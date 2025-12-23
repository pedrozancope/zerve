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
interface ExecuteReservationPayload {
  scheduleId?: string
  // Modo de teste E2E: permite rodar sem um schedule real (reserva para HOJE)
  test?: boolean
  hour?: number // horário da reserva (6-21)
  // Modo Dry Run: executa tudo EXCETO a reserva final (para validar agendamentos)
  dryRun?: boolean
}

interface AuthResponse {
  access_token: string
  refresh_token: string
}

interface ReservationApiResponse {
  status: number
  msg: string
  data: Array<{
    status: number
    ID_RESERVA_RES?: string
    id_reserva?: string
    [key: string]: any
  }>
}

interface NotificationConfig {
  email?: string
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
}

// =============================================================================
// Constants - Mapeamento de horários para IDs (igual Utils.js)
// =============================================================================
const ID_AREAS: Record<number, string> = {
  6: "455",
  7: "440",
  8: "441",
  9: "442",
  10: "443",
  11: "444",
  12: "445",
  13: "446",
  14: "447",
  15: "448",
  16: "449",
  17: "450",
  18: "451",
  19: "452",
  20: "453",
  21: "454",
}

// =============================================================================
// Logger - Igual Logs.js
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
// Utils - Igual Utils.js
// =============================================================================

/**
 * Converte a data para o formato MM/DD/YYYY
 * @param isTestMode - Se true, usa a data de hoje. Se false, usa +10 dias.
 */
function convertReservationDate(isTestMode: boolean = false): string {
  const today = new Date()
  const targetDate = new Date(today)

  // No modo de teste, usa a data de HOJE para testar imediatamente
  // No modo normal, usa +10 dias (regra do condomínio)
  if (!isTestMode) {
    targetDate.setDate(today.getDate() + 10)
  }

  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const day = String(targetDate.getDate()).padStart(2, "0")
  const year = targetDate.getFullYear()

  return `${month}/${day}/${year}`
}

/**
 * Calcula a data da reserva baseado no modo de disparo
 * @param schedule - O agendamento com trigger_mode e trigger_datetime
 * @param isTestMode - Se true, usa a data de hoje
 */
