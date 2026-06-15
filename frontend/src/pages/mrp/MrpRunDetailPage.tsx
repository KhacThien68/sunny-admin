import { useState, useRef } from 'react'
import {
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Tabs,
  Alert,
  Popconfirm,
  Tooltip,
  InputNumber,
  Result,
  App,
} from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { getMrpRunDetail, patchMrpLine, closeRound } from '../../api/mrp'
import type { MrpLine, MrpRound, MrpRunDetailResponse } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { MOB_LABELS, MOB_COLORS } from '../../constants/labels'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

/** Format a number with Vietnamese locale, max 4 decimals */
function fmtNum(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

// ── Editable purchase cell ────────────────────────────────────────────────────

interface PurchaseCellProps {
  line: MrpLine
  runId: number
  editable: boolean
  onUpdated: (updatedLine: MrpLine) => void
}

function PurchaseCell({ line, runId, editable, onUpdated }: PurchaseCellProps) {
  const { message } = App.useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState<number | null>(line.purchase)
  const originalRef = useRef(line.purchase)

  const patchMutation = useMutation({
    mutationFn: (purchase: number) =>
      patchMrpLine(runId, line.id, { purchase }),
    onSuccess: (updated) => {
      originalRef.current = updated.purchase
      setInputVal(updated.purchase)
      onUpdated(updated)
      setEditing(false)
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật số lượng mua'))
      setInputVal(originalRef.current)
      setEditing(false)
    },
  })

  function commit() {
    const val = inputVal ?? 0
    if (val === originalRef.current) {
      setEditing(false)
      return
    }
    patchMutation.mutate(val)
  }

  if (!editable) {
    const lockReason =
      line.mob === 'KHONG'
        ? 'Mã khai báo là sản xuất'
        : line.mob === 'BAT_BUOC'
          ? 'Mã bắt buộc mua'
          : undefined

    if (lockReason) {
      return (
        <Tooltip title={lockReason}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            {fmtNum(line.purchase)}
          </span>
        </Tooltip>
      )
    }
    return <span>{fmtNum(line.purchase)}</span>
  }

  if (editing) {
    return (
      <InputNumber
        autoFocus
        min={0}
        controls={false}
        style={{ width: 110 }}
        value={inputVal}
        onChange={(v) => setInputVal(v)}
        onBlur={commit}
        onPressEnter={commit}
        disabled={patchMutation.isPending}
      />
    )
  }

  return (
    <Tooltip title={`0 hoặc ≥ MoQ (${fmtNum(line.moq)})`}>
      <span
        style={{
          cursor: 'pointer',
          borderBottom: '1px dashed #1677ff',
          color: '#1677ff',
        }}
        onClick={() => setEditing(true)}
      >
        {fmtNum(line.purchase)}
      </span>
    </Tooltip>
  )
}

// ── Round Tab content ─────────────────────────────────────────────────────────

interface RoundTabProps {
  roundData: MrpRound
  runId: number
  isCurrentRound: boolean
  runStatus: 'RUNNING' | 'DONE'
  canUpdate: boolean
  onLineUpdated: (lineId: number, updatedLine: MrpLine) => void
}

function RoundTab({
  roundData,
  runId,
  isCurrentRound,
  runStatus,
  canUpdate,
  onLineUpdated,
}: RoundTabProps) {
  const purchaseEditable = (line: MrpLine) =>
    runStatus === 'RUNNING' &&
    isCurrentRound &&
    !line.locked &&
    line.mob === 'CO_THE' &&
    canUpdate

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'componentCode',
      key: 'componentCode',
      width: 120,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'ĐV',
      dataIndex: 'uom',
      key: 'uom',
      width: 60,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'MoB',
      dataIndex: 'mob',
      key: 'mob',
      width: 130,
      render: (mob: MrpLine['mob']) => (
        <Tag color={MOB_COLORS[mob]}>{MOB_LABELS[mob]}</Tag>
      ),
    },
    {
      title: 'Order Qty',
      dataIndex: 'orderQty',
      key: 'orderQty',
      width: 110,
      align: 'right' as const,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'On-Hand',
      dataIndex: 'onhand',
      key: 'onhand',
      width: 110,
      align: 'right' as const,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'Levels',
      dataIndex: 'levels',
      key: 'levels',
      width: 90,
      align: 'right' as const,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'Demand',
      dataIndex: 'demand',
      key: 'demand',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <strong>{fmtNum(v)}</strong>,
    },
    {
      title: 'Purchase (Mua)',
      key: 'purchase',
      dataIndex: 'purchase',
      width: 140,
      align: 'right' as const,
      render: (_: number, line: MrpLine) => (
        <PurchaseCell
          key={line.id}
          line={line}
          runId={runId}
          editable={purchaseEditable(line)}
          onUpdated={(updated) => onLineUpdated(line.id, updated)}
        />
      ),
    },
    {
      title: 'Manufacturing (Sản xuất)',
      dataIndex: 'manufacturing',
      key: 'manufacturing',
      width: 180,
      align: 'right' as const,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'Thu hồi',
      dataIndex: 'recovery',
      key: 'recovery',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (v === 0 ? '—' : fmtNum(v)),
    },
  ]

  return (
    <Table
      rowKey="id"
      dataSource={roundData.lines}
      columns={columns}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'Không có dòng nào' }}
    />
  )
}

