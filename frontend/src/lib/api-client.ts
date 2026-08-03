let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

export class AuthExpiredError extends Error {}

type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: HeadersInit
}

async function rawFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

// Callback central pra qualquer chamada (dentro ou fora do bootstrap do
// AuthContext) avisar que a sessao expirou de vez (refresh falhou). O
// AuthContext registra o handler pra limpar o contexto e mandar o usuario
// pra /login mesmo quando o 401 acontece fora do fluxo de bootstrap.
let onAuthExpired: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  onAuthExpired = handler
}

// refreshAccessToken precisa ser single-flight: o backend tem
// ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION, entao cada refresh
// bem-sucedido invalida o cookie anterior. Duas chamadas concorrentes (ex.:
// StrictMode disparando o bootstrap do AuthContext duas vezes) usando o
// mesmo cookie fariam a segunda tomar 401 mesmo com sessao valida. Uma
// unica promise em voo garante que so exista um POST /auth/refresh/ por
// vez; chamadas concorrentes esperam a mesma promise.
let refreshInFlight: Promise<string> | null = null

export function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight
  }
  refreshInFlight = (async () => {
    const response = await fetch('/api/auth/refresh/', { method: 'POST', credentials: 'include' })
    if (!response.ok) {
      onAuthExpired?.()
      throw new AuthExpiredError()
    }
    const data = (await response.json()) as { access: string }
    accessToken = data.access
    return data.access
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false,
): Promise<T> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && !isRetry && path !== '/auth/refresh/' && path !== '/auth/login/') {
    await refreshAccessToken()
    return apiRequest<T>(path, options, true)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { detail?: string })
    throw new ApiError(response.status, (body as { detail?: string }).detail ?? 'Erro na requisicao', body)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
