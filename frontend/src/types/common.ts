export interface RowError {
  row: number
  column: string
  message: string
}

export interface ImportResult {
  valid: number
  errors: RowError[]
  warnings?: string[]
  committed?: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
