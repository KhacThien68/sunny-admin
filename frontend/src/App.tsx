import { Routes, Route } from 'react-router-dom'

function LoginPage() {
  return <div>Đăng nhập</div>
}

function HomePage() {
  return <div>Sunny Admin</div>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

export default App
