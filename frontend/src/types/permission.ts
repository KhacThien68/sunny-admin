export interface Screen {
  key: string
  label: string
}

export interface PermissionEntry {
  screenKey: string
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}
