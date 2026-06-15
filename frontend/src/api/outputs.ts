import { apiClient } from './client'

// ── Shared types ─────────────────────────────────────────────────────────────

export interface OutputRunSummary {
  id: number
  status: 'RUNNING' | 'DONE'
  currentRound: number
  createdAt: string
}

export interface OutputRunInfo {
  id: number
  status: 'RUNNING' | 'DONE'
  createdAt: string
  rounds: number[]
}

// ── Purchase / Recovery summary ───────────────────────────────────────────────

export interface PurchaseSummaryItem {
  code: string
  classification: string | null
  description: string | null
  uom: string | null
  total: number
  rounds: Record<string, number>
}

export interface PurchaseSummaryResponse {
  run: OutputRunInfo
  items: PurchaseSummaryItem[]
}

// ── PSI ───────────────────────────────────────────────────────────────────────

export interface PsiItem {
  code: string
  classification: string | null
  description: string | null
  uom: string | null
  onhand: number
  purchase: number
  sale: number
  closing: number
}

export interface PsiResponse {
  run: OutputRunInfo
  items: PsiItem[]
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getOutputRuns(): Promise<OutputRunSummary[]> {
  const res = await apiClient.get<OutputRunSummary[]>('/outputs/runs')
  return res.data
}

export async function getPurchaseSummary(runId?: number): Promise<PurchaseSummaryResponse> {
  const res = await apiClient.get<PurchaseSummaryResponse>('/outputs/purchase-summary', {
    params: runId !== undefined ? { runId } : undefined,
  })
  return res.data
}

export async function getRecoverySummary(runId?: number): Promise<PurchaseSummaryResponse> {
  const res = await apiClient.get<PurchaseSummaryResponse>('/outputs/recovery-summary', {
    params: runId !== undefined ? { runId } : undefined,
  })
  return res.data
}

export async function getPsi(runId?: number): Promise<PsiResponse> {
  const res = await apiClient.get<PsiResponse>('/outputs/psi', {
    params: runId !== undefined ? { runId } : undefined,
  })
  return res.data
}
