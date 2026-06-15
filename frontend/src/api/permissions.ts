import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type { Screen, PermissionEntry } from '../types'

export type { Screen, PermissionEntry }

export async function getScreens(): Promise<Screen[]> {
  const res = await apiClient.get<Screen[]>(ENDPOINTS.permissions.screens)
  return res.data
}

export async function getUserPermissions(
  userId: number,
): Promise<PermissionEntry[]> {
  const res = await apiClient.get<PermissionEntry[]>(
    ENDPOINTS.permissions.byUser(userId),
  )
  return res.data
}

export async function putUserPermissions(
  userId: number,
  entries: PermissionEntry[],
): Promise<PermissionEntry[]> {
  const res = await apiClient.put<PermissionEntry[]>(
    ENDPOINTS.permissions.byUser(userId),
    entries,
  )
  return res.data
}
