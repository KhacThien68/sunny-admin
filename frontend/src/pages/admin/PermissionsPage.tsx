import { useState, useEffect } from 'react'
import {
  Typography,
  Space,
  Select,
  Button,
  Table,
  Checkbox,
  Alert,
  App,
} from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import { getUsers } from '../../api/users'
import type { User } from '../../api/users'
import {
  getScreens,
  getUserPermissions,
  putUserPermissions,
} from '../../api/permissions'
import type { PermissionEntry } from '../../api/permissions'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title, Text } = Typography

export default function PermissionsPage() {
  const { message } = App.useApp()
  const { canUpdate } = usePermission('PERMISSIONS')

  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined)
  const [localPerms, setLocalPerms] = useState<PermissionEntry[]>([])

  // Fetch all users for the Select
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  // Fetch screens list
  const { data: screens = [] } = useQuery({
    queryKey: ['permissions', 'screens'],
    queryFn: getScreens,
  })

  // Fetch permissions for selected user
  const {
    data: serverPerms,
    isLoading: permsLoading,
    refetch: refetchPerms,
  } = useQuery({
    queryKey: ['permissions', selectedUserId],
    queryFn: () => getUserPermissions(selectedUserId!),
    enabled: selectedUserId !== undefined,
  })

  // Sync server data into local editable state
  useEffect(() => {
    if (serverPerms) {
      setLocalPerms(serverPerms.map((p) => ({ ...p })))
    }
  }, [serverPerms])

  const saveMutation = useMutation({
    mutationFn: () => putUserPermissions(selectedUserId!, localPerms),
    onSuccess: () => {
      void message.success('Đã lưu phân quyền')
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi lưu phân quyền'))
    },
  })

  const selectedUser: User | undefined = users.find((u) => u.id === selectedUserId)

  function updatePerm(
    screenKey: string,
    field: keyof Omit<PermissionEntry, 'screenKey'>,
    value: boolean,
  ) {
    setLocalPerms((prev) =>
      prev.map((p) =>
        p.screenKey === screenKey ? { ...p, [field]: value } : p,
      ),
    )
  }

  function handleSelectAll() {
    setLocalPerms((prev) =>
      prev.map((p) => ({
        ...p,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      })),
    )
  }

  function handleDeselectAll() {
    setLocalPerms((prev) =>
      prev.map((p) => ({
        ...p,
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      })),
    )
  }

  function handleReset() {
    void refetchPerms()
  }

  const userOptions = users.map((u) => ({
    label: `${u.name} — ${u.email}`,
    value: u.id,
  }))

  // Build table datasource from screens + localPerms merged
  const tableData = screens.map((screen) => {
    const perm = localPerms.find((p) => p.screenKey === screen.key) ?? {
      screenKey: screen.key,
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    }
    return {
      key: screen.key,
      label: screen.label,
      ...perm,
    }
  })

  const isAdminUser = selectedUser?.isAdmin === true
  const showMatrix = selectedUserId !== undefined && !isAdminUser

  const columns = [
    {
      title: 'Màn hình',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: 'Xem (R)',
      key: 'canRead',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: typeof tableData[0]) => (
        <Checkbox
          checked={record.canRead}
          disabled={!canUpdate}
          onChange={(e) => updatePerm(record.key, 'canRead', e.target.checked)}
        />
      ),
    },
    {
      title: 'Thêm (C)',
      key: 'canCreate',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: typeof tableData[0]) => (
        <Checkbox
          checked={record.canCreate}
          disabled={!canUpdate}
          onChange={(e) => updatePerm(record.key, 'canCreate', e.target.checked)}
        />
      ),
    },
    {
      title: 'Sửa (U)',
      key: 'canUpdate',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: typeof tableData[0]) => (
        <Checkbox
          checked={record.canUpdate}
          disabled={!canUpdate}
          onChange={(e) => updatePerm(record.key, 'canUpdate', e.target.checked)}
        />
      ),
    },
    {
      title: 'Xóa (D)',
      key: 'canDelete',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: typeof tableData[0]) => (
        <Checkbox
          checked={record.canDelete}
          disabled={!canUpdate}
          onChange={(e) => updatePerm(record.key, 'canDelete', e.target.checked)}
        />
      ),
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Phân quyền
        </Title>
      </div>

      {/* User selector */}
      <div>
        <Select
          showSearch
          placeholder="Chọn người dùng..."
          style={{ width: 360 }}
          options={userOptions}
          value={selectedUserId}
          onChange={(val) => {
            setSelectedUserId(val as number)
            setLocalPerms([])
          }}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          optionFilterProp="label"
        />
      </div>

      {/* No user selected */}
      {selectedUserId === undefined && (
        <Text type="secondary">Vui lòng chọn người dùng để xem và chỉnh sửa phân quyền.</Text>
      )}

      {/* Admin user — show info alert */}
      {selectedUserId !== undefined && isAdminUser && (
        <Alert
          type="info"
          showIcon
          message="Người dùng này là Quản trị viên, có toàn quyền trên mọi màn hình."
        />
      )}

      {/* Permission matrix */}
      {showMatrix && (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {/* Hint */}
          <Text type="secondary">
            Quyền Xem (R) là bắt buộc để truy cập màn hình.
          </Text>

          {/* Select all / deselect all + action buttons */}
          <Space wrap>
            {canUpdate && (
              <>
                <Button size="small" onClick={handleSelectAll}>
                  Chọn tất cả
                </Button>
                <Button size="small" onClick={handleDeselectAll}>
                  Bỏ chọn tất cả
                </Button>
              </>
            )}
            <Button size="small" onClick={handleReset}>
              Đặt lại
            </Button>
            {canUpdate && (
              <Button
                type="primary"
                size="small"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Lưu
              </Button>
            )}
          </Space>

          {/* Matrix table */}
          <Table
            rowKey="key"
            loading={permsLoading}
            dataSource={tableData}
            columns={columns}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </Space>
      )}
    </Space>
  )
}
