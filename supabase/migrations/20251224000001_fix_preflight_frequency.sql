-- ============================================
-- Fix: Corrigir Frequência do Preflight-Check
-- ============================================
-- Corrige o job preflight-check para rodar todo minuto
-- ao invés de apenas no minuto 30
-- ============================================

-- Corrigir job de preflight para rodar todo minuto
DO $$
DECLARE
  v_job_id BIGINT;
  v_supabase_url TEXT;
BEGIN
  -- Remover job atual de preflight
  BEGIN
    PERFORM cron.unschedule('preflight-check');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Obter URL do Supabase das configurações
  SELECT value INTO v_supabase_url 
  FROM system_config 
  WHERE key = 'supabase_url';
  
  -- Se não conseguiu pela system_config, tentar app_config
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url 
    FROM app_config 
    WHERE key = 'supabase_url';
  END IF;
  
  -- Criar o job apenas se conseguirmos a URL
  IF v_supabase_url IS NOT NULL AND v_supabase_url != '' THEN
    -- Job que roda todo minuto
    SELECT cron.schedule(
      'preflight-check',
      '* * * * *', -- Todo minuto
      format(
        'SELECT net.http_post(
          url:=''%s/functions/v1/run-preflight'',
          headers:=''{"Content-Type": "application/json", "Authorization": "Bearer '' || current_setting(''supabase.service_role_key'', true) || ''"}''::jsonb,
          body:=''{}''::jsonb
        )',
        v_supabase_url
      )
    ) INTO v_job_id;
    
    RAISE NOTICE 'Job preflight-check corrigido: agora roda todo minuto (job id: %)', v_job_id;
  ELSE
    RAISE WARNING 'Não foi possível corrigir preflight-check - Supabase URL não configurada';
  END IF;
END $$;
