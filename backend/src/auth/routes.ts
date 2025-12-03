import { Router } from 'express'
import { authenticate, getProfile } from './authService.js'
import { authenticateJWT } from './middleware.js'
import { setAuthCookie, clearAuthCookie } from './cookies.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { login, password } = req.body ?? {}

  if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password.trim()) {
    res.status(400).json({ message: 'Informe login e senha' })
    return
  }

  try {
    const { token, user } = await authenticate(login, password)
    setAuthCookie(res, token)
    res.json({ user })
  } catch (error) {
    console.error('Falha no login', error)
    res.status(401).json({ message: 'Usuário ou senha inválidos' })
  }
})

router.get('/me', authenticateJWT, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'Token inválido' })
    return
  }

  try {
    const profile = await getProfile(req.user.sub)
    if (!profile) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }
    res.json({ user: profile })
  } catch (error) {
    console.error('Falha ao carregar perfil', error)
    res.status(500).json({ message: 'Não foi possível carregar o perfil' })
  }
})

router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.status(204).end()
})

export default router
