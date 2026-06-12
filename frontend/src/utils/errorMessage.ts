import type { AxiosError } from 'axios'

interface ApiErrorBody {
  message?: string | string[]
  statusCode?: number
}

/**
 * Extracts a human-readable error message from an Axios error.
 * Backend errors have shape { message: string | string[], statusCode }.
 * Arrays are joined with '; '. Falls back to `fallback` if nothing found.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiErrorBody>
  const data = axiosErr?.response?.data
  if (!data) return fallback

  const { message } = data
  if (!message) return fallback
  if (Array.isArray(message)) return message.join('; ')
  return message
}
