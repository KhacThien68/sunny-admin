import { Routes, Route, useNavigate } from 'react-router-dom'
import { Button, Typography } from 'antd'
import LoginPage from './pages/LoginPage'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './stores/auth'
import { logoutApi } from './api/auth'

function AuthenticatedHome() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logoutApi()
    navigate('/login')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Typography.Title level={2}>Sunny Admin</Typography.Title>
      {user && (
        <Typography.Text>
          Xin chào, <strong>{user.name}</strong> ({user.email})
        </Typography.Text>
      )}
      <Button type="default" onClick={handleLogout}>
        Đăng xuất
      </Button>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<AuthenticatedHome />} />
      </Route>
    </Routes>
  )
}

export default App
