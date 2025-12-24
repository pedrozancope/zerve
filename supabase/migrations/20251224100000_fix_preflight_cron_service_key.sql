-- ============================================
-- Fix: Corrigir Cron Job do Preflight para usar Service Key da system_config
-- ============================================
-- Problema: O cron job preflight-check estava usando current_setting('supabase.service_role_key')
-- que retorna NULL no contexto do pg_cron. Isso causava erro de JSON inválido.
-- 
-- Solução: Usar a service_role_key salva na tabela system_config
-- ============================================

-- 1. Remover o cron job atual que está quebrado
SELECT cron.unschedule('preflight-check');

-- 2. Criar função wrapper que busca a service_key da system_config
CREATE OR REPLACE FUNCTION call_preflight_edge_function()
RETURNS jsonb AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Obter configurações da tabela system_config
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  -- Verificar se as configurações existem
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada em system_config');
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada em system_config');
  END IF;

  -- Chamar Edge Function via pg_net
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/run-preflight',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'called_at', NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'called_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar novo cron job que usa a função wrapper
SELECT cron.schedule(
  'preflight-check',
  '* * * * *', -- Todo minuto (para debug, depois pode voltar para '*/5 * * * *')
  'SELECT call_preflight_edge_function()'
);

-- 4. Comentários
COMMENT ON FUNCTION call_preflight_edge_function() IS 
  'Wrapper para chamar a Edge Function run-preflight via pg_net. Busca credenciais da system_config.';

