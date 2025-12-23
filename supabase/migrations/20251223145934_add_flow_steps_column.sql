-- Adicionar campo flow_steps na tabela execution_logs
-- Para armazenar os passos detalhados da execução
ALTER TABLE execution_logs
ADD COLUMN IF NOT EXISTS flow_steps JSONB;

COMMENT ON COLUMN execution_logs.flow_steps IS 'Array com os passos de execução detalhados';