"use client"

import { useEffect, useState } from "react"
import { Eye, Shield, UserRound, UserRoundCog, UserRoundPlus } from "lucide-react"
import { ModalActions, ModalShell, UnderlineInput } from "@/components/saudacao/ModalShell"

type PanelUser = {
  username: string
  role: "admin" | "user" | "viewer"
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || "Falha ao processar solicitação."))
  }
  return data as T
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "não informado"
  return date.toLocaleString("pt-BR")
}

interface UsersModalProps {
  open: boolean
  onClose: () => void
  currentUsername: string
  onCurrentUserUpdated?: (payload: { username: string; imageUrl?: string }) => void
}

export function UsersModal({ open, onClose, currentUsername, onCurrentUserUpdated }: UsersModalProps) {
  const [users, setUsers] = useState<PanelUser[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [deleteCandidate, setDeleteCandidate] = useState<PanelUser | null>(null)
  const [editingUsername, setEditingUsername] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formImageUrl, setFormImageUrl] = useState("")
  const [formRole, setFormRole] = useState<"admin" | "user" | "viewer">("user")

  const isEditing = Boolean(editingUsername)

  async function loadUsers() {
    setLoading(true)
    setError("")
    try {
      const payload = await requestJson<{ users?: PanelUser[] }>("/api/users")
      setUsers(Array.isArray(payload?.users) ? payload.users : [])
    } catch (nextError) {
      setError(String((nextError as Error)?.message || "Falha ao carregar usuários."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadUsers()
  }, [open])

  function resetForm() {
    setEditingUsername("")
    setFormUsername("")
    setFormPassword("")
    setFormImageUrl("")
    setFormRole("user")
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    setFeedback("")
    try {
      if (!formUsername.trim()) {
        throw new Error("Informe o nome de usuário.")
      }
      if (!isEditing && formPassword.length < 4) {
        throw new Error("Informe uma senha com ao menos 4 caracteres.")
      }

      if (isEditing) {
        const payload = await requestJson<{ user?: PanelUser }>(`/api/users/${encodeURIComponent(editingUsername)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formUsername.trim(),
            password: formPassword,
            role: formRole,
            imageUrl: formImageUrl.trim(),
          }),
        })
        const updatedUser = payload?.user
        if (updatedUser && editingUsername === currentUsername) {
          onCurrentUserUpdated?.({
            username: updatedUser.username,
            imageUrl: updatedUser.imageUrl,
          })
        }
        setFeedback("Usuário atualizado com sucesso.")
      } else {
        await requestJson("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formUsername.trim(),
            password: formPassword,
            role: formRole,
            imageUrl: formImageUrl.trim(),
          }),
        })
        setFeedback("Usuário criado com sucesso.")
      }

      resetForm()
      await loadUsers()
    } catch (nextError) {
      setError(String((nextError as Error)?.message || "Falha ao salvar usuário."))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(username: string) {
    setSaving(true)
    setError("")
    setFeedback("")
    try {
      await requestJson(`/api/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
      })
      if (editingUsername === username) {
        resetForm()
      }
      setDeleteCandidate(null)
      setFeedback("Usuário excluído com sucesso.")
      await loadUsers()
    } catch (nextError) {
      setError(String((nextError as Error)?.message || "Falha ao excluir usuário."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={() => {
        resetForm()
        setError("")
        setFeedback("")
        onClose()
      }}
      title="Usuários"
      subtitle="Cadastro, edição e remoção de acessos ao painel"
      size="xl"
      icon={<UserRoundCog className="h-5 w-5 text-primary" />}
      bodyClassName="overflow-hidden bg-muted/10"
    >
      <div className="grid h-[78vh] max-h-[78vh] gap-0 md:grid-cols-[1.25fr_1fr]">
        <section className="flex min-h-0 flex-col border-b border-border p-6 md:border-r md:border-b-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Acessos cadastrados</h3>
              <p className="text-xs text-muted-foreground">Somente admins visualizam e gerenciam esta lista.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm()
                setError("")
                setFeedback("")
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <UserRoundPlus size={14} />
              Novo
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Nenhum usuário cadastrado.
            </div>
          ) : (
            <div className="min-h-0 h-full flex-1 overflow-y-auto pr-2">
              <div className="space-y-3">
              {users.map((user) => {
                const isCurrent = user.username === currentUsername
                return (
                  <article key={user.username} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {user.imageUrl ? (
                            <span className="inline-flex h-9 w-9 overflow-hidden rounded-xl border border-border bg-muted">
                              <img src={user.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </span>
                          ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              {user.role === "admin" ? <Shield size={16} /> : user.role === "viewer" ? <Eye size={16} /> : <UserRound size={16} />}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {user.role === "admin" ? "Administrador" : user.role === "viewer" ? "Visualização" : "Usuário"}
                              {isCurrent ? " · sessão atual" : ""}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          Criado em {formatDateTime(user.createdAt)}<br />
                          Atualizado em {formatDateTime(user.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUsername(user.username)
                            setFormUsername(user.username)
                            setFormPassword("")
                            setFormImageUrl(String(user.imageUrl || ""))
                            setFormRole(user.role)
                            setError("")
                            setFeedback("")
                          }}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteCandidate(user)
                          }}
                          disabled={isCurrent}
                          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-status-err transition-colors hover:bg-destructive/10"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {isEditing ? `Editando ${editingUsername}` : "Novo usuário"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Defina credenciais e nível de acesso ao painel.
            </p>
          </div>

          <div className="space-y-5">
            <UnderlineInput
              label="Usuário"
              value={formUsername}
              onChange={setFormUsername}
              placeholder="ex.: joao.silva"
              required
              disabled={editingUsername === currentUsername}
            />

            <div className="space-y-2">
            <UnderlineInput
              label={isEditing ? "Nova senha" : "Senha"}
              value={formPassword}
                onChange={setFormPassword}
                placeholder={isEditing ? "deixe em branco para manter" : "mínimo 4 caracteres"}
                type="password"
                hint={isEditing ? "Se deixar em branco, a senha atual será mantida." : undefined}
              required={!isEditing}
            />

            <UnderlineInput
              label="Link da imagem"
              value={formImageUrl}
              onChange={setFormImageUrl}
              placeholder="https://exemplo.com/avatar.jpg"
              hint="Opcional. Será usado como avatar do usuário no painel."
            />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfil</label>
              <select
                value={formRole}
                onChange={(event) =>
                  setFormRole(
                    event.target.value === "admin"
                      ? "admin"
                      : event.target.value === "viewer"
                        ? "viewer"
                        : "user"
                  )
                }
                disabled={editingUsername === currentUsername}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                <option value="user">Usuário</option>
                <option value="viewer">Visualização</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                `Visualização` pode navegar pelo painel e ver explicações, mas não altera dados.
              </p>
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {feedback ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {feedback}
              </div>
            ) : null}
          </div>

          <ModalActions
            onCancel={() => {
              resetForm()
              setError("")
              setFeedback("")
            }}
            onConfirm={() => {
              void handleSave()
            }}
            confirmLabel={saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar usuário"}
            confirmDisabled={saving}
            cancelLabel={isEditing ? "Cancelar edição" : "Limpar"}
          />
        </section>
      </div>

      {deleteCandidate ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/12 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">Excluir usuário</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Deseja realmente excluir o usuário "{deleteCandidate.username}"?
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Esta ação remove o acesso ao painel imediatamente.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDelete(deleteCandidate.username)
                }}
                disabled={saving}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-semibold text-status-err transition-colors hover:bg-destructive/20 disabled:opacity-60"
              >
                {saving ? "Excluindo..." : "Excluir usuário"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
