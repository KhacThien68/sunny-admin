export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  permissions: {
    me: '/permissions/me',
    screens: '/permissions/screens',
    byUser: (userId: number) => `/permissions/${userId}`,
  },
  components: {
    base: '/components',
    classifications: '/components/classifications',
    template: '/components/template',
    import: '/components/import',
    byId: (id: number) => `/components/${id}`,
  },
  bom: {
    base: '/bom',
    template: '/bom/template',
    import: '/bom/import',
    unregistered: '/bom/unregistered',
    byId: (id: number) => `/bom/${id}`,
    tree: (code: string) => `/bom/tree/${code}`,
  },
  onhand: {
    base: '/onhand',
    template: '/onhand/template',
    import: '/onhand/import',
    byCode: (componentCode: string) => `/onhand/${componentCode}`,
    byId: (id: number) => `/onhand/${id}`,
  },
  personnel: {
    base: '/personnel',
    template: '/personnel/template',
    import: '/personnel/import',
    byId: (id: number) => `/personnel/${id}`,
  },
  users: {
    base: '/users',
    byId: (id: number) => `/users/${id}`,
  },
  purchasingTeams: {
    base: '/purchasing-teams',
    unassignedComponents: '/purchasing-teams/unassigned-components',
    byId: (id: number) => `/purchasing-teams/${id}`,
    members: (id: number) => `/purchasing-teams/${id}/members`,
    memberById: (id: number, memberId: number) =>
      `/purchasing-teams/${id}/members/${memberId}`,
    scopes: (id: number) => `/purchasing-teams/${id}/scopes`,
    scopeById: (id: number, scopeId: number) =>
      `/purchasing-teams/${id}/scopes/${scopeId}`,
  },
  orders: {
    base: '/orders',
    template: '/orders/template',
    import: '/orders/import',
    aggregate: '/orders/aggregate',
    aggregationsLatest: '/orders/aggregations/latest',
    byId: (id: number) => `/orders/${id}`,
  },
  mrp: {
    runs: '/mrp/runs',
    runById: (id: number) => `/mrp/runs/${id}`,
    lines: (runId: number, lineId: number) =>
      `/mrp/runs/${runId}/lines/${lineId}`,
    closeRound: (runId: number) => `/mrp/runs/${runId}/close-round`,
  },
  outputs: {
    runs: '/outputs/runs',
    purchaseSummary: '/outputs/purchase-summary',
    recoverySummary: '/outputs/recovery-summary',
    psi: '/outputs/psi',
  },
} as const
