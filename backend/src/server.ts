import express, { Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import authRouter from './auth/routes.js'
import adminRouter from './auth/adminRoutes.js'
import { initAuthDatabase } from './auth/database.js'
import { clocks, Clock } from './clocks.js'

const PORT = Number(process.env.PORT ?? 1332)
const CONTROL_ID_LOGIN = process.env.CONTROL_ID_LOGIN ?? 'control-id-login'
const CONTROL_ID_PASSWORD = process.env.CONTROL_ID_PASSWORD ?? 'control-id-password'
const MAX_ATTEMPTS = Number(process.env.CONTROL_ID_MAX_ATTEMPTS ?? 2)
const SESSION_TTL = Number(process.env.CONTROL_ID_SESSION_TTL_MS ?? 60_000)
const CURL_TIMEOUT_MS = Number(process.env.CONTROL_ID_CURL_TIMEOUT_MS ?? 30_000)
const CURL_BINARY = process.env.CURL_BINARY ?? 'curl'
const VERBOSE = process.env.CONTROL_ID_VERBOSE === 'true'
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
const BRTA_MASTER_IP = process.env.BRTA_MASTER_IP ?? '192.168.100.10'
const BRGO_MASTER_IP = process.env.BRGO_MASTER_IP ?? '192.168.200.10'
const COIL_MONITORED_IPS = clocks.map((clock) => clock.ip)

const app = express()

await initAuthDatabase()

if (corsOrigins?.length) {
  app.use(cors({ origin: corsOrigins, credentials: true }))
} else {
  app.use(cors({ origin: true, credentials: true }))
}

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', clocks: clocks.length })
})

app.get('/api/clocks/status', async (_req: Request, res: Response) => {
  const results = await Promise.all(clocks.map((clock) => checkClockStatus(clock)))
  res.json({ generatedAt: new Date().toISOString(), data: results })
})

app.get('/api/dashboard/overview/clocks', async (_req: Request, res: Response) => {
  try {
    const results = await Promise.all(clocks.map((clock) => checkDashboardClockStatus(clock)))
    const online = results.filter((result) => result.status === 'online').length
    res.json({
      generatedAt: new Date().toISOString(),
      total: clocks.length,
      online,
      data: results,
    })
  } catch (error) {
    console.error('Erro ao consultar resumo de relógios', error)
    res.status(500).json({ message: 'Não foi possível consultar os relógios' })
  }
})

app.get('/api/dashboard/overview/users/brta', async (_req: Request, res: Response) => {
  try {
    const payload = await fetchBrtaUserSummary()
    res.json(payload)
  } catch (error) {
    console.error('Erro ao consultar usuários BRTA', error)
    res.status(500).json({ message: 'Não foi possível consultar usuários BRTA' })
  }
})

app.get('/api/dashboard/overview/users/brgo', async (_req: Request, res: Response) => {
  try {
    const payload = await fetchBrgoUserSummary()
    res.json(payload)
  } catch (error) {
    console.error('Erro ao consultar usuários BRGO', error)
    res.status(500).json({ message: 'Não foi possível consultar usuários BRGO' })
  }
})

app.get('/api/brta/users', async (req: Request, res: Response) => {
  try {
    const params = parseUserListQuery(req)
    const payload = await fetchBrtaUserList(params)
    res.json(payload)
  } catch (error) {
    console.error('Erro ao listar usuários BRTA', error)
    res.status(500).json({ message: 'Não foi possível listar usuários BRTA' })
  }
})

app.post('/api/brta/users/update', async (req: Request, res: Response) => {
  try {
    const body = buildGeneralUpdatePayload(req.body)
    const summary = await executeUserActionAcrossClocks('update-general', body)
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao atualizar colaborador BRTA', error)
    res.status(500).json({ message: 'Não foi possível atualizar colaborador nos relógios BRTA' })
  }
})

app.post('/api/brta/users/add', async (req: Request, res: Response) => {
  try {
    const body = buildUserCreationPayload(req.body)
    const summary = await executeUserActionAcrossClocks('add-user', body, {
      endpoint: 'add_users.fcgi',
      includeMode: true,
      mode: '671',
    })
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao cadastrar colaborador BRTA', error)
    res.status(500).json({ message: 'Não foi possível cadastrar o colaborador nos relógios BRTA' })
  }
})

app.post('/api/brta/users/update-photo', async (req: Request, res: Response) => {
  try {
    const body = buildPhotoUpdatePayload(req.body)
    const summary = await executeUserActionAcrossClocks('update-photo', body)
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao atualizar foto BRTA', error)
    res.status(500).json({ message: 'Não foi possível atualizar a foto nos relógios BRTA' })
  }
})

app.post('/api/brta/users/remove-photo', async (req: Request, res: Response) => {
  try {
    const body = buildPhotoRemovalPayload(req.body)
    const summary = await executeUserActionAcrossClocks('remove-photo', body)
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao remover foto BRTA', error)
    res.status(500).json({ message: 'Não foi possível remover a foto nos relógios BRTA' })
  }
})

