import { Routes, Route } from 'react-router-dom'
import { Result } from 'antd'
import LoginPage from './pages/LoginPage'
import RequireAuth from './components/RequireAuth'
import AppLayout, { ScreenGuard } from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ComponentsPage from './pages/components/ComponentsPage'

function NotFound() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Không tìm thấy trang"
    />
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          {/* Dashboard — always visible */}
          <Route path="/" element={<DashboardPage />} />

          {/* Khai báo */}
          <Route
            path="/components"
            element={
              <ScreenGuard screenKey="COMPONENTS">
                <ComponentsPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/bom"
            element={
              <ScreenGuard screenKey="BOM">
                <PlaceholderPage title="Quản lý BoM" />
              </ScreenGuard>
            }
          />
          <Route
            path="/personnel"
            element={
              <ScreenGuard screenKey="PERSONNEL">
                <PlaceholderPage title="Nhân sự" />
              </ScreenGuard>
            }
          />
          <Route
            path="/purchasing-teams"
            element={
              <ScreenGuard screenKey="PURCHASING_TEAMS">
                <PlaceholderPage title="Team mua hàng" />
              </ScreenGuard>
            }
          />
          <Route
            path="/onhand"
            element={
              <ScreenGuard screenKey="ONHAND">
                <PlaceholderPage title="Hàng thực tế" />
              </ScreenGuard>
            }
          />
          <Route
            path="/orders"
            element={
              <ScreenGuard screenKey="ORDERS">
                <PlaceholderPage title="Đơn hàng" />
              </ScreenGuard>
            }
          />

          {/* Tính toán */}
          <Route
            path="/mrp"
            element={
              <ScreenGuard screenKey="MRP">
                <PlaceholderPage title="Chạy MRP" />
              </ScreenGuard>
            }
          />

          {/* Kết quả */}
          <Route
            path="/outputs/purchase"
            element={
              <ScreenGuard screenKey="OUTPUT_PURCHASE">
                <PlaceholderPage title="Tổng hợp mua & Thu hồi phế" />
              </ScreenGuard>
            }
          />
          <Route
            path="/outputs/psi"
            element={
              <ScreenGuard screenKey="OUTPUT_PSI">
                <PlaceholderPage title="Tồn kho PSI" />
              </ScreenGuard>
            }
          />

          {/* Quản trị */}
          <Route
            path="/users"
            element={
              <ScreenGuard screenKey="USERS">
                <PlaceholderPage title="Người dùng" />
              </ScreenGuard>
            }
          />
          <Route
            path="/permissions"
            element={
              <ScreenGuard screenKey="PERMISSIONS">
                <PlaceholderPage title="Phân quyền" />
              </ScreenGuard>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
