-- ─── O PADRÃO TÉCNICO DO CAMPEONATO ──────────────────────────────────────────
-- Medido no banco em 24/09/2026: de 26 campos de Transmissão, DEZ têm um valor
-- único repetido em todas as linhas. Nos 60 jogos do Brasileirão, os dez dizem
-- sempre a mesma coisa — banda 9Mhz, aspecto 16:9, Mpeg-4, DVB-S2, 7500, 2/3.
--
-- Campo que nunca muda não é informação do jogo: é configuração do campeonato.
-- E hoje quem cadastra um jogo novo digita tudo de novo, campo por campo — foi
-- o incômodo que a equipe confirmou ser real.
--
-- Aqui o campeonato passa a guardar esses valores. O jogo continua com os seus
-- (a linha segue auto-contida, e um jogo que fuja do padrão é só editar), mas
-- nasce preenchido em vez de vazio.
--
-- Rode com: node scripts/sql.mjs supabase_padrao_tecnico.sql --rodar
-- Depois:   node scripts/padrao_tecnico.mjs --gravar   (preenche pelo histórico)

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS padrao_tecnico JSONB;

COMMENT ON COLUMN competitions.padrao_tecnico IS
  'Valores que não mudam de jogo para jogo (banda, aspecto, compressão, FEC...). Um jogo novo nasce com eles preenchidos; quem fugir do padrão é só editar.';
