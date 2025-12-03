export type UserRole = 'padrao' | 'admin'

export type AuthUser = {
  id: number
  login: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}
