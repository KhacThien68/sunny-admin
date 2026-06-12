import { apiClient } from './client'

export interface Personnel {
  id: number
  name: string
  position: string | null
  team: string | null
  email: string
  phone: string | null
  isAdmin: boolean
  isActive: boolean
}

export interface CreatePersonnelBody {
  name: string
  email: string
  position?: string
  team?: string
  phone?: string
}

export interface UpdatePersonnelBody {
  name?: string
  email?: string
  position?: string
  team?: string
  phone?: string
}

export async function getPersonnel(): Promise<Personnel[]> {
  const res = await apiClient.get<Personnel[]>('/personnel')
  return res.data
}

export async function createPersonnel(body: CreatePersonnelBody): Promise<Personnel> {
  const res = await apiClient.post<Personnel>('/personnel', body)
  return res.data
}

export async function updatePersonnel(
  id: number,
  body: UpdatePersonnelBody,
): Promise<Personnel> {
  const res = await apiClient.patch<Personnel>(`/personnel/${id}`, body)
  return res.data
}

export async function deletePersonnel(id: number): Promise<void> {
  await apiClient.delete(`/personnel/${id}`)
}
