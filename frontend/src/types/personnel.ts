export interface Personnel {
  id: number
  name: string
  position: string | null
  team: string | null
  email: string
  phone: string | null
  isAdmin: boolean
  isActive: boolean
}

export interface CreatePersonnelBody {
  name: string
  email: string
  position?: string
  team?: string
  phone?: string
}

export interface UpdatePersonnelBody {
  name?: string
  email?: string
  position?: string
  team?: string
  phone?: string
}
