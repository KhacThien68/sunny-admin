import { Select, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getOutputRuns } from '../../api/outputs'
import type { OutputRunSummary } from '../../api/outputs'

interface RunSelectorProps {
  value?: number
  onChange: (id: number) => void
}

export default function RunSelector({ value, onChange }: RunSelectorProps) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['output-runs'],
    queryFn: getOutputRuns,
  })

  if (isLoading) {
    return <Spin size="small" />
  }

  const options = runs.map((run: OutputRunSummary) => ({
    value: run.id,
    label: `Phiên #${run.id} — ${dayjs(run.createdAt).format('DD/MM/YYYY HH:mm')} (${run.status === 'DONE' ? 'Hoàn tất' : 'Đang chạy'})`,
  }))

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Chọn phiên chạy MRP"
      style={{ minWidth: 340 }}
      loading={isLoading}
    />
  )
}
