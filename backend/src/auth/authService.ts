import { verifyPassword } from './passwords.js'
import { signAccessToken } from './jwt.js'
import { getActiveUserByLogin, getUserById, updateLastLogin } from './userRepository.js'
import type { PublicUser } from './types.js'

export async function authenticate(login: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const user = await getActiveUserByLogin(login)
  if (!user) {
    throw new Error('Usuário ou senha inválidos')
  }

  const passwordOk = await verifyPassword(user.passwordHash, password)
  if (!passwordOk) {
    throw new Error('Usuário ou senha inválidos')
  }

  await updateLastLogin(user.id)
  const refreshed = await getUserById(user.id)
  if (!refreshed) {
    throw new Error('Não foi possível carregar o usuário autenticado')
  }

  const token = signAccessToken(user)
  return { token, user: refreshed }
}

export async function getProfile(sub: number): Promise<PublicUser | null> {
  return getUserById(sub)
}
