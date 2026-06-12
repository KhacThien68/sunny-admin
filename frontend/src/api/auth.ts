import axios from 'axios'
import { apiClient } from './client'
import { useAuth, type AuthUser, type PermissionFlags } from '../stores/auth'

interface LoginResponse {
  accessToken: string
  user: AuthUser
}

interface PermissionEntry {
  screenKey: string
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}

async function fetchMyPermissions(): Promise<void> {
  const res = await apiClient.get<PermissionEntry[]>('/permissions/me')
  const permsRecord: Record<string, PermissionFlags> = {}
  for (const entry of res.data) {
    permsRecord[entry.screenKey] = {
      canCreate: entry.canCreate,
      canRead: entry.canRead,
      canUpdate: entry.canUpdate,
      canDelete: entry.canDelete,
    }
  }
  useAuth.getState().setPermissions(permsRecord)
}

export async function login(email: string, password: string): Promise<void> {
  const res = await axios.post<LoginResponse>(
    '/api/auth/login',
    { email, password },
    { withCredentials: true },
  )
  const { accessToken, user } = res.data
  useAuth.getState().setAuth(accessToken, user)
  await fetchMyPermissions()
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // Ignore errors on logout
  }
  useAuth.getState().clear()
}

export async function bootstrapSession(): Promise<void> {
  try {
    const res = await axios.post<LoginResponse>(
      '/api/auth/refresh',
      {},
      { withCredentials: true },
    )
    const { accessToken, user } = res.data
    useAuth.getState().setAuth(accessToken, user)
    await fetchMyPermissions()
  } catch {
    // No valid refresh token — stay logged out
  } finally {
    useAuth.getState().setInitialized()
  }
}
