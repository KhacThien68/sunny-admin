export interface BomRow {
  id: number
  parentCode: string
  childCode: string
  quantityPerUnit: number
  parentRegistered: boolean
  childRegistered: boolean
  parentDescription?: string | null
  childDescription?: string | null
}

export interface BomTreeNode {
  code: string
  description?: string | null
  registered: boolean
  quantityPerUnit: number
  children: BomTreeNode[]
}

export interface CreateBomBody {
  parentCode: string
  childCode: string
  quantityPerUnit: number
}

export interface UpdateBomBody {
  quantityPerUnit: number
}
