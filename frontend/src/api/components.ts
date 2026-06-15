import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import { IMPORT_MODE, MULTIPART_HEADERS } from '../constants/http'
import type {
  Component,
  ComponentsListParams,
  ComponentsListResponse,
  CreateComponentBody,
  UpdateComponentBody,
  ImportResult,
} from '../types'

export type { MobType } from '../types'
export type {
  Component,
  ComponentsListParams,
  ComponentsListResponse,
  CreateComponentBody,
  UpdateComponentBody,
}

/** @deprecated use ImportResult from '../types' */
export type ImportPreviewResponse = ImportResult

export async function getComponents(
  params: ComponentsListParams,
): Promise<ComponentsListResponse> {
  const res = await apiClient.get<ComponentsListResponse>(
    ENDPOINTS.components.base,
    {
      params,
    },
  )
  return res.data
}

export async function getComponentClassifications(): Promise<string[]> {
  const res = await apiClient.get<string[]>(
    ENDPOINTS.components.classifications,
  )
  return res.data
}

export async function createComponent(
  body: CreateComponentBody,
): Promise<Component> {
  const res = await apiClient.post<Component>(ENDPOINTS.components.base, body)
  return res.data
}

export async function updateComponent(
  id: number,
  body: UpdateComponentBody,
): Promise<Component> {
  const res = await apiClient.patch<Component>(
    ENDPOINTS.components.byId(id),
    body,
  )
  return res.data
}

export async function deleteComponent(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.components.byId(id))
}

export async function downloadComponentTemplate(): Promise<Blob> {
  const res = await apiClient.get<Blob>(ENDPOINTS.components.template, {
    responseType: 'blob',
  })
  return res.data
}

export async function importComponentsPreview(
  file: File,
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<ImportResult>(
    ENDPOINTS.components.import,
    formData,
    {
      headers: MULTIPART_HEADERS,
      params: { mode: IMPORT_MODE.PREVIEW },
    },
  )
  return res.data
}

export async function importComponentsCommit(
  file: File,
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<ImportResult>(
    ENDPOINTS.components.import,
    formData,
    {
      headers: MULTIPART_HEADERS,
      params: { mode: IMPORT_MODE.COMMIT },
    },
  )
  return res.data
}
