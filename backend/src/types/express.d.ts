import type { AuthTokenPayload } from '../auth/types.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

export {}
