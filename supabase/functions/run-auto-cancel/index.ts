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
interface RunAutoCancelPayload {
  configId?: string // ID da configuração (retrocompatibilidade)
  userId?: string // ID do usuário (novo padrão - cron job)
  dryRun?: boolean // Modo de teste: não cancela de verdade
  adHoc?: boolean // Execução manual (não agendada)
}

interface AuthResponse {
  access_token: string
  refresh_token: string
}

interface ReservationItem {
  id_reserva_res: string
  id_area_are: string
  dt_reserva_res: string
  st_nome_are: string
  [key: string]: any
}

interface ListReservationsResponse {
  multipleresponse: string
  status: string
  msg: string
  data: Array<{
    status: string
    msg: string
    data: ReservationItem[]
  }>
}

interface CancelReservationResponse {
  multipleresponse: string
  status: string
  msg: string
  data: Array<{
    status: string
    msg: string
  }>
}

interface FlowStep {
  step: string
  message: string
  details?: Record<string, unknown>
  request?: Record<string, any>
  response?: Record<string, any>
  timestamp: string
}

interface LogEntry {
  step: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
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

/**
 * Converte uma data para o formato MM/DD/YYYY (formato americano) em BRT
 */
function formatDateBRT(date: Date): string {
  // Converter para BRT (UTC-3)
  const brtDate = new Date(date.getTime() - 3 * 60 * 60 * 1000)

  const day = String(brtDate.getUTCDate()).padStart(2, "0")
  const month = String(brtDate.getUTCMonth() + 1).padStart(2, "0")
  const year = brtDate.getUTCFullYear()

  // Retornar no formato americano MM/DD/YYYY (esperado pela API)
  return `${month}/${day}/${year}`
}

/**
 * Obtém a data de hoje em BRT no formato MM/DD/YYYY (formato americano)
 */
function getTodayBRT(): string {
  const now = new Date()
  return formatDateBRT(now)
}

/**
 * Compara duas datas no formato DD/MM/YYYY
 */
function isSameDate(date1: string, date2: string): boolean {
  return date1 === date2
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
 * Lista as reservas da unidade em uma data específica
 * Baseado no HAR: obterreservasdaunidade
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
    dtFim: dateStr, // Incluir dtFim igual ao dtInicio para buscar apenas hoje
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
      idcondominio: "185",
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

/**
 * Cancela uma reserva específica
 * Baseado no HAR: cancelar
 */
async function cancelReservation(
  accessToken: string,
  reservationId: string,
  areaId: string,
  reason: string
): Promise<CancelReservationResponse> {
  const personId = Deno.env.get("SUPERLOGICA_PERSON_ID")
  const baseUrl = "speedassessoria.superlogica.net"

  const url = `https://${baseUrl}/areadocondomino/atual/reservas/cancelar`

  const body = {
    ID_RESERVA_RES: reservationId,
    ST_MOTIVOCANCELAMENTO_RES: reason,
    ID_AREA_ARE: areaId,
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
      idcondominio: "185",
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

  log.info("Cancel reservation response", {
    status: response.status,
    ok: response.ok,
    reservationId,
    responseData,
  })

  if (!response.ok) {
    const error: any = new Error(
      `Cancel reservation failed (${response.status}): ${JSON.stringify(
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
        from: "Zerve <noreply@resend.dev>",
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
 * Gera HTML do e-mail de sucesso (sem reservas)
 */
function generateSuccessNoReservationsEmailHtml(
  dateStr: string,
  isDryRun: boolean
): string {
  const dryRunBanner = isDryRun
    ? `
    <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">🔍 MODO DRY RUN</p>
      <p style="margin: 4px 0 0; color: #a16207; font-size: 13px;">Esta é uma simulação. Nenhuma reserva real foi cancelada.</p>
    </div>
  `
    : ""

  const dryRunBadge = isDryRun ? "[DRY RUN] " : ""

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, ${
        isDryRun ? "#f59e0b" : "#3b82f6"
      } 0%, ${
    isDryRun ? "#d97706" : "#2563eb"
  } 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔄 ${dryRunBadge}Auto-Cancel Executado</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          ${isDryRun ? "Simulação concluída" : "Execução concluída com sucesso"}
        </p>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        ${dryRunBanner}
        
        <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Data verificada:</strong> ${dateStr}</p>
          <p style="margin: 8px 0 0;"><strong>Status:</strong> Nenhuma reserva encontrada para cancelamento</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0;">
          O sistema verificou todas as reservas do dia e não encontrou nenhuma que precisasse ser cancelada.
        </p>
      </div>
    </div>
  `
}

/**
 * Gera HTML do e-mail de sucesso (com reservas canceladas)
 */
function generateSuccessWithReservationsEmailHtml(
  dateStr: string,
  cancelledReservations: Array<{
    id: string
    areaName: string
    success: boolean
  }>,
  isDryRun: boolean
): string {
  const dryRunBanner = isDryRun
    ? `
    <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">🔍 MODO DRY RUN</p>
      <p style="margin: 4px 0 0; color: #a16207; font-size: 13px;">Esta é uma simulação. Nenhuma reserva real foi cancelada.</p>
    </div>
  `
    : ""

  const dryRunBadge = isDryRun ? "[DRY RUN] " : ""

  const reservationsList = cancelledReservations
    .map(
      (res) => `
      <div style="background: ${
        res.success ? "#f0fdf4" : "#fef2f2"
      }; padding: 12px; border-radius: 6px; margin: 8px 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">${res.success ? "✅" : "❌"}</span>
          <div>
            <p style="margin: 0; font-weight: 600; color: ${
              res.success ? "#166534" : "#991b1b"
            };">${res.areaName}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: ${
              res.success ? "#15803d" : "#b91c1c"
            };">ID: ${res.id}</p>
          </div>
        </div>
      </div>
    `
    )
    .join("")

  const successCount = cancelledReservations.filter((r) => r.success).length
  const totalCount = cancelledReservations.length

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, ${
        isDryRun ? "#f59e0b" : "#22c55e"
      } 0%, ${
    isDryRun ? "#d97706" : "#16a34a"
  } 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎾 ${dryRunBadge}Reservas Canceladas</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          ${
            isDryRun
              ? "Simulação de cancelamento concluída"
              : `${successCount} de ${totalCount} reservas canceladas com sucesso`
          }
        </p>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        ${dryRunBanner}
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Data:</strong> ${dateStr}</p>
          <p style="margin: 8px 0 0;"><strong>Total processado:</strong> ${totalCount} ${
    totalCount === 1 ? "reserva" : "reservas"
  }</p>
        </div>
        
        <h3 style="margin: 16px 0 8px; color: #1f2937;">Reservas processadas:</h3>
        ${reservationsList}
      </div>
    </div>
  `
}

/**
 * Gera HTML do e-mail de erro
 */
function generateErrorEmailHtml(
  errorMessage: string,
  errorStep: string,
  dateStr: string,
  isDryRun: boolean,
  details?: Record<string, any>
): string {
  const dryRunBadge = isDryRun ? "[DRY RUN] " : ""

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">❌ ${dryRunBadge}Erro no Auto-Cancel</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          Falha ao executar o cancelamento automático
        </p>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Erro: ${errorMessage}</p>
          <p style="margin: 8px 0 0; color: #b91c1c; font-size: 13px;">Step: ${errorStep}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Data:</strong> ${dateStr}</p>
          ${
            details
              ? `<p style="margin: 8px 0 0;"><strong>Detalhes:</strong></p>
            <pre style="background: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${JSON.stringify(
              details,
              null,
              2
            )}</pre>`
              : ""
          }
        </div>
      </div>
    </div>
  `
}

// =============================================================================
// Main Handler
// =============================================================================
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const startTime = Date.now()
  let currentStep = "initialization"
  const executionLog: FlowStep[] = []
  let config: any = null
  let isDryRun = false
  let isAdHoc = false

  // Helper para adicionar logs estruturados
  const addLog = (
    step: string,
    message: string,
    details: Record<string, unknown> = {}
  ) => {
    executionLog.push({
      step,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // ==========================================================================
    // PARSE REQUEST & INITIALIZE
    // ==========================================================================
    currentStep = "parsing_request"

    const payload: RunAutoCancelPayload = await req.json().catch(() => ({}))
    const { configId, userId, dryRun = false, adHoc = false } = payload

    isDryRun = dryRun
    isAdHoc = adHoc

    addLog(
      "parsing_request",
      isDryRun
        ? "🔍 Iniciando execução em modo DRY RUN"
        : isAdHoc
        ? "▶️ Iniciando execução AD-HOC"
        : "🚀 Iniciando execução automática do auto-cancel",
      { configId, userId, isDryRun, isAdHoc }
    )

    log.info("Auto-cancel iniciado", { configId, userId, isDryRun, isAdHoc })

    // ==========================================================================
    // CONNECT TO SUPABASE
    // ==========================================================================
    currentStep = "connecting_database"

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

    addLog("connecting_database", "Conectado ao Supabase", {
      url: Deno.env.get("SUPABASE_URL"),
    })

    // ==========================================================================
    // LOAD CONFIG
    // ==========================================================================
    currentStep = "loading_config"

    if (configId) {
      // Retrocompatibilidade: buscar por ID
      const { data: configData, error: configError } = await supabaseClient
        .from("auto_cancel_config")
        .select("*")
        .eq("id", configId)
        .single()

      if (configError || !configData) {
        throw new Error(
          `Configuração não encontrada: ${
            configError?.message || "ID inválido"
          }`
        )
      }

      config = configData
    } else if (userId) {
      // Novo padrão: buscar por userId
      const { data: configData, error: configError } = await supabaseClient
        .from("auto_cancel_config")
        .select("*")
        .eq("user_id", userId)
        .single()

      if (configError || !configData) {
        throw new Error(
          `Configuração não encontrada para o usuário: ${
            configError?.message || "Usuário sem config"
          }`
        )
      }

      config = configData
    } else {
      // Fallback: buscar a primeira config ativa
      const { data: configData, error: configError } = await supabaseClient
        .from("auto_cancel_config")
        .select("*")
        .eq("enabled", true)
        .limit(1)
        .single()

      if (configError || !configData) {
        throw new Error("Nenhuma configuração ativa encontrada")
      }

      config = configData
    }

    addLog("loading_config", "Configuração carregada", {
      configId: config.id,
      enabled: config.enabled,
      runHour: config.run_hour,
      runMinute: config.run_minute,
      reason: config.cancellation_reason,
      unitId: config.unit_id,
      condoId: config.condo_id,
    })

    // Verificar se está habilitado (apenas para execuções automáticas)
    if (!config.enabled && !isAdHoc && !isDryRun) {
      throw new Error("Configuração está desabilitada")
    }

    // Validar unit_id e condo_id
    if (!config.unit_id || !config.condo_id) {
      throw new Error(
        "Configuração incompleta: unit_id e condo_id são obrigatórios"
      )
    }

    // ==========================================================================
    // GET AUTH TOKEN
    // ==========================================================================
    currentStep = "getting_auth_token"

    const { data: tokenConfig, error: tokenError } = await supabaseClient
      .from("app_config")
      .select("value")
      .eq("key", "auth_token")
      .single()

    if (tokenError || !tokenConfig?.value) {
      throw new Error("Refresh token não configurado no sistema")
    }

    addLog("getting_auth_token", "Refresh token recuperado do banco")

    // ==========================================================================
    // AUTHENTICATE
    // ==========================================================================
    currentStep = "authenticating"

    const clientId = Deno.env.get("SUPERLOGICA_CLIENT_ID")
    const sessionId = Deno.env.get("SUPERLOGICA_SESSION_ID")
    const personId = Deno.env.get("SUPERLOGICA_PERSON_ID")

    addLog("authenticating", "Iniciando autenticação com SuperLogica...")

    // Save request information
    executionLog[executionLog.length - 1].request = {
      method: "POST",
      url: "https://api.superlogica.com/spaces/v1/auth/token",
      body: {
        grant_type: "refresh_token",
        client_id: clientId ? "HIDDEN" : undefined,
        refresh_token: "HIDDEN",
        session_id: sessionId ? "HIDDEN" : undefined,
      },
    }

    const authResult = await authSuperLogica(tokenConfig.value)

    // Save response information
    executionLog[executionLog.length - 1].response = {
      access_token: authResult.access_token.substring(0, 10) + "...",
      refresh_token: authResult.refresh_token.substring(0, 10) + "...",
      access_token_length: authResult.access_token.length,
      refresh_token_length: authResult.refresh_token.length,
    }

    addLog("authenticating", "Autenticação realizada com sucesso", {
      hasAccessToken: !!authResult.access_token,
      hasRefreshToken: !!authResult.refresh_token,
    })

    // Atualizar o refresh token no banco se mudou
    if (authResult.refresh_token !== tokenConfig.value) {
      await supabaseClient
        .from("app_config")
        .update({ value: authResult.refresh_token })
        .eq("key", "auth_token")

      addLog("updating_token", "Refresh token atualizado no banco")
    }

    // ==========================================================================
    // GET TODAY'S DATE IN BRT
    // ==========================================================================
    currentStep = "calculating_date"

    const todayBRT = getTodayBRT()

    addLog("calculating_date", "Data de hoje calculada (BRT)", {
      date: todayBRT,
      timezone: "America/Sao_Paulo (BRT)",
      format: "MM/DD/YYYY",
    })

    // ==========================================================================
    // LIST RESERVATIONS
    // ==========================================================================
    currentStep = "listing_reservations"

    const baseUrl = "speedassessoria.superlogica.net"
    const listUrl = `https://${baseUrl}/areadocondomino/atual/reservas/obterreservasdaunidade`

    addLog("listing_reservations", "Listando reservas da API...")

    // Save request information
    executionLog[executionLog.length - 1].request = {
      method: "POST",
      url: listUrl,
      body: {
        idUnidades: [config.unit_id],
        dtInicio: todayBRT,
        dtFim: todayBRT,
        idCondominio: config.condo_id,
        filtrarFila: 1,
      },
    }

    const listResult = await listReservations(
      authResult.access_token,
      todayBRT,
      config.unit_id,
      config.condo_id
    )

    // Save response information
    executionLog[executionLog.length - 1].response = {
      status: listResult.status,
      msg: listResult.msg,
      multipleresponse: listResult.multipleresponse,
      data: listResult.data,
    }

    addLog("listing_reservations", "Reservas listadas da API", {
      status: listResult.status,
      message: listResult.msg,
      multipleResponse: listResult.multipleresponse,
      requestParams: {
        unitId: config.unit_id,
        condoId: config.condo_id,
        date: todayBRT,
      },
      dataStructure: {
        hasData: !!listResult.data,
        isArray: Array.isArray(listResult.data),
        dataLength: listResult.data?.length || 0,
        fullData: listResult.data, // Retorno completo da API para debug
      },
    })

    // Extrair reservas do resultado
    const reservations: ReservationItem[] = []

    if (
      listResult.data &&
      Array.isArray(listResult.data) &&
      listResult.data.length > 0
    ) {
      const firstDataBlock = listResult.data[0]

      addLog("listing_reservations", "Analisando primeiro bloco de dados", {
        blockStatus: firstDataBlock.status,
        blockMessage: firstDataBlock.msg,
        hasData: !!firstDataBlock.data,
        isDataArray: Array.isArray(firstDataBlock.data),
        dataCount: Array.isArray(firstDataBlock.data)
          ? firstDataBlock.data.length
          : 0,
        fullBlock: firstDataBlock, // Bloco completo para debug
      })

      if (
        firstDataBlock.status === "200" &&
        Array.isArray(firstDataBlock.data)
      ) {
        reservations.push(...firstDataBlock.data)
      }
    }

    addLog(
      "filtering_reservations",
      `${reservations.length} reservas encontradas para o dia`,
      {
        totalReservations: reservations.length,
        dateFilter: todayBRT,
        reservations: reservations.map((r) => ({
          id: r.id_reserva_res,
          area: r.st_nome_are,
          date: r.dt_reserva_res,
        })),
      }
    )

    // ==========================================================================
    // FILTER RESERVATIONS FOR TODAY
    // ==========================================================================
    currentStep = "filtering_today_reservations"

    // Filtrar apenas reservas de hoje
    const todayReservations = reservations.filter((r) => {
      // A data pode vir em diferentes formatos:
      // - "MM/DD/YYYY HH:MM:SS" (formato americano)
      // - "DD/MM/YYYY HH:MM:SS" (formato brasileiro)
      // Pegar apenas a parte da data (antes do espaço)
      const reservationDateFull = r.dt_reserva_res.split(" ")[0]

      // Como agora estamos enviando MM/DD/YYYY para a API,
      // ela deve retornar no mesmo formato
      return isSameDate(reservationDateFull, todayBRT)
    })

    addLog(
      "filtering_today_reservations",
      `${todayReservations.length} reservas confirmadas para hoje`,
      {
        today: todayBRT,
        todayFormat: "MM/DD/YYYY",
        todayReservations: todayReservations.map((r) => ({
          id: r.id_reserva_res,
          area: r.st_nome_are,
          areaId: r.id_area_are,
          date: r.dt_reserva_res,
        })),
      }
    )

    // ==========================================================================
    // CANCEL RESERVATIONS (or simulate)
    // ==========================================================================
    currentStep = "cancelling_reservations"

    const cancelResults: Array<{
      id: string
      areaName: string
      areaId: string
      success: boolean
      message?: string
      error?: string
    }> = []

    if (todayReservations.length === 0) {
      addLog("cancelling_reservations", "Nenhuma reserva para cancelar hoje", {
        reason: "Não há reservas confirmadas para a data de hoje",
      })
    } else {
      for (const reservation of todayReservations) {
        const reservationId = reservation.id_reserva_res
        const areaId = reservation.id_area_are
        const areaName = reservation.st_nome_are

        if (isDryRun) {
          // Modo dry run: simular cancelamento
          addLog(
            "cancelling_reservations",
            `🔍 [DRY RUN] Simulando cancelamento da reserva ${reservationId}`,
            {
              reservationId,
              areaId,
              areaName,
              simulated: true,
            }
          )

          cancelResults.push({
            id: reservationId,
            areaName,
            areaId,
            success: true,
            message: "[DRY RUN] Cancelamento simulado com sucesso",
          })
        } else {
          // Cancelamento real
          try {
            const cancelUrl = `https://speedassessoria.superlogica.net/areadocondomino/atual/reservas/cancelar`

            addLog(
              "cancelling_reservations",
              `Cancelando reserva ${reservationId}...`,
              {
                reservationId,
                areaId,
                areaName,
              }
            )

            // Save request information
            executionLog[executionLog.length - 1].request = {
              method: "POST",
              url: cancelUrl,
              body: {
                ID_RESERVA_RES: reservationId,
                ST_MOTIVOCANCELAMENTO_RES: config.cancellation_reason,
                ID_AREA_ARE: areaId,
              },
            }

            const cancelResult = await cancelReservation(
              authResult.access_token,
              reservationId,
              areaId,
              config.cancellation_reason
            )

            // Save response information
            executionLog[executionLog.length - 1].response = {
              status: cancelResult.status,
              msg: cancelResult.msg,
              multipleresponse: cancelResult.multipleresponse,
              data: cancelResult.data,
            }

            const itemResult = cancelResult.data?.[0]
            const itemStatus = itemResult?.status

            // Verificar sucesso: status 200 OU (206 parcial com item status 200)
            // Falha: status >= 400 OU (206 com item status >= 400)
            const success =
              (cancelResult.status === "200" && itemStatus === "200") ||
              (cancelResult.status === "206" && itemStatus === "200")

            const hasError =
              Number(itemStatus) >= 400 ||
              (cancelResult.status === "206" && Number(itemStatus) >= 400)

            if (hasError) {
              // Tratar como erro mesmo que HTTP seja 206
              const errorMsg =
                itemResult?.msg ||
                cancelResult.msg ||
                "Erro ao cancelar reserva"
              throw new Error(errorMsg)
            }

            addLog(
              "cancelling_reservations",
              success
                ? `✅ Reserva ${reservationId} cancelada com sucesso`
                : `⚠️ Falha ao cancelar reserva ${reservationId}`,
              {
                reservationId,
                areaId,
                areaName,
                apiStatus: cancelResult.status,
                apiMessage: cancelResult.msg,
                dataStatus: itemStatus,
                dataMessage: itemResult?.msg,
              }
            )

            cancelResults.push({
              id: reservationId,
              areaName,
              areaId,
              success,
              message: itemResult?.msg || cancelResult.msg,
            })
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error)

            addLog(
              "cancelling_reservations",
              `❌ Erro ao cancelar reserva ${reservationId}`,
              {
                reservationId,
                areaId,
                areaName,
                error: errorMsg,
              }
            )

            cancelResults.push({
              id: reservationId,
              areaName,
              areaId,
              success: false,
              error: errorMsg,
            })
          }
        }
      }
    }

    const successfulCancellations = cancelResults.filter(
      (r) => r.success
    ).length
    const failedCancellations = cancelResults.filter((r) => !r.success).length

    addLog(
      "cancellation_summary",
      `Cancelamento concluído: ${successfulCancellations} sucesso, ${failedCancellations} falhas`,
      {
        total: cancelResults.length,
        successful: successfulCancellations,
        failed: failedCancellations,
        isDryRun,
        results: cancelResults,
      }
    )

    const duration = Date.now() - startTime

    // ==========================================================================
    // UPDATE CONFIG (last_run_at)
    // ==========================================================================
    if (!isDryRun) {
      currentStep = "updating_config"

      await supabaseClient
        .from("auto_cancel_config")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", config.id)

      addLog("updating_config", "Config atualizada com timestamp da execução")
    }

    // ==========================================================================
    // GET NOTIFICATION EMAIL FROM APP_CONFIG
    // ==========================================================================
    currentStep = "getting_notification_email"

    const { data: emailConfig } = await supabaseClient
      .from("app_config")
      .select("value")
      .eq("key", "notification_email")
      .maybeSingle()

    const notificationEmail = emailConfig?.value

    addLog("getting_notification_email", "E-mail de notificação obtido", {
      hasEmail: !!notificationEmail,
      email: notificationEmail
        ? notificationEmail.substring(0, 3) + "***"
        : null,
    })

    // ==========================================================================
    // SEND NOTIFICATION EMAIL
    // ==========================================================================
    currentStep = "sending_notification"

    const shouldNotify =
      todayReservations.length === 0
        ? config.notify_on_success_no_reservations
        : config.notify_on_success_with_reservations

    if (notificationEmail && shouldNotify) {
      const subjectPrefix = isDryRun ? "🔍 [DRY RUN] " : ""
      const emailHtml =
        todayReservations.length === 0
          ? generateSuccessNoReservationsEmailHtml(todayBRT, isDryRun)
          : generateSuccessWithReservationsEmailHtml(
              todayBRT,
              cancelResults,
              isDryRun
            )

      const subject =
        todayReservations.length === 0
          ? `🔄 ${subjectPrefix}Auto-Cancel: Nenhuma reserva encontrada`
          : `🎾 ${subjectPrefix}Auto-Cancel: ${successfulCancellations} ${
              successfulCancellations === 1
                ? "reserva cancelada"
                : "reservas canceladas"
            }`

      const emailSent = await sendNotificationEmail(
        notificationEmail,
        subject,
        emailHtml
      )

      addLog(
        "sending_notification",
        emailSent
          ? "E-mail de sucesso enviado"
          : "E-mail não enviado (erro na API)",
        {
          email: notificationEmail,
          sent: emailSent,
          type: "success",
          reservationCount: todayReservations.length,
        }
      )
    } else {
      addLog(
        "sending_notification",
        !notificationEmail
          ? "E-mail não configurado"
          : "Notificação desabilitada para este tipo de resultado",
        {
          configured: !!notificationEmail,
          enabled: shouldNotify,
          type: "success",
          reservationCount: todayReservations.length,
        }
      )
    }

    // ==========================================================================
    // SAVE EXECUTION LOG
    // ==========================================================================
    currentStep = "saving_execution_log"

    const { data: executionLogData, error: logError } = await supabaseClient
      .from("execution_logs")
      .insert({
        user_id: config.user_id || null,
        status: "success",
        message: isDryRun
          ? `[DRY RUN] Auto-cancel simulado: ${todayReservations.length} ${
              todayReservations.length === 1 ? "reserva" : "reservas"
            } processadas`
          : `Auto-cancel executado: ${successfulCancellations} ${
              successfulCancellations === 1
                ? "reserva cancelada"
                : "reservas canceladas"
            }`,
        request_payload: {
          configId: config.id,
          date: todayBRT,
          isDryRun,
          isAdHoc,
          totalReservations: todayReservations.length,
        },
        response_payload: {
          successfulCancellations,
          failedCancellations,
          cancelResults,
        },
        duration_ms: duration,
        execution_type: "auto_cancel",
        flow_steps: executionLog,
      })
      .select()
      .single()

    if (logError) {
      addLog("warning", "Erro ao salvar log de execução", {
        error: logError.message,
      })
    } else {
      addLog("saving_execution_log", "Log de execução salvo", {
        logId: executionLogData?.id,
      })
    }

    // ==========================================================================
    // RETURN SUCCESS
    // ==========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        config: {
          id: config.id,
          enabled: config.enabled,
          runHour: config.run_hour,
          runMinute: config.run_minute,
        },
        execution: {
          date: todayBRT,
          totalReservations: todayReservations.length,
          successfulCancellations,
          failedCancellations,
          results: cancelResults,
        },
        duration,
        isDryRun,
        isAdHoc,
        executionLogId: executionLogData?.id,
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

    addLog("error", `Erro no step [${currentStep}]: ${errorMessage}`, {
      stack: error instanceof Error ? error.stack : undefined,
    })

    log.error(error instanceof Error ? error : String(error), {
      step: currentStep,
      configId: config?.id,
    })

    // SAVE ERROR LOG
    let executionLogId: string | undefined
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

      // SEND ERROR EMAIL
      if (config?.notification_email && config?.notify_on_failure) {
        const subjectPrefix = isDryRun ? "🔍 [DRY RUN] " : ""
        const emailSent = await sendNotificationEmail(
          config.notification_email,
          `❌ ${subjectPrefix}Erro no Auto-Cancel`,
          generateErrorEmailHtml(
            errorMessage,
            currentStep,
            getTodayBRT(),
            isDryRun,
            {
              configId: config?.id,
              duration,
              stack: error instanceof Error ? error.stack : undefined,
            }
          )
        )

        addLog(
          "sending_notification",
          emailSent
            ? "E-mail de erro enviado"
            : "Falha ao enviar e-mail de erro",
          {
            email: config.notification_email,
            sent: emailSent,
            type: "error",
          }
        )
      }

      const { data: logData } = await supabaseClient
        .from("execution_logs")
        .insert({
          user_id: config?.user_id || null,
          status: "error",
          message: isDryRun
            ? `[DRY RUN] [${currentStep}] ${errorMessage}`
            : `[${currentStep}] ${errorMessage}`,
          request_payload: {
            configId: config?.id,
            isDryRun,
            isAdHoc,
          },
          response_payload: {
            error: errorMessage,
            step: currentStep,
            stack: error instanceof Error ? error.stack : undefined,
          },
          duration_ms: duration,
          execution_type: "auto_cancel",
          flow_steps: executionLog,
        })
        .select("id")
        .single()

      executionLogId = logData?.id
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
        configId: config?.id,
        executionLogId,
        duration,
        isDryRun,
        isAdHoc,
        log: executionLog,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
