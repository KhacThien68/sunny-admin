import { apiClient } from './client'

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

export async function getOrders(): Promise<OrderSummary[]> {
  const res = await apiClient.get<OrderSummary[]>('/orders')
  return res.data
}

export async function getOrder(id: number): Promise<OrderDetail> {
  const res = await apiClient.get<OrderDetail>(`/orders/${id}`)
  return res.data
}

export async function createOrder(body: CreateOrderBody): Promise<OrderDetail> {
  const res = await apiClient.post<OrderDetail>('/orders', body)
  return res.data
}

export async function updateOrder(
  id: number,
  body: UpdateOrderBody,
): Promise<OrderDetail> {
  const res = await apiClient.patch<OrderDetail>(`/orders/${id}`, body)
  return res.data
}

export async function deleteOrder(id: number): Promise<void> {
  await apiClient.delete(`/orders/${id}`)
}

export async function aggregateOrders(): Promise<AggregationResult> {
  const res = await apiClient.post<AggregationResult>('/orders/aggregate')
  return res.data
}

export async function getLatestAggregation(): Promise<LatestAggregation | null> {
  try {
    const res = await apiClient.get<LatestAggregation>('/orders/aggregations/latest')
    return res.data
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr?.response?.status === 404) {
      return null
    }
    throw err
  }
}
