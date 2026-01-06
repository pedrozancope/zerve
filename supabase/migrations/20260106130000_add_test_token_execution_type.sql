-- Adicionar tipo 'test_token' aos tipos de execução suportados
-- Atualizar constraint para incluir 'test_token'
ALTER TABLE execution_logs
DROP CONSTRAINT IF EXISTS execution_logs_execution_type_check;

ALTER TABLE execution_logs ADD CONSTRAINT execution_logs_execution_type_check CHECK (
  execution_type IN (
    'reservation',
    'preflight',
    'test',
    'auto_cancel',
    'test_token'
  )
);

-- Comentário
COMMENT ON CONSTRAINT execution_logs_execution_type_check ON execution_logs IS 'Tipos de execução: reservation (reserva normal), preflight (verificação prévia), test (teste), auto_cancel (cancelamento automático), test_token (validação de token)';