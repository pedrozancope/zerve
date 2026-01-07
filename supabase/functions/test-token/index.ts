import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// =============================================================================
// CORS Headers
// =============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// =============================================================================
// Types
// =============================================================================
interface AuthResponse {
  access_token: string
  refresh_token: string
}

interface ListReservationsResponse {
  status: number
  msg: string
  data: any[]
}

interface FlowStep {
  step: string
  status: "running" | "completed" | "error"
  message: string
  details?: Record<string, any>
  request?: Record<string, any>
  response?: Record<string, any>
  timestamp?: string
}

// =============================================================================
// Logger
// =============================================================================
const log = {
  info: (message: string, details: Record<string, any> = {}) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        ...details,
      })
    )
  },

  error: (error: Error | string, details: Record<string, any> = {}) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack =
      error instanceof Error ? error.stack : "No stack trace available"

    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        stack,
        ...details,
      })
    )
  },
}

// =============================================================================
// Utils
// =============================================================================
function formatDateBRT(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const year = today.getFullYear()
  return `${month}/${day}/${year}`
}

// =============================================================================
// Services
// =============================================================================

/**
 * Autentica na API da SuperLógica usando refresh_token
 */
async function authSuperLogica(refreshToken: string): Promise<AuthResponse> {
  const clientId = Deno.env.get("SUPERLOGICA_CLIENT_ID")
  const sessionId = Deno.env.get("SUPERLOGICA_SESSION_ID")
  const personId = Deno.env.get("SUPERLOGICA_PERSON_ID")

  if (!clientId || !sessionId || !personId) {
    throw new Error(
      "Missing SuperLogica environment variables (CLIENT_ID, SESSION_ID, PERSON_ID)"
    )
  }

  const response = await fetch(
    "https://api.superlogica.com/spaces/v1/auth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-app-name": "Gruvi",
        "x-person-id": personId,
        "x-company-id": "23044",
        "x-app-version": "3.11.2",
        "x-app-build": "1811",
        "x-device-type": "mobile",
        "User-Agent": "Gruvi/1811 v3.11.2 (ios; mobile;)",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
        session_id: sessionId,
      }),
    }
  )

  let responseData: any
  let responseText: string = ""

  try {
    responseText = await response.text()
    responseData = JSON.parse(responseText)
  } catch {
    responseData = { raw: responseText }
  }

  if (!response.ok) {
    const error: any = new Error(
      `SuperLogica auth failed (${response.status}): ${JSON.stringify(
        responseData
      )}`
    )
    error.apiStatus = response.status
    error.apiResponse = responseData
    error.apiMessage =
      responseData?.error_description || responseData?.error || responseText
    throw error
  }

  if (!responseData.access_token || !responseData.refresh_token) {
    const error: any = new Error("SuperLogica auth response missing tokens")
    error.apiResponse = responseData
    throw error
  }

  return {
    access_token: responseData.access_token,
    refresh_token: responseData.refresh_token,
  }
}

/**
 * Lista reservas para testar se o token funciona
 */
async function listReservations(
  accessToken: string,
  dateStr: string,
  unitId: string,
  condoId: string
): Promise<ListReservationsResponse> {
  const personId = Deno.env.get("SUPERLOGICA_PERSON_ID")
  const baseUrl = "speedassessoria.superlogica.net"

  const url = `https://${baseUrl}/areadocondomino/atual/reservas/obterreservasdaunidade`

  const body = {
    idUnidades: [unitId],
    dtInicio: dateStr,
    dtFim: dateStr,
    idCondominio: condoId,
    filtrarFila: 1,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "x-person-id": personId || "",
      "x-app-name": "Gruvi",
      license: "speedassessoria",
      tokenjwt: accessToken,
      "x-company-id": "23044",
      "x-app-version": "3.11.2",
      "x-app-build": "1811",
      "x-device-type": "mobile",
      "User-Agent": "Gruvi/1811 v3.11.2 (ios; mobile;)",
      idcondominio: condoId,
    },
    body: JSON.stringify(body),
  })

  let responseData: any
  let responseText: string = ""

  try {
    responseText = await response.text()
    responseData = JSON.parse(responseText)
  } catch (e: any) {
    responseData = { raw: responseText, parseError: e?.message || String(e) }
  }

  log.info("List reservations response", {
    status: response.status,
    ok: response.ok,
    responseData,
  })

  if (!response.ok) {
    const error: any = new Error(
      `List reservations failed (${response.status}): ${JSON.stringify(
        responseData
      )}`
    )
    error.apiStatus = response.status
    error.apiResponse = responseData
    error.apiMessage =
      responseData?.msg || responseData?.message || responseText
    throw error
  }

  return responseData
}

// =============================================================================
// Main Handler
// =============================================================================
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const startTime = Date.now()
  let executionLogId: string | null = null

  try {
    // ==========================================================================
    // Initialize Supabase client
    // ==========================================================================
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // ==========================================================================
    // STEP 1: Get refresh_token from Supabase
    // ==========================================================================
    log.info("Getting refresh token from database...")

    const flowSteps: FlowStep[] = [
      {
        step: "get_token",
        status: "running",
        message: "Buscando refresh token...",
      },
    ]

    // Create execution log
    const { data: logData, error: logError } = await supabaseClient
      .from("execution_logs")
      .insert({
        execution_type: "test_token",
        status: "pending",
        message: "Testando token...",
        flow_steps: flowSteps,
      })
      .select("id")
      .single()

    if (logError) {
      log.error("Failed to create execution log", { error: logError })
    }

    if (logData) {
      executionLogId = logData.id
      log.info("Execution log created", { executionLogId })
    }

    const { data: tokenConfigs, error: tokenError } = await supabaseClient
      .from("app_config")
      .select("value, key")
      .in("key", ["auth_token", "superlogica_refresh_token"])
      .not("value", "is", null)
      .limit(1)

    if (tokenError) {
      throw new Error(`Error fetching refresh token: ${tokenError.message}`)
    }

    const tokenConfig = tokenConfigs?.[0]
    if (!tokenConfig?.value) {
      throw new Error(
        "Refresh token not found in database. Configure it in Settings."
      )
    }

    const currentRefreshToken = tokenConfig.value

    // Complete step 1
    flowSteps[0].status = "completed"
    flowSteps[0].message = "Refresh token obtido com sucesso"

    // ==========================================================================
    // STEP 2: Authenticate with SuperLogica API
    // ==========================================================================
    log.info("Authenticating with SuperLogica API...")

    flowSteps.push({
      step: "authenticate",
      status: "running",
      message: "Autenticando com SuperLógica...",
    })

    if (executionLogId) {
      await supabaseClient
        .from("execution_logs")
        .update({ flow_steps: flowSteps })
        .eq("id", executionLogId)
    }

    const { data: apiConfigs, error: apiConfigError } = await supabaseClient
      .from("app_config")
      .select("key, value")
      .in("key", ["unit_id", "condo_id"])

    if (apiConfigError) {
      throw new Error(`Error fetching API config: ${apiConfigError.message}`)
    }

    const unitId = apiConfigs?.find((c: any) => c.key === "unit_id")?.value
    const condoId = apiConfigs?.find((c: any) => c.key === "condo_id")?.value

    if (!unitId || !condoId) {
      throw new Error(
        "unit_id or condo_id not configured. Configure them in Settings."
      )
    }

    const { access_token: accessToken, refresh_token: newRefreshToken } =
      await authSuperLogica(currentRefreshToken)

    log.info("Authentication successful")

    // Complete step 2 with API request and response details
    flowSteps[1].status = "completed"
    flowSteps[1].message = "Autenticação bem-sucedida"
    flowSteps[1].request = {
      method: "POST",
      url: "https://api.superlogica.com/spaces/v1/auth/token",
      body: {
        grant_type: "refresh_token",
        client_id: "HIDDEN",
        refresh_token: "HIDDEN",
        session_id: "HIDDEN",
      },
    }
    flowSteps[1].response = {
      tokenLength: accessToken?.length || 0,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!newRefreshToken,
    }

    // ==========================================================================
    // STEP 3: Test API by listing reservations
    // ==========================================================================
    log.info("Testing API by listing reservations...")

    flowSteps.push({
      step: "list_reservations",
      status: "running",
      message: "Listando reservas...",
    })

    if (executionLogId) {
      await supabaseClient
        .from("execution_logs")
        .update({ flow_steps: flowSteps })
        .eq("id", executionLogId)
    }

    const dateStr = formatDateBRT()
    const listResult = await listReservations(
      accessToken,
      dateStr,
      unitId,
      condoId
    )

    // Log detalhado para debug
    log.info("Estrutura da resposta da API", {
      hasData: !!listResult.data,
      dataIsArray: Array.isArray(listResult.data),
      dataLength: listResult.data?.length,
      firstItem: listResult.data?.[0],
      firstItemData: listResult.data?.[0]?.data,
      fullData: listResult.data,
    })

    // Count reservations from data[0].data array
    let totalReservations = 0
    if (
      listResult.data &&
      Array.isArray(listResult.data) &&
      listResult.data[0]?.data
    ) {
      const reservasArray = listResult.data[0].data
      if (Array.isArray(reservasArray)) {
        totalReservations = reservasArray.length
      }
    }

    log.info("Total de reservas contadas", { totalReservations })

    // Complete step 3 with request and response
    flowSteps[2].status = "completed"
    flowSteps[2].message = `${totalReservations} reserva(s) encontrada(s)`
    flowSteps[2].request = {
      method: "POST",
      url: "https://api.superlogica.com/spaces/v1/speed/reservations/list",
      body: {
        date: dateStr,
        unit_id: unitId,
        condo_id: condoId,
      },
    }
    flowSteps[2].response = {
      status: listResult.status,
      message: listResult.msg,
      totalReservations,
      reservations: listResult.data?.[0]?.data || [],
    }

    // ==========================================================================
    // STEP 4: Update refresh_token in Supabase
    // ==========================================================================
    log.info("Updating refresh token in database...")

    flowSteps.push({
      step: "update_token",
      status: "running",
      message: "Atualizando refresh token...",
    })

    if (executionLogId) {
      await supabaseClient
        .from("execution_logs")
        .update({ flow_steps: flowSteps })
        .eq("id", executionLogId)
    }

    await supabaseClient
      .from("app_config")
      .update({
        value: newRefreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq("key", tokenConfig.key)

    // Complete step 4
    flowSteps[3].status = "completed"
    flowSteps[3].message = "Token atualizado com sucesso"

    // ==========================================================================
    // STEP 5: Success
    // ==========================================================================
    flowSteps.push({
      step: "success",
      status: "completed" as const,
      message: "Teste concluído com sucesso!",
    })

    const duration = Date.now() - startTime

    log.info("Token test successful", {
      duration,
      reservationsFound: totalReservations,
    })

    // ==========================================================================
    // Update execution log with success
    // ==========================================================================
    if (executionLogId) {
      await supabaseClient
        .from("execution_logs")
        .update({
          status: "success",
          message: `Token válido! ${totalReservations} reserva(s) encontrada(s)`,
          flow_steps: flowSteps,
          request_payload: {
            dateStr,
            unitId,
            condoId,
          },
          response_payload: {
            success: true,
            reservationsFound: totalReservations,
            duration,
            apiResponse: listResult,
          },
          duration_ms: duration,
        })
        .eq("id", executionLogId)
    }

    // ==========================================================================
    // Return success response
    // ==========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        message: "Token is valid and API is working",
        duration,
        data: {
          reservationsFound: totalReservations,
          apiStatus: listResult.status,
          apiMessage: listResult.msg,
          apiResponse: listResult,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    // ==========================================================================
    // ERROR HANDLING
    // ==========================================================================
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    // Extrair detalhes da API se disponíveis
    const apiStatus = (error as any)?.apiStatus
    const apiResponse = (error as any)?.apiResponse
    const apiMessage = (error as any)?.apiMessage

    log.error("Token test failed", {
      error: errorMessage,
      stack: errorStack,
      duration,
      apiStatus,
      apiResponse,
      apiMessage,
    })

    // Update execution log with error
    if (executionLogId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )

        await supabaseClient
          .from("execution_logs")
          .update({
            status: "error",
            message: errorMessage,
            response_payload: {
              success: false,
              error: errorMessage,
            },
            details: {
              apiStatus,
              apiMessage,
              apiResponse,
            },
            duration_ms: duration,
          })
          .eq("id", executionLogId)
      } catch (logUpdateError) {
        log.error("Failed to update execution log", {
          error: logUpdateError,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration,
        apiDetails: {
          status: apiStatus,
          message: apiMessage,
          response: apiResponse,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
