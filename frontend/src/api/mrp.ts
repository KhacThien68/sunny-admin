import { apiClient } from './client'

// ── Shared types ─────────────────────────────────────────────────────────────

export type MobType = 'KHONG' | 'CO_THE' | 'BAT_BUOC'
export type MrpRunStatus = 'RUNNING' | 'DONE'

// ── MRP Line (full) ──────────────────────────────────────────────────────────

export interface MrpLine {
  id: number
  componentCode: string
  orderQty: number
  onhand: number
  levels: number
  demand: number
  purchase: number
  manufacturing: number
  recovery: number
  locked: boolean
  description: string | null
  uom: string | null
  mob: MobType
  moq: number
}

// ── MRP Round ────────────────────────────────────────────────────────────────

export interface MrpRound {
  round: number
  locked: boolean
  lines: MrpLine[]
}

// ── MRP Run (summary — list) ─────────────────────────────────────────────────

export interface MrpRunSummary {
  id: number
  status: MrpRunStatus
  currentRound: number
  createdAt: string
  createdByName?: string | null
  createdById?: number | null
}

// ── MRP Run (full — detail) ──────────────────────────────────────────────────

export interface MrpRunDetail {
  id: number
  status: MrpRunStatus
  currentRound: number
  aggregationId: number
  createdById: number
  createdAt: string
}

export interface MrpRunDetailResponse {
  run: MrpRunDetail
  rounds: MrpRound[]
}

// ── Create Run response ──────────────────────────────────────────────────────

export interface CreateMrpRunResponse {
  run: MrpRunSummary & { aggregationId: number; createdById: number }
  lines: MrpLine[]
  warnings: string[]
}

// ── API functions ────────────────────────────────────────────────────────────

export async function createMrpRun(): Promise<CreateMrpRunResponse> {
  const res = await apiClient.post<CreateMrpRunResponse>('/mrp/runs')
  return res.data
}

export async function getMrpRuns(): Promise<MrpRunSummary[]> {
  const res = await apiClient.get<MrpRunSummary[]>('/mrp/runs')
  return res.data
}

export async function getMrpRunDetail(id: number): Promise<MrpRunDetailResponse> {
  const res = await apiClient.get<MrpRunDetailResponse>(`/mrp/runs/${id}`)
  return res.data
}

export async function patchMrpLine(
  runId: number,
  lineId: number,
  body: { purchase: number },
): Promise<MrpLine> {
  const res = await apiClient.patch<MrpLine>(`/mrp/runs/${runId}/lines/${lineId}`, body)
  return res.data
}

export async function closeRound(runId: number): Promise<MrpRunDetailResponse> {
  const res = await apiClient.post<MrpRunDetailResponse>(`/mrp/runs/${runId}/close-round`)
  return res.data
}
