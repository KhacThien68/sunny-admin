import { useState, useEffect } from 'react'
import {
  Typography,
  Space,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Popconfirm,
  Modal,
  Form,
  AutoComplete,
  InputNumber,
  App,
} from 'antd'
import type { TablePaginationConfig } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import ImportExcelButton from '../../components/ImportExcelButton'
import {
  getComponents,
  getComponentClassifications,
  createComponent,
  updateComponent,
  deleteComponent,
} from '../../api/components'
import type { Component, MobType } from '../../api/components'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

const MOB_LABELS: Record<MobType, string> = {
  KHONG: 'Sản xuất',
  CO_THE: 'Có thể mua',
  BAT_BUOC: 'Bắt buộc mua',
}

const MOB_COLORS: Record<MobType, string | undefined> = {
  KHONG: undefined,
  CO_THE: 'blue',
  BAT_BUOC: 'red',
}

interface FormValues {
  code: string
  classification?: string
  description?: string
  uom: string
  mob: MobType
  moq?: number
  inventoryLevel?: number
}

export default function ComponentsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('COMPONENTS')

  const [searchParams, setSearchParams] = useSearchParams()

  // Filter / pagination state
  const [search, setSearch] = useState('')
  const [classification, setClassification] = useState<string | undefined>(
    undefined,
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<Component | null>(
    null,
  )
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined)
  const [form] = Form.useForm<FormValues>()

  // Prefill support — BoM screen deep-links with ?prefill=SOME_CODE
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill && canCreate) {
      // Open add modal with code prefilled
      setEditingComponent(null)
      setPrefillCode(prefill)
      setModalOpen(true)
      // Remove the param so refreshing doesn't re-open
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('prefill')
        return next
      })
    }
  }, [searchParams, canCreate, setSearchParams])

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['components', { search, classification, page, pageSize }],
    queryFn: () =>
      getComponents({
        search: search || undefined,
        classification: classification || undefined,
        page,
        pageSize,
      }),
  })

  const { data: classifications = [] } = useQuery({
    queryKey: ['components', 'classifications'],
    queryFn: getComponentClassifications,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createComponent,
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      setPrefillCode(undefined)
      void queryClient.invalidateQueries({ queryKey: ['components'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo mã'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormValues> }) =>
      updateComponent(id, body),
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['components'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật mã'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComponent,
    onSuccess: () => {
      void message.success('Đã xóa')
      void queryClient.invalidateQueries({ queryKey: ['components'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa mã'))
    },
  })

  function openAdd() {
    setEditingComponent(null)
    setPrefillCode(undefined)
    setModalOpen(true)
  }

  function openEdit(record: Component) {
    setEditingComponent(record)
    setModalOpen(true)
  }

  function handleModalOk() {
    form
      .validateFields()
      .then((values) => {
        if (editingComponent) {
          // code is not allowed in PATCH
          const { code: _code, ...rest } = values
          void _code // suppress unused warning
          updateMutation.mutate({ id: editingComponent.id, body: rest })
        } else {
          createMutation.mutate(values)
        }
      })
      .catch(() => {
        // validation errors shown by antd
      })
  }

  function handleTableChange(pagination: TablePaginationConfig) {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 20)
  }

  const classificationOptions = classifications.map((c) => ({ value: c }))

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      fixed: 'left' as const,
      width: 140,
    },
    {
      title: 'Phân loại',
      dataIndex: 'classification',
      key: 'classification',
      width: 120,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Đơn vị',
      dataIndex: 'uom',
      key: 'uom',
      width: 80,
    },
    {
      title: 'Mua/Sản xuất',
      dataIndex: 'mob',
      key: 'mob',
      width: 140,
      render: (mob: MobType) => (
        <Tag color={MOB_COLORS[mob]}>{MOB_LABELS[mob]}</Tag>
      ),
    },
    {
      title: 'MoQ',
      dataIndex: 'moq',
      key: 'moq',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'Tồn định mức',
      dataIndex: 'inventoryLevel',
      key: 'inventoryLevel',
      width: 120,
      align: 'right' as const,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Component) => (
        <Space>
          {canUpdate && (
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              Sửa
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Xóa mã này?"
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending

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
          Quản lý mã
        </Title>
        <Space wrap>
          <Input.Search
            placeholder="Tìm theo mã hoặc mô tả"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => {
              setSearch(v)
              setPage(1)
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setSearch('')
                setPage(1)
              }
            }}
          />
          <Select
            allowClear
            placeholder="Phân loại"
            style={{ width: 160 }}
            options={classifications.map((c) => ({ label: c, value: c }))}
            value={classification}
            onChange={(v) => {
              setClassification(v as string | undefined)
              setPage(1)
            }}
          />
          {canCreate && (
            <ImportExcelButton
              templateUrl="/components/template"
              importUrl="/components/import"
              templateFileName="component_template.xlsx"
              onDone={() =>
                void queryClient.invalidateQueries({ queryKey: ['components'] })
              }
            />
          )}
          {canCreate && (
            <Button type="primary" onClick={openAdd}>
              Thêm mã
            </Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          total: data?.total ?? 0,
          current: page,
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Tổng ${total} mã`,
        }}
        onChange={handleTableChange}
        size="small"
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingComponent ? 'Sửa mã' : 'Thêm mã'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setPrefillCode(undefined) }}
        onOk={handleModalOk}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={isSubmitting}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editingComponent
              ? {
                  code: editingComponent.code,
                  classification: editingComponent.classification ?? undefined,
                  description: editingComponent.description ?? undefined,
                  uom: editingComponent.uom,
                  mob: editingComponent.mob,
                  moq: editingComponent.moq,
                  inventoryLevel: editingComponent.inventoryLevel,
                }
              : { uom: 'PC', code: prefillCode }
          }
        >
          <Form.Item
            name="code"
            label="Mã"
            rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
          >
            <Input disabled={!!editingComponent} placeholder="VD: COMP-001" />
          </Form.Item>

          <Form.Item name="classification" label="Phân loại">
            <AutoComplete
              options={classificationOptions}
              placeholder="Nhập hoặc chọn phân loại"
              filterOption={(inputValue, option) =>
                (option?.value ?? '')
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input placeholder="Mô tả ngắn" />
          </Form.Item>

          <Form.Item
            name="uom"
            label="Đơn vị"
            rules={[{ required: true, message: 'Vui lòng nhập đơn vị' }]}
            initialValue="PC"
          >
            <Input placeholder="VD: PC, KG, M" />
          </Form.Item>

          <Form.Item
            name="mob"
            label="Mua/Sản xuất"
            rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
          >
            <Select
              options={[
                { label: 'Không (sản xuất)', value: 'KHONG' },
                { label: 'Có thể mua', value: 'CO_THE' },
                { label: 'Bắt buộc mua', value: 'BAT_BUOC' },
              ]}
              placeholder="Chọn loại"
            />
          </Form.Item>

          <Form.Item name="moq" label="MoQ">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="inventoryLevel" label="Tồn định mức">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
