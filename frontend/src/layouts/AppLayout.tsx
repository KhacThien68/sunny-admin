import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Dropdown, Typography, Space, Result } from 'antd'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  TeamOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  PlayCircleOutlined,
  TableOutlined,
  UserOutlined,
  SafetyOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useAuth } from '../stores/auth'
import { usePermission } from '../hooks/usePermission'
import { logoutApi } from '../api/auth'

const { Sider, Header, Content } = Layout

// ScreenGuard component — used by App routing (exported here for colocation)
export function ScreenGuard({
  screenKey,
  children,
}: {
  screenKey: string
  children: React.ReactNode
}) {
  const { canRead } = usePermission(screenKey)
  if (!canRead) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Bạn không có quyền truy cập màn hình này"
      />
    )
  }
  return <>{children}</>
}

// MenuItem definition
interface NavItem {
  key: string
  label: string
  icon: React.ReactNode
  path: string
  screenKey: string | null // null = always visible
}

interface NavGroup {
  key: string
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: <DashboardOutlined />,
    items: [
      {
        key: '/',
        label: 'Dashboard',
        icon: <AppstoreOutlined />,
        path: '/',
        screenKey: null,
      },
    ],
  },
  {
    key: 'khai-bao',
    label: 'Khai báo',
    icon: <DatabaseOutlined />,
    items: [
      {
        key: '/components',
        label: 'Quản lý mã',
        icon: <ApartmentOutlined />,
        path: '/components',
        screenKey: 'COMPONENTS',
      },
      {
        key: '/bom',
        label: 'Quản lý BoM',
        icon: <DatabaseOutlined />,
        path: '/bom',
        screenKey: 'BOM',
      },
      {
        key: '/personnel',
        label: 'Nhân sự',
        icon: <TeamOutlined />,
        path: '/personnel',
        screenKey: 'PERSONNEL',
      },
      {
        key: '/purchasing-teams',
        label: 'Team mua hàng',
        icon: <ShoppingCartOutlined />,
        path: '/purchasing-teams',
        screenKey: 'PURCHASING_TEAMS',
      },
      {
        key: '/onhand',
        label: 'Hàng thực tế',
        icon: <InboxOutlined />,
        path: '/onhand',
        screenKey: 'ONHAND',
      },
      {
        key: '/orders',
        label: 'Đơn hàng',
        icon: <ShoppingCartOutlined />,
        path: '/orders',
        screenKey: 'ORDERS',
      },
    ],
  },
  {
    key: 'tinh-toan',
    label: 'Tính toán',
    icon: <PlayCircleOutlined />,
    items: [
      {
        key: '/mrp',
        label: 'Chạy MRP',
        icon: <PlayCircleOutlined />,
        path: '/mrp',
        screenKey: 'MRP',
      },
    ],
  },
  {
    key: 'ket-qua',
    label: 'Kết quả',
    icon: <BarChartOutlined />,
    items: [
      {
        key: '/outputs/purchase',
        label: 'Tổng hợp mua & Thu hồi phế',
        icon: <TableOutlined />,
        path: '/outputs/purchase',
        screenKey: 'OUTPUT_PURCHASE',
      },
      {
        key: '/outputs/psi',
        label: 'Tồn kho PSI',
        icon: <TableOutlined />,
        path: '/outputs/psi',
        screenKey: 'OUTPUT_PSI',
      },
    ],
  },
  {
    key: 'quan-tri',
    label: 'Quản trị',
    icon: <SafetyOutlined />,
    items: [
      {
        key: '/users',
        label: 'Người dùng',
        icon: <UserOutlined />,
        path: '/users',
        screenKey: 'USERS',
      },
      {
        key: '/permissions',
        label: 'Phân quyền',
        icon: <SafetyOutlined />,
        path: '/permissions',
        screenKey: 'PERMISSIONS',
      },
    ],
  },
]

function useNavItems() {
  const compPerm = usePermission('COMPONENTS')
  const bomPerm = usePermission('BOM')
  const personnelPerm = usePermission('PERSONNEL')
  const purchasingTeamsPerm = usePermission('PURCHASING_TEAMS')
  const onhandPerm = usePermission('ONHAND')
  const ordersPerm = usePermission('ORDERS')
  const mrpPerm = usePermission('MRP')
  const outputPurchasePerm = usePermission('OUTPUT_PURCHASE')
  const outputPsiPerm = usePermission('OUTPUT_PSI')
  const usersPerm = usePermission('USERS')
  const permissionsPerm = usePermission('PERMISSIONS')

  const permMap: Record<string, boolean> = {
    COMPONENTS: compPerm.canRead,
    BOM: bomPerm.canRead,
    PERSONNEL: personnelPerm.canRead,
    PURCHASING_TEAMS: purchasingTeamsPerm.canRead,
    ONHAND: onhandPerm.canRead,
    ORDERS: ordersPerm.canRead,
    MRP: mrpPerm.canRead,
    OUTPUT_PURCHASE: outputPurchasePerm.canRead,
    OUTPUT_PSI: outputPsiPerm.canRead,
    USERS: usersPerm.canRead,
    PERMISSIONS: permissionsPerm.canRead,
  }

  return permMap
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const permMap = useNavItems()

  async function handleLogout() {
    await logoutApi()
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ]

  // Build antd menu items, filtering by permission
  const menuItems: MenuProps['items'] = NAV_GROUPS.flatMap((group) => {
    const visibleItems = group.items.filter((item) => {
      if (item.screenKey === null) return true
      return permMap[item.screenKey] === true
    })

    if (visibleItems.length === 0) return []

    return [
      {
        key: group.key,
        label: group.label,
        icon: group.icon,
        type: 'group' as const,
        children: visibleItems.map((item) => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          onClick: () => navigate(item.path),
        })),
      },
    ]
  })

  const selectedKeys = [location.pathname]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography.Text
            strong
            style={{
              color: '#fff',
              fontSize: collapsed ? 14 : 18,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {collapsed ? 'SA' : 'Sunny Admin'}
          </Typography.Text>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18 }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              <Typography.Text>{user?.name ?? ''}</Typography.Text>
              <DownOutlined style={{ fontSize: 12 }} />
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              minHeight: 'calc(100vh - 128px)',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
