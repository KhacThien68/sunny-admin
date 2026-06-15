import { useState } from 'react'
import {
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Popconfirm,
  Modal,
  List,
  App,
} from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { usePermission } from '../../hooks/usePermission'
import { getMrpRuns, createMrpRun } from '../../api/mrp'
import type { MrpRunSummary } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

export default function MrpPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { canCreate } = usePermission('MRP')

  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [pendingRunId, setPendingRunId] = useState<number | null>(null)

  const { data: runs = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.mrpRuns,
    queryFn: getMrpRuns,
  })

  const createMutation = useMutation({
    mutationFn: createMrpRun,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mrpRuns })
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings)
        setPendingRunId(data.run.id)
        setWarningsModalOpen(true)
      } else {
        navigate(`/mrp/${data.run.id}`)
      }
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi tạo phiên chạy MRP'))
    },
  })

  function handleWarningsOk() {
    setWarningsModalOpen(false)
    if (pendingRunId !== null) {
      navigate(`/mrp/${pendingRunId}`)
    }
  }

  const columns = [
    {
      title: 'Phiên',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: number) => `#${id}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: MrpRunSummary['status']) =>
        status === 'RUNNING' ? (
          <Tag color="processing">Đang chạy</Tag>
        ) : (
          <Tag color="success">Hoàn tất</Tag>
        ),
    },
    {
      title: 'Vòng hiện tại',
      dataIndex: 'currentRound',
      key: 'currentRound',
      width: 130,
      align: 'center' as const,
      render: (r: number) => `2.${r}`,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Người tạo',
      key: 'creator',
      render: (_: unknown, record: MrpRunSummary) =>
        record.createdByName
          ? record.createdByName
          : record.createdById
          ? `#${record.createdById}`
          : '—',
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Header */}
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
          Chạy MRP
        </Title>
        {canCreate && (
          <Popconfirm
            title="Tạo phiên chạy từ lần tổng hợp đơn hàng gần nhất?"
            onConfirm={() => createMutation.mutate()}
            okText="Tạo"
            cancelText="Hủy"
            disabled={createMutation.isPending}
          >
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={createMutation.isPending}
            >
              Tạo phiên chạy mới
            </Button>
          </Popconfirm>
        )}
      </div>

      {/* History table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={runs}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total) => `Tổng ${total} phiên`,
        }}
        size="small"
        onRow={(record) => ({
          onClick: () => navigate(`/mrp/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: 'Chưa có phiên chạy nào' }}
      />

      {/* Warnings Modal */}
      <Modal
        title="Cảnh báo khi tạo phiên chạy"
        open={warningsModalOpen}
        onOk={handleWarningsOk}
        onCancel={handleWarningsOk}
        okText="Tiếp tục"
        cancelText="Đóng"
        destroyOnHidden
      >
        <List
          dataSource={warnings}
          renderItem={(w) => (
            <List.Item>
              <span style={{ color: '#faad14' }}>{w}</span>
            </List.Item>
          )}
          size="small"
        />
      </Modal>
    </Space>
  )
}
