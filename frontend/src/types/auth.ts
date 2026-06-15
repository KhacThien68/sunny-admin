export interface AuthUser {
  id: number
  name: string
  email: string
  isAdmin: boolean
}

export interface PermissionFlags {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
