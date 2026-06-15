import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type { Personnel, CreatePersonnelBody, UpdatePersonnelBody } from '../types'

export type { Personnel, CreatePersonnelBody, UpdatePersonnelBody }

export async function getPersonnel(): Promise<Personnel[]> {
  const res = await apiClient.get<Personnel[]>(ENDPOINTS.personnel.base)
  return res.data
}

export async function createPersonnel(body: CreatePersonnelBody): Promise<Personnel> {
  const res = await apiClient.post<Personnel>(ENDPOINTS.personnel.base, body)
  return res.data
}

export async function updatePersonnel(
  id: number,
  body: UpdatePersonnelBody,
): Promise<Personnel> {
  const res = await apiClient.patch<Personnel>(ENDPOINTS.personnel.byId(id), body)
  return res.data
}

export async function deletePersonnel(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.personnel.byId(id))
}
