export type UserRole = 'padrao' | 'admin'

export type AuthTokenPayload = {
  sub: number
  login: string
  role: UserRole
  iat?: number
  exp?: number
}

export type UserRecord = {
  id: number
  login: string
  passwordHash: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>
