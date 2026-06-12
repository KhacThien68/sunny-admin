import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useAuth } from '../stores/auth'
import { login } from '../api/auth'

interface LoginFormValues {
  email: string
  password: string
}

export default function LoginPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  async function handleFinish(values: LoginFormValues) {
    setLoading(true)
    try {
      await login(values.email, values.password)
      navigate('/')
    } catch (err: unknown) {
      const status =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'status' in err.response
          ? (err.response as { status: number }).status
          : undefined

      if (status === 401) {
        messageApi.error('Sai tài khoản hoặc mật khẩu')
      } else {
        messageApi.error('Không thể kết nối máy chủ')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {contextHolder}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <Typography.Title
            level={3}
            style={{ textAlign: 'center', marginBottom: 24 }}
          >
            Sunny Admin
          </Typography.Title>
          <Form<LoginFormValues>
            layout="vertical"
            onFinish={handleFinish}
            autoComplete="off"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password placeholder="••••••••" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  )
}
