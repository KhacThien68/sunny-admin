import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type {
  MrpRunStatus,
  MrpLine,
  MrpRound,
  MrpRunSummary,
  MrpRunDetail,
  MrpRunDetailResponse,
  CreateMrpRunResponse,
} from '../types'

export type { MobType } from '../types'
export type {
  MrpRunStatus,
  MrpLine,
  MrpRound,
  MrpRunSummary,
  MrpRunDetail,
  MrpRunDetailResponse,
  CreateMrpRunResponse,
}

export async function createMrpRun(): Promise<CreateMrpRunResponse> {
  const res = await apiClient.post<CreateMrpRunResponse>(ENDPOINTS.mrp.runs)
  return res.data
}

export async function getMrpRuns(): Promise<MrpRunSummary[]> {
  const res = await apiClient.get<MrpRunSummary[]>(ENDPOINTS.mrp.runs)
  return res.data
}

export async function getMrpRunDetail(
  id: number,
): Promise<MrpRunDetailResponse> {
  const res = await apiClient.get<MrpRunDetailResponse>(
    ENDPOINTS.mrp.runById(id),
  )
  return res.data
}

export async function patchMrpLine(
  runId: number,
  lineId: number,
  body: { purchase: number },
): Promise<MrpLine> {
  const res = await apiClient.patch<MrpLine>(
    ENDPOINTS.mrp.lines(runId, lineId),
    body,
  )
  return res.data
}

export async function closeRound(runId: number): Promise<MrpRunDetailResponse> {
  const res = await apiClient.post<MrpRunDetailResponse>(
    ENDPOINTS.mrp.closeRound(runId),
  )
  return res.data
}
