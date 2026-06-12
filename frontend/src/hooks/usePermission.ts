import { useAuth } from '../stores/auth'
import type { PermissionFlags } from '../stores/auth'

const ALL_TRUE: PermissionFlags = {
  canCreate: true,
  canRead: true,
  canUpdate: true,
  canDelete: true,
}

const ALL_FALSE: PermissionFlags = {
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
}

export function usePermission(screenKey: string): PermissionFlags {
  const { user, permissions } = useAuth()

  if (user?.isAdmin) {
    return ALL_TRUE
  }

  return permissions[screenKey] ?? ALL_FALSE
}
