import { useState } from 'react'
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
  Alert,
  App,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import {
  getPurchasingTeams,
  createPurchasingTeam,
  updatePurchasingTeam,
  deletePurchasingTeam,
  getUnassignedComponents,
} from '../../api/purchasingTeams'
import type { PurchasingTeamSummary, Component, MobType } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { MOB_LABELS, MOB_COLORS } from '../../constants/labels'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

interface TeamFormValues {
  name: string
  description?: string
}

export default function TeamsListPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { canCreate, canUpdate, canDelete } = usePermission('PURCHASING_TEAMS')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<PurchasingTeamSummary | null>(
    null,
  )
  const [form] = Form.useForm<TeamFormValues>()

  const [unassignedModalOpen, setUnassignedModalOpen] = useState(false)
  const [alertClosed, setAlertClosed] = useState(false)

  const { data: teams = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.purchasingTeams,
    queryFn: getPurchasingTeams,
  })

  const { data: unassigned = [] } = useQuery({
    queryKey: QUERY_KEYS.unassignedComponents,
    queryFn: getUnassignedComponents,
  })

  const createMutation = useMutation({
    mutationFn: createPurchasingTeam,
    onSuccess: () => {
      void message.success('Đã tạo team')
      setModalOpen(false)
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.purchasingTeams,
      })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo team'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TeamFormValues }) =>
      updatePurchasingTeam(id, body),
    onSuccess: () => {
      void message.success('Đã lưu')
      setModalOpen(false)
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.purchasingTeams,
      })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật team'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchasingTeam,
    onSuccess: () => {
      void message.success('Đã xóa team')
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.purchasingTeams,
      })
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.unassignedComponents,
      })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa team'))
    },
  })

  function openAdd() {
    setEditingTeam(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(record: PurchasingTeamSummary) {
    setEditingTeam(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? undefined,
    })
    setModalOpen(true)
  }

  function handleModalOk() {
    form
      .validateFields()
      .then((values) => {
        if (editingTeam) {
          updateMutation.mutate({ id: editingTeam.id, body: values })
        } else {
          createMutation.mutate(values)
        }
      })
      .catch(() => {})
  }

  function handleModalCancel() {
    setModalOpen(false)
    setEditingTeam(null)
    form.resetFields()
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = [
    {
      title: 'Tên team',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: PurchasingTeamSummary) => (
        <Link
          to={`/purchasing-teams/${record.id}`}
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </Link>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Thành viên',
      dataIndex: 'memberCount',
      key: 'memberCount',
      align: 'center' as const,
      width: 110,
    },
    {
      title: 'Phạm vi phụ trách',
      dataIndex: 'scopeCount',
      key: 'scopeCount',
      align: 'center' as const,
      width: 140,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: PurchasingTeamSummary) => (
        <Space>
          {canUpdate && (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(record)
              }}
            >
              Sửa
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Xóa team sẽ xóa cả thành viên và phạm vi phụ trách?"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              onPopupClick={(e) => e.stopPropagation()}
            >
              <Button
                type="link"
                size="small"
                danger
                onClick={(e) => e.stopPropagation()}
              >
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const unassignedColumns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
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
      title: 'MoB',
      dataIndex: 'mob',
      key: 'mob',
      width: 140,
      render: (mob: MobType) => (
        <Tag color={MOB_COLORS[mob]}>{MOB_LABELS[mob]}</Tag>
      ),
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Unassigned components alert */}
      {!alertClosed && unassigned.length > 0 && (
        <Alert
          type="warning"
          closable
          onClose={() => setAlertClosed(true)}
          message={
            <Space>
              <span>
                Còn {unassigned.length} mã có thể mua chưa có team phụ trách
              </span>
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => setUnassignedModalOpen(true)}
              >
                Xem danh sách
              </Button>
            </Space>
          }
        />
      )}

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
          Team mua hàng
        </Title>
        {canCreate && (
          <Button type="primary" onClick={openAdd}>
            Thêm team
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={teams}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total) => `Tổng ${total} team`,
        }}
        size="small"
        onRow={(record) => ({
          onClick: () => navigate(`/purchasing-teams/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingTeam ? 'Sửa team' : 'Thêm team'}
        open={modalOpen}
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={isSubmitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Tên team"
            rules={[{ required: true, message: 'Vui lòng nhập tên team' }]}
          >
            <Input placeholder="VD: Team mua hàng A" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về team" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Unassigned components modal */}
      <Modal
        title={`Mã có thể mua chưa có team phụ trách (${unassigned.length})`}
        open={unassignedModalOpen}
        onCancel={() => setUnassignedModalOpen(false)}
        footer={
          <Button onClick={() => setUnassignedModalOpen(false)}>Đóng</Button>
        }
        width={700}
        destroyOnHidden
      >
        <Table
          rowKey="code"
          dataSource={unassigned as Component[]}
          columns={unassignedColumns}
          pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} mã` }}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Modal>
    </Space>
  )
}
