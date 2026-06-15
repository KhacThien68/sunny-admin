import type { PaginatedResponse } from './common'

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

export interface ComponentsListParams {
  search?: string
  classification?: string
  page?: number
  pageSize?: number
}

export type ComponentsListResponse = PaginatedResponse<Component>

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

export interface ComponentSearchItem {
  code: string
  description: string | null
}

export interface ComponentSearchResponse {
  items: ComponentSearchItem[]
}
