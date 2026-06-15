import type { MobType } from './component'

export type MrpRunStatus = 'RUNNING' | 'DONE'

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

export interface MrpRound {
  round: number
  locked: boolean
  lines: MrpLine[]
}

export interface MrpRunSummary {
  id: number
  status: MrpRunStatus
  currentRound: number
  createdAt: string
  createdByName?: string | null
  createdById?: number | null
}

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

export interface CreateMrpRunResponse {
  run: MrpRunSummary & { aggregationId: number; createdById: number }
  lines: MrpLine[]
  warnings: string[]
}
