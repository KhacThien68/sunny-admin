import { useState, useMemo } from 'react'
import {
  Typography,
  Space,
  Input,
  Button,
  Table,
  Tag,
  Switch,
  Popconfirm,
  Modal,
  Form,
  App,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import { useAuth } from '../../stores/auth'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../../api/users'
import type { User } from '../../api/users'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

interface FormValues {
  name: string
  email: string
  password?: string
  position?: string
  team?: string
  phone?: string
  isAdmin: boolean
  isActive: boolean
}

export default function UsersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('USERS')
  const currentUser = useAuth((s) => s.user)

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<User | null>(null)
  const [form] = Form.useForm<FormValues>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  // Client-side filter by name or email
  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [data, search])

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void message.success('Đã tạo người dùng')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo người dùng'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FormValues> }) =>
      updateUser(id, body),
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật người dùng'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void message.success('Đã xóa người dùng')
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa người dùng'))
    },
  })

  function openAdd() {
    setEditingRecord(null)
    setModalOpen(true)
  }

  function openEdit(record: User) {
    setEditingRecord(record)
    setModalOpen(true)
  }

  function handleModalOk() {
    form
      .validateFields()
      .then((values) => {
        if (editingRecord) {
          // Only send password if user filled it in
          const body: Partial<FormValues> = { ...values }
          if (!body.password) {
            delete body.password
          }
          updateMutation.mutate({ id: editingRecord.id, body })
        } else {
          createMutation.mutate({
            name: values.name,
            email: values.email,
            password: values.password!,
            position: values.position,
            team: values.team,
            phone: values.phone,
            isAdmin: values.isAdmin,
            isActive: values.isActive,
          })
        }
      })
      .catch(() => {
        // antd shows validation errors inline
      })
  }

  function handleModalCancel() {
    setModalOpen(false)
    setEditingRecord(null)
  }

  function handleToggleActive(record: User, checked: boolean) {
    updateMutation.mutate({ id: record.id, body: { isActive: checked } })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const isEditing = !!editingRecord

  const columns = [
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
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
      title: 'Quản trị',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      width: 100,
      render: (isAdmin: boolean) =>
        isAdmin ? <Tag color="gold">Admin</Tag> : '—',
    },
    {
      title: 'Hoạt động',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean, record: User) => {
        const isSelf = currentUser?.id === record.id
        if (canUpdate) {
          return (
            <Switch
              checked={isActive}
              disabled={isSelf}
              onChange={(checked) => handleToggleActive(record, checked)}
              size="small"
            />
          )
        }
        return (
          <Tag color={isActive ? 'green' : 'default'}>
            {isActive ? 'Hoạt động' : 'Khóa'}
          </Tag>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: User) => {
        const isSelf = currentUser?.id === record.id
        return (
          <Space>
            {canUpdate && (
              <Button type="link" size="small" onClick={() => openEdit(record)}>
                Sửa
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="Xóa người dùng này?"
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText="Xóa"
                cancelText="Hủy"
                disabled={isSelf}
              >
                <Button type="link" size="small" danger disabled={isSelf}>
                  Xóa
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
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
          Quản trị người dùng
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
            <Button type="primary" onClick={openAdd}>
              Thêm người dùng
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
          showTotal: (total) => `Tổng ${total} người dùng`,
        }}
        size="small"
      />

      {/* Add / Edit Modal */}
      <Modal
        title={isEditing ? 'Sửa người dùng' : 'Thêm người dùng'}
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
                  isAdmin: editingRecord.isAdmin,
                  isActive: editingRecord.isActive,
                }
              : { isAdmin: false, isActive: true }
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
            <Input placeholder="example@company.com" type="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label={isEditing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}
            rules={
              isEditing
                ? [
                    {
                      min: 6,
                      message: 'Mật khẩu phải ít nhất 6 ký tự',
                    },
                  ]
                : [
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 6, message: 'Mật khẩu phải ít nhất 6 ký tự' },
                  ]
            }
          >
            <Input.Password placeholder={isEditing ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'} />
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

          <Form.Item name="isAdmin" label="Quản trị viên" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
