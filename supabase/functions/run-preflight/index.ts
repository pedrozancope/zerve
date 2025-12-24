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

interface PreflightResult {
  scheduleId: string
  scheduleName: string
  success: boolean
  error?: string
  duration: number
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
 * Gera HTML do e-mail de sucesso do preflight
 */
function generatePreflightSuccessEmailHtml(
  scheduleName: string,
  hoursBeforeTrigger: number,
  triggerDatetime?: string
): string {
  const triggerInfo = triggerDatetime
    ? new Date(triggerDatetime).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "próximo disparo agendado"

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✈️ Pre-flight Concluído!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          Validação prévia do token realizada com sucesso
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0;"><strong>Agendamento:</strong> ${scheduleName}</p>
          <p style="margin: 8px 0 0;"><strong>Disparo em:</strong> ${triggerInfo}</p>
          <p style="margin: 8px 0 0;"><strong>Tempo até disparo:</strong> ~${hoursBeforeTrigger}h</p>
        </div>
        
        <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin-top: 16px;">
          <p style="margin: 0; color: #166534; font-size: 13px;">
            ✅ <strong>Token validado e atualizado</strong> - O sistema está pronto para executar a reserva no horário programado.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
            🎾 Tennis Scheduler - Pre-flight Check
          </p>
        </div>
      </div>
    </div>
  `
}

/**
 * Gera HTML do e-mail de erro do preflight
 */
function generatePreflightErrorEmailHtml(
  scheduleName: string,
  errorMessage: string,
  step: string,
  hoursBeforeTrigger: number,
  triggerDatetime?: string
): string {
  const triggerInfo = triggerDatetime
    ? new Date(triggerDatetime).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "próximo disparo agendado"

  const stepNames: Record<string, string> = {
    initialization: "Inicialização",
    getting_refresh_token: "Obtenção do Refresh Token",
    authenticating_superlogica: "Autenticação SuperLógica",
    updating_refresh_token: "Atualização do Refresh Token",
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Falha no Pre-flight</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          A validação prévia do token falhou
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0;"><strong>Agendamento:</strong> ${scheduleName}</p>
          <p style="margin: 8px 0 0;"><strong>Disparo previsto em:</strong> ${triggerInfo}</p>
          <p style="margin: 8px 0 0;"><strong>Tempo até disparo:</strong> ~${hoursBeforeTrigger}h</p>
          <p style="margin: 8px 0 0;"><strong>Etapa com erro:</strong> ${
            stepNames[step] || step
          }</p>
        </div>
        
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px;">💬 Mensagem de Erro</h3>
          <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 13px; word-break: break-word;">
            ${errorMessage}
          </p>
        </div>
        
        <div style="background: #fefce8; padding: 12px 16px; border-radius: 8px; margin-top: 16px;">
          <p style="margin: 0; color: #854d0e; font-size: 13px;">
            ⚠️ <strong>Ação recomendada:</strong> Verifique as configurações do token antes do horário de disparo para evitar falha na reserva.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
            🎾 Tennis Scheduler - Pre-flight Check
          </p>
        </div>
      </div>
    </div>
  `
}

// =============================================================================
// Preflight Execution for a Single Schedule
// =============================================================================
async function executePreflightForSchedule(
  supabaseClient: any,
  schedule: any
): Promise<PreflightResult> {
  const startTime = Date.now()
  let currentStep = "initialization"

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
    log.info(`[Preflight ${schedule.name}] ${message}`, { step, ...details })
  }