app.post('/api/brta/users/remove', async (req: Request, res: Response) => {
  try {
    const body = buildUserDeletionPayload(req.body)
    const summary = await executeUserActionAcrossClocks('remove-user', body, {
      endpoint: 'remove_users.fcgi',
      includeMode: false,
    })
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao remover colaborador BRTA', error)
    res.status(500).json({ message: 'Não foi possível remover o colaborador nos relógios BRTA' })
  }
})

app.get('/api/brgo/users', async (req: Request, res: Response) => {
  try {
    const params = parseUserListQuery(req)
    const payload = await fetchBrgoUserList(params)
    res.json(payload)
  } catch (error) {
    console.error('Erro ao listar usuários BRGO', error)
    res.status(500).json({ message: 'Não foi possível listar usuários BRGO' })
  }
})

app.post('/api/brgo/users/update', async (req: Request, res: Response) => {
  try {
    const body = buildGeneralUpdatePayload(req.body)
    const summary = await executeUserActionAcrossClocks('update-general', body, {}, getBrgoClocks())
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao atualizar colaborador BRGO', error)
    res.status(500).json({ message: 'Não foi possível atualizar colaborador nos relógios BRGO' })
  }
})

app.post('/api/brgo/users/add', async (req: Request, res: Response) => {
  try {
    const body = buildUserCreationPayload(req.body)
    const summary = await executeUserActionAcrossClocks(
      'add-user',
      body,
      {
        endpoint: 'add_users.fcgi',
        includeMode: true,
        mode: '671',
      },
      getBrgoClocks(),
    )
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao cadastrar colaborador BRGO', error)
    res.status(500).json({ message: 'Não foi possível cadastrar o colaborador nos relógios BRGO' })
  }
})

app.post('/api/brgo/users/update-photo', async (req: Request, res: Response) => {
  try {
    const body = buildPhotoUpdatePayload(req.body)
    const summary = await executeUserActionAcrossClocks('update-photo', body, {}, getBrgoClocks())
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao atualizar foto BRGO', error)
    res.status(500).json({ message: 'Não foi possível atualizar a foto nos relógios BRGO' })
  }
})

app.post('/api/brgo/users/remove-photo', async (req: Request, res: Response) => {
  try {
    const body = buildPhotoRemovalPayload(req.body)
    const summary = await executeUserActionAcrossClocks('remove-photo', body, {}, getBrgoClocks())
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao remover foto BRGO', error)
    res.status(500).json({ message: 'Não foi possível remover a foto nos relógios BRGO' })
  }
})

app.post('/api/brgo/users/remove', async (req: Request, res: Response) => {
  try {
    const body = buildUserDeletionPayload(req.body)
    const summary = await executeUserActionAcrossClocks(
      'remove-user',
      body,
      {
        endpoint: 'remove_users.fcgi',
        includeMode: false,
      },
      getBrgoClocks(),
    )
    res.json(summary)
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('Erro ao remover colaborador BRGO', error)
    res.status(500).json({ message: 'Não foi possível remover o colaborador nos relógios BRGO' })
  }
})

app.get('/api/dashboard/coils', async (_req: Request, res: Response) => {
  try {
    const targetClocks = getCoilMonitoredClocks()
    const data = await Promise.all(targetClocks.map((clock) => fetchCoilStatus(clock)))
    res.json({
      generatedAt: new Date().toISOString(),
      total: targetClocks.length,
      data,
    })
  } catch (error) {
    console.error('Erro ao consultar bobinas', error)
    res.status(500).json({ message: 'Não foi possível consultar bobinas' })
  }
})

app.listen(PORT, () => {
  console.log(`Control ID backend listening on port ${PORT}`)
})

type ClockStatus = Clock & {
  status: 'online' | 'offline'
  attempts: number
  lastError: string | null
}

type DashboardClockStatus = Clock & {
  status: 'online' | 'offline'
  attempts: number
  lastError: string | null
}

type CoilSummary = Clock & {
  status: 'success' | 'error'
  coilPaper: number | null
  attempts: number
  lastError: string | null
}

type UserListParams = {
  limit: number
  offset: number
  cpfs: number[]
}

type NormalizedClockUser = {
  uid: string
  name: string
  cpf: string | null
  registration: string | null
  rfid: string | null
  hasFace: boolean
  raw: Record<string, unknown>
}

type CurlRequestInit = {
  method?: string
  headers?: Record<string, string | undefined>
  body?: string | Buffer | Record<string, unknown> | URLSearchParams | null
}

type CurlResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
  json: <T = unknown>() => Promise<T>
}

type CachedSession = {
  session: string
  expiresAt: number
}

type UserSummary = {
  plant: string
  deviceId: string
  ip: string
  count: number
  generatedAt: string
}

