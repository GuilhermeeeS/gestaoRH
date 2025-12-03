import { runRead, runWrite } from './database.js'
import type { PublicUser, UserRecord, UserRole } from './types.js'

type UserRow = {
  id: number
  login: string
  passwordHash: string
  role: UserRole
  active: number
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

const BASE_SELECT = `
  SELECT
    id,
    login,
    password_hash as passwordHash,
    role,
    active,
    created_at as createdAt,
    updated_at as updatedAt,
    last_login_at as lastLoginAt
  FROM users
`

export async function getActiveUserByLogin(login: string): Promise<UserRecord | null> {
  const normalized = login.trim().toLowerCase()
  return runRead((db) => {
    const stmt = db.prepare(`${BASE_SELECT} WHERE lower(login) = ? AND active = 1 LIMIT 1`)
    stmt.bind([normalized])
    const row = stmt.step() ? (stmt.getAsObject() as unknown as UserRow) : null
    stmt.free()
    return row ? mapRow(row) : null
  })
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  return runRead((db) => {
    const stmt = db.prepare(`${BASE_SELECT} WHERE id = ? LIMIT 1`)
    stmt.bind([id])
    const row = stmt.step() ? (stmt.getAsObject() as unknown as UserRow) : null
    stmt.free()
    return row ? toPublicUser(mapRow(row)) : null
  })
}

export async function listUsers(): Promise<PublicUser[]> {
  return runRead((db) => {
    const stmt = db.prepare(`${BASE_SELECT} ORDER BY created_at ASC`)
    const users: PublicUser[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as UserRow
      users.push(toPublicUser(mapRow(row)))
    }
    stmt.free()
    return users
  })
}

export async function createUser(login: string, passwordHash: string, role: UserRole): Promise<PublicUser> {
  const normalized = login.trim()
  return runWrite((db) => {
    const insert = db.prepare(
      `INSERT INTO users (login, password_hash, role, active, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
    )
    insert.bind([normalized, passwordHash, role])
    insert.step()
    insert.free()

    const select = db.prepare(`${BASE_SELECT} WHERE id = last_insert_rowid()`)
    select.step()
    const row = select.getAsObject() as unknown as UserRow
    select.free()
    return toPublicUser(mapRow(row))
  })
}

export async function updateLastLogin(userId: number): Promise<void> {
  await runWrite((db) => {
    const stmt = db.prepare(`
      UPDATE users
      SET last_login_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.bind([userId])
    stmt.step()
    stmt.free()
  })
}

export async function updateUserRole(id: number, role: UserRole): Promise<PublicUser | null> {
  await runWrite((db) => {
    const stmt = db.prepare(`
      UPDATE users
      SET role = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.bind([role, id])
    stmt.step()
    stmt.free()
  })
  return getUserById(id)
}

export async function updateUserStatus(id: number, active: boolean): Promise<PublicUser | null> {
  await runWrite((db) => {
    const stmt = db.prepare(`
      UPDATE users
      SET active = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.bind([active ? 1 : 0, id])
    stmt.step()
    stmt.free()
  })
  return getUserById(id)
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<PublicUser | null> {
  await runWrite((db) => {
    const stmt = db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.bind([passwordHash, id])
    stmt.step()
    stmt.free()
  })
  return getUserById(id)
}

export async function deleteUser(id: number): Promise<boolean> {
  return runWrite((db) => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?')
    stmt.bind([id])
    stmt.step()
    const affected = db.getRowsModified()
    stmt.free()
    return affected > 0
  })
}

function mapRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    login: row.login,
    passwordHash: row.passwordHash,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt ?? null,
  }
}

function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, ...rest } = user
  return rest
}
