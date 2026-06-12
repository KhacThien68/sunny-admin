import { Result } from 'antd'
import { ToolOutlined } from '@ant-design/icons'

interface PlaceholderPageProps {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Result
      icon={<ToolOutlined />}
      title={title}
      subTitle="Màn hình đang được xây dựng"
    />
  )
}
