-- Adicionar campo flow_steps na tabela execution_logs
ALTER TABLE execution_logs
ADD COLUMN IF NOT EXISTS flow_steps JSONB;

-- Comentário
COMMENT ON COLUMN execution_logs.flow_steps IS 'Array com os passos de execução detalhados';