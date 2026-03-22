import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

export type PanelUserRole = "admin" | "user" | "viewer"

type StoredPanelUser = {
  username: string
  passwordHash: string
  role: PanelUserRole
  imageUrl: string
  createdAt: string
  updatedAt: string
}

export type PanelUser = Omit<StoredPanelUser, "passwordHash">

type PanelUsersFile = {
  users: StoredPanelUser[]
}

const DEFAULT_USERS_FILE = "panel-users.json"

function getDataRootDir() {
  return path.resolve(process.env.SAUDACAO_DATA_DIR || process.cwd())
}

function getUsersFilePath() {
  return path.join(getDataRootDir(), DEFAULT_USERS_FILE)
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase()
}

function toPublicUser(user: StoredPanelUser): PanelUser {
  return {
    username: user.username,
    role: user.role,
    imageUrl: user.imageUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function normalizeImageUrl(value: string) {
  return String(value || "").trim()
}

async function ensureUsersFile() {
  const filePath = getUsersFilePath()
  try {
    await fs.access(filePath)
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const seedUser = buildSeedAdmin()
    const payload: PanelUsersFile = {
      users: seedUser ? [seedUser] : [],
    }
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8")
  }
}

function buildSeedAdmin(): StoredPanelUser | null {
  const username = normalizeUsername(process.env.PANEL_LOGIN_USER || "admin")
  const passwordHash = String(process.env.PANEL_LOGIN_PASSWORD_SHA256 || "").trim().toLowerCase()
    || sha256(String(process.env.PANEL_LOGIN_PASSWORD || "admin"))
  if (!username || !passwordHash) return null
  const now = new Date().toISOString()
  return {
    username,
    passwordHash,
    role: "admin",
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
  }
}

async function readUsersFile(): Promise<PanelUsersFile> {
  await ensureUsersFile()
  const raw = await fs.readFile(getUsersFilePath(), "utf8")
  const parsed = JSON.parse(raw) as Partial<PanelUsersFile>
  const users = Array.isArray(parsed?.users) ? parsed.users : []
  return {
    users: users
      .map((item): StoredPanelUser => ({
        username: normalizeUsername(item?.username || ""),
        passwordHash: String(item?.passwordHash || "").trim().toLowerCase(),
        role: item?.role === "admin" ? "admin" : item?.role === "viewer" ? "viewer" : "user",
        imageUrl: normalizeImageUrl(item?.imageUrl || ""),
        createdAt: String(item?.createdAt || ""),
        updatedAt: String(item?.updatedAt || ""),
      }))
      .filter((item) => Boolean(item.username) && Boolean(item.passwordHash)),
  }
}

async function writeUsersFile(payload: PanelUsersFile) {
  const filePath = getUsersFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8")
}

export async function listPanelUsers(): Promise<PanelUser[]> {
  const payload = await readUsersFile()
  return payload.users
    .slice()
    .sort((left, right) => left.username.localeCompare(right.username, "pt-BR"))
    .map(toPublicUser)
}

export async function findStoredPanelUser(username: string): Promise<StoredPanelUser | null> {
  const normalized = normalizeUsername(username)
  if (!normalized) return null
  const payload = await readUsersFile()
  return payload.users.find((item) => item.username === normalized) || null
}

export async function findPanelUser(username: string): Promise<PanelUser | null> {
  const user = await findStoredPanelUser(username)
  return user ? toPublicUser(user) : null
}

export async function validateStoredPanelCredentials(username: string, password: string) {
  const user = await findStoredPanelUser(username)
  if (!user) return null
  const passwordHash = sha256(String(password || ""))
  if (passwordHash !== user.passwordHash) return null
  return toPublicUser(user)
}

export async function createPanelUser(input: {
  username: string
  password: string
  role: PanelUserRole
  imageUrl?: string
}) {
  const username = normalizeUsername(input.username)
  const password = String(input.password || "")
  const role: PanelUserRole = input.role === "admin" ? "admin" : input.role === "viewer" ? "viewer" : "user"
  const imageUrl = normalizeImageUrl(input.imageUrl || "")

  if (!username) {
    throw new Error("Informe um nome de usuário válido.")
  }
  if (password.length < 4) {
    throw new Error("A senha deve ter ao menos 4 caracteres.")
  }

  const payload = await readUsersFile()
  if (payload.users.some((item) => item.username === username)) {
    throw new Error("Já existe um usuário com esse nome.")
  }

  const now = new Date().toISOString()
  const user: StoredPanelUser = {
    username,
    passwordHash: sha256(password),
    role,
    imageUrl,
    createdAt: now,
    updatedAt: now,
  }
  payload.users.push(user)
  await writeUsersFile(payload)
  return toPublicUser(user)
}

export async function updatePanelUser(
  username: string,
  changes: {
    nextUsername?: string
    nextPassword?: string
    nextRole?: PanelUserRole
    nextImageUrl?: string
  }
) {
  const normalized = normalizeUsername(username)
  if (!normalized) {
    throw new Error("Usuário inválido.")
  }

  const payload = await readUsersFile()
  const index = payload.users.findIndex((item) => item.username === normalized)
  if (index < 0) {
    throw new Error("Usuário não encontrado.")
  }

  const current = payload.users[index]
  const nextUsername = changes.nextUsername ? normalizeUsername(changes.nextUsername) : current.username
  const nextRole: PanelUserRole =
    changes.nextRole === "admin"
      ? "admin"
      : changes.nextRole === "viewer"
        ? "viewer"
        : changes.nextRole === "user"
          ? "user"
          : current.role
  const nextPassword = String(changes.nextPassword || "")
  const nextImageUrl = typeof changes.nextImageUrl === "string" ? normalizeImageUrl(changes.nextImageUrl) : current.imageUrl

  if (!nextUsername) {
    throw new Error("Informe um nome de usuário válido.")
  }
  if (nextPassword && nextPassword.length < 4) {
    throw new Error("A senha deve ter ao menos 4 caracteres.")
  }
  if (payload.users.some((item, itemIndex) => item.username === nextUsername && itemIndex !== index)) {
    throw new Error("Já existe outro usuário com esse nome.")
  }

  const adminCount = payload.users.filter((item) => item.role === "admin").length
  if (current.role === "admin" && nextRole !== "admin" && adminCount <= 1) {
    throw new Error("Deve existir ao menos um usuário admin.")
  }

  const updated: StoredPanelUser = {
    ...current,
    username: nextUsername,
    role: nextRole,
    imageUrl: nextImageUrl,
    updatedAt: new Date().toISOString(),
    passwordHash: nextPassword ? sha256(nextPassword) : current.passwordHash,
  }
  payload.users[index] = updated
  await writeUsersFile(payload)
  return toPublicUser(updated)
}

export async function deletePanelUser(username: string) {
  const normalized = normalizeUsername(username)
  if (!normalized) {
    throw new Error("Usuário inválido.")
  }

  const payload = await readUsersFile()
  const index = payload.users.findIndex((item) => item.username === normalized)
  if (index < 0) {
    throw new Error("Usuário não encontrado.")
  }

  const target = payload.users[index]
  const adminCount = payload.users.filter((item) => item.role === "admin").length
  if (target.role === "admin" && adminCount <= 1) {
    throw new Error("Não é possível excluir o último admin.")
  }

  payload.users.splice(index, 1)
  await writeUsersFile(payload)
  return toPublicUser(target)
}
