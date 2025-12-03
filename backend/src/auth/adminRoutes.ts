import { Router } from 'express'
import { authenticateJWT, requireRole } from './middleware.js'
import { listUsers, createUser, updateUserRole, updateUserStatus, updateUserPassword, deleteUser } from './userRepository.js'
import { hashPassword } from './passwords.js'
import type { UserRole } from './types.js'

const adminRouter = Router()

adminRouter.use(authenticateJWT, requireRole('admin'))

adminRouter.get('/users', async (_req, res) => {
  try {
    const users = await listUsers()
    res.json({ users })
  } catch (error) {
    console.error('Falha ao listar usuários', error)
    res.status(500).json({ message: 'Não foi possível listar os usuários' })
  }
})

adminRouter.post('/users', async (req, res) => {
  const { login, password, role } = req.body ?? {}
  const normalizedLogin = typeof login === 'string' ? login.trim() : ''
  const normalizedPassword = typeof password === 'string' ? password : ''
  const normalizedRole = parseRole(role)

  if (!normalizedLogin) {
    res.status(400).json({ message: 'Informe o login do usuário' })
    return
  }
  if (normalizedLogin.length < 3) {
    res.status(400).json({ message: 'Login deve conter ao menos 3 caracteres' })
    return
  }
  if (!normalizedPassword || normalizedPassword.length < 6) {
    res.status(400).json({ message: 'A senha deve conter ao menos 6 caracteres' })
    return
  }
  if (!normalizedRole) {
    res.status(400).json({ message: "Role inválida. Use 'padrao' ou 'admin'" })
    return
  }

  try {
    const passwordHash = await hashPassword(normalizedPassword)
    const user = await createUser(normalizedLogin, passwordHash, normalizedRole)
    res.status(201).json({ user })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: 'Já existe um usuário com esse login' })
      return
    }
    console.error('Falha ao criar usuário', error)
    res.status(500).json({ message: 'Não foi possível criar o usuário' })
  }
})

adminRouter.patch('/users/:id/role', async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) {
    res.status(400).json({ message: 'ID inválido' })
    return
  }
  const role = parseRole(req.body?.role)
  if (!role) {
    res.status(400).json({ message: "Role inválida. Use 'padrao' ou 'admin'" })
    return
  }

  try {
    const user = await updateUserRole(id, role)
    if (!user) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }
    res.json({ user })
  } catch (error) {
    console.error('Falha ao atualizar role do usuário', error)
    res.status(500).json({ message: 'Não foi possível atualizar o usuário' })
  }
})

adminRouter.patch('/users/:id/status', async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) {
    res.status(400).json({ message: 'ID inválido' })
    return
  }
  const active = typeof req.body?.active === 'boolean' ? req.body.active : null
  if (active === null) {
    res.status(400).json({ message: 'Informe o status ativo/inativo' })
    return
  }

  try {
    const user = await updateUserStatus(id, active)
    if (!user) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }
    res.json({ user })
  } catch (error) {
    console.error('Falha ao atualizar status do usuário', error)
    res.status(500).json({ message: 'Não foi possível atualizar o usuário' })
  }
})

adminRouter.post('/users/:id/reset-password', async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) {
    res.status(400).json({ message: 'ID inválido' })
    return
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!password || password.length < 6) {
    res.status(400).json({ message: 'Informe uma nova senha com ao menos 6 caracteres' })
    return
  }

  try {
    const passwordHash = await hashPassword(password)
    const user = await updateUserPassword(id, passwordHash)
    if (!user) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }
    res.json({ user })
  } catch (error) {
    console.error('Falha ao redefinir senha', error)
    res.status(500).json({ message: 'Não foi possível redefinir a senha' })
  }
})

adminRouter.delete('/users/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) {
    res.status(400).json({ message: 'ID inválido' })
    return
  }

  if (req.user?.sub === id) {
    res.status(400).json({ message: 'Você não pode remover o próprio usuário autenticado' })
    return
  }

  try {
    const removed = await deleteUser(id)
    if (!removed) {
      res.status(404).json({ message: 'Usuário não encontrado' })
      return
    }
    res.status(204).end()
  } catch (error) {
    console.error('Falha ao remover usuário', error)
    res.status(500).json({ message: 'Não foi possível remover o usuário' })
  }
})

function parseRole(value: unknown): UserRole | null {
  if (value === 'padrao' || value === 'admin') {
    return value
  }
  return null
}

function parseId(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }
  return null
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return /UNIQUE constraint failed/i.test(error.message)
}

export default adminRouter

