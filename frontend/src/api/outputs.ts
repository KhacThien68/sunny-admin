import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type {
  OutputRunSummary,
  OutputRunInfo,
  PurchaseSummaryItem,
  PurchaseSummaryResponse,
  PsiItem,
  PsiResponse,
} from '../types'

export type {
  OutputRunSummary,
  OutputRunInfo,
  PurchaseSummaryItem,
  PurchaseSummaryResponse,
  PsiItem,
  PsiResponse,
}

export async function getOutputRuns(): Promise<OutputRunSummary[]> {
  const res = await apiClient.get<OutputRunSummary[]>(ENDPOINTS.outputs.runs)
  return res.data
}

export async function getPurchaseSummary(
  runId?: number,
): Promise<PurchaseSummaryResponse> {
  const res = await apiClient.get<PurchaseSummaryResponse>(
    ENDPOINTS.outputs.purchaseSummary,
    {
      params: runId !== undefined ? { runId } : undefined,
    },
  )
  return res.data
}

export async function getRecoverySummary(
  runId?: number,
): Promise<PurchaseSummaryResponse> {
  const res = await apiClient.get<PurchaseSummaryResponse>(
    ENDPOINTS.outputs.recoverySummary,
    {
      params: runId !== undefined ? { runId } : undefined,
    },
  )
  return res.data
}

export async function getPsi(runId?: number): Promise<PsiResponse> {
  const res = await apiClient.get<PsiResponse>(ENDPOINTS.outputs.psi, {
    params: runId !== undefined ? { runId } : undefined,
  })
  return res.data
}
