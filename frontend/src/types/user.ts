export interface User {
  id: number
  name: string
  position: string | null
  team: string | null
  email: string
  phone: string | null
  isAdmin: boolean
  isActive: boolean
}

export interface CreateUserBody {
  name: string
  email: string
  password: string
  position?: string
  team?: string
  phone?: string
  isAdmin?: boolean
  isActive?: boolean
}

export interface UpdateUserBody {
  name?: string
  email?: string
  password?: string
  position?: string
  team?: string
  phone?: string
  isAdmin?: boolean
  isActive?: boolean
}