// ── Main detail page ──────────────────────────────────────────────────────────

export default function MrpRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const runId = Number(id)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canUpdate } = usePermission('MRP')

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.mrpRun(runId),
    queryFn: () => getMrpRunDetail(runId),
    enabled: !isNaN(runId),
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status
      if (status === 404) return false
      return failureCount < 3
    },
  })

  // Derive active tab: first unlocked round (current round), or last round if all locked
  const defaultActiveRound = data ? data.run.currentRound : 1

  const [activeTab, setActiveTab] = useState<string | null>(null)

  const effectiveActiveTab = activeTab ?? String(defaultActiveRound)

  const closeRoundMutation = useMutation({
    mutationFn: () => closeRound(runId),
    onSuccess: (result) => {
      queryClient.setQueryData<MrpRunDetailResponse>(
        QUERY_KEYS.mrpRun(runId),
        result,
      )
      if (result.run.status === 'DONE') {
        void message.success('Phiên MRP đã hoàn tất')
      } else {
        void message.success(
          `Đã chốt vòng, chuyển sang vòng 2.${result.run.currentRound}`,
        )
        setActiveTab(String(result.run.currentRound))
      }
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi chốt vòng'))
    },
  })

  function handleLineUpdated(
    roundNum: number,
    lineId: number,
    updatedLine: MrpLine,
  ) {
    queryClient.setQueryData<MrpRunDetailResponse>(
      QUERY_KEYS.mrpRun(runId),
      (old) => {
        if (!old) return old
        return {
          ...old,
          rounds: old.rounds.map((r) =>
            r.round === roundNum
              ? {
                  ...r,
                  lines: r.lines.map((l) =>
                    l.id === lineId ? updatedLine : l,
                  ),
                }
              : r,
          ),
        }
      },
    )
  }

  if (isNaN(runId)) {
    return (
      <Result
        status="404"
        title="ID không hợp lệ"
        extra={
          <Button type="primary" onClick={() => navigate('/mrp')}>
            Quay lại
          </Button>
        }
      />
    )
  }

  if (isLoading) {
    return <div style={{ padding: 24 }}>Đang tải...</div>
  }

  if (isError || !data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy phiên chạy"
        subTitle="Phiên này không tồn tại."
        extra={
          <Button type="primary" onClick={() => navigate('/mrp')}>
            Quay lại danh sách
          </Button>
        }
      />
    )
  }

  const { run, rounds } = data
  const currentRoundNum = run.currentRound

  const tabItems = rounds.map((r) => ({
    key: String(r.round),
    label: (
      <span>
        {`Vòng 2.${r.round}`}
        {r.locked && <LockOutlined style={{ marginLeft: 4, fontSize: 12 }} />}
      </span>
    ),
    children: (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <RoundTab
          roundData={r}
          runId={runId}
          isCurrentRound={r.round === currentRoundNum}
          runStatus={run.status}
          canUpdate={canUpdate}
          onLineUpdated={(lineId, updatedLine) =>
            handleLineUpdated(r.round, lineId, updatedLine)
          }
        />
        {/* Footer: close-round button for current round */}
        {run.status === 'RUNNING' &&
          canUpdate &&
          r.round === currentRoundNum &&
          !r.locked && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Popconfirm
                title="Sau khi chốt sẽ không sửa được vòng này?"
                onConfirm={() => closeRoundMutation.mutate()}
                okText="Chốt"
                cancelText="Hủy"
                disabled={closeRoundMutation.isPending}
              >
                <Button type="primary" loading={closeRoundMutation.isPending}>
                  {`Chốt vòng 2.${currentRoundNum}`}
                </Button>
              </Popconfirm>
            </div>
          )}
      </Space>
    ),
  }))

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Back + Title */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/mrp')}
          style={{ marginBottom: 8, paddingLeft: 0 }}
        >
          Danh sách phiên
        </Button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {`Phiên chạy MRP #${runId}`}
          </Title>
          {run.status === 'RUNNING' ? (
            <Tag color="processing">Đang chạy</Tag>
          ) : (
            <Tag color="success">Hoàn tất</Tag>
          )}
        </div>
      </div>

      {/* Done alert */}
      {run.status === 'DONE' && (
        <Alert
          type="success"
          message="Phiên đã hoàn tất"
          action={
            <Button
              type="link"
              size="small"
              onClick={() => navigate('/outputs/purchase')}
            >
              Xem kết quả Output
            </Button>
          }
          showIcon
        />
      )}

      {/* Rounds tabs */}
      <Tabs
        activeKey={effectiveActiveTab}
        onChange={(key) => setActiveTab(key)}
        items={tabItems}
        type="card"
      />
    </Space>
  )
}
