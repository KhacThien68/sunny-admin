import { Routes, Route } from 'react-router-dom'
import { Result } from 'antd'
import LoginPage from './pages/LoginPage'
import RequireAuth from './components/RequireAuth'
import AppLayout, { ScreenGuard } from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ComponentsPage from './pages/components/ComponentsPage'
import BomPage from './pages/bom/BomPage'
import PersonnelPage from './pages/personnel/PersonnelPage'
import OnhandPage from './pages/onhand/OnhandPage'
import TeamsListPage from './pages/purchasing/TeamsListPage'
import TeamDetailPage from './pages/purchasing/TeamDetailPage'
import OrdersPage from './pages/orders/OrdersPage'
import MrpPage from './pages/mrp/MrpPage'
import MrpRunDetailPage from './pages/mrp/MrpRunDetailPage'
import PurchaseSummaryPage from './pages/outputs/PurchaseSummaryPage'
import PsiPage from './pages/outputs/PsiPage'
import UsersPage from './pages/admin/UsersPage'
import PermissionsPage from './pages/admin/PermissionsPage'

function NotFound() {
  return <Result status="404" title="404" subTitle="Không tìm thấy trang" />
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
                <BomPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/personnel"
            element={
              <ScreenGuard screenKey="PERSONNEL">
                <PersonnelPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/purchasing-teams"
            element={
              <ScreenGuard screenKey="PURCHASING_TEAMS">
                <TeamsListPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/purchasing-teams/:id"
            element={
              <ScreenGuard screenKey="PURCHASING_TEAMS">
                <TeamDetailPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/onhand"
            element={
              <ScreenGuard screenKey="ONHAND">
                <OnhandPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/orders"
            element={
              <ScreenGuard screenKey="ORDERS">
                <OrdersPage />
              </ScreenGuard>
            }
          />

          {/* Tính toán */}
          <Route
            path="/mrp"
            element={
              <ScreenGuard screenKey="MRP">
                <MrpPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/mrp/:id"
            element={
              <ScreenGuard screenKey="MRP">
                <MrpRunDetailPage />
              </ScreenGuard>
            }
          />

          {/* Kết quả */}
          <Route
            path="/outputs/purchase"
            element={
              <ScreenGuard screenKey="OUTPUT_PURCHASE">
                <PurchaseSummaryPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/outputs/psi"
            element={
              <ScreenGuard screenKey="OUTPUT_PSI">
                <PsiPage />
              </ScreenGuard>
            }
          />

          {/* Quản trị */}
          <Route
            path="/users"
            element={
              <ScreenGuard screenKey="USERS">
                <UsersPage />
              </ScreenGuard>
            }
          />
          <Route
            path="/permissions"
            element={
              <ScreenGuard screenKey="PERMISSIONS">
                <PermissionsPage />
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
