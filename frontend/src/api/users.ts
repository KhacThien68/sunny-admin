import { apiClient } from './client'

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

export async function getUsers(): Promise<User[]> {
  const res = await apiClient.get<User[]>('/users')
  return res.data
}

export async function createUser(body: CreateUserBody): Promise<User> {
  const res = await apiClient.post<User>('/users', body)
  return res.data
}

export async function updateUser(id: number, body: UpdateUserBody): Promise<User> {
  const res = await apiClient.patch<User>(`/users/${id}`, body)
  return res.data
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}
