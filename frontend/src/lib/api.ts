function resolveDefaultBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    const port = import.meta.env.VITE_BACKEND_PORT || '1332'
    return `${protocol}//${hostname}:${port}`
  }
  return 'http://localhost:1332'
}

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || resolveDefaultBackendUrl()

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Resposta do servidor não é JSON válido')
  }
}