const sessionCache = new Map<string, CachedSession>()
const loginLocks = new Map<string, Promise<string>>()
const dashboardSessionCache = new Map<string, CachedSession>()
const dashboardLoginLocks = new Map<string, Promise<string>>()
const brtaUserSessionCache = new Map<string, CachedSession>()
const brtaUserLoginLocks = new Map<string, Promise<string>>()
const brgoUserSessionCache = new Map<string, CachedSession>()
const brgoUserLoginLocks = new Map<string, Promise<string>>()
const coilSessionCache = new Map<string, CachedSession>()
const coilLoginLocks = new Map<string, Promise<string>>()
const brtaListSessionCache = new Map<string, CachedSession>()
const brtaListLoginLocks = new Map<string, Promise<string>>()
const brgoListSessionCache = new Map<string, CachedSession>()
const brgoListLoginLocks = new Map<string, Promise<string>>()

class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

type UserActionName = 'update-general' | 'update-photo' | 'remove-photo' | 'remove-user' | 'add-user'

const ACTION_SUCCESS_MESSAGES: Record<UserActionName, string> = {
  'update-general': 'Atualizado com sucesso',
  'update-photo': 'Foto atualizada com sucesso',
  'remove-photo': 'Foto removida com sucesso',
  'remove-user': 'Colaborador excluído com sucesso',
  'add-user': 'Colaborador cadastrado com sucesso',
}

type UserActionResult = {
  clockId: string
  clockLabel: string
  ip: string
  ok: boolean
  attempts: number
  statusCode: number | null
  message: string | null
}

type UserActionSummary = {
  action: UserActionName
  generatedAt: string
  total: number
  success: number
  failure: number
  results: UserActionResult[]
}

async function fetchBrtaUserSummary(): Promise<UserSummary> {
  const clock = getClockByIp(BRTA_MASTER_IP)
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getBrtaUserSession(clock)
      const count = await brtaUserCount(clock, session)
      return {
        plant: clock.plant,
        deviceId: clock.id,
        ip: clock.ip,
        count,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao consultar usuários BRTA')
      brtaUserInvalidateSession(clock)
    }
  }

  throw lastError ?? new Error('Não foi possível consultar usuários BRTA')
}

async function fetchBrgoUserSummary(): Promise<UserSummary> {
  const clock = getClockByIp(BRGO_MASTER_IP)
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getBrgoUserSession(clock)
      const count = await brgoUserCount(clock, session)
      return {
        plant: clock.plant,
        deviceId: clock.id,
        ip: clock.ip,
        count,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao consultar usuários BRGO')
      brgoUserInvalidateSession(clock)
    }
  }

  throw lastError ?? new Error('Não foi possível consultar usuários BRGO')
}

async function fetchBrtaUserList(params: UserListParams) {
  const clock = getClockByIp(BRTA_MASTER_IP)
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getBrtaListSession(clock)
      const users = await brtaLoadUsers(clock, session, params)
      return {
        plant: clock.plant,
        deviceId: clock.id,
        ip: clock.ip,
        generatedAt: new Date().toISOString(),
        count: users.length,
        users,
        meta: {
          limit: params.limit,
          offset: params.offset,
          filter: params.cpfs.length ? 'cpf' : 'range',
        },
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao listar usuários BRTA')
      brtaListInvalidateSession(clock)
    }
  }

  throw lastError ?? new Error('Não foi possível listar usuários BRTA')
}

async function fetchBrgoUserList(params: UserListParams) {
  const clock = getClockByIp(BRGO_MASTER_IP)
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getBrgoListSession(clock)
      const users = await brgoLoadUsers(clock, session, params)
      return {
        plant: clock.plant,
        deviceId: clock.id,
        ip: clock.ip,
        generatedAt: new Date().toISOString(),
        count: users.length,
        users,
        meta: {
          limit: params.limit,
          offset: params.offset,
          filter: params.cpfs.length ? 'cpf' : 'range',
        },
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao listar usuários BRGO')
      brgoListInvalidateSession(clock)
    }
  }

  throw lastError ?? new Error('Não foi possível listar usuários BRGO')
}

async function fetchCoilStatus(clock: Clock): Promise<CoilSummary> {
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getCoilSession(clock)
      const coilPaper = await coilPaperCount(clock, session)
      return {
        ...clock,
        status: 'success',
        coilPaper,
        attempts,
        lastError: null,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao consultar bobina')
      coilInvalidateSession(clock)
    }
  }

  return {
    ...clock,
    status: 'error',
    coilPaper: null,
    attempts,
    lastError: lastError ? lastError.message : null,
  }
}

async function checkClockStatus(clock: Clock): Promise<ClockStatus> {
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getSession(clock)
      const isValid = await sessionIsValid(clock, session)
      if (isValid) {
        return {
          ...clock,
          status: 'online',
          attempts,
          lastError: null,
        }
      }
      invalidateSession(clock)
      lastError = new Error('Sessão inválida')
    } catch (error) {
      invalidateSession(clock)
      lastError = error instanceof Error ? error : new Error('Erro desconhecido')
    }
  }

  return {
    ...clock,
    status: 'offline',
    attempts,
    lastError: lastError ? lastError.message : null,
  }
}

