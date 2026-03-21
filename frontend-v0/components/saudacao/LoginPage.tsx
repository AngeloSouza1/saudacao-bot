"use client"

import { useState } from "react"
import { LockKeyhole, LogIn } from "lucide-react"

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(String(data?.error || "Falha na autenticação."))
  return data as T
}

export function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      await postJson("/api/auth/login", {
        username: username.trim(),
        password,
      })
      window.location.reload()
    } catch (err) {
      setError(String((err as Error)?.message || "Falha ao entrar no painel."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-border bg-card/80 p-10 shadow-sm">
            <span className="inline-flex rounded-full border border-primary/10 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Saudação Bot
            </span>
            <h1 className="mt-6 max-w-xl text-5xl font-black tracking-tight text-foreground">
              Acesse o painel antes de liberar o WhatsApp
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              Primeiro valide o acesso ao painel. Depois disso, a aplicação decide se deve mostrar
              o QR Code do WhatsApp ou entrar direto no painel operacional.
            </p>
            <div className="mt-10 grid gap-4">
              {[
                "1. Faça login no painel com usuário e senha.",
                "2. Se a sessão do WhatsApp estiver desconectada, escaneie o QR Code.",
                "3. Com o WhatsApp pronto, o painel operacional é liberado.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-muted/20 px-5 py-4 text-sm text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-card shadow-sm">
            <div className="border-b border-border px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                  <LockKeyhole size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Login do painel</h2>
                  <p className="text-sm text-muted-foreground">Use suas credenciais para continuar.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-8 py-8">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Usuário
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  autoComplete="username"
                  placeholder="Digite seu usuário"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-green-deep disabled:opacity-60"
              >
                <LogIn size={16} />
                {loading ? "Entrando..." : "Entrar no painel"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
