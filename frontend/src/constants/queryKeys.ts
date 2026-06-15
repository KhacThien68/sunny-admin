export const QUERY_KEYS = {
  // Components
  components: (params?: unknown) =>
    params === undefined
      ? (['components'] as const)
      : (['components', params] as const),
  classifications: ['components', 'classifications'] as const,
  componentsSearch: (search: string) => ['components-search', search] as const,

  // BOM
  bom: (parentFilter?: string) => ['bom', parentFilter] as const,
  bomBase: ['bom'] as const,
  bomTree: (code: string) => ['bom-tree', code] as const,
  bomTreeBase: ['bom-tree'] as const,
  bomUnregistered: ['bom-unregistered'] as const,

  // On-Hand
  onhand: ['onhand'] as const,

  // Personnel
  personnel: ['personnel'] as const,

  // Users
  users: ['users'] as const,

  // Purchasing Teams
  purchasingTeams: ['purchasing-teams'] as const,
  purchasingTeam: (id: number) => ['purchasing-team', id] as const,
  unassignedComponents: ['unassigned-components'] as const,

  // Orders
  orders: ['orders'] as const,
  latestAggregation: ['latest-aggregation'] as const,

  // MRP
  mrpRuns: ['mrp-runs'] as const,
  mrpRun: (id: number) => ['mrp-run', id] as const,

  // Outputs
  outputRuns: ['output-runs'] as const,
  outputPurchase: (runId?: number) => ['output-purchase', runId] as const,
  outputRecovery: (runId?: number) => ['output-recovery', runId] as const,
  outputPsi: (runId?: number) => ['output-psi', runId] as const,

  // Permissions
  permissionsScreens: ['permissions', 'screens'] as const,
  permissionsForUser: (userId: number) => ['permissions', userId] as const,

  // Component classifications (alias used in TeamDetailPage)
  componentClassifications: ['component-classifications'] as const,
} as const
