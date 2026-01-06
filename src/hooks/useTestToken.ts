import { useMutation } from "@tanstack/react-query"

interface TestTokenResponse {
  success: boolean
  message?: string
  error?: string
  duration: number
  data?: {
    reservationsFound: number
    apiStatus: number
    apiMessage: string
  }
  apiDetails?: {
    status?: number
    message?: string
    response?: any
  }
}

export function useTestToken() {
  return useMutation({
    mutationFn: async (): Promise<TestTokenResponse> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/test-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      })

      const data: TestTokenResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to test token")
      }

      return data
    },
  })
}
