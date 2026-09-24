-- ─── PRODUÇÃO EXECUTIVA ──────────────────────────────────────────────────────
-- Mais uma função de produção na escala do jogo, ao lado de Coordenador UM,
-- Produtor UM, Produtor de Campo e Monitoração (equipe, 24/09/2026).
--
-- Ela entra na escala_geral porque é lá que as funções de produção vivem — a
-- mesma tabela que alimenta o grupo Pessoal da Visão Geral, a tela Escalar e a
-- ligação com a escala interna. Uma coluna aqui e uma linha em FUNCOES_ESCALA
-- fazem a função aparecer nos três lugares.
--
-- Rode com: node scripts/sql.mjs supabase_producao_executiva.sql --rodar

ALTER TABLE escala_geral
  ADD COLUMN IF NOT EXISTS producao_executiva TEXT;

COMMENT ON COLUMN escala_geral.producao_executiva IS
  'Função de produção, como coordenador_um e produtor_um. "Não" significa que o jogo não terá essa função — não é pendência.';