async function checkDashboardClockStatus(clock: Clock): Promise<DashboardClockStatus> {
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getDashboardSession(clock)
      const isValid = await dashboardSessionIsValid(clock, session)
      if (isValid) {
        return {
          ...clock,
          status: 'online',
          attempts,
          lastError: null,
        }
      }
      dashboardInvalidateSession(clock)
      lastError = new Error('Sessão inválida')
    } catch (error) {
      dashboardInvalidateSession(clock)
      lastError = error instanceof Error ? error : new Error('Erro desconhecido')
    }
  }

  return {
    ...clock,
    status: 'offline',
    attempts,
    lastError: lastError ? lastError.message : null,
  }
}

async function getSession(clock: Clock): Promise<string> {
  const cached = sessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (loginLocks.has(clock.id)) {
    return loginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = performLogin(clock)
    .then((session) => {
      sessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      loginLocks.delete(clock.id)
    })

  loginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function invalidateSession(clock: Clock): void {
  sessionCache.delete(clock.id)
}

async function performLogin(clock: Clock): Promise<string> {
  const response = await controlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login sem sessão')
  }

  return payload.session
}

async function sessionIsValid(clock: Clock, session: string): Promise<boolean> {
  const response = await controlIdRequest(clock, `session_is_valid.fcgi?session=${encodeURIComponent(session)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha na validação da sessão (${response.status}): ${text}`)
  }

  // Alguns firmwares retornam "true", outros apenas HTTP 200
  // Consideramos o dispositivo online sempre que a requisição for bem sucedida
  return true
}

async function getDashboardSession(clock: Clock): Promise<string> {
  const cached = dashboardSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (dashboardLoginLocks.has(clock.id)) {
    return dashboardLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = dashboardPerformLogin(clock)
    .then((session) => {
      dashboardSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      dashboardLoginLocks.delete(clock.id)
    })

  dashboardLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function dashboardInvalidateSession(clock: Clock): void {
  dashboardSessionCache.delete(clock.id)
}

async function dashboardPerformLogin(clock: Clock): Promise<string> {
  const response = await dashboardControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login sem sessão')
  }

  return payload.session
}

async function dashboardSessionIsValid(clock: Clock, session: string): Promise<boolean> {
  const response = await dashboardControlIdRequest(clock, `session_is_valid.fcgi?session=${encodeURIComponent(session)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha na validação da sessão (${response.status}): ${text}`)
  }

  return true
}

