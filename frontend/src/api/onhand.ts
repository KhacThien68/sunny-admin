import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type { OnhandItem, ComponentSearchItem, ComponentSearchResponse } from '../types'

export type { OnhandItem, ComponentSearchItem, ComponentSearchResponse }

export async function getOnhand(): Promise<OnhandItem[]> {
  const res = await apiClient.get<OnhandItem[]>(ENDPOINTS.onhand.base)
  return res.data
}

export async function upsertOnhand(
  componentCode: string,
  quantity: number,
): Promise<OnhandItem> {
  const res = await apiClient.put<OnhandItem>(ENDPOINTS.onhand.byCode(componentCode), { quantity })
  return res.data
}

export async function deleteOnhand(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.onhand.byId(id))
}

export async function searchComponents(
  search: string,
  pageSize = 30,
): Promise<ComponentSearchResponse> {
  const res = await apiClient.get<ComponentSearchResponse>(ENDPOINTS.components.base, {
    params: { search, pageSize },
  })
  return res.data
}
