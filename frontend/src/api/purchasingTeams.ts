import { apiClient } from './client'
import type { Component } from './components'

// ── List response types ──────────────────────────────────────────────────────

export interface PurchasingTeamSummary {
  id: number
  name: string
  description: string | null
  memberCount: number
  scopeCount: number
}

// ── Detail response types ────────────────────────────────────────────────────

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

// ── Request body types ───────────────────────────────────────────────────────

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

// ── API functions ────────────────────────────────────────────────────────────

export async function getPurchasingTeams(): Promise<PurchasingTeamSummary[]> {
  const res = await apiClient.get<PurchasingTeamSummary[]>('/purchasing-teams')
  return res.data
}

export async function getPurchasingTeam(id: number): Promise<PurchasingTeamDetail> {
  const res = await apiClient.get<PurchasingTeamDetail>(`/purchasing-teams/${id}`)
  return res.data
}

export async function createPurchasingTeam(body: CreateTeamBody): Promise<PurchasingTeamSummary> {
  const res = await apiClient.post<PurchasingTeamSummary>('/purchasing-teams', body)
  return res.data
}

export async function updatePurchasingTeam(
  id: number,
  body: UpdateTeamBody,
): Promise<PurchasingTeamSummary> {
  const res = await apiClient.patch<PurchasingTeamSummary>(`/purchasing-teams/${id}`, body)
  return res.data
}

export async function deletePurchasingTeam(id: number): Promise<void> {
  await apiClient.delete(`/purchasing-teams/${id}`)
}

export async function addTeamMember(id: number, body: AddMemberBody): Promise<void> {
  await apiClient.post(`/purchasing-teams/${id}/members`, body)
}

export async function removeTeamMember(id: number, memberId: number): Promise<void> {
  await apiClient.delete(`/purchasing-teams/${id}/members/${memberId}`)
}

export async function addTeamScope(id: number, body: AddScopeBody): Promise<void> {
  await apiClient.post(`/purchasing-teams/${id}/scopes`, body)
}

export async function removeTeamScope(id: number, scopeId: number): Promise<void> {
  await apiClient.delete(`/purchasing-teams/${id}/scopes/${scopeId}`)
}

export async function getUnassignedComponents(): Promise<Component[]> {
  const res = await apiClient.get<Component[]>('/purchasing-teams/unassigned-components')
  return res.data
}
