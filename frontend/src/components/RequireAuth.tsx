import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../stores/auth'
import { bootstrapSession } from '../api/auth'

export default function RequireAuth() {
  const { accessToken, initialized } = useAuth()

  useEffect(() => {
    if (!initialized) {
      bootstrapSession()
    }
  }, [initialized])

  if (!initialized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
