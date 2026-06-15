import { useState, useEffect } from 'react'
import { Typography, Space, Card, Table, Empty } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { getOutputRuns, getPurchaseSummary, getRecoverySummary } from '../../api/outputs'
import type { PurchaseSummaryItem, OutputRunInfo } from '../../types'
import { QUERY_KEYS } from '../../constants/queryKeys'
import RunSelector from './RunSelector'

const { Title } = Typography

function formatNum(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

function buildColumns(run: OutputRunInfo | undefined): ColumnsType<PurchaseSummaryItem> {
  const fixed: ColumnsType<PurchaseSummaryItem> = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: 'Phân loại',
      dataIndex: 'classification',
      key: 'classification',
      width: 110,
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
      width: 90,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Tổng',
      dataIndex: 'total',
      key: 'total',
      width: 110,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 700 }}>
          {v.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
        </span>
      ),
    },
  ]

  const dynamic: ColumnsType<PurchaseSummaryItem> =
    run
      ? [...run.rounds]
          .sort((a, b) => a - b)
          .map((roundNum) => ({
            title: `2.${roundNum}`,
            key: `round_${roundNum}`,
            width: 100,
            align: 'right' as const,
            render: (_: unknown, record: PurchaseSummaryItem) =>
              formatNum(record.rounds[String(roundNum)] ?? 0),
          }))
      : []

  return [...fixed, ...dynamic]
}

interface SectionTableProps {
  run: OutputRunInfo | undefined
  items: PurchaseSummaryItem[]
  loading: boolean
  emptyText: string
}

function SectionTable({ run, items, loading, emptyText }: SectionTableProps) {
  const columns = buildColumns(run)

  if (!loading && items.length === 0) {
    return <Empty description={emptyText} />
  }

  return (
    <Table
      rowKey="code"
      loading={loading}
      dataSource={items}
      columns={columns}
      scroll={{ x: 'max-content' }}
      pagination={false}
      size="small"
    />
  )
}

export default function PurchaseSummaryPage() {
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>(undefined)

  // Load runs list to initialize selector
  const { data: runs = [] } = useQuery({
    queryKey: QUERY_KEYS.outputRuns,
    queryFn: getOutputRuns,
  })

  // Once runs load, default to first run (newest first from backend)
  useEffect(() => {
    if (runs.length > 0 && selectedRunId === undefined) {
      setSelectedRunId(runs[0].id)
    }
  }, [runs, selectedRunId])

  const is404 = (err: unknown) => {
    const e = err as { response?: { status?: number } }
    return e?.response?.status === 404
  }

  const {
    data: purchaseData,
    isLoading: purchaseLoading,
    error: purchaseError,
  } = useQuery({
    queryKey: QUERY_KEYS.outputPurchase(selectedRunId),
    queryFn: () => getPurchaseSummary(selectedRunId),
    retry: false,
    enabled: runs.length > 0 || selectedRunId !== undefined,
  })

  const {
    data: recoveryData,
    isLoading: recoveryLoading,
    error: recoveryError,
  } = useQuery({
    queryKey: QUERY_KEYS.outputRecovery(selectedRunId),
    queryFn: () => getRecoverySummary(selectedRunId),
    retry: false,
    enabled: runs.length > 0 || selectedRunId !== undefined,
  })

  const noRuns = (purchaseError && is404(purchaseError)) || (recoveryError && is404(recoveryError))

  if (noRuns) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Title level={4} style={{ margin: 0 }}>
          Tổng hợp mua &amp; Thu hồi phế
        </Title>
        <Empty description="Chưa có phiên chạy MRP nào" />
      </Space>
    )
  }

  const purchaseRun = purchaseData?.run
  const purchaseItems = purchaseData?.items ?? []
  const recoveryRun = recoveryData?.run
  const recoveryItems = recoveryData?.items ?? []

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Tổng hợp mua &amp; Thu hồi phế
        </Title>
        <RunSelector value={selectedRunId} onChange={setSelectedRunId} />
      </div>

      {/* Purchase section */}
      <Card title="Mua (Purchase)" size="small">
        <SectionTable
          run={purchaseRun}
          items={purchaseItems}
          loading={purchaseLoading}
          emptyText="Không có dữ liệu mua"
        />
      </Card>

      {/* Recovery section */}
      <Card title="Thu hồi phế (Thu hồi)" size="small">
        <SectionTable
          run={recoveryRun}
          items={recoveryItems}
          loading={recoveryLoading}
          emptyText="Không có dữ liệu thu hồi"
        />
      </Card>
    </Space>
  )
}
