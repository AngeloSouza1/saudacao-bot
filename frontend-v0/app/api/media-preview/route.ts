import { promises as fs } from "fs"
import path from "path"

function resolveRepoRoot() {
  const cwd = process.cwd()
  return path.basename(cwd) === "frontend-v0" ? path.resolve(cwd, "..") : cwd
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  if (ext === ".svg") return "image/svg+xml"
  return "application/octet-stream"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawPath = String(searchParams.get("path") || "").trim()
  if (!rawPath) {
    return new Response("Arquivo não informado.", { status: 400 })
  }

  const repoRoot = resolveRepoRoot()
  const normalized = rawPath.replace(/^\/+/, "")
  const absolutePath = path.resolve(repoRoot, normalized)

  if (!absolutePath.startsWith(repoRoot + path.sep) && absolutePath !== repoRoot) {
    return new Response("Caminho inválido.", { status: 400 })
  }

  try {
    const file = await fs.readFile(absolutePath)
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": getContentType(absolutePath),
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return new Response("Arquivo não encontrado.", { status: 404 })
  }
}
