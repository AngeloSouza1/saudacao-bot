"use client"

const STORAGE_KEY = "saudacao.panel.lock-until"

function now() {
  return Date.now()
}

export function getPanelUnlockUntil() {
  if (typeof window === "undefined") return 0
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const value = Number(raw || 0)
  if (!Number.isFinite(value) || value <= now()) {
    window.localStorage.removeItem(STORAGE_KEY)
    return 0
  }
  return value
}

export function isPanelUnlocked() {
  return getPanelUnlockUntil() > now()
}

export function activatePanelUnlock(timeoutMin: number) {
  if (typeof window === "undefined") return 0
  const safeTimeout = Number.isFinite(timeoutMin) && timeoutMin > 0 ? timeoutMin : 15
  const unlockUntil = now() + safeTimeout * 60 * 1000
  window.localStorage.setItem(STORAGE_KEY, String(unlockUntil))
  return unlockUntil
}

export function clearPanelUnlock() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}
