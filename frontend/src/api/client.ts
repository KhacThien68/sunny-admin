import axios from 'axios'
import { useAuth } from '../stores/auth'

export const apiClient = axios.create({
  baseURL: '/api',
})

// Single-flight refresh promise — module level so all concurrent 401s share it
let refreshPromise: Promise<string> | null = null

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 with single-flight token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh for auth routes to avoid infinite loops
    const url: string = originalRequest?.url ?? ''
    if (
      error.response?.status !== 401 ||
      url.startsWith('/auth/') ||
      originalRequest._retried
    ) {
      return Promise.reject(error)
    }

    // Mark request as retried to prevent loops
    originalRequest._retried = true

    try {
      // Single-flight: if refresh is already in-flight, wait for it
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/auth/refresh', {}, { withCredentials: true })
          .then((res) => {
            const { accessToken, user } = res.data as {
              accessToken: string
              user: import('../stores/auth').AuthUser
            }
            useAuth.getState().setAuth(accessToken, user)
            return accessToken
          })
          .finally(() => {
            refreshPromise = null
          })
      }

      const newToken = await refreshPromise

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch {
      useAuth.getState().clear()
      return Promise.reject(error)
    }
  },
)
