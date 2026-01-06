-- ============================================
-- 016: Fix Pre-flight Cron Frequency
-- ============================================
-- Atualiza o cron job de preflight para rodar a cada 5 minutos
-- ao invés de a cada hora no minuto 30

-- 1. Remover o cron job existente (se existir)
DO $$
BEGIN
  PERFORM cron.unschedule('preflight-check');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job preflight-check não encontrado, continuando...';
END $$;

-- 2. Criar novo cron job que roda a cada 5 minutos
DO $$
DECLARE
  v_job_id BIGINT;
  v_supabase_url TEXT;
BEGIN
  -- Obter URL do Supabase das configurações
  v_supabase_url := current_setting('supabase.url', true);
  
  -- Se não conseguir a URL, tentar pegar de outra forma
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Usar URL padrão ou configurada manualmente
    SELECT value INTO v_supabase_url 
    FROM app_config 
    WHERE key = 'supabase_url';
  END IF;
  
  -- Criar o job apenas se conseguirmos a URL
  IF v_supabase_url IS NOT NULL AND v_supabase_url != '' THEN
    -- Job que roda a cada 5 minutos
    SELECT cron.schedule(
      'preflight-check',
      '*/5 * * * *', -- A cada 5 minutos
      format(
        'SELECT net.http_post(
          url:=''%s/functions/v1/run-preflight'',
          headers:=''{"Content-Type": "application/json", "Authorization": "Bearer '' || current_setting(''supabase.service_role_key'', true) || ''"}''::jsonb,
          body:=''{}''::jsonb
        )',
        v_supabase_url
      )
    ) INTO v_job_id;
    
    RAISE NOTICE 'Created preflight cron job with id % (runs every 5 minutes)', v_job_id;
  ELSE
    RAISE NOTICE 'Skipping cron job creation - Supabase URL not configured';
  END IF;
END $$;

-- 3. Comentário para documentação
COMMENT ON EXTENSION pg_cron IS 'Pre-flight check runs every 5 minutes to ensure timely validation';
