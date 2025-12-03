import type { Request, Response } from 'express'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token'
const COOKIE_PATH = process.env.AUTH_COOKIE_PATH ?? '/'
const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === 'true'
const COOKIE_HTTP_ONLY = process.env.AUTH_COOKIE_HTTP_ONLY !== 'false'
const COOKIE_SAME_SITE = normalizeSameSite(process.env.AUTH_COOKIE_SAME_SITE)
const COOKIE_MAX_AGE = normalizeMaxAge(process.env.AUTH_COOKIE_MAX_AGE_MS)

function normalizeSameSite(value: string | undefined): 'lax' | 'strict' | 'none' {
  if (!value) return 'lax'
  const normalized = value.toLowerCase()
  if (normalized === 'strict' || normalized === 'none' || normalized === 'lax') {
    return normalized
  }
  return 'lax'
}

function normalizeMaxAge(value: string | undefined): number {
  const parsed = value ? Number(value) : NaN
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return 60 * 60 * 1000 // 1h
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: COOKIE_HTTP_ONLY,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: COOKIE_PATH,
  })
}

export function extractTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME]
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim()
  }

  const header = req.headers.authorization
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = header.slice(7).trim()
  return token || null
}
