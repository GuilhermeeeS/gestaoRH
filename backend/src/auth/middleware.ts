import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from './jwt.js'
import { extractTokenFromRequest } from './cookies.js'
import type { AuthTokenPayload, UserRole } from './types.js'

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req)
  if (!token) {
    res.status(401).json({ message: 'Token ausente' })
    return
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch (error) {
    console.error('Falha ao validar token JWT', error)
    res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const payload = req.user as AuthTokenPayload | undefined
    if (!payload) {
      res.status(401).json({ message: 'Não autenticado' })
      return
    }

    if (payload.role !== role) {
      res.status(403).json({ message: 'Permissão negada' })
      return
    }

    next()
  }
}
