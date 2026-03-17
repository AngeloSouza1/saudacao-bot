export function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

export function isNullWord(value: unknown) {
  return normalizeText(value).toLowerCase() === "null"
}

export function isValidStudentName(value: unknown) {
  const v = normalizeText(value)
  return v.length >= 2 && !isNullWord(v)
}

export function isValidPhoneFallback(value: unknown) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (!digits) return true
  return digits.length >= 10 && digits.length <= 15
}

export function normalizeHourInput(rawValue: unknown) {
  const original = normalizeText(rawValue)
  if (!original) return ""
  const normalizedSource = original
    .normalize("NFKC")
    .replace(/[hH.]/g, ":")
    .replace(/[,;：﹕ː]/g, ":")
    .replace(/[-_]/g, ":")

  const numericParts: string[] = []
  let current = ""
  for (const ch of normalizedSource) {
    if (ch >= "0" && ch <= "9") {
      current += ch
    } else if (current) {
      numericParts.push(current)
      current = ""
    }
  }
  if (current) numericParts.push(current)

  let hours: number
  let minutes: number
  if (numericParts.length >= 2) {
    hours = Number(numericParts[0])
    minutes = Number(numericParts[1])
  } else {
    const digitsOnly = normalizedSource.replace(/\D/g, "")
    if (!(digitsOnly.length === 3 || digitsOnly.length === 4)) return ""
    const hh = digitsOnly.length === 3 ? digitsOnly.slice(0, 1) : digitsOnly.slice(0, 2)
    const mm = digitsOnly.slice(-2)
    hours = Number(hh)
    minutes = Number(mm)
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return ""
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return ""
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function isValidDateOnly(value: unknown) {
  const raw = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const [year, month, day] = raw.split("-").map(Number)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function hasRequiredConfig(params: {
  turma?: unknown
  instituicao?: unknown
  groupName?: unknown
  to?: unknown
  scheduleCount?: number
}) {
  const turmaOk = normalizeText(params.turma).length >= 2
  const instituicaoOk = normalizeText(params.instituicao).length >= 2
  const destinationOk = normalizeText(params.groupName) || normalizeText(params.to)
  const scheduleOk = Number(params.scheduleCount || 0) > 0
  return Boolean(turmaOk && instituicaoOk && destinationOk && scheduleOk)
}

