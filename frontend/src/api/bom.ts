import { apiClient } from './client'

export interface BomRow {
  id: number
  parentCode: string
  childCode: string
  quantityPerUnit: number
  parentRegistered: boolean
  childRegistered: boolean
  parentDescription?: string | null
  childDescription?: string | null
}

export interface BomTreeNode {
  code: string
  description?: string | null
  registered: boolean
  quantityPerUnit: number
  children: BomTreeNode[]
}

export interface CreateBomBody {
  parentCode: string
  childCode: string
  quantityPerUnit: number
}

export interface UpdateBomBody {
  quantityPerUnit: number
}

export async function getBomList(parentCode?: string): Promise<BomRow[]> {
  const res = await apiClient.get<BomRow[]>('/bom', {
    params: parentCode ? { parentCode } : {},
  })
  return res.data
}

export async function createBomRow(body: CreateBomBody): Promise<BomRow> {
  const res = await apiClient.post<BomRow>('/bom', body)
  return res.data
}

export async function updateBomRow(id: number, body: UpdateBomBody): Promise<BomRow> {
  const res = await apiClient.patch<BomRow>(`/bom/${id}`, body)
  return res.data
}

export async function deleteBomRow(id: number): Promise<void> {
  await apiClient.delete(`/bom/${id}`)
}

export async function getBomTree(code: string): Promise<BomTreeNode> {
  const res = await apiClient.get<BomTreeNode>(`/bom/tree/${code}`)
  return res.data
}

export async function getUnregisteredBomCodes(): Promise<string[]> {
  const res = await apiClient.get<string[]>('/bom/unregistered')
  return res.data
}
