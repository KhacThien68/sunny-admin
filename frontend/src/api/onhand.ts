import { apiClient } from './client'

export interface OnhandItem {
  id: number
  componentCode: string
  quantity: number
  updatedAt: string
  registered: boolean
  description: string | null
}

export interface ComponentSearchItem {
  code: string
  description: string | null
}

export interface ComponentSearchResponse {
  items: ComponentSearchItem[]
}

export async function getOnhand(): Promise<OnhandItem[]> {
  const res = await apiClient.get<OnhandItem[]>('/onhand')
  return res.data
}

export async function upsertOnhand(
  componentCode: string,
  quantity: number,
): Promise<OnhandItem> {
  const res = await apiClient.put<OnhandItem>(`/onhand/${componentCode}`, { quantity })
  return res.data
}

export async function deleteOnhand(id: number): Promise<void> {
  await apiClient.delete(`/onhand/${id}`)
}

export async function searchComponents(
  search: string,
  pageSize = 30,
): Promise<ComponentSearchResponse> {
  const res = await apiClient.get<ComponentSearchResponse>('/components', {
    params: { search, pageSize },
  })
  return res.data
}