async function getBrtaUserSession(clock: Clock): Promise<string> {
  const cached = brtaUserSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (brtaUserLoginLocks.has(clock.id)) {
    return brtaUserLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = brtaUserPerformLogin(clock)
    .then((session) => {
      brtaUserSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      brtaUserLoginLocks.delete(clock.id)
    })

  brtaUserLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function brtaUserInvalidateSession(clock: Clock): void {
  brtaUserSessionCache.delete(clock.id)
}

async function brtaUserPerformLogin(clock: Clock): Promise<string> {
  const response = await brtaUserControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login BRTA (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login BRTA sem sessão')
  }

  return payload.session
}

async function brtaUserCount(clock: Clock, session: string): Promise<number> {
  const response = await brtaUserControlIdRequest(clock, `count_users.fcgi?session=${encodeURIComponent(session)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao contar usuários BRTA (${response.status}): ${text}`)
  }

  const payload = await response.json<{ count?: number }>()
  const count = Number(payload.count ?? 0)
  if (Number.isNaN(count)) {
    throw new Error('Resposta de contagem BRTA inválida')
  }

  return count
}

async function getBrgoUserSession(clock: Clock): Promise<string> {
  const cached = brgoUserSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (brgoUserLoginLocks.has(clock.id)) {
    return brgoUserLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = brgoUserPerformLogin(clock)
    .then((session) => {
      brgoUserSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      brgoUserLoginLocks.delete(clock.id)
    })

  brgoUserLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function brgoUserInvalidateSession(clock: Clock): void {
  brgoUserSessionCache.delete(clock.id)
}

async function brgoUserPerformLogin(clock: Clock): Promise<string> {
  const response = await brgoUserControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login BRGO (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login BRGO sem sessão')
  }

  return payload.session
}

async function brgoUserCount(clock: Clock, session: string): Promise<number> {
  const response = await brgoUserControlIdRequest(clock, `count_users.fcgi?session=${encodeURIComponent(session)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao contar usuários BRGO (${response.status}): ${text}`)
  }

  const payload = await response.json<{ count?: number }>()
  const count = Number(payload.count ?? 0)
  if (Number.isNaN(count)) {
    throw new Error('Resposta de contagem BRGO inválida')
  }

  return count
}

async function getBrtaListSession(clock: Clock): Promise<string> {
  const cached = brtaListSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (brtaListLoginLocks.has(clock.id)) {
    return brtaListLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = brtaListPerformLogin(clock)
    .then((session) => {
      brtaListSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      brtaListLoginLocks.delete(clock.id)
    })

  brtaListLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function brtaListInvalidateSession(clock: Clock): void {
  brtaListSessionCache.delete(clock.id)
}

async function brtaListPerformLogin(clock: Clock): Promise<string> {
  const response = await brtaListControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login (listagem) (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login de listagem sem sessão')
  }

  return payload.session
}

async function brtaLoadUsers(clock: Clock, session: string, params: UserListParams): Promise<NormalizedClockUser[]> {
  const query = new URLSearchParams({ mode: '671' })
  query.set('session', session)
  const body = buildLoadUsersBody(params)
  const response = await brtaListControlIdRequest(clock, `load_users.fcgi?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao listar usuários BRTA (${response.status}): ${text}`)
  }

  const payload = await response.json<Record<string, unknown>>()
  return normalizeClockUsers(payload)
}

async function getBrgoListSession(clock: Clock): Promise<string> {
  const cached = brgoListSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (brgoListLoginLocks.has(clock.id)) {
    return brgoListLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = brgoListPerformLogin(clock)
    .then((session) => {
      brgoListSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      brgoListLoginLocks.delete(clock.id)
    })

  brgoListLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function brgoListInvalidateSession(clock: Clock): void {
  brgoListSessionCache.delete(clock.id)
}

async function brgoListPerformLogin(clock: Clock): Promise<string> {
  const response = await brgoListControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login de listagem BRGO (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login de listagem BRGO sem sessão')
  }

  return payload.session
}

async function brgoLoadUsers(clock: Clock, session: string, params: UserListParams): Promise<NormalizedClockUser[]> {
  const query = new URLSearchParams({ mode: '671' })
  query.set('session', session)
  const body = buildLoadUsersBody(params)
  const response = await brgoListControlIdRequest(clock, `load_users.fcgi?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao listar usuários BRGO (${response.status}): ${text}`)
  }

  const payload = await response.json<Record<string, unknown>>()
  return normalizeClockUsers(payload)
}

function buildLoadUsersBody(params: UserListParams): Record<string, unknown> {
  if (params.cpfs.length > 0) {
    return {
      users_cpf: params.cpfs,
    }
  }
  return {
    limit: params.limit,
    offset: params.offset,
  }
}

function buildGeneralUpdatePayload(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new BadRequestError('Corpo da requisição inválido')
  }

  const cpf = ensureCpf(data.cpf)
  const userPayload: Record<string, unknown> = { cpf }

  const name = optionalString(data.name)
  if (name) {
    userPayload.name = name
  }

  const bars = optionalString(data.bars)
  if (bars) {
    userPayload.bars = bars
  }

  const code = optionalNumber(data.code)
  if (code !== undefined) {
    userPayload.code = code
  }

  const password = optionalString(data.password)
  if (password) {
    userPayload.password = password
  }

  const rfid = optionalNumber(data.rfid)
  if (rfid !== undefined) {
    userPayload.rfid = rfid
  }

  if (typeof data.admin === 'boolean') {
    userPayload.admin = data.admin
  }

  return {
    users: [userPayload],
  }
}

function buildUserCreationPayload(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new BadRequestError('Corpo da requisição inválido')
  }

  if (Array.isArray(data.users) && data.users.length) {
    const normalizedUsers = data.users.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new BadRequestError(`Usuário inválido na posição ${index + 1}`)
      }
      return normalizeUserCreationEntry(entry)
    })
    const doMatch = typeof data.do_match === 'boolean' ? data.do_match : false
    return {
      do_match: doMatch,
      users: normalizedUsers,
    }
  }

  const user = normalizeUserCreationEntry(data)
  return {
    do_match: false,
    users: [user],
  }
}

function buildPhotoUpdatePayload(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new BadRequestError('Corpo da requisição inválido')
  }

  const cpf = ensureCpf(data.cpf)
  const image = ensureImageBase64(data.imageBase64 ?? data.image)

  return {
    do_match: false,
    users: [
      {
        cpf,
        image,
        image_timestamp: Math.floor(Date.now() / 1000),
      },
    ],
  }
}

function buildPhotoRemovalPayload(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new BadRequestError('Corpo da requisição inválido')
  }

  const cpf = ensureCpf(data.cpf)

  return {
    users: [
      {
        cpf,
        remove_faces: true,
      },
    ],
  }
}

function buildUserDeletionPayload(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new BadRequestError('Corpo da requisição inválido')
  }

  const cpfs = collectCpfList(data)
  if (!cpfs.length) {
    throw new BadRequestError('Informe ao menos um CPF válido para remover')
  }

  return {
    users: cpfs,
  }
}

