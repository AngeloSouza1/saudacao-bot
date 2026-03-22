"use client"

import { useEffect, useState } from "react"
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
  const [userPreview, setUserPreview] = useState<{ username?: string; imageUrl?: string } | null>(null)

  useEffect(() => {
    const normalizedUsername = username.trim()
    if (!normalizedUsername) {
      setUserPreview(null)
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/user-preview?username=${encodeURIComponent(normalizedUsername)}`, {
          cache: "no-store",
        })
        const data = await response.json().catch(() => ({}))
        const preview = data?.user && typeof data.user === "object" ? data.user : null
        setUserPreview(preview)
      } catch {
        setUserPreview(null)
      }
    }, 180)

    return () => window.clearTimeout(timer)
  }, [username])

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
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7fbf8_0%,#eef5ef_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(40,130,85,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(227,183,90,0.14),transparent_22%)]" />
      <div className="absolute left-[6%] top-[10%] h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="absolute right-[10%] top-[22%] h-48 w-48 rounded-full bg-accent/12 blur-3xl" aria-hidden="true" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-4">
        <div className="w-full max-w-7xl">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.03fr_0.72fr] xl:items-stretch">
            <section className="rounded-[1.85rem] border border-white/60 bg-white/78 p-4 shadow-[0_30px_90px_rgba(20,74,45,0.12)] backdrop-blur-xl sm:p-4.5 lg:p-5">
              <div className="grid gap-3 xl:grid-cols-[0.98fr_0.72fr] xl:items-stretch">
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/18 bg-primary/7 px-3 py-1.5">
                      <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                        Saudação Bot
                      </span>
                    </div>

                    <h1 className="max-w-3xl text-[2.02rem] font-black leading-[1.01] tracking-[-0.05em] text-foreground text-balance sm:text-[2.24rem] lg:text-[2.45rem]">
                      Acesse o painel com segurança antes de liberar o WhatsApp
                    </h1>

                    <p className="mt-4 max-w-2xl text-[0.92rem] leading-[1.75] text-foreground/70">
                      Controle o acesso do painel, valide a conta correta e só então prossiga para a
                      conexão do WhatsApp e o início da operação da turma.
                    </p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {[
                      {
                        title: "Autenticação do painel",
                        desc: "Entre com seu usuário e senha para validar o acesso administrativo.",
                      },
                      {
                        title: "Validação da sessão do WhatsApp",
                        desc: "Se a sessão estiver desconectada, o sistema abrirá o QR Code para autenticação.",
                      },
                      {
                        title: "Acesso operacional liberado",
                        desc: "Com o WhatsApp pronto, o painel principal é carregado automaticamente.",
                      },
                    ].map((item, index) => (
                      <div
                        key={item.title}
                        className="rounded-[1rem] border border-border/80 bg-[linear-gradient(180deg,rgba(244,249,244,0.94),rgba(235,243,236,0.78))] px-3 py-2.5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-[0.94rem] font-semibold text-foreground">{item.title}</p>
                            <p className="mt-1 text-[0.9rem] leading-5 text-foreground/68">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[1.45rem] border border-primary/12 bg-[linear-gradient(145deg,rgba(16,80,52,0.98),rgba(24,111,73,0.93))] shadow-[0_24px_70px_rgba(18,71,47,0.28)]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,26,18,0.12),rgba(8,26,18,0.58))]" />

                  <div className="relative flex h-full min-h-[196px] flex-col justify-between p-4 text-white sm:p-4.5">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                        Ambiente seguro
                      </div>
                      <div className="rounded-full bg-emerald-300/20 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                        Painel protegido
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/68">Controle central</p>
                      <h2 className="mt-2 text-[1.18rem] font-bold leading-tight tracking-[-0.03em] text-balance">
                        Operação, autenticação e sessões organizadas em uma única experiência.
                      </h2>
                      <p className="mt-1.5 max-w-sm text-[0.86rem] leading-5 text-white/74">
                        O login garante rastreabilidade do usuário autenticado antes do acesso à
                        conexão do WhatsApp e ao painel operacional.
                      </p>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-[1.05rem] border border-white/12 bg-white/8">
                      <img
                        src="/imagem-login.png"
                        alt="Fluxo profissional de autenticação e operação"
                        className="h-28 w-full object-cover opacity-80"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-[0.95rem] border border-white/12 bg-white/8 p-2.5 backdrop-blur-sm">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Acesso</p>
                        <p className="mt-1 text-[0.85rem] font-semibold">Usuários rastreáveis</p>
                      </div>
                      <div className="rounded-[0.95rem] border border-white/12 bg-white/8 p-2.5 backdrop-blur-sm">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Sessão</p>
                        <p className="mt-1 text-[0.85rem] font-semibold">Fluxo seguro até o QR Code</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="xl:pl-3">
              <div className="flex h-full rounded-[2.1rem] border border-white/65 bg-white/88 p-5 shadow-[0_26px_80px_rgba(18,71,47,0.12)] backdrop-blur-xl sm:p-6">
                <form onSubmit={handleSubmit} className="flex h-full w-full flex-col">
                  <div className="rounded-[1.5rem] border border-border/60 bg-[linear-gradient(180deg,rgba(252,253,252,0.95),rgba(244,248,245,0.88))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <div className="flex items-start gap-4 border-b border-border/55 pb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.05rem] border border-green-mid/25 bg-[linear-gradient(180deg,rgba(214,238,220,0.96),rgba(195,227,205,0.92))] shadow-sm">
                        <Lock className="h-7 w-7 text-green-deep" strokeWidth={2.4} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/72">
                          Painel autenticado
                        </p>
                        <h2 className="mt-1 text-[1.85rem] font-bold tracking-[-0.03em] text-foreground">
                          Login do painel
                        </h2>
                        <p className="mt-1.5 text-[0.95rem] leading-6 text-muted-foreground">
                          Use suas credenciais para continuar com segurança.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="panel-user"
                          className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/72"
                        >
                          Usuário
                        </label>
                        <div className="relative">
                          {userPreview?.imageUrl ? (
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 overflow-hidden rounded-full border border-white/70 bg-muted shadow-md">
                              <img
                                src={userPreview.imageUrl}
                                alt=""
                                className="h-9 w-9 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </span>
                          ) : null}
                          <input
                            id="panel-user"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            placeholder="seu.usuario"
                            className={`w-full rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(245,249,245,0.95),rgba(238,244,239,0.92))] py-3 pr-4 text-sm text-foreground shadow-inner placeholder:text-muted-foreground/55 transition-all focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/22 ${
                              userPreview?.imageUrl ? "pl-16" : "px-4"
                            }`}
                          />
                        </div>
                        {userPreview?.imageUrl ? (
                          <p className="text-[11px] text-muted-foreground">
                            Usuário reconhecido:{" "}
                            <span className="font-medium text-foreground/80">{userPreview.username}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="panel-password"
                          className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/72"
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
                          className="w-full rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(245,249,245,0.95),rgba(238,244,239,0.92))] px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground/55 transition-all focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/22"
                        />
                      </div>

                      {error ? (
                        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                          <p className="text-sm font-medium text-destructive">{error}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      type="submit"
                      disabled={loading || !username.trim() || !password}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,oklch(0.44_0.12_155),oklch(0.52_0.12_155))] px-5 text-base font-semibold text-primary-foreground shadow-[0_18px_34px_rgba(23,95,62,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(23,95,62,0.3)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                          <span>Entrando...</span>
                        </>
                      ) : (
                        <>
                          <LogIn size={18} />
                          <span>Entrar no painel</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="rounded-[1.3rem] border border-border/75 bg-[linear-gradient(180deg,rgba(244,249,244,0.88),rgba(236,242,237,0.82))] px-4 py-3.5">
                      <p className="text-sm leading-6 text-muted-foreground">
                        Após o login, o sistema verifica a sessão do WhatsApp e direciona você para a
                        próxima etapa do fluxo operacional.
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
