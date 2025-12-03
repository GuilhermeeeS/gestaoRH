import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { hashPassword } from './passwords.js'
import type { UserRole } from './types.js'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
const DEFAULT_DB_PATH = process.env.AUTH_DB_PATH ? path.resolve(process.cwd(), process.env.AUTH_DB_PATH) : path.resolve(process.cwd(), 'data', 'auth.sqlite')
const PRIMARY_ADMIN_LOGIN = process.env.AUTH_DEFAULT_ADMIN_LOGIN ?? 'admin.principal'
const PRIMARY_ADMIN_PASSWORD = process.env.AUTH_DEFAULT_ADMIN_PASSWORD ?? 'change-this-password'
const SECONDARY_ADMIN_LOGIN = process.env.AUTH_SECOND_ADMIN_LOGIN ?? 'admin.backup'
const SECONDARY_ADMIN_PASSWORD = process.env.AUTH_SECOND_ADMIN_PASSWORD ?? 'change-this-password-too'

const SEEDED_USERS: Array<{ login: string; password: string; role: UserRole }> = [
  { login: PRIMARY_ADMIN_LOGIN, password: PRIMARY_ADMIN_PASSWORD, role: 'admin' },
  { login: SECONDARY_ADMIN_LOGIN, password: SECONDARY_ADMIN_PASSWORD, role: 'admin' },
]

let sqlInstancePromise: Promise<SqlJsStatic> | null = null
let db: Database | null = null
let initPromise: Promise<void> | null = null
let writeLock: Promise<void> = Promise.resolve()

async function loadSqlModule(): Promise<SqlJsStatic> {
  if (!sqlInstancePromise) {
    sqlInstancePromise = initSqlJs({
      locateFile: () => wasmPath,
    })
  }
  return sqlInstancePromise
}

async function ensureDatabase(): Promise<Database> {
  if (db) {
    return db
  }

  const SQL = await loadSqlModule()
  await fs.mkdir(path.dirname(DEFAULT_DB_PATH), { recursive: true })

  let fileBuffer: Uint8Array | null = null
  try {
    const file = await fs.readFile(DEFAULT_DB_PATH)
    fileBuffer = file
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code && nodeError.code !== 'ENOENT') {
      throw error
    }
  }

  db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database()
  runMigrations(db)

  if (!fileBuffer) {
    await persistDatabase()
  }

  return db
}

function runMigrations(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','padrao')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login);
  `)

  ensureRoleConstraintIsCurrent(database)
}

function ensureRoleConstraintIsCurrent(database: Database): void {
  const tableDefinition = getTableDefinition(database, 'users')
  if (!tableDefinition) {
    return
  }

  if (!tableDefinition.includes("CHECK(role IN ('admin','padrao')")) {
    recreateUsersTableWithNewRoleConstraint(database)
  }

  updateLegacyRoleValues(database)
}

function recreateUsersTableWithNewRoleConstraint(database: Database): void {
  database.exec(`
    BEGIN TRANSACTION;
    DROP TABLE IF EXISTS users_migration;
    CREATE TABLE users_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','padrao')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT NULL
    );
    INSERT INTO users_migration (id, login, password_hash, role, active, created_at, updated_at, last_login_at)
    SELECT
      id,
      login,
      password_hash,
      CASE role WHEN 'ti' THEN 'admin' WHEN 'rh' THEN 'padrao' ELSE role END AS role,
      active,
      created_at,
      updated_at,
      last_login_at
    FROM users;
    DROP TABLE users;
    ALTER TABLE users_migration RENAME TO users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login);
    COMMIT;
  `)
}

function updateLegacyRoleValues(database: Database): void {
  database.exec(`
    UPDATE users
    SET role = CASE role WHEN 'ti' THEN 'admin' WHEN 'rh' THEN 'padrao' ELSE role END
    WHERE role IN ('ti','rh');
  `)
}

function getTableDefinition(database: Database, tableName: string): string | null {
  const stmt = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
  stmt.bind([tableName])
  const hasRow = stmt.step()
  const row = hasRow ? (stmt.getAsObject() as { sql?: string | null }) : null
  stmt.free()
  const sql = row?.sql
  return typeof sql === 'string' ? sql : null
}

async function persistDatabase(): Promise<void> {
  if (!db) {
    return
  }
  const data = db.export()
  await fs.writeFile(DEFAULT_DB_PATH, data)
}

async function seedDefaultUsers(): Promise<void> {
  for (const seedUser of SEEDED_USERS) {
    await ensureSeedUser(seedUser)
  }
}

async function ensureSeedUser({ login, password, role }: { login: string; password: string; role: UserRole }): Promise<void> {
  const rawLogin = login.trim()
  const normalizedLogin = rawLogin.toLowerCase()
  if (!rawLogin || !password) {
    return
  }

  const existing = await runRead((dbInstance) => {
    const stmt = dbInstance.prepare('SELECT id, role, active FROM users WHERE lower(login) = ? LIMIT 1')
    stmt.bind([normalizedLogin])
    const row = stmt.step() ? (stmt.getAsObject() as { id: number; role: UserRole; active: number }) : null
    stmt.free()
    return row
  })

  if (existing) {
    const needsRoleUpdate = existing.role !== role
    const isInactive = existing.active !== 1
    if (needsRoleUpdate || isInactive) {
      await runWrite((dbInstance) => {
        const stmt = dbInstance.prepare(`
          UPDATE users
          SET role = ?, active = 1, updated_at = datetime('now')
          WHERE id = ?
        `)
        stmt.bind([role, existing.id])
        stmt.step()
        stmt.free()
      })
    }
    return
  }

  const passwordHash = await hashPassword(password)
  await runWrite((dbInstance) => {
    const stmt = dbInstance.prepare(
      `INSERT INTO users (login, password_hash, role, active, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
    )
    stmt.bind([rawLogin, passwordHash, role])
    stmt.step()
    stmt.free()
  })
}

export async function initAuthDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureDatabase()
      await seedDefaultUsers()
    })()
  }
  return initPromise
}

export async function runRead<T>(task: (database: Database) => T): Promise<T> {
  const database = await ensureDatabase()
  return task(database)
}

export async function runWrite<T>(task: (database: Database) => T | Promise<T>): Promise<T> {
  const database = await ensureDatabase()
  const runner = async () => {
    const result = await task(database)
    await persistDatabase()
    return result
  }

  const next = writeLock.then(runner, runner)
  writeLock = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export function getAuthDatabasePath(): string {
  return DEFAULT_DB_PATH
}