function calculateReservationDate(
  schedule: {
    trigger_mode?: string
    trigger_datetime?: string
    reservation_day_of_week?: number
  } | null,
  isTestMode: boolean = false
): string {
  // Modo de teste: sempre usa a data de hoje
  if (isTestMode) {
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    const year = today.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Se o schedule tem modo "trigger_date" com datetime específico
  // A reserva deve ser feita para o DIA da data de disparo (não +10)
  if (schedule?.trigger_mode === "trigger_date" && schedule.trigger_datetime) {
    const triggerDate = new Date(schedule.trigger_datetime)
    const month = String(triggerDate.getMonth() + 1).padStart(2, "0")
    const day = String(triggerDate.getDate()).padStart(2, "0")
    const year = triggerDate.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Modo padrão "reservation_date": usa +10 dias (regra do condomínio)
  const today = new Date()
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + 10)

  const month = String(targetDate.getMonth() + 1).padStart(2, "0")
  const day = String(targetDate.getDate()).padStart(2, "0")
  const year = targetDate.getFullYear()

  return `${month}/${day}/${year}`
}

/**
 * Obtém o ID da área baseado na hora
 * Igual: getIdOfArea() em Utils.js
 */
function getIdOfArea(hour: number): string {
  if (!hour || !Number.isInteger(hour) || hour < 6 || hour > 21) {
    throw new Error(
      "Invalid hour provided. Hour must be an integer between 6 and 21."
    )
  }
  return ID_AREAS[hour]
}

// =============================================================================
// Services
// =============================================================================

/**
 * Autentica na API da SuperLógica usando refresh_token
 * Igual: SuperLogicaService.auth()
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
        "x-app-version": "2.15.0",
        "x-app-build": "1272",
        "x-device-type": "mobile",
        "User-Agent": "Gruvi/1272 v2.15.0 (ios; mobile;)",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
        session_id: sessionId,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `SuperLogica auth failed (${response.status}): ${errorText}`
    )
  }

  const data = await response.json()

  if (!data.access_token || !data.refresh_token) {
    throw new Error("SuperLogica auth response missing tokens")
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  }
}

/**
 * Faz a reserva na API do Speed
 * Igual: SpeedService.putReservation()
 */
async function putReservation(
  accessToken: string,
  dateStr: string,
  idArea: string
): Promise<ReservationApiResponse> {
  const personId = Deno.env.get("SUPERLOGICA_PERSON_ID")
  const baseUrl = "speedassessoria.superlogica.net"

  const url = `https://${baseUrl}/areadocondomino/atual/reservas/put?ID_AREA_ARE=${idArea}&DT_RESERVA_RES=${encodeURIComponent(
    dateStr
  )}&ID_UNIDADE_UNI=17686&ID_CONDOMINIO_COND=185&FL_REGRAS_ARE=1&FL_RESERVA_JA_CONFIRMADA=0`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-person-id": personId || "",
      "x-app-name": "Gruvi",
      license: "speedassessoria",
      tokenjwt: accessToken,
      "x-company-id": "23044",
      "x-app-version": "2.15.0",
      "x-app-build": "1272",
      "x-device-type": "mobile",
      "User-Agent": "Gruvi/1272 v2.15.0 (ios; mobile;)",
      idcondominio: "185",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Speed API request failed (${response.status}): ${errorText}`
    )
  }

  return await response.json()
}

/**
 * Envia e-mail de notificação via Resend
 */
async function sendNotificationEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")

  if (!resendApiKey) {
    log.info("RESEND_API_KEY não configurada, pulando envio de e-mail")
    return false
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Tennis Scheduler <noreply@resend.dev>",
        to: [to],
        subject,
        html: htmlBody,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error(`Erro ao enviar e-mail: ${errorText}`)
      return false
    }

    log.info("E-mail enviado com sucesso", { to, subject })
    return true
  } catch (error) {
    log.error("Erro ao enviar e-mail", {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Gera HTML do e-mail de sucesso
 */
function generateSuccessEmailHtml(
  reservationDate: string,
  hour: number,
  isTest: boolean,
  isDryRun: boolean = false
): string {
  const dryRunBanner = isDryRun
    ? `
    <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">🔍 MODO DRY RUN</p>
      <p style="margin: 4px 0 0; color: #a16207; font-size: 13px;">Esta é uma simulação. Nenhuma reserva real foi efetuada.</p>
    </div>
  `
    : ""

  const testBadge = isTest && !isDryRun ? "(TESTE) " : ""
  const dryRunBadge = isDryRun ? "[DRY RUN] " : ""

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, ${
        isDryRun ? "#f59e0b" : "#22c55e"
      } 0%, ${
    isDryRun ? "#d97706" : "#16a34a"
  } 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎾 ${dryRunBadge}${testBadge}Reserva Confirmada!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          ${
            isDryRun
              ? "Simulação concluída com sucesso"
              : "Sua reserva foi realizada com sucesso"
          }
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        ${dryRunBanner}
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Data:</strong> ${reservationDate}</p>
          <p style="margin: 8px 0 0;"><strong>Horário:</strong> ${hour
            .toString()
            .padStart(2, "0")}:00</p>
        </div>
        
        ${
          isDryRun
            ? `
          <div style="background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              ✅ <strong>O que foi validado:</strong> Autenticação, refresh token, configurações do agendamento
            </p>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">
              ⏭️ <strong>Não executado:</strong> Chamada à API de reserva
            </p>
          </div>
        `
            : ""
        }
        
        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
            🎾 Tennis Scheduler - Reservas Automáticas
          </p>
        </div>
      </div>
    </div>
  `
}

/**
 * Gera HTML do e-mail de erro - versão detalhada
 */
function generateErrorEmailHtml(
  errorMessage: string,
  step: string,
  hour: number,
  isTest: boolean,
  details?: {
    reservationDate?: string
    idArea?: string
    apiStatus?: number
    apiMessage?: string
    apiResponse?: any
    stack?: string
    duration?: number
    scheduleId?: string
    scheduleName?: string
    isDryRun?: boolean
  }
): string {
  const isDryRun = details?.isDryRun || false
  const stepNames: Record<string, string> = {
    initialization: "Inicialização",
    parsing_payload: "Processamento do Payload",
    test_mode: "Configuração Modo Teste",
    getting_schedule: "Busca do Agendamento",
    getting_refresh_token: "Obtenção do Refresh Token",
    authenticating_superlogica: "Autenticação SuperLógica",
    updating_refresh_token: "Atualização do Refresh Token",
    making_reservation: "Execução da Reserva",
    processing_response: "Processamento da Resposta",
    saving_execution_log: "Salvamento do Log",
    saving_reservation: "Salvamento da Reserva",
    sending_notification: "Envio de Notificação",
  }

  const stepName = stepNames[step] || step
  const timestamp = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })

  const dryRunBanner = isDryRun
    ? `
    <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">🔍 MODO DRY RUN</p>
      <p style="margin: 4px 0 0; color: #a16207; font-size: 13px;">Esta é uma simulação. Nenhuma reserva real seria efetuada.</p>
    </div>
  `
    : ""

  let apiDetailsHtml = ""
  if (details?.apiStatus || details?.apiMessage || details?.apiResponse) {
    apiDetailsHtml = `
      <div style="background: #fff7ed; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316;">
        <h3 style="margin: 0 0 12px 0; color: #c2410c; font-size: 14px;">📡 Resposta da API</h3>
        ${
          details.apiStatus
            ? `<p style="margin: 0 0 8px 0;"><strong>Status HTTP:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${details.apiStatus}</code></p>`
            : ""
        }
        ${
          details.apiMessage
            ? `<p style="margin: 0 0 8px 0;"><strong>Mensagem:</strong> ${details.apiMessage}</p>`
            : ""
        }
        ${
          details.apiResponse
            ? `
          <details style="margin-top: 8px;">
            <summary style="cursor: pointer; color: #9a3412; font-weight: 500;">Ver resposta completa</summary>
            <pre style="background: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; margin-top: 8px;">${JSON.stringify(
              details.apiResponse,
              null,
              2
            )}</pre>
          </details>
        `
            : ""
        }
      </div>
    `
  }

  let scheduleInfoHtml = ""
  if (details?.scheduleId || details?.scheduleName) {
    scheduleInfoHtml = `
      <p style="margin: 8px 0 0;"><strong>Agendamento:</strong> ${
        details.scheduleName || details.scheduleId || "N/A"
      }</p>
    `
  }

  let technicalDetailsHtml = ""
  if (details?.stack) {
    technicalDetailsHtml = `
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">🔧 Detalhes Técnicos</h3>
        <details>
          <summary style="cursor: pointer; color: #6b7280; font-weight: 500;">Ver stack trace</summary>
          <pre style="background: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 10px; margin-top: 8px; white-space: pre-wrap; word-break: break-all;">${details.stack}</pre>
        </details>
      </div>
    `
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">❌ Erro na Reserva ${
          isTest
            ? '<span style="background: #fbbf24; color: #1f2937; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">TESTE</span>'
            : ""
        }</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Ocorreu um erro ao tentar fazer a reserva</p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        
        ${dryRunBanner}
        
        <!-- Error Summary -->
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #ef4444;">
          <h3 style="margin: 0 0 12px 0; color: #991b1b; font-size: 14px;">⚠️ Resumo do Erro</h3>
          <p style="margin: 0 0 8px 0;"><strong>Horário tentado:</strong> ${
            hour ? hour.toString().padStart(2, "0") + ":00" : "N/A"
          }</p>
          ${
            details?.reservationDate
              ? `<p style="margin: 0 0 8px 0;"><strong>Data da reserva:</strong> ${details.reservationDate}</p>`
              : ""
          }
          ${
            details?.idArea
              ? `<p style="margin: 0 0 8px 0;"><strong>ID da Área:</strong> ${details.idArea}</p>`
              : ""
          }
          ${scheduleInfoHtml}
          <p style="margin: 8px 0 0;"><strong>Etapa com erro:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${stepName}</code></p>
        </div>

        <!-- Error Message -->
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px;">💬 Mensagem de Erro</h3>
          <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 13px; word-break: break-word;">${errorMessage}</p>
        </div>

        ${apiDetailsHtml}
        ${technicalDetailsHtml}

        <!-- Metadata -->
        <div style="background: #f9fafb; padding: 12px 16px; border-radius: 8px; margin-top: 16px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            <strong>Timestamp:</strong> ${timestamp}
            ${
              details?.duration
                ? ` • <strong>Duração:</strong> ${details.duration}ms`
                : ""
            }
          </p>
        </div>

        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
            🎾 Tennis Scheduler - Reservas Automáticas
          </p>
        </div>
      </div>
    </div>
  `
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
  let scheduleId: string | undefined
  let reservationHour: number | undefined
  let currentStep = "initialization"
  let isTestMode = false
  let isDryRun = false
  let schedule: any = null

  // Log detalhado para retornar ao cliente
  const executionLog: {
    step: string
    message: string
    details?: any
    timestamp: string
  }[] = []

  function addLog(step: string, message: string, details?: any) {
    executionLog.push({
      step,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
    log.info(message, { step, ...details })
  }

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
    // STEP 0: Parse payload
    // ==========================================================================
    currentStep = "parsing_payload"
    const payload: ExecuteReservationPayload = await req.json()
    scheduleId = payload.scheduleId
    isTestMode = payload.test === true
    isDryRun = payload.dryRun === true

    addLog(currentStep, "Payload recebido", {
      scheduleId,
      isTestMode,
      isDryRun,
      hour: payload.hour,
    })

    // ==========================================================================
    // MODO DE TESTE E2E: não precisa de scheduleId, usa hour diretamente
    // ==========================================================================
    if (isTestMode) {
      reservationHour = payload.hour
      if (!reservationHour || reservationHour < 6 || reservationHour > 21) {
        throw new Error("Para teste E2E, informe 'hour' entre 6 e 21.")
      }
      addLog("test_mode", "Modo de teste E2E ativado", { reservationHour })
    } else {
      // ==========================================================================
      // STEP 1: Get schedule details and extract reservationHour
      // ==========================================================================
      currentStep = "getting_schedule"

      if (!scheduleId) {
        throw new Error(
          "scheduleId é obrigatório quando não está em modo de teste"
        )
      }

      addLog(currentStep, "Buscando detalhes do agendamento...", { scheduleId })

      const { data: scheduleData, error: scheduleError } = await supabaseClient
        .from("schedules")
        .select(`*, time_slots (*)`)
        .eq("id", scheduleId)
        .single()

      if (scheduleError || !scheduleData) {
        throw new Error(
          `Schedule not found: ${scheduleError?.message || "Unknown error"}`
        )
      }

      schedule = scheduleData

      if (!schedule.is_active) {
        addLog(currentStep, "Schedule está inativo, pulando execução", {
          scheduleId,
        })
        return new Response(
          JSON.stringify({
            success: false,
            message: "Schedule is inactive",
            scheduleId,
            log: executionLog,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        )
      }

      // Extract reservation hour from time_slot
      reservationHour = schedule.time_slots?.hour
      if (!reservationHour) {
        throw new Error("Time slot hour not found in schedule")
      }

      addLog(currentStep, "Detalhes do agendamento obtidos", {
        scheduleName: schedule.name,
        reservationHour,
        timeSlotName: schedule.time_slots?.display_name,
      })
    }

    // ==========================================================================
    // STEP 2: Get refresh_token from Supabase (equivalent to SSM)
    // ==========================================================================
    currentStep = "getting_refresh_token"
    addLog(currentStep, "Obtendo refresh token do Supabase...")

    // Busca o token - pode estar com a chave 'auth_token' ou 'superlogica_refresh_token'
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
        `Refresh token not found in database. Certifique-se de configurar o token em Configurações.`
      )
    }

    const currentRefreshToken = tokenConfig.value
    addLog(currentStep, "Refresh token obtido do Supabase", {
      tokenKey: tokenConfig.key,
      tokenLength: currentRefreshToken.length,
      tokenPreview: currentRefreshToken.substring(0, 10) + "...",
    })

    // ==========================================================================
    // STEP 3: Authenticate with SuperLogica API
    // ==========================================================================
    currentStep = "authenticating_superlogica"
    addLog(currentStep, "Autenticando com a API da SuperLogica...")

    const { access_token: accessToken, refresh_token: newRefreshToken } =
      await authSuperLogica(currentRefreshToken)

    addLog(currentStep, "Access token e refresh token obtidos", {
      accessTokenLength: accessToken.length,
      accessTokenPreview: accessToken.substring(0, 10) + "...",
      refreshTokenLength: newRefreshToken.length,
      refreshTokenPreview: newRefreshToken.substring(0, 10) + "...",
    })

    // ==========================================================================
    // STEP 4: Update refresh_token in Supabase
    // ==========================================================================
    currentStep = "updating_refresh_token"
    addLog(currentStep, "Atualizando refresh token no Supabase...")

    // Atualiza usando a mesma chave que foi encontrada
    const { error: updateError } = await supabaseClient
      .from("app_config")
      .update({
        value: newRefreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq("key", tokenConfig.key)

    if (updateError) {
      throw new Error(`Failed to update refresh token: ${updateError.message}`)
    }

    addLog(currentStep, "Refresh token atualizado no Supabase")

    // ==========================================================================
    // STEP 5: Make reservation via Speed API (ou simular em Dry Run)
    // ==========================================================================
    currentStep = "making_reservation"
    // Usa a nova função que considera o trigger_mode do schedule
    const reservationDate = calculateReservationDate(schedule, isTestMode)
    const idArea = getIdOfArea(reservationHour!)

    addLog(
      currentStep,
      isDryRun
        ? "🔍 [DRY RUN] Simulando reserva..."
        : "Iniciando reserva na API do Speed...",
      {
        reservationDate,
        reservationHour,
        idArea,
        isDryRun,
        triggerMode: schedule?.trigger_mode || "test_mode",
        triggerDatetime: schedule?.trigger_datetime || null,
      }
    )

    let reservationResponse: ReservationApiResponse

    if (isDryRun) {
      // Em modo Dry Run, simular uma resposta de sucesso
      reservationResponse = {
        status: 200,
        msg: "[DRY RUN] Reserva simulada com sucesso - nenhuma reserva real foi feita",
        data: [
          {
            status: 200,
            ID_RESERVA_RES: "DRY_RUN_SIMULATED",
            id_reserva: "DRY_RUN_SIMULATED",
            simulated: true,
          },
        ],
      }
      addLog(
        currentStep,
        "🔍 [DRY RUN] Reserva simulada - API NÃO foi chamada",
        {
          wouldSendTo: "Speed API",
          wouldSendDate: reservationDate,
          wouldSendHour: reservationHour,
          wouldSendIdArea: idArea,
        }
      )
    } else {
      reservationResponse = await putReservation(
        accessToken,
        reservationDate,
        idArea
      )
    }

    // ==========================================================================
    // STEP 6: Process reservation response
    // ==========================================================================
    currentStep = "processing_response"
    const { status, msg, data: responseData } = reservationResponse
    const reservationResult = responseData?.[0]

    addLog(currentStep, "Resposta da reserva recebida", {
      status,
      msg,
      reservationResult,
    })

    // Check if reservation failed
    if (!reservationResult || Number(reservationResult.status) >= 400) {
      const details = {
        status,
        msg,
        reservationDate,
        reservationResponse: reservationResult,
      }
      const error = new Error("Erro ao reservar quadra")
      ;(error as any).details = details
      throw error
    }

    // ==========================================================================
    // SUCCESS: Log and save execution
    // ==========================================================================
    const duration = Date.now() - startTime

    const successMessage = isDryRun
      ? "🔍 [DRY RUN] Simulação concluída com sucesso - nenhuma reserva real foi feita"
      : "Reserva realizada com sucesso 🥎"

    addLog("success", successMessage, {
      status,
      msg,
      reservationDate,
      reservationResponse: reservationResult,
      duration,
      isDryRun,
    })

    // Calculate actual reservation date for database (ISO format)
    const targetDate = new Date()
    if (!isTestMode) {
      targetDate.setDate(targetDate.getDate() + 10)
    }
    const reservationDateISO = targetDate.toISOString().split("T")[0]

    // SEMPRE salvar o log de execução (teste ou não)
    currentStep = "saving_execution_log"

    // Buscar user_id do schedule ou do token config
    let userId: string | null = schedule?.user_id || null
    if (!userId) {
      // Tentar buscar o user_id do app_config
      const { data: configData } = await supabaseClient
        .from("app_config")
        .select("user_id")
        .eq("key", tokenConfig.key)
        .single()
      userId = configData?.user_id || null
    }

    const { data: executionLogData, error: logError } = await supabaseClient
      .from("execution_logs")
      .insert({
        schedule_id: scheduleId || null,
        user_id: userId,
        status: "success",
        message: isDryRun
          ? `[DRY RUN] Simulação concluída - ${msg}`
          : isTestMode
          ? `[TESTE] Reserva realizada com sucesso - ${msg}`
          : `Reserva realizada com sucesso - ${msg}`,
        request_payload: {
          reservationHour,
          reservationDate,
          idArea,
          isTestMode,
          isDryRun,
        },
        response_payload: reservationResponse,
        reservation_date: reservationDateISO,
        duration_ms: duration,
        is_test: isTestMode || isDryRun,
        test_hour: isTestMode || isDryRun ? reservationHour : null,
        flow_steps: executionLog,
      })
      .select()
      .single()

    if (logError) {
      addLog("warning", "Erro ao salvar log de execução", {
        error: logError.message,
      })
    }

    // Save reservation record (apenas se não for teste NEM dry run)
    if (!isTestMode && !isDryRun && scheduleId) {
      currentStep = "saving_reservation"
      const { error: reservationError } = await supabaseClient
        .from("reservations")
        .insert({
          schedule_id: scheduleId,
          execution_log_id: executionLogData?.id,
          time_slot_id: schedule?.time_slot_id,
          reservation_date: reservationDateISO,
          status: "confirmed",
          external_id:
            reservationResult.ID_RESERVA_RES || reservationResult.id_reserva,
        })

      if (reservationError) {
        addLog("warning", "Erro ao salvar registro de reserva", {
          error: reservationError.message,
        })
      }

      // ==========================================================================
      // DESATIVAR SCHEDULE SE FREQUENCY = 'once'
      // ==========================================================================
      if (schedule?.frequency === "once") {
        const { error: deactivateError } = await supabaseClient
          .from("schedules")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", scheduleId)

        if (deactivateError) {
          addLog("warning", "Erro ao desativar schedule 'once'", {
            error: deactivateError.message,
          })
        } else {
          addLog(
            "deactivate_schedule",
            "Schedule 'once' desativado após execução bem-sucedida",
            {
              scheduleId,
              scheduleName: schedule.name,
            }
          )
        }
      }
    }

    // ==========================================================================
    // ENVIAR E-MAIL DE SUCESSO
    // ==========================================================================
    currentStep = "sending_notification"

    // Buscar configurações de notificação
    const { data: notifyConfigs } = await supabaseClient
      .from("app_config")
      .select("key, value")
      .in("key", ["notification_email", "notify_on_success"])

    const notificationEmail = notifyConfigs?.find(
      (c) => c.key === "notification_email"
    )?.value
    const notifyOnSuccess =
      notifyConfigs?.find((c) => c.key === "notify_on_success")?.value !==
      "false"

    if (notificationEmail && notifyOnSuccess) {
      const subjectPrefix = isDryRun
        ? "🔍 [DRY RUN] "
        : isTestMode
        ? "(TESTE) "
        : ""
      const emailSent = await sendNotificationEmail(
        notificationEmail,
        `🎾 ${subjectPrefix}Reserva Confirmada - ${reservationHour}:00`,
        generateSuccessEmailHtml(
          reservationDate,
          reservationHour!,
          isTestMode,
          isDryRun
        )
      )
      addLog(
        "notification",
        emailSent
          ? `E-mail de sucesso enviado${isDryRun ? " (Dry Run)" : ""}`
          : "E-mail não enviado (sem API key)",
        {
          email: notificationEmail,
          sent: emailSent,
          isDryRun,
        }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: reservationResult,
        duration,
        isTestMode,
        isDryRun,
        executionLogId: executionLogData?.id,
        schedule: schedule
          ? {
              id: schedule.id,
              name: schedule.name,
              hour: reservationHour,
            }
          : { hour: reservationHour },
        log: executionLog,
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
    const errorDetails = (error as any).details || {}

    addLog("error", `Erro no step [${currentStep}]: ${errorMessage}`, {
      ...errorDetails,
      stack: error instanceof Error ? error.stack : undefined,
    })

    log.error(error instanceof Error ? error : String(error), {
      step: currentStep,
      scheduleId,
      reservationHour,
      ...errorDetails,
    })

    // SEMPRE salvar log de erro no banco
    let executionLogId: string | undefined
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      )

      // Tentar buscar user_id
      let userId: string | null = null
      if (scheduleId) {
        const { data: scheduleData } = await supabaseClient
          .from("schedules")
          .select("user_id")
          .eq("id", scheduleId)
          .single()
        userId = scheduleData?.user_id || null
      }

      // Se não tiver userId do schedule, buscar do app_config
      if (!userId) {
        const { data: configData } = await supabaseClient
          .from("app_config")
          .select("user_id")
          .in("key", ["auth_token", "superlogica_refresh_token"])
          .limit(1)
        userId = configData?.[0]?.user_id || null
      }

      const { data: logData } = await supabaseClient
        .from("execution_logs")
        .insert({
          schedule_id: scheduleId || null,
          user_id: userId,
          status: "error",
          message: isTestMode
            ? `[TESTE] [${currentStep}] ${errorMessage}`
            : `[${currentStep}] ${errorMessage}`,
          request_payload: {
            reservationHour,
            isTestMode,
          },
          response_payload: {
            error: errorMessage,
            details: errorDetails,
            stack: error instanceof Error ? error.stack : undefined,
            step: currentStep, // IMPORTANTE: step do erro aqui para o frontend usar
          },
          duration_ms: duration,
          is_test: isTestMode,
          test_hour: isTestMode ? reservationHour : null,
          flow_steps: executionLog,
        })
        .select("id")
        .single()

      executionLogId = logData?.id

      // Enviar e-mail de erro
      const { data: notifyConfigs } = await supabaseClient
        .from("app_config")
        .select("key, value")
        .in("key", ["notification_email", "notify_on_failure"])

      const notificationEmail = notifyConfigs?.find(
        (c) => c.key === "notification_email"
      )?.value
      const notifyOnFailure =
        notifyConfigs?.find((c) => c.key === "notify_on_failure")?.value !==
        "false"

      if (notificationEmail && notifyOnFailure) {
        const subjectPrefix = isDryRun
          ? "🔍 [DRY RUN] "
          : isTestMode
          ? "(TESTE) "
          : ""
        await sendNotificationEmail(
          notificationEmail,
          `❌ ${subjectPrefix}Erro na Reserva - ${reservationHour || "N/A"}:00`,
          generateErrorEmailHtml(
            errorMessage,
            currentStep,
            reservationHour || 0,
            isTestMode,
            {
              reservationDate: errorDetails.reservationDate,
              idArea: errorDetails.idArea,
              apiStatus: errorDetails.status,
              apiMessage: errorDetails.msg,
              apiResponse: errorDetails.reservationResponse || errorDetails,
              stack: error instanceof Error ? error.stack : undefined,
              duration,
              scheduleId,
              scheduleName: schedule?.name,
              isDryRun,
            }
          )
        )
      }
    } catch (logError) {
      log.error("Erro ao salvar log de erro", {
        error: logError instanceof Error ? logError.message : String(logError),
      })
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        step: currentStep,
        details: errorDetails,
        scheduleId,
        executionLogId,
        duration,
        isTestMode,
        isDryRun,
        log: executionLog,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
