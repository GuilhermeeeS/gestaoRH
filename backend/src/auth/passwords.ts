import bcrypt from 'bcryptjs'

const DEFAULT_ROUNDS = 10
const rounds = Number(process.env.AUTH_BCRYPT_ROUNDS ?? DEFAULT_ROUNDS)

export async function hashPassword(plain: string): Promise<string> {
  if (!plain) {
    throw new Error('Senha não pode ser vazia')
  }
  return bcrypt.hash(plain, Math.max(4, rounds))
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain) {
    return false
  }
  return bcrypt.compare(plain, hash)
}
