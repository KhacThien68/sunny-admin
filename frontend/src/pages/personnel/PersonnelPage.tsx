import { useState, useMemo } from 'react'
import {
  Typography,
  Space,
  Input,
  Button,
  Table,
  Popconfirm,
  Modal,
  Form,
  App,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import ImportExcelButton from '../../components/ImportExcelButton'
import {
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
} from '../../api/personnel'
import type { Personnel } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { ENDPOINTS } from '../../constants/endpoints'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

interface FormValues {
  name: string
  email: string
  position?: string
  team?: string
  phone?: string
}

export default function PersonnelPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('PERSONNEL')

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Personnel | null>(null)
  const [form] = Form.useForm<FormValues>()

  const { data = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.personnel,
    queryFn: getPersonnel,
  })

  // Client-side filter
  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    )
  }, [data, search])

  const createMutation = useMutation({
    mutationFn: createPersonnel,
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.personnel })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo nhân sự'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormValues> }) =>
      updatePersonnel(id, body),
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.personnel })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật nhân sự'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePersonnel,
    onSuccess: () => {
      void message.success('Đã xóa')
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.personnel })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa nhân sự'))
    },
  })

  function openAdd() {
    setEditingRecord(null)
    setModalOpen(true)
  }

  function openEdit(record: Personnel) {
    setEditingRecord(record)
    setModalOpen(true)
  }

  function handleModalOk() {
    form
      .validateFields()
      .then((values) => {
        if (editingRecord) {
          updateMutation.mutate({ id: editingRecord.id, body: values })
        } else {
          createMutation.mutate(values)
        }
      })
      .catch(() => {})
  }

  function handleModalCancel() {
    setModalOpen(false)
    setEditingRecord(null)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = [
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Chức vụ',
      dataIndex: 'position',
      key: 'position',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Bộ phận',
      dataIndex: 'team',
      key: 'team',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Mail',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Personnel) => (
        <Space>
          {canUpdate && (
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              Sửa
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Xóa nhân sự này?"
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
          Nhân sự
        </Title>
        <Space wrap>
          <Input.Search
            placeholder="Tìm theo tên hoặc email"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => setSearch(v)}
            onChange={(e) => {
              if (!e.target.value) setSearch('')
            }}
          />
          {canCreate && (
            <ImportExcelButton
              templateUrl={ENDPOINTS.personnel.template}
              importUrl={ENDPOINTS.personnel.import}
              templateFileName="personnel_template.xlsx"
              onDone={() =>
                void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.personnel })
              }
            />
          )}
          {canCreate && (
            <Button type="primary" onClick={openAdd}>
              Thêm nhân sự
            </Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Tổng ${total} nhân sự`,
        }}
        size="small"
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingRecord ? 'Sửa nhân sự' : 'Thêm nhân sự'}
        open={modalOpen}
        onCancel={handleModalCancel}
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
            editingRecord
              ? {
                  name: editingRecord.name,
                  email: editingRecord.email,
                  position: editingRecord.position ?? undefined,
                  team: editingRecord.team ?? undefined,
                  phone: editingRecord.phone ?? undefined,
                }
              : undefined
          }
        >
          <Form.Item
            name="name"
            label="Tên"
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="example@company.com" />
          </Form.Item>

          <Form.Item name="position" label="Chức vụ">
            <Input placeholder="Kỹ sư, Quản lý, ..." />
          </Form.Item>

          <Form.Item name="team" label="Bộ phận">
            <Input placeholder="IT, Sản xuất, ..." />
          </Form.Item>

          <Form.Item name="phone" label="Điện thoại">
            <Input placeholder="0901234567" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
