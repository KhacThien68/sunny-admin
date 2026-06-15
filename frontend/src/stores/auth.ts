import { create } from 'zustand'
import type { AuthUser, PermissionFlags } from '../types'

export type { AuthUser, PermissionFlags }

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  permissions: Record<string, PermissionFlags>
  initialized: boolean
  setAuth(token: string, user: AuthUser): void
  setPermissions(perms: Record<string, PermissionFlags>): void
  setInitialized(): void
  clear(): void
}

export const useAuth = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  permissions: {},
  initialized: false,
  setAuth: (token, user) => set({ accessToken: token, user }),
  setPermissions: (perms) => set({ permissions: perms }),
  setInitialized: () => set({ initialized: true }),
  clear: () =>
    set({
      accessToken: null,
      user: null,
      permissions: {},
    }),
}))
