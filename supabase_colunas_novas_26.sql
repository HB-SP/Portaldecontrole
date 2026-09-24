-- ─── COLUNAS QUE A PLANILHA GANHOU E A TABELA NÃO TINHA ──────────────────────
-- As planilhas de controle continuam sendo editadas, e de vez em quando ganham
-- uma coluna. Quando isso acontece, o dado existe na origem e não tem onde
-- entrar no Portal — some sem ninguém reparar.
--
-- Estas cinco apareceram na importação de 24/09/2026, e todas têm conteúdo:
--
--   Paulistão Feminino · Credenciamento     20 de 20 preenchidos
--   Periféricos BR     · UltraCam           19
--   Periféricos BR     · Fornecedor UltraCam  2
--   Periféricos BR     · Klover               6
--   Periféricos BR     · UM de Áudio         13
--
-- Rode com: node scripts/sql.mjs supabase_colunas_novas_26.sql --rodar

ALTER TABLE paulistao_feminino_jogos
  ADD COLUMN IF NOT EXISTS credenciamento TEXT;

ALTER TABLE perifericos_brasileirao
  ADD COLUMN IF NOT EXISTS ultracam            TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor_ultracam TEXT,
  ADD COLUMN IF NOT EXISTS klover              TEXT,
  ADD COLUMN IF NOT EXISTS um_de_audio         TEXT;
