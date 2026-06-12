import { useState } from 'react'
import {
  Typography,
  Space,
  Button,
  Table,
  Popconfirm,
  Modal,
  Form,
  AutoComplete,
  InputNumber,
  Alert,
  App,
} from 'antd'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import ImportExcelButton from '../../components/ImportExcelButton'
import UnregisteredCode from '../../components/UnregisteredCode'
import {
  getOnhand,
  upsertOnhand,
  deleteOnhand,
  searchComponents,
} from '../../api/onhand'
import type { OnhandItem } from '../../api/onhand'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

interface EditingState {
  id: number
  value: number
}

interface AddRowFormValues {
  componentCode: string
  quantity: number
}

export default function OnhandPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('ONHAND')
  const compPerm = usePermission('COMPONENTS')

  // Inline editing state
  const [editing, setEditing] = useState<EditingState | null>(null)

  // Add modal state
  const [addOpen, setAddOpen] = useState(false)
  const [codeSearch, setCodeSearch] = useState('')
  const [addForm] = Form.useForm<AddRowFormValues>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['onhand'],
    queryFn: getOnhand,
  })

  const { data: componentSearchData } = useQuery({
    queryKey: ['components-search', codeSearch],
    queryFn: () => searchComponents(codeSearch, 30),
    enabled: addOpen,
  })

  const upsertMutation = useMutation({
    mutationFn: ({ code, qty }: { code: string; qty: number }) =>
      upsertOnhand(code, qty),
    onSuccess: () => {
      void message.success('Đã lưu')
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ['onhand'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật tồn kho'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOnhand,
    onSuccess: () => {
      void message.success('Đã xóa')
      void queryClient.invalidateQueries({ queryKey: ['onhand'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa'))
    },
  })

  function handleQtyClick(record: OnhandItem) {
    if (!canUpdate) return
    setEditing({ id: record.id, value: record.quantity })
  }

  function commitEdit(record: OnhandItem) {
    if (!editing || editing.id !== record.id) return
    if (editing.value !== record.quantity) {
      upsertMutation.mutate({ code: record.componentCode, qty: editing.value })
    } else {
      setEditing(null)
    }
  }

  function cancelEdit() {
    setEditing(null)
  }

  function handleAddOk() {
    addForm
      .validateFields()
      .then((values) => {
        upsertMutation.mutate(
          { code: values.componentCode, qty: values.quantity },
          {
            onSuccess: () => {
              setAddOpen(false)
              addForm.resetFields()
              void queryClient.invalidateQueries({ queryKey: ['onhand'] })
            },
          },
        )
      })
      .catch(() => {})
  }

  function handleAddCancel() {
    setAddOpen(false)
    addForm.resetFields()
    setCodeSearch('')
  }

  const codeOptions = (componentSearchData?.items ?? []).map((c) => ({
    value: c.code,
    label: `${c.code}${c.description ? ` — ${c.description}` : ''}`,
  }))

  const columns = [
    {
      title: 'Mã thành phần',
      dataIndex: 'componentCode',
      key: 'componentCode',
      width: 180,
      render: (_: unknown, record: OnhandItem) => (
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
      title: 'Tồn thực tế',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 160,
      align: 'right' as const,
      render: (qty: number, record: OnhandItem) => {
        if (canUpdate && editing && editing.id === record.id) {
          return (
            <InputNumber
              autoFocus
              min={0}
              value={editing.value}
              onChange={(v) => {
                if (v !== null) setEditing({ id: record.id, value: v })
              }}
              onBlur={() => commitEdit(record)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit(record)
                if (e.key === 'Escape') cancelEdit()
              }}
              style={{ width: 120 }}
              size="small"
            />
          )
        }
        return (
          <span
            style={canUpdate ? { cursor: 'pointer', textDecoration: 'underline dotted' } : undefined}
            onClick={() => handleQtyClick(record)}
            title={canUpdate ? 'Click để sửa' : undefined}
          >
            {qty}
          </span>
        )
      },
    },
    {
      title: 'Cập nhật lúc',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: OnhandItem) =>
        canDelete ? (
          <Popconfirm
            title="Xóa dòng này?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="link" size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Info alert */}
      <Alert
        type="info"
        showIcon
        message="Mã không nhập tồn được tính bằng 0 khi chạy MRP"
        closable={false}
      />

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
          Hàng thực tế
        </Title>
        <Space wrap>
          {canCreate && (
            <ImportExcelButton
              templateUrl="/onhand/template"
              importUrl="/onhand/import"
              templateFileName="onhand_template.xlsx"
              onDone={() =>
                void queryClient.invalidateQueries({ queryKey: ['onhand'] })
              }
            />
          )}
          {canCreate && (
            <Button type="primary" onClick={() => setAddOpen(true)}>
              Thêm dòng
            </Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Tổng ${total} dòng`,
        }}
        size="small"
      />

      {/* Add Row Modal */}
      <Modal
        title="Thêm dòng tồn kho"
        open={addOpen}
        onCancel={handleAddCancel}
        onOk={handleAddOk}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={upsertMutation.isPending}
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="componentCode"
            label="Mã thành phần"
            rules={[{ required: true, message: 'Vui lòng nhập mã thành phần' }]}
          >
            <AutoComplete
              options={codeOptions}
              onSearch={setCodeSearch}
              placeholder="Tìm hoặc nhập mã"
              filterOption={false}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Số lượng tồn"
            rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
