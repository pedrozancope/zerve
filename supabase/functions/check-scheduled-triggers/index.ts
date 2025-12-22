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
// Check Scheduled Triggers
// Esta função é chamada periodicamente (a cada minuto) via pg_cron
// Busca agendamentos com trigger_mode='trigger_date' que estão prontos para executar
// =============================================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 Checking for scheduled triggers...")

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar agendamentos ativos com trigger_mode='trigger_date'
    // que devem ser executados agora (trigger_datetime <= now + 1 minute)
    const { data: schedules, error: scheduleError } = await supabase
      .from("schedules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_mode", "trigger_date")
      .not("trigger_datetime", "is", null)
      .lte("trigger_datetime", new Date(Date.now() + 60000).toISOString()) // próximos 60 segundos
      .gte("trigger_datetime", new Date(Date.now() - 120000).toISOString()) // últimos 2 minutos (margem de segurança)

    if (scheduleError) {
      console.error("❌ Error fetching schedules:", scheduleError)
      throw scheduleError
    }

    if (!schedules || schedules.length === 0) {
      console.log("✅ No schedules to execute at this time")
      return new Response(
        JSON.stringify({
          success: true,
          message: "No schedules to execute",
          checked_at: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    console.log(`📅 Found ${schedules.length} schedule(s) ready to execute`)

    // Executar cada agendamento
    const results = []
    for (const schedule of schedules) {
      try {
        console.log(`🚀 Executing schedule: ${schedule.name} (${schedule.id})`)

        // Chamar a Edge Function execute-reservation
        const executeResponse = await fetch(
          `${supabaseUrl}/functions/v1/execute-reservation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              scheduleId: schedule.id,
            }),
          }
        )

        const executeResult = await executeResponse.json()

        // Se frequência é 'once', desativar o agendamento
        if (schedule.frequency === "once") {
          console.log(
            `🔄 Frequency is 'once', deactivating schedule ${schedule.id}`
          )
          await supabase
            .from("schedules")
            .update({ is_active: false })
            .eq("id", schedule.id)
        }

        results.push({
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          success: executeResponse.ok,
          result: executeResult,
        })

        console.log(`✅ Schedule ${schedule.name} executed successfully`)
      } catch (error) {
        console.error(`❌ Error executing schedule ${schedule.id}:`, error)
        results.push({
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          success: false,
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Executed ${results.length} schedule(s)`,
        results,
        checked_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("❌ Error in check-scheduled-triggers:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
