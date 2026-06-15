import { apiClient } from './client'

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

export async function getScreens(): Promise<Screen[]> {
  const res = await apiClient.get<Screen[]>('/permissions/screens')
  return res.data
}

export async function getUserPermissions(userId: number): Promise<PermissionEntry[]> {
  const res = await apiClient.get<PermissionEntry[]>(`/permissions/${userId}`)
  return res.data
}

export async function putUserPermissions(
  userId: number,
  entries: PermissionEntry[],
): Promise<PermissionEntry[]> {
  const res = await apiClient.put<PermissionEntry[]>(`/permissions/${userId}`, entries)
  return res.data
}
