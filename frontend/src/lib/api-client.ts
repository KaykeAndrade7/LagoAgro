let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class AuthExpiredError extends Error {}

type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: HeadersInit
}

async function rawFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
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

export async function refreshAccessToken(): Promise<string> {
  const response = await fetch('/api/auth/refresh/', { method: 'POST', credentials: 'include' })
  if (!response.ok) {
    throw new AuthExpiredError()
  }
  const data = (await response.json()) as { access: string }
  accessToken = data.access
  return data.access
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false,
): Promise<T> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && !isRetry && path !== '/auth/refresh/') {
    await refreshAccessToken()
    return apiRequest<T>(path, options, true)
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}) as { detail?: string })
    throw new ApiError(response.status, detail.detail ?? 'Erro na requisicao')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
