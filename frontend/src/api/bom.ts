import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type {
  BomRow,
  BomTreeNode,
  CreateBomBody,
  UpdateBomBody,
} from '../types'

export type { BomRow, BomTreeNode, CreateBomBody, UpdateBomBody }

export async function getBomList(parentCode?: string): Promise<BomRow[]> {
  const res = await apiClient.get<BomRow[]>(ENDPOINTS.bom.base, {
    params: parentCode ? { parentCode } : {},
  })
  return res.data
}

export async function createBomRow(body: CreateBomBody): Promise<BomRow> {
  const res = await apiClient.post<BomRow>(ENDPOINTS.bom.base, body)
  return res.data
}

export async function updateBomRow(
  id: number,
  body: UpdateBomBody,
): Promise<BomRow> {
  const res = await apiClient.patch<BomRow>(ENDPOINTS.bom.byId(id), body)
  return res.data
}

export async function deleteBomRow(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.bom.byId(id))
}

export async function getBomTree(code: string): Promise<BomTreeNode> {
  const res = await apiClient.get<BomTreeNode>(ENDPOINTS.bom.tree(code))
  return res.data
}

export async function getUnregisteredBomCodes(): Promise<string[]> {
  const res = await apiClient.get<string[]>(ENDPOINTS.bom.unregistered)
  return res.data
}
