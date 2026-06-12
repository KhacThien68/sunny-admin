import { Typography, App } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface UnregisteredCodeProps {
  code: string
  registered: boolean
  canCreateComponent: boolean
}

export default function UnregisteredCode({
  code,
  registered,
  canCreateComponent,
}: UnregisteredCodeProps) {
  const { modal } = App.useApp()
  const navigate = useNavigate()

  if (registered) {
    return <Typography.Text>{code}</Typography.Text>
  }

  function handleClick() {
    modal.confirm({
      title: 'Mã chưa được khai báo',
      content: `Mã "${code}" chưa được khai báo tại Quản lý mã.`,
      okText: canCreateComponent ? 'Đi khai báo' : undefined,
      cancelText: 'Đóng',
      okButtonProps: canCreateComponent ? {} : { style: { display: 'none' } },
      onOk: canCreateComponent
        ? () => {
            navigate(`/components?prefill=${encodeURIComponent(code)}`)
          }
        : undefined,
    })
  }

  return (
    <Typography.Text
      type="danger"
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    >
      <WarningOutlined style={{ marginRight: 4 }} />
      {code}
    </Typography.Text>
  )
}
