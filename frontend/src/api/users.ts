import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type { User, CreateUserBody, UpdateUserBody } from '../types'

export type { User, CreateUserBody, UpdateUserBody }

export async function getUsers(): Promise<User[]> {
  const res = await apiClient.get<User[]>(ENDPOINTS.users.base)
  return res.data
}

export async function createUser(body: CreateUserBody): Promise<User> {
  const res = await apiClient.post<User>(ENDPOINTS.users.base, body)
  return res.data
}

export async function updateUser(
  id: number,
  body: UpdateUserBody,
): Promise<User> {
  const res = await apiClient.patch<User>(ENDPOINTS.users.byId(id), body)
  return res.data
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.users.byId(id))
}