function normalizeUserCreationEntry(record: Record<string, unknown>): Record<string, unknown> {
  const name = ensureNonEmptyString(record.name, 'Nome é obrigatório')
  const cpf = ensureCpf(record.cpf)

  const user: Record<string, unknown> = {
    name,
    cpf,
  }

  const code = optionalNumber(record.code)
  if (code !== undefined) {
    user.code = code
  }

  const registration = optionalNumber(record.registration ?? record.bars)
  if (registration !== undefined) {
    user.registration = registration
  }

  const rfid = optionalNumber(record.rfid)
  if (rfid !== undefined) {
    user.rfid = rfid
  }

  if (typeof record.admin === 'boolean') {
    user.admin = record.admin
  }

  const password = optionalString(record.password)
  if (password) {
    user.password = password
  }

  const image = optionalString(record.imageBase64 ?? record.image)
  if (image) {
    user.image = image
    const timestamp = optionalNumber(record.image_timestamp)
    user.image_timestamp = timestamp ?? Math.floor(Date.now() / 1000)
  }

  return user
}

type UserExecutionOptions = {
  endpoint?: string
  includeMode?: boolean
  mode?: string
  successMessage?: string
}

async function executeUserActionAcrossClocks(
  action: UserActionName,
  userPayload: Record<string, unknown>,
  options: UserExecutionOptions = {},
  targetClocks: Clock[] = getBrtaClocks(),
): Promise<UserActionSummary> {
  const results: UserActionResult[] = []
  const defaultSuccessMessage = ACTION_SUCCESS_MESSAGES[action] ?? 'Ação concluída com sucesso'
  const resolvedOptions: Required<UserExecutionOptions> = {
    endpoint: options.endpoint ?? 'update_users.fcgi',
    includeMode: options.includeMode ?? true,
    mode: options.mode ?? '671',
    successMessage: options.successMessage ?? defaultSuccessMessage,
  }

  for (const clock of targetClocks) {
    const result = await executeActionOnClock(clock, userPayload, resolvedOptions)
    results.push(result)
  }

  const success = results.filter((result) => result.ok).length

  return {
    action,
    generatedAt: new Date().toISOString(),
    total: targetClocks.length,
    success,
    failure: results.length - success,
    results,
  }
}

async function executeActionOnClock(
  clock: Clock,
  userPayload: Record<string, unknown>,
  options: Required<UserExecutionOptions>,
): Promise<UserActionResult> {
  let attempts = 0
  let lastError: Error | null = null

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const session = await getSession(clock)
      const query = new URLSearchParams({ session })
      if (options.includeMode) {
        query.set('mode', options.mode)
      }
      const endpointPath = `${options.endpoint}?${query.toString()}`
      const response = await controlIdRequest(clock, endpointPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: userPayload,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
      }

      let details = options.successMessage
      try {
        const payload = await response.json<Record<string, unknown>>()
        const successFlag = parseMaybeNumber(payload['success'])
        if (successFlag != null && successFlag === 0) {
          const message = optionalString(payload['message']) ?? 'Atualização recusada'
          throw new Error(message)
        }
        const message = optionalString(payload['message'])
        if (message) {
          details = message
        }
      } catch {
        // resposta não JSON, manter mensagem padrão
      }

      return {
        clockId: clock.id,
        clockLabel: clock.label,
        ip: clock.ip,
        ok: true,
        attempts,
        statusCode: response.status,
        message: details,
      }
    } catch (error) {
      invalidateSession(clock)
      lastError = error instanceof Error ? error : new Error('Falha desconhecida')
    }
  }

  return {
    clockId: clock.id,
    clockLabel: clock.label,
    ip: clock.ip,
    ok: false,
    attempts,
    statusCode: null,
    message: lastError ? lastError.message : 'Falha desconhecida',
  }
}

async function getCoilSession(clock: Clock): Promise<string> {
  const cached = coilSessionCache.get(clock.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session
  }

  if (coilLoginLocks.has(clock.id)) {
    return coilLoginLocks.get(clock.id) as Promise<string>
  }

  const loginPromise = coilPerformLogin(clock)
    .then((session) => {
      coilSessionCache.set(clock.id, { session, expiresAt: Date.now() + SESSION_TTL })
      return session
    })
    .finally(() => {
      coilLoginLocks.delete(clock.id)
    })

  coilLoginLocks.set(clock.id, loginPromise)
  return loginPromise
}

function coilInvalidateSession(clock: Clock): void {
  coilSessionCache.delete(clock.id)
}

