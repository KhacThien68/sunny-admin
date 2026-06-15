import { apiClient } from './client'
import { ENDPOINTS } from '../constants/endpoints'
import type {
  PurchasingTeamSummary,
  PurchasingTeamDetail,
  TeamMember,
  TeamScope,
  CreateTeamBody,
  UpdateTeamBody,
  AddMemberBody,
  AddScopeBody,
  AddScopeByClassification,
  AddScopeByComponent,
  Component,
} from '../types'

export type {
  PurchasingTeamSummary,
  PurchasingTeamDetail,
  TeamMember,
  TeamScope,
  CreateTeamBody,
  UpdateTeamBody,
  AddMemberBody,
  AddScopeBody,
  AddScopeByClassification,
  AddScopeByComponent,
}

export async function getPurchasingTeams(): Promise<PurchasingTeamSummary[]> {
  const res = await apiClient.get<PurchasingTeamSummary[]>(
    ENDPOINTS.purchasingTeams.base,
  )
  return res.data
}

export async function getPurchasingTeam(
  id: number,
): Promise<PurchasingTeamDetail> {
  const res = await apiClient.get<PurchasingTeamDetail>(
    ENDPOINTS.purchasingTeams.byId(id),
  )
  return res.data
}

export async function createPurchasingTeam(
  body: CreateTeamBody,
): Promise<PurchasingTeamSummary> {
  const res = await apiClient.post<PurchasingTeamSummary>(
    ENDPOINTS.purchasingTeams.base,
    body,
  )
  return res.data
}

export async function updatePurchasingTeam(
  id: number,
  body: UpdateTeamBody,
): Promise<PurchasingTeamSummary> {
  const res = await apiClient.patch<PurchasingTeamSummary>(
    ENDPOINTS.purchasingTeams.byId(id),
    body,
  )
  return res.data
}

export async function deletePurchasingTeam(id: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.purchasingTeams.byId(id))
}

export async function addTeamMember(
  id: number,
  body: AddMemberBody,
): Promise<void> {
  await apiClient.post(ENDPOINTS.purchasingTeams.members(id), body)
}

export async function removeTeamMember(
  id: number,
  memberId: number,
): Promise<void> {
  await apiClient.delete(ENDPOINTS.purchasingTeams.memberById(id, memberId))
}

export async function addTeamScope(
  id: number,
  body: AddScopeBody,
): Promise<void> {
  await apiClient.post(ENDPOINTS.purchasingTeams.scopes(id), body)
}

export async function removeTeamScope(
  id: number,
  scopeId: number,
): Promise<void> {
  await apiClient.delete(ENDPOINTS.purchasingTeams.scopeById(id, scopeId))
}

export async function getUnassignedComponents(): Promise<Component[]> {
  const res = await apiClient.get<Component[]>(
    ENDPOINTS.purchasingTeams.unassignedComponents,
  )
  return res.data
}
