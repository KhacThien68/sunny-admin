import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type {
  OrderStatus,
  OrderSummary,
  OrderLine,
  OrderDetail,
  CreateOrderBody,
  UpdateOrderBody,
  AggregationLine,
  AggregationResult,
  LatestAggregationLine,
  LatestAggregation,
} from '../types'

export type {
  OrderStatus,
  OrderSummary,
  OrderLine,
  OrderDetail,
  CreateOrderBody,
  UpdateOrderBody,
  AggregationLine,
  AggregationResult,
  LatestAggregationLine,
  LatestAggregation,
}

export async function getOrders(): Promise<OrderSummary[]> {
  const res = await apiClient.get<OrderSummary[]>(ENDPOINTS.orders.base)
  return res.data
}

export async function getOrder(id: number): Promise<OrderDetail> {
  const res = await apiClient.get<OrderDetail>(ENDPOINTS.orders.byId(id))
  return res.data
}

export async function createOrder(body: CreateOrderBody): Promise<OrderDetail> {
  const res = await apiClient.post<OrderDetail>(ENDPOINTS.orders.base, body)
  return res.data
}

export async function updateOrder(
  id: number,
  body: UpdateOrderBody,
): Promise<OrderDetail> {
  const res = await apiClient.patch<OrderDetail>(
    ENDPOINTS.orders.byId(id),
    body,
  )
  return res.data
}

export async function deleteOrder(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.orders.byId(id))
}

export async function aggregateOrders(): Promise<AggregationResult> {
  const res = await apiClient.post<AggregationResult>(
    ENDPOINTS.orders.aggregate,
  )
  return res.data
}

export async function getLatestAggregation(): Promise<LatestAggregation | null> {
  try {
    const res = await apiClient.get<LatestAggregation>(
      ENDPOINTS.orders.aggregationsLatest,
    )
    return res.data
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr?.response?.status === 404) {
      return null
    }
    throw err
  }
}
