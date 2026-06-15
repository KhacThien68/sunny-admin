export interface PurchasingTeamSummary {
  id: number
  name: string
  description: string | null
  memberCount: number
  scopeCount: number
}

export interface TeamMember {
  memberId: number
  userId: number
  name: string
  email: string
  team: string | null
}

export interface TeamScope {
  scopeId: number
  type: 'classification' | 'component'
  value: string
  componentDescription?: string | null
}

export interface PurchasingTeamDetail {
  id: number
  name: string
  description: string | null
  members: TeamMember[]
  scopes: TeamScope[]
}

export interface CreateTeamBody {
  name: string
  description?: string
}

export interface UpdateTeamBody {
  name?: string
  description?: string
}

export interface AddMemberBody {
  userId: number
}

export interface AddScopeByClassification {
  classification: string
}

export interface AddScopeByComponent {
  componentCode: string
}

export type AddScopeBody = AddScopeByClassification | AddScopeByComponent
