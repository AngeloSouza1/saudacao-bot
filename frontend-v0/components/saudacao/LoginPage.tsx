"use client"

import { useState } from "react"
import { Lock, LogIn } from "lucide-react"

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
      window.sessionStorage.setItem("saudacao.panel.just-authenticated", "1")
      window.location.reload()
    } catch (err) {
      setError(String((err as Error)?.message || "Falha ao entrar no painel."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_0.8fr]">
            <section className="space-y-6">
              <div className="rounded-[2rem] border border-border/50 bg-card p-8 shadow-sm">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Saudação Bot
                  </span>
                </div>

                <h1 className="mb-4 max-w-3xl text-4xl font-bold leading-tight text-foreground text-balance lg:text-5xl">
                  Acesse o painel antes de liberar o WhatsApp
                </h1>

                <p className="mb-8 max-w-2xl text-base leading-relaxed text-foreground/70">
                  Primeiro valide o acesso ao painel. Depois disso, a aplicação decide se deve
                  mostrar o QR Code do WhatsApp ou entrar direto no painel operacional.
                </p>

                <div className="space-y-3">
                  {[
                    "Faça login no painel com usuário e senha.",
                    "Se a sessão do WhatsApp estiver desconectada, escaneie o QR Code.",
                    "Com o WhatsApp pronto, o painel operacional é liberado.",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-lg border border-border bg-secondary/40 p-4"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-semibold text-primary">{index + 1}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/85">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="lg:pl-4">
              <div className="rounded-[2rem] border border-border/40 bg-white p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-green-mid/30 bg-green-soft">
                      <Lock className="h-5 w-5 text-green-deep" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Login do painel</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Use suas credenciais para continuar.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="panel-user"
                      className="text-xs font-semibold uppercase tracking-wide text-foreground/70"
                    >
                      Usuário
                    </label>
                    <input
                      id="panel-user"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      placeholder="seu.usuario"
                      className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="panel-password"
                      className="text-xs font-semibold uppercase tracking-wide text-foreground/70"
                    >
                      Senha
                    </label>
                    <input
                      id="panel-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-xs font-medium text-destructive">{error}</p>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || !username.trim() || !password}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>Entrar no painel</span>
                      </>
                    )}
                  </button>

                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Após o login, o sistema pode solicitar a conexão do WhatsApp.
                  </p>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
