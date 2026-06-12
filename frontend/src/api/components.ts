import { apiClient } from './client'

export type MobType = 'KHONG' | 'CO_THE' | 'BAT_BUOC'

export interface Component {
  id: number
  code: string
  classification: string | null
  description: string | null
  uom: string
  mob: MobType
  moq: number
  inventoryLevel: number
  createdAt: string
  updatedAt: string
}

export interface ComponentsListResponse {
  items: Component[]
  total: number
  page: number
  pageSize: number
}

export interface ComponentsListParams {
  search?: string
  classification?: string
  page?: number
  pageSize?: number
}

export interface CreateComponentBody {
  code: string
  classification?: string
  description?: string
  uom: string
  mob: MobType
  moq?: number
  inventoryLevel?: number
}

export interface UpdateComponentBody {
  classification?: string
  description?: string
  uom?: string
  mob?: MobType
  moq?: number
  inventoryLevel?: number
}

export interface ImportPreviewResponse {
  valid: number
  errors: Array<{ row: number; column: string; message: string }>
  warnings?: string[]
  committed?: boolean
}

export async function getComponents(
  params: ComponentsListParams,
): Promise<ComponentsListResponse> {
  const res = await apiClient.get<ComponentsListResponse>('/components', {
    params,
  })
  return res.data
}

export async function getComponentClassifications(): Promise<string[]> {
  const res = await apiClient.get<string[]>('/components/classifications')
  return res.data
}

export async function createComponent(body: CreateComponentBody): Promise<Component> {
  const res = await apiClient.post<Component>('/components', body)
  return res.data
}

export async function updateComponent(
  id: number,
  body: UpdateComponentBody,
): Promise<Component> {
  const res = await apiClient.patch<Component>(`/components/${id}`, body)
  return res.data
}

export async function deleteComponent(id: number): Promise<void> {
  await apiClient.delete(`/components/${id}`)
}

export async function downloadComponentTemplate(): Promise<Blob> {
  const res = await apiClient.get<Blob>('/components/template', {
    responseType: 'blob',
  })
  return res.data
}

export async function importComponentsPreview(
  file: File,
): Promise<ImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<ImportPreviewResponse>(
    '/components/import?mode=preview',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}

export async function importComponentsCommit(
  file: File,
): Promise<ImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<ImportPreviewResponse>(
    '/components/import?mode=commit',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}
