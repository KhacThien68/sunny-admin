import { useState, useCallback } from 'react'
import {
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Popconfirm,
  Modal,
  Form,
  Input,
  InputNumber,
  AutoComplete,
  Card,
  Empty,
  App,
} from 'antd'
import {
  CalculatorOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import ImportExcelButton from '../../components/ImportExcelButton'
import UnregisteredCode from '../../components/UnregisteredCode'
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  aggregateOrders,
  getLatestAggregation,
} from '../../api/orders'
import type { OrderSummary, OrderDetail, AggregationResult } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { ENDPOINTS } from '../../constants/endpoints'
import { getErrorMessage } from '../../utils/errorMessage'
import { apiClient } from '../../api/client'

const { Title } = Typography

interface ComponentSearchItem {
  code: string
  description: string | null
}

interface LineFormValue {
  componentCode: string
  quantity: number
}

interface OrderFormValues {
  customerGroup: string
  note?: string
  code?: string
  lines: LineFormValue[]
}

async function searchComponentOptions(
  search: string,
): Promise<ComponentSearchItem[]> {
  if (!search || search.length < 1) return []
  const res = await apiClient.get<{ items: ComponentSearchItem[] }>(
    ENDPOINTS.components.base,
    {
      params: { search, pageSize: 20 },
    },
  )
  return res.data.items
}

