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