  try {
    addLog("initialization", "Iniciando Pre-flight", {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      preflightHoursBefore: schedule.preflight_hours_before,
    })

    // ==========================================================================
    // STEP 1: Get refresh_token from Supabase
    // ==========================================================================
    currentStep = "getting_refresh_token"
    addLog(currentStep, "Obtendo refresh token do Supabase...")

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
    })

    // ==========================================================================
    // STEP 2: Authenticate with SuperLogica API
    // ==========================================================================
    currentStep = "authenticating_superlogica"
    addLog(currentStep, "Autenticando com a API da SuperLogica...")

    const { access_token: accessToken, refresh_token: newRefreshToken } =
      await authSuperLogica(currentRefreshToken)

    addLog(currentStep, "Autenticação bem-sucedida! Token validado.", {
      accessTokenLength: accessToken.length,
      refreshTokenLength: newRefreshToken.length,
    })

    // ==========================================================================
    // STEP 3: Update refresh_token in Supabase
    // ==========================================================================
    currentStep = "updating_refresh_token"
    addLog(currentStep, "Atualizando refresh token no Supabase...")

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

    addLog(currentStep, "Refresh token atualizado com sucesso!")

    // ==========================================================================
    // ENVIAR E-MAIL DE SUCESSO (se configurado)
    // ==========================================================================
    currentStep = "sending_notification"

    // Buscar configurações de notificação
    const { data: notifyConfigs } = await supabaseClient
      .from("app_config")
      .select("value")
      .eq("key", "notification_email")
      .single()

    const notificationEmail = notifyConfigs?.value
    const notifyEnabled = schedule.preflight_notify_on_success

    if (notificationEmail && notifyEnabled) {
      const emailSent = await sendNotificationEmail(
        notificationEmail,
        `✈️ Pre-flight OK - ${schedule.name}`,
        generatePreflightSuccessEmailHtml(
          schedule.name,
          schedule.preflight_hours_before,
          schedule.trigger_datetime
        )
      )
      addLog(
        "sending_notification",
        emailSent
          ? "E-mail de sucesso enviado"
          : "E-mail não enviado (falha no envio)",
        {
          email: notificationEmail,
          sent: emailSent,
          configured: true,
          enabled: true,
          type: "preflight_success",
        }
      )
    } else {
      addLog(
        "sending_notification",
        !notificationEmail
          ? "E-mail não configurado - notificação pulada"
          : "Notificações de sucesso desabilitadas",
        {
          configured: !!notificationEmail,
          enabled: notifyEnabled,
          type: "preflight_success",
        }
      )
    }

    // ==========================================================================
    // SUCCESS
    // ==========================================================================
    const duration = Date.now() - startTime
    addLog("success", "Pre-flight concluído com sucesso! ✈️", { duration })

    // Atualizar last_preflight_at do schedule
    await supabaseClient
      .from("schedules")
      .update({ last_preflight_at: new Date().toISOString() })
      .eq("id", schedule.id)

    // Salvar log de execução
    await supabaseClient.from("execution_logs").insert({
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      status: "success",
      message: `[PRE-FLIGHT] Validação de token concluída com sucesso`,
      execution_type: "preflight",
      request_payload: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        preflightHoursBefore: schedule.preflight_hours_before,
      },
      response_payload: {
        success: true,
        log: executionLog,
      },
      duration_ms: duration,
    })

    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      success: true,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStep = currentStep // Capturar o step onde ocorreu o erro

    addLog("error", `Erro no Pre-flight: ${errorMessage}`, {
      step: currentStep,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // ==========================================================================
    // ENVIAR E-MAIL DE ERRO (se configurado)
    // ==========================================================================
    // Buscar configurações de notificação
    const { data: notifyConfigs } = await supabaseClient
      .from("app_config")
      .select("value")
      .eq("key", "notification_email")
      .single()

    const notificationEmail = notifyConfigs?.value
    const notifyEnabled = schedule.preflight_notify_on_failure

    if (notificationEmail && notifyEnabled) {
      const emailSent = await sendNotificationEmail(
        notificationEmail,
        `⚠️ Pre-flight FALHOU - ${schedule.name}`,
        generatePreflightErrorEmailHtml(
          schedule.name,
          errorMessage,
          errorStep,
          schedule.preflight_hours_before,
          schedule.trigger_datetime
        )
      )
      addLog(
        "sending_notification",
        emailSent
          ? "E-mail de erro enviado"
          : "E-mail não enviado (falha no envio)",
        {
          email: notificationEmail,
          sent: emailSent,
          configured: true,
          enabled: true,
          type: "preflight_error",
        }
      )
    } else {
      addLog(
        "sending_notification",
        !notificationEmail
          ? "E-mail não configurado - notificação pulada"
          : "Notificações de erro desabilitadas",
        {
          configured: !!notificationEmail,
          enabled: notifyEnabled,
          type: "preflight_error",
        }
      )
    }

    // Salvar log de erro
    await supabaseClient.from("execution_logs").insert({
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      status: "error",
      message: `[PRE-FLIGHT] Falha na validação: ${errorMessage}`,
      execution_type: "preflight",
      request_payload: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        preflightHoursBefore: schedule.preflight_hours_before,
      },
      response_payload: {
        success: false,
        error: errorMessage,
        step: errorStep,
        log: executionLog,
      },
      duration_ms: duration,
    })

    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

// =============================================================================
// Main Handler
// =============================================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    log.info("🔍 Starting Pre-flight check...")

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Parse payload (opcional - para execução manual de um schedule específico)
    let specificScheduleId: string | undefined
    let forceExecution = false
    try {
      const payload = await req.json()
      specificScheduleId = payload.scheduleId
      forceExecution = payload.force === true // Permite forçar execução ignorando janela de tempo
    } catch {
      // No payload - verificar todos os schedules
    }

    // ==========================================================================
    // Buscar schedules que precisam de preflight
    // ==========================================================================
    const now = new Date()

    let query = supabaseClient
      .from("schedules")
      .select("*")
      .eq("is_active", true)
      .eq("preflight_enabled", true)

    // Se foi especificado um schedule, executar apenas para ele
    if (specificScheduleId) {
      query = query.eq("id", specificScheduleId)
    }

    const { data: schedules, error: scheduleError } = await query

    if (scheduleError) {
      throw new Error(`Error fetching schedules: ${scheduleError.message}`)
    }

    if (!schedules || schedules.length === 0) {
      log.info("✅ No schedules with preflight enabled")
      return new Response(
        JSON.stringify({
          success: true,
          message: "No schedules require preflight",
          checked_at: now.toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    // ==========================================================================
    // Filtrar schedules que precisam de preflight AGORA
    // (ou todos se forceExecution = true)
    // ==========================================================================
    const schedulesToPreflight: any[] = []

    for (const schedule of schedules) {
      // Se force = true, executa sem verificar janela de tempo
      if (forceExecution) {
        log.info(`🔧 Force execution enabled for schedule: ${schedule.name}`)
        schedulesToPreflight.push(schedule)
        continue
      }

      const hoursBeforeTrigger = schedule.preflight_hours_before || 4

      // Para trigger_mode = 'trigger_date', calcular baseado em trigger_datetime
      if (
        schedule.trigger_mode === "trigger_date" &&
        schedule.trigger_datetime
      ) {
        const triggerDate = new Date(schedule.trigger_datetime)
        const preflightDeadline = new Date(
          triggerDate.getTime() - hoursBeforeTrigger * 60 * 60 * 1000
        )

        // Verificar se estamos dentro da janela de preflight (1 hora de margem)
        const windowStart = new Date(
          preflightDeadline.getTime() - 30 * 60 * 1000
        ) // 30min antes
        const windowEnd = new Date(preflightDeadline.getTime() + 30 * 60 * 1000) // 30min depois

        if (now >= windowStart && now <= windowEnd) {
          // Verificar se já executou preflight recentemente
          if (
            !schedule.last_preflight_at ||
            new Date(schedule.last_preflight_at) < windowStart
          ) {
            schedulesToPreflight.push(schedule)
          }
        }
      } else {
        // Para trigger recorrente (weekly, etc), usar cron para calcular próximo disparo
        // Por simplicidade, verificamos se não executou nas últimas (hoursBeforeTrigger) horas
        const lastPreflight = schedule.last_preflight_at
          ? new Date(schedule.last_preflight_at)
          : new Date(0)

        const minTimeSinceLastPreflight = hoursBeforeTrigger * 60 * 60 * 1000

        if (
          now.getTime() - lastPreflight.getTime() >
          minTimeSinceLastPreflight
        ) {
          // Calcular próximo disparo baseado no cron
          // Simplificado: verificar se o dia/hora do trigger está nas próximas X horas
          const triggerDayOfWeek = schedule.trigger_day_of_week
          const triggerTimeParts = (schedule.trigger_time || "00:01:00").split(
            ":"
          )
          const triggerHour = parseInt(triggerTimeParts[0]) || 0
          const triggerMinute = parseInt(triggerTimeParts[1]) || 1

          // Calcular próximo disparo
          const nextTrigger = new Date(now)
          nextTrigger.setHours(triggerHour, triggerMinute, 0, 0)

          // Ajustar para o próximo dia de trigger
          const currentDayOfWeek = now.getDay()
          let daysUntilTrigger = triggerDayOfWeek - currentDayOfWeek
          if (daysUntilTrigger < 0) daysUntilTrigger += 7
          if (daysUntilTrigger === 0 && nextTrigger <= now) daysUntilTrigger = 7

          nextTrigger.setDate(nextTrigger.getDate() + daysUntilTrigger)

          // Verificar se preflight é necessário
          const preflightTime = new Date(
            nextTrigger.getTime() - hoursBeforeTrigger * 60 * 60 * 1000
          )

          // Janela de 1 hora para o preflight
          const windowStart = new Date(preflightTime.getTime() - 30 * 60 * 1000)
          const windowEnd = new Date(preflightTime.getTime() + 30 * 60 * 1000)

          if (now >= windowStart && now <= windowEnd) {
            schedulesToPreflight.push(schedule)
          }
        }
      }
    }

    if (schedulesToPreflight.length === 0) {
      log.info("✅ No schedules need preflight at this time")
      return new Response(
        JSON.stringify({
          success: true,
          message: "No schedules need preflight at this time",
          checked_at: now.toISOString(),
          schedulesChecked: schedules.length,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    log.info(
      `✈️ Found ${schedulesToPreflight.length} schedule(s) needing preflight`
    )

    // ==========================================================================
    // Executar preflight para cada schedule
    // ==========================================================================
    const results: PreflightResult[] = []

    for (const schedule of schedulesToPreflight) {
      const result = await executePreflightForSchedule(supabaseClient, schedule)
      results.push(result)
    }

    const totalDuration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length

    log.info(`✅ Pre-flight check completed`, {
      total: results.length,
      success: successCount,
      errors: errorCount,
      duration: totalDuration,
    })

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Pre-flight completed: ${successCount} success, ${errorCount} errors`,
        results,
        duration: totalDuration,
        checked_at: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(error instanceof Error ? error : String(error))

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
