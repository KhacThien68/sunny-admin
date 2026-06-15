import { useState, useEffect } from 'react'
import { Typography, Space, Table, Empty, Alert } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { getOutputRuns, getPsi } from '../../api/outputs'
import type { PsiItem } from '../../api/outputs'
import RunSelector from './RunSelector'

const { Title } = Typography

function formatNum(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

const PSI_COLUMNS: ColumnsType<PsiItem> = [
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
    title: 'Tồn đầu (On-Hand)',
    dataIndex: 'onhand',
    key: 'onhand',
    width: 150,
    align: 'right' as const,
    render: (v: number) => formatNum(v),
  },
  {
    title: 'Mua (Purchase)',
    dataIndex: 'purchase',
    key: 'purchase',
    width: 130,
    align: 'right' as const,
    render: (v: number) => formatNum(v),
  },
  {
    title: 'Bán (Sale)',
    dataIndex: 'sale',
    key: 'sale',
    width: 120,
    align: 'right' as const,
    render: (v: number) => formatNum(v),
  },
  {
    title: 'Tồn cuối (Closing)',
    dataIndex: 'closing',
    key: 'closing',
    width: 150,
    align: 'right' as const,
    render: (v: number) => formatNum(v),
  },
]

export default function PsiPage() {
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>(undefined)

  // Load runs list to initialize selector
  const { data: runs = [] } = useQuery({
    queryKey: ['output-runs'],
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
    data: psiData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['output-psi', selectedRunId],
    queryFn: () => getPsi(selectedRunId),
    retry: false,
    enabled: runs.length > 0 || selectedRunId !== undefined,
  })

  const noRuns = error && is404(error)

  if (noRuns) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Title level={4} style={{ margin: 0 }}>
          Tồn kho PSI
        </Title>
        <Empty description="Chưa có phiên chạy MRP nào" />
      </Space>
    )
  }

  const items = psiData?.items ?? []

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
          Tồn kho PSI
        </Title>
        <RunSelector value={selectedRunId} onChange={setSelectedRunId} />
      </div>

      {/* Formula info */}
      <Alert
        type="info"
        closable={false}
        message="Công thức: Sale (Bán) = Tồn đầu (On-Hand) + Mua (Purchase) − Tồn cuối (Closing)"
      />

      {/* PSI table */}
      {!isLoading && items.length === 0 ? (
        <Empty description="Không có dữ liệu PSI" />
      ) : (
        <Table
          rowKey="code"
          loading={isLoading}
          dataSource={items}
          columns={PSI_COLUMNS}
          scroll={{ x: 'max-content' }}
          pagination={false}
          size="small"
        />
      )}
    </Space>
  )
}