export default function OrdersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('ORDERS')
  const compPerm = usePermission('COMPONENTS')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<OrderDetail | null>(null)
  const [editingOrder, setEditingOrder] = useState<OrderSummary | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Aggregation result modal
  const [aggResultOpen, setAggResultOpen] = useState(false)
  const [aggResult, setAggResult] = useState<AggregationResult | null>(null)

  // Component search per-line autocomplete
  const [lineOptions, setLineOptions] = useState<
    Record<number, ComponentSearchItem[]>
  >({})

  const [form] = Form.useForm<OrderFormValues>()

  // Queries
  const { data: orders = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.orders,
    queryFn: getOrders,
  })

  const { data: latestAggregation, isLoading: aggLoading } = useQuery({
    queryKey: QUERY_KEYS.latestAggregation,
    queryFn: getLatestAggregation,
    retry: false,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      void message.success('Đã tạo đơn hàng')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo đơn hàng'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: Parameters<typeof updateOrder>[1]
    }) => updateOrder(id, body),
    onSuccess: () => {
      void message.success('Đã cập nhật đơn hàng')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật đơn hàng'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      void message.success('Đã xóa đơn hàng')
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa đơn hàng'))
    },
  })

  const aggregateMutation = useMutation({
    mutationFn: aggregateOrders,
    onSuccess: (result) => {
      void message.success('Tổng hợp thành công')
      setAggResult(result)
      setAggResultOpen(true)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders })
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestAggregation,
      })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tổng hợp'))
    },
  })

  async function openAdd() {
    setEditingOrder(null)
    setViewingOrder(null)
    setLineOptions({})
    form.resetFields()
    form.setFieldsValue({ lines: [{ componentCode: '', quantity: 1 }] })
    setModalOpen(true)
  }

  async function openViewEdit(record: OrderSummary) {
    setLoadingDetail(true)
    setEditingOrder(record)
    setViewingOrder(null)
    setLineOptions({})
    try {
      const detail = await getOrder(record.id)
      setViewingOrder(detail)
      form.setFieldsValue({
        customerGroup: detail.customerGroup,
        note: detail.note ?? undefined,
        code: detail.code,
        lines: detail.lines.map((l) => ({
          componentCode: l.componentCode,
          quantity: l.quantity,
        })),
      })
      setModalOpen(true)
    } catch (err) {
      void message.error(
        getErrorMessage(err, 'Không thể tải chi tiết đơn hàng'),
      )
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleModalOk() {
    if (viewingOrder?.status === 'AGGREGATED') {
      setModalOpen(false)
      return
    }
    form
      .validateFields()
      .then((values) => {
        const lines = (values.lines ?? []).map((l: LineFormValue) => ({
          componentCode: l.componentCode,
          quantity: l.quantity,
        }))
        if (editingOrder) {
          updateMutation.mutate({
            id: editingOrder.id,
            body: {
              customerGroup: values.customerGroup,
              note: values.note,
              lines,
            },
          })
        } else {
          createMutation.mutate({
            customerGroup: values.customerGroup,
            note: values.note,
            code: values.code || undefined,
            lines,
          })
        }
      })
      .catch(() => {})
  }

  const handleLineSearch = useCallback(
    async (index: number, search: string) => {
      if (!search) {
        setLineOptions((prev) => ({ ...prev, [index]: [] }))
        return
      }
      try {
        const items = await searchComponentOptions(search)
        setLineOptions((prev) => ({ ...prev, [index]: items }))
      } catch {
        // ignore search errors
      }
    },
    [],
  )

  const isReadOnly = viewingOrder?.status === 'AGGREGATED'
  const isEditing = !!editingOrder
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const getLineOptions = (index: number) =>
    (lineOptions[index] ?? []).map((c) => ({
      value: c.code,
      label: `${c.code}${c.description ? ` — ${c.description}` : ''}`,
    }))

  const modalTitle = isReadOnly
    ? 'Xem đơn hàng'
    : isEditing
      ? 'Sửa đơn hàng'
      : 'Thêm đơn hàng'

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'code',
      key: 'code',
      width: 160,
    },
    {
      title: 'Nhóm khách hàng',
      dataIndex: 'customerGroup',
      key: 'customerGroup',
    },
    {
      title: 'Số dòng',
      dataIndex: 'lineCount',
      key: 'lineCount',
      width: 90,
      align: 'center' as const,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) =>
        status === 'DRAFT' ? (
          <Tag color="blue">Chờ tổng hợp</Tag>
        ) : (
          <Tag>Đã tổng hợp</Tag>
        ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: OrderSummary) => (
        <Space>
          <Button
            type="link"
            size="small"
            loading={loadingDetail && editingOrder?.id === record.id}
            onClick={() => void openViewEdit(record)}
          >
            {record.status === 'DRAFT' && canUpdate ? 'Xem/Sửa' : 'Xem'}
          </Button>
          {record.status === 'DRAFT' && canDelete && (
            <Popconfirm
              title="Xóa đơn hàng này?"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button type="link" size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const aggResultColumns = [
    {
      title: 'Mã',
      dataIndex: 'componentCode',
      key: 'componentCode',
    },
    {
      title: 'Tổng số lượng',
      dataIndex: 'totalQty',
      key: 'totalQty',
      width: 140,
      align: 'right' as const,
    },
  ]

  const latestAggColumns = [
    {
      title: 'Mã',
      dataIndex: 'componentCode',
      key: 'componentCode',
      render: (
        _: unknown,
        record: { componentCode: string; registered: boolean },
      ) => (
        <UnregisteredCode
          code={record.componentCode}
          registered={record.registered}
          canCreateComponent={compPerm.canCreate}
        />
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Tổng số lượng',
      dataIndex: 'totalQty',
      key: 'totalQty',
      width: 140,
      align: 'right' as const,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Đơn hàng
        </Title>
        <Space wrap>
          {canCreate && (
            <ImportExcelButton
              templateUrl={ENDPOINTS.orders.template}
              importUrl={ENDPOINTS.orders.import}
              templateFileName="orders_template.xlsx"
              onDone={() => {
                void queryClient.invalidateQueries({
                  queryKey: QUERY_KEYS.orders,
                })
                void queryClient.invalidateQueries({
                  queryKey: QUERY_KEYS.latestAggregation,
                })
              }}
            />
          )}
          {canCreate && (
            <Button type="primary" onClick={() => void openAdd()}>
              Thêm đơn hàng
            </Button>
          )}
          {canCreate && (
            <Popconfirm
              title="Gộp tất cả đơn hàng chờ tổng hợp thành nhu cầu tổng?"
              onConfirm={() => aggregateMutation.mutate()}
              okText="Tổng hợp"
              cancelText="Hủy"
            >
              <Button
                icon={<CalculatorOutlined />}
                loading={aggregateMutation.isPending}
              >
                Tổng hợp
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* Orders Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={orders}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total) => `Tổng ${total} đơn`,
        }}
        size="small"
      />

      {/* Latest Aggregation Card */}
      <Card title="Lần tổng hợp gần nhất" size="small" loading={aggLoading}>
        {latestAggregation ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Thời điểm:{' '}
              {dayjs(latestAggregation.createdAt).format('DD/MM/YYYY HH:mm')}
            </Typography.Text>
            <Table
              rowKey="componentCode"
              dataSource={latestAggregation.lines}
              columns={latestAggColumns}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Space>
        ) : (
          <Empty description="Chưa có lần tổng hợp nào" />
        )}
      </Card>

      {/* Add / Edit / View Modal */}
      <Modal
        title={modalTitle}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingOrder(null)
          setViewingOrder(null)
        }}
        onOk={handleModalOk}
        okText={isReadOnly ? 'Đóng' : 'Lưu'}
        cancelText="Hủy"
        cancelButtonProps={
          isReadOnly ? { style: { display: 'none' } } : undefined
        }
        confirmLoading={isSubmitting}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customerGroup"
            label="Nhóm khách hàng"
            rules={[
              { required: true, message: 'Vui lòng nhập nhóm khách hàng' },
            ]}
          >
            <Input disabled={isReadOnly} placeholder="VD: KH-01" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input disabled={isReadOnly} placeholder="Ghi chú (tuỳ chọn)" />
          </Form.Item>

          <Form.Item name="code" label="Mã đơn hàng">
            <Input
              disabled={isReadOnly || isEditing}
              placeholder="Tự sinh nếu để trống"
            />
          </Form.Item>

          {/* Lines */}
          <Form.List
            name="lines"
            rules={[
              {
                validator: async (_, lines) => {
                  if (!lines || lines.length === 0) {
                    return Promise.reject(new Error('Phải có ít nhất 1 dòng'))
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>Dòng đơn hàng</Typography.Text>
                </div>
                {fields.map((field, index) => {
                  const { key: _fieldKey, ...fieldRest } = field
                  return (
                    <div
                      key={field.key}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        marginBottom: 8,
                      }}
                    >
                      <Form.Item
                        {...fieldRest}
                        name={[field.name, 'componentCode']}
                        rules={[{ required: true, message: 'Nhập mã' }]}
                        style={{ flex: 1, margin: 0 }}
                      >
                        <AutoComplete
                          options={getLineOptions(index)}
                          onSearch={(val) => void handleLineSearch(index, val)}
                          filterOption={false}
                          placeholder="Tìm hoặc nhập mã"
                          disabled={isReadOnly}
                        />
                      </Form.Item>
                      <Form.Item
                        {...fieldRest}
                        name={[field.name, 'quantity']}
                        rules={[
                          { required: true, message: 'Nhập SL' },
                          {
                            type: 'number',
                            min: 1,
                            message: 'SL > 0',
                          },
                        ]}
                        style={{ width: 120, margin: 0 }}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          placeholder="Số lượng"
                          disabled={isReadOnly}
                        />
                      </Form.Item>
                      {!isReadOnly && (
                        <Button
                          type="text"
                          icon={<MinusCircleOutlined />}
                          danger
                          onClick={() => remove(field.name)}
                          style={{ marginTop: 4 }}
                        />
                      )}
                    </div>
                  )
                })}
                {!isReadOnly && (
                  <Button
                    type="dashed"
                    onClick={() => add({ componentCode: '', quantity: 1 })}
                    icon={<PlusOutlined />}
                    block
                    style={{ marginBottom: 8 }}
                  >
                    Thêm dòng
                  </Button>
                )}
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Aggregation Result Modal */}
      <Modal
        title="Kết quả tổng hợp"
        open={aggResultOpen}
        onCancel={() => setAggResultOpen(false)}
        onOk={() => setAggResultOpen(false)}
        okText="Đóng"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={520}
      >
        {aggResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Thời điểm: {dayjs(aggResult.createdAt).format('DD/MM/YYYY HH:mm')}
            </Typography.Text>
            <Table
              rowKey="componentCode"
              dataSource={aggResult.lines}
              columns={aggResultColumns}
              size="small"
              pagination={false}
              scroll={{ y: 320 }}
            />
          </Space>
        )}
      </Modal>
    </Space>
  )
}
