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
  Select,
  Radio,
  Row,
  Col,
  Card,
  Result,
  Tooltip,
  App,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import {
  getPurchasingTeam,
  addTeamMember,
  removeTeamMember,
  addTeamScope,
  removeTeamScope,
} from '../../api/purchasingTeams'
import type { TeamMember, TeamScope } from '../../api/purchasingTeams'
import { getPersonnel } from '../../api/personnel'
import { getComponentClassifications, getComponents } from '../../api/components'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title, Text } = Typography

type ScopeMode = 'classification' | 'component'

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const teamId = Number(id)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canUpdate } = usePermission('PURCHASING_TEAMS')

  // Member select state
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined)

  // Scope modal state
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [scopeMode, setScopeMode] = useState<ScopeMode>('classification')
  const [scopeClassification, setScopeClassification] = useState<string | undefined>(undefined)
  const [scopeComponentCode, setScopeComponentCode] = useState<string | undefined>(undefined)
  const [componentSearch, setComponentSearch] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: team,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['purchasing-team', teamId],
    queryFn: () => getPurchasingTeam(teamId),
    enabled: !isNaN(teamId),
    retry: (failureCount, error) => {
      // Don't retry on 404
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) return false
      return failureCount < 3
    },
  })

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
  })

  const { data: classifications = [] } = useQuery({
    queryKey: ['component-classifications'],
    queryFn: getComponentClassifications,
    enabled: scopeModalOpen && scopeMode === 'classification',
  })

  const { data: componentsData } = useQuery({
    queryKey: ['components-search', componentSearch],
    queryFn: () => getComponents({ search: componentSearch, pageSize: 50 }),
    enabled: scopeModalOpen && scopeMode === 'component',
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => addTeamMember(teamId, { userId }),
    onSuccess: () => {
      void message.success('Đã thêm nhân sự')
      setSelectedUserId(undefined)
      void queryClient.invalidateQueries({ queryKey: ['purchasing-team', teamId] })
      void queryClient.invalidateQueries({ queryKey: ['purchasing-teams'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi thêm nhân sự'))
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => removeTeamMember(teamId, memberId),
    onSuccess: () => {
      void message.success('Đã xóa thành viên')
      void queryClient.invalidateQueries({ queryKey: ['purchasing-team', teamId] })
      void queryClient.invalidateQueries({ queryKey: ['purchasing-teams'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa thành viên'))
    },
  })

  const addScopeMutation = useMutation({
    mutationFn: (body: Parameters<typeof addTeamScope>[1]) =>
      addTeamScope(teamId, body),
    onSuccess: () => {
      void message.success('Đã thêm phạm vi')
      closeScopeModal()
      void queryClient.invalidateQueries({ queryKey: ['purchasing-team', teamId] })
      void queryClient.invalidateQueries({ queryKey: ['purchasing-teams'] })
      void queryClient.invalidateQueries({ queryKey: ['unassigned-components'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi thêm phạm vi'))
    },
  })

  const removeScopeMutation = useMutation({
    mutationFn: (scopeId: number) => removeTeamScope(teamId, scopeId),
    onSuccess: () => {
      void message.success('Đã xóa phạm vi')
      void queryClient.invalidateQueries({ queryKey: ['purchasing-team', teamId] })
      void queryClient.invalidateQueries({ queryKey: ['purchasing-teams'] })
      void queryClient.invalidateQueries({ queryKey: ['unassigned-components'] })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa phạm vi'))
    },
  })

  // ── Helpers ────────────────────────────────────────────────────────────────

  function closeScopeModal() {
    setScopeModalOpen(false)
    setScopeMode('classification')
    setScopeClassification(undefined)
    setScopeComponentCode(undefined)
    setComponentSearch('')
  }

  function handleAddScope() {
    if (scopeMode === 'classification') {
      if (!scopeClassification) {
        void message.warning('Vui lòng chọn nhóm hàng')
        return
      }
      addScopeMutation.mutate({ classification: scopeClassification })
    } else {
      if (!scopeComponentCode) {
        void message.warning('Vui lòng chọn mã cụ thể')
        return
      }
      addScopeMutation.mutate({ componentCode: scopeComponentCode })
    }
  }

  // Personnel options (exclude already-members)
  const existingUserIds = new Set((team?.members ?? []).map((m) => m.userId))
  const personnelOptions = personnel
    .filter((p) => !existingUserIds.has(p.id))
    .map((p) => ({
      value: p.id,
      label: `${p.name} — ${p.email}`,
    }))

  const componentOptions = (componentsData?.items ?? []).map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.description ?? ''}`,
  }))

  // ── Column definitions ─────────────────────────────────────────────────────

  const memberColumns = [
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Bộ phận',
      dataIndex: 'team',
      key: 'team',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: TeamMember) =>
        canUpdate ? (
          <Popconfirm
            title="Xóa thành viên này khỏi team?"
            onConfirm={() => removeMemberMutation.mutate(record.memberId)}
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

  const scopeColumns = [
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: TeamScope['type']) =>
        type === 'classification' ? (
          <Tag color="blue">Nhóm hàng</Tag>
        ) : (
          <Tag color="purple">Mã cụ thể</Tag>
        ),
    },
    {
      title: 'Giá trị',
      dataIndex: 'value',
      key: 'value',
      render: (value: string, record: TeamScope) =>
        record.componentDescription ? (
          <Tooltip title={record.componentDescription}>
            <span>
              {value}{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.componentDescription}
              </Text>
            </span>
          </Tooltip>
        ) : (
          value
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: TeamScope) =>
        canUpdate ? (
          <Popconfirm
            title="Xóa phạm vi này?"
            onConfirm={() => removeScopeMutation.mutate(record.scopeId)}
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div style={{ padding: 24 }}>Đang tải...</div>
  }

  if (isError || !team) {
    return (
      <Result
        status="404"
        title="Không tìm thấy team"
        subTitle="Team này không tồn tại hoặc đã bị xóa."
        extra={
          <Button type="primary" onClick={() => navigate('/purchasing-teams')}>
            Quay lại danh sách
          </Button>
        }
      />
    )
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/purchasing-teams')}
          style={{ marginBottom: 8, paddingLeft: 0 }}
        >
          Danh sách team
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {team.name}
        </Title>
        {team.description && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
            {team.description}
          </Typography.Paragraph>
        )}
      </div>

      {/* Two-column cards */}
      <Row gutter={[16, 16]}>
        {/* Members Card */}
        <Col xs={24} lg={12}>
          <Card
            title="Thành viên"
            size="small"
            extra={
              canUpdate && (
                <Select
                  showSearch
                  placeholder="Thêm nhân sự..."
                  style={{ width: 240 }}
                  value={selectedUserId}
                  onChange={(userId: number) => {
                    setSelectedUserId(userId)
                    addMemberMutation.mutate(userId)
                  }}
                  options={personnelOptions}
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  loading={addMemberMutation.isPending}
                  disabled={addMemberMutation.isPending}
                  notFoundContent="Không có nhân sự"
                />
              )
            }
          >
            <Table
              rowKey="memberId"
              dataSource={team.members}
              columns={memberColumns}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Chưa có thành viên' }}
            />
          </Card>
        </Col>

        {/* Scopes Card */}
        <Col xs={24} lg={12}>
          <Card
            title="Phạm vi phụ trách mua"
            size="small"
            extra={
              canUpdate && (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => setScopeModalOpen(true)}
                >
                  Thêm phạm vi
                </Button>
              )
            }
          >
            <Table
              rowKey="scopeId"
              dataSource={team.scopes}
              columns={scopeColumns}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Chưa có phạm vi' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Add Scope Modal */}
      <Modal
        title="Thêm phạm vi phụ trách"
        open={scopeModalOpen}
        onCancel={closeScopeModal}
        onOk={handleAddScope}
        okText="Thêm"
        cancelText="Hủy"
        confirmLoading={addScopeMutation.isPending}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Radio.Group
            value={scopeMode}
            onChange={(e) => {
              setScopeMode(e.target.value as ScopeMode)
              setScopeClassification(undefined)
              setScopeComponentCode(undefined)
              setComponentSearch('')
            }}
          >
            <Radio value="classification">Theo nhóm hàng</Radio>
            <Radio value="component">Theo mã cụ thể</Radio>
          </Radio.Group>

          {scopeMode === 'classification' && (
            <Form layout="vertical">
              <Form.Item label="Nhóm hàng" required>
                <Select
                  placeholder="Chọn nhóm hàng..."
                  style={{ width: '100%' }}
                  value={scopeClassification}
                  onChange={(val: string) => setScopeClassification(val)}
                  options={classifications.map((c) => ({ value: c, label: c }))}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  notFoundContent="Không có nhóm hàng"
                />
              </Form.Item>
            </Form>
          )}

          {scopeMode === 'component' && (
            <Form layout="vertical">
              <Form.Item label="Mã cụ thể" required>
                <Select
                  showSearch
                  placeholder="Tìm mã..."
                  style={{ width: '100%' }}
                  value={scopeComponentCode}
                  onChange={(val: string) => setScopeComponentCode(val)}
                  onSearch={(val) => setComponentSearch(val)}
                  options={componentOptions}
                  filterOption={false}
                  notFoundContent="Không tìm thấy mã"
                />
              </Form.Item>
            </Form>
          )}
        </Space>
      </Modal>
    </Space>
  )
}