async function coilPerformLogin(clock: Clock): Promise<string> {
  const response = await coilControlIdRequest(clock, 'login.fcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      login: CONTROL_ID_LOGIN,
      password: CONTROL_ID_PASSWORD,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha no login (coil) (${response.status}): ${text}`)
  }

  const payload = await response.json<{ session?: string }>()
  if (!payload.session) {
    throw new Error('Resposta de login de bobina sem sessão')
  }

  return payload.session
}

async function coilPaperCount(clock: Clock, session: string): Promise<number> {
  const response = await coilControlIdRequest(clock, `get_coil_paper.fcgi?session=${encodeURIComponent(session)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao consultar bobina (${response.status}): ${text}`)
  }

  const payload = await response.json<Record<string, unknown>>()
  const coilPaper = extractCoilPaper(payload)
  return coilPaper
}

async function controlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function dashboardControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function brtaUserControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function brgoUserControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function brtaListControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function brgoListControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

async function coilControlIdRequest(clock: Clock, path: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const url = buildHttpsUrl(clock.ip, path)
  return runCurl(url, init)
}

function getClockByIp(ip: string): Clock {
  const clock = clocks.find((item) => item.ip === ip)
  if (!clock) {
    throw new Error(`Relógio não configurado (${ip})`)
  }
  return clock
}

function getBrtaClocks(): Clock[] {
  const targets = clocks.filter((clock) => clock.plant === 'BRTA')
  if (!targets.length) {
    throw new Error('Nenhum relógio BRTA configurado')
  }
  return targets
}

function getBrgoClocks(): Clock[] {
  const targets = clocks.filter((clock) => clock.plant === 'BRGO')
  if (!targets.length) {
    throw new Error('Nenhum relógio BRGO configurado')
  }
  return targets
}

function getCoilMonitoredClocks(): Clock[] {
  const monitored = clocks.filter((clock) => COIL_MONITORED_IPS.includes(clock.ip))
  if (monitored.length > 0) {
    return monitored
  }
  return [getClockByIp(BRTA_MASTER_IP)]
}

function buildHttpsUrl(ip: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `https://${ip}/${normalizedPath}`
}

function parseUserListQuery(req: Request): UserListParams {
  const limit = normalizePositiveNumber(req.query.limit, 100)
  const offset = normalizePositiveNumber(req.query.offset, 0)
  const cpfs = extractCpfFilters(req.query.cpf)
  return {
    limit,
    offset,
    cpfs,
  }
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed)
  }
  return fallback
}

function extractCpfFilters(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((num) => Number.isFinite(num))
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((num) => Number.isFinite(num))
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value]
  }
  return []
}

async function runCurl(url: string, init: CurlRequestInit = {}): Promise<CurlResponse> {
  const method = (init.method ?? 'GET').toUpperCase()
  const args = ['-sS', '--insecure', '--location', '--write-out', '\n--CURL_HTTP_CODE--%{http_code}', '-X', method]
  const headers = normalizeHeaders(init.headers)

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    args.push('-H', `${key}: ${value}`)
  }

  const maxSeconds = Math.max(1, Math.ceil(CURL_TIMEOUT_MS / 1000))
  args.push('--max-time', String(maxSeconds), '--connect-timeout', String(maxSeconds))

  let tempFile: string | null = null
  let cleanupNeeded = false

  if (init.body !== undefined && init.body !== null) {
    const bodyString = formatBody(init.body)
    tempFile = createTempFile(bodyString)
    cleanupNeeded = true

    const hasContentLength = Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')
    if (!hasContentLength) {
      args.push('-H', `Content-Length: ${Buffer.byteLength(bodyString, 'utf8')}`)
    }

    args.push('--data-binary', `@${tempFile}`)
  }

  args.push(url)

  let stdout = ''
  let stderr = ''

  try {
    const result = spawnSync(CURL_BINARY, args, {
      encoding: 'utf8',
      timeout: CURL_TIMEOUT_MS,
    })

    stdout = result.stdout ?? ''
    stderr = result.stderr ?? ''

    if (result.error) {
      throw result.error
    }

    if (result.status && result.status !== 0) {
      throw new Error(stderr.trim() || `curl retornou código ${result.status}`)
    }
  } catch (error) {
    if (cleanupNeeded && tempFile) {
      safeUnlink(tempFile)
    }

    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(`Curl não encontrado (${CURL_BINARY}). Instale o binário ou ajuste a variável CURL_BINARY.`)
    }

    throw error instanceof Error ? error : new Error('Curl falhou')
  } finally {
    if (cleanupNeeded && tempFile) {
      safeUnlink(tempFile)
    }
  }

  const marker = '\n--CURL_HTTP_CODE--'
  const markerIndex = stdout.lastIndexOf(marker)
  if (markerIndex === -1) {
    throw new Error('Curl não retornou código HTTP')
  }

  const body = stdout.slice(0, markerIndex)
  const statusCode = Number(stdout.slice(markerIndex + marker.length).trim())

  if (Number.isNaN(statusCode)) {
    throw new Error('Código HTTP inválido recebido do curl')
  }

  logVerboseFailure(url, statusCode, stderr)

  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    text: async () => body,
    json: async <T>() => {
      try {
        return JSON.parse(body || '{}') as T
      } catch (error) {
        throw new Error('Resposta do relógio não é JSON válido')
      }
    },
  }
}

function normalizeHeaders(headers?: Record<string, string | undefined>): Record<string, string | undefined> {
  if (!headers) {
    return {
      'Content-Type': 'application/json',
    }
  }
  return headers
}

function formatBody(body: CurlRequestInit['body']): string {
  if (body == null) {
    return ''
  }

  if (typeof body === 'string') {
    return body
  }

  if (Buffer.isBuffer(body)) {
    return body.toString('utf8')
  }

  if (body instanceof URLSearchParams) {
    return body.toString()
  }

  return JSON.stringify(body)
}

