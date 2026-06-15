export type OrderStatus = 'DRAFT' | 'AGGREGATED'

export interface OrderSummary {
  id: number
  code: string
  customerGroup: string
  note: string | null
  status: OrderStatus
  createdById: number
  createdAt: string
  lineCount: number
}

export interface OrderLine {
  id: number
  componentCode: string
  quantity: number
  registered: boolean
  description: string | null
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[]
}

export interface CreateOrderBody {
  customerGroup: string
  note?: string
  code?: string
  lines: Array<{ componentCode: string; quantity: number }>
}

export type UpdateOrderBody = CreateOrderBody

export interface AggregationLine {
  componentCode: string
  totalQty: number
}

export interface AggregationResult {
  id: number
  createdAt: string
  lines: AggregationLine[]
}

export interface LatestAggregationLine {
  componentCode: string
  totalQty: number
  registered: boolean
  description: string | null
}

export interface LatestAggregation {
  id: number
  createdAt: string
  lines: LatestAggregationLine[]
}
