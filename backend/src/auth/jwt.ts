import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken'
import type { AuthTokenPayload, UserRecord, UserRole } from './types.js'

const JWT_SECRET: Secret = process.env.AUTH_JWT_SECRET ?? 'change-me'
const JWT_EXPIRES_IN = (process.env.AUTH_JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn']

export function signAccessToken(user: UserRecord): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    login: user.login,
    role: user.role,
  }

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  }
  return jwt.sign(payload, JWT_SECRET, options)
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET)
  if (typeof decoded === 'string') {
    throw new Error('Token inválido')
  }

  const payload = decoded as JwtPayload & { login?: string; role?: UserRole }
  const subjectValue = typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub
  if (!payload.login || (payload.role !== 'padrao' && payload.role !== 'admin') || typeof subjectValue !== 'number' || Number.isNaN(subjectValue)) {
    throw new Error('Token inválido')
  }

  return {
    sub: subjectValue,
    login: payload.login,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
  }
}