function createTempFile(contents: string): string {
  const tmpName = `controlid_body_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  const filePath = path.join(os.tmpdir(), tmpName)
  fs.writeFileSync(filePath, contents, 'utf8')
  return filePath
}

function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

function logVerboseFailure(url: string, status: number, stderr: string): void {
  if (!VERBOSE) {
    return
  }

  if (status >= 200 && status < 300) {
    return
  }

  console.warn(`curl falhou para ${url} -> status ${status}`, {
    stderr: stderr.slice(0, 200),
  })
}

function normalizeClockUsers(payload: Record<string, unknown>): NormalizedClockUser[] {
  const rawUsers = extractClockUsersArray(payload)
  return rawUsers.map((raw, index) => toNormalizedClockUser(raw, index))
}

function extractClockUsersArray(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const users = payload['users']
  if (Array.isArray(users)) {
    return users.filter(isRecord)
  }
  const data = payload['data']
  if (Array.isArray(data)) {
    return data.filter(isRecord)
  }
  const results = payload['results']
  if (Array.isArray(results)) {
    return results.filter(isRecord)
  }
  return []
}

function toNormalizedClockUser(raw: Record<string, unknown>, index: number): NormalizedClockUser {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Usuário ${index + 1}`
  const cpf = formatOptionalString(raw.cpf ?? raw.user_cpf ?? raw.document)
  const registration = formatOptionalString(raw.registration ?? raw.user_registration ?? raw.pis)
  const rfid = formatOptionalString(raw.rfid ?? raw.card ?? raw.card_number ?? raw.badge)
  const uid = formatUid(raw, index, cpf, registration)
  const hasFace = detectFacePresence(raw)

  return {
    uid,
    name,
    cpf,
    registration,
    rfid,
    hasFace,
    raw,
  }
}

function formatOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function formatUid(raw: Record<string, unknown>, index: number, cpf: string | null, registration: string | null): string {
  const candidates = [raw.id, raw.code, raw.user_id, cpf, registration]
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate)
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return `user-${index}-${Date.now()}`
}

function detectFacePresence(raw: Record<string, unknown>): boolean {
  if (typeof raw.has_face === 'boolean') {
    return raw.has_face
  }
  if (Array.isArray(raw.templates)) {
    return raw.templates.some((template) => hasFaceFlag(template))
  }
  if (Array.isArray(raw.faces)) {
    return raw.faces.length > 0
  }
  if (raw.face || raw.face_template || raw.template_face) {
    return true
  }
  return false
}

function hasFaceFlag(template: unknown): boolean {
  if (!template || typeof template !== 'object') {
    return false
  }
  const record = template as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type.toLowerCase() : ''
  if (type.includes('face')) {
    return true
  }
  if (typeof record.modality === 'string' && record.modality.toLowerCase().includes('face')) {
    return true
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function extractCoilPaper(payload: Record<string, unknown>): number {
  const candidates: unknown[] = []

  candidates.push(payload['coil_paper'], payload['coilPaper'])

  const respostas = selectNestedRecord(payload, ['Respostas', 'respostas', 'Responses'])
  if (respostas) {
    candidates.push(respostas['coil_paper'], respostas['coilPaper'])
  }

  const value = candidates
    .map((candidate) => parseMaybeNumber(candidate))
    .find((candidate): candidate is number => candidate !== null)

  if (value == null) {
    throw new Error('Resposta de bobina sem valor numérico')
  }

  return value
}

function selectNestedRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const child = source[key]
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return child as Record<string, unknown>
    }
  }
  return null
}

function parseMaybeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function ensureCpf(value: unknown): number {
  const cpf = optionalNumber(value)
  if (cpf === undefined) {
    throw new BadRequestError('CPF é obrigatório')
  }
  return cpf
}

function ensureNonEmptyString(value: unknown, message: string): string {
  const normalized = optionalString(value)
  if (!normalized) {
    throw new BadRequestError(message)
  }
  return normalized
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function collectCpfList(record: Record<string, unknown>): number[] {
  const seen = new Set<number>()
  const pushCpf = (candidate: unknown) => {
    const value = optionalNumber(candidate)
    if (value !== undefined) {
      seen.add(value)
    }
  }

  if ('cpf' in record) {
    pushCpf(record.cpf)
  }

  const cpfsField = record.cpfs
  if (Array.isArray(cpfsField)) {
    for (const candidate of cpfsField) {
      pushCpf(candidate)
    }
  } else if (typeof cpfsField === 'string' && cpfsField.trim()) {
    const segments = cpfsField.split(',')
    for (const segment of segments) {
      pushCpf(segment.trim())
    }
  }

  return Array.from(seen)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function ensureImageBase64(value: unknown): string {
  const image = optionalString(value)
  if (!image) {
    throw new BadRequestError('Imagem em base64 é obrigatória')
  }
  return image
}
