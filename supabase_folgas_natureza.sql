-- ─── DUAS PERGUNTAS, DOIS CAMPOS ────────────────────────────────────────────
-- A lista de categorias mistura duas perguntas de naturezas diferentes:
--
--   1. DÁ PARA CONTAR COM A PESSOA?   sim ou não
--   2. SE DÁ, ONDE ELA ESTÁ?          casa, escritório ou rua
--
-- "Folga" só responde a primeira. "Vila Olímpia" só responde a segunda, e deixa
-- a primeira implícita. Separar as duas foi a melhor ideia da proposta de
-- escala de 22/09/2026, e o mapeamento abaixo é o que a equipe fechou em
-- 23/09/2026 — inclusive os dois casos que não cabiam nas caixas originais:
-- atestado é "não contar com a pessoa", e monitoração é "contar com ela, em
-- casa".
--
-- POR QUE ISSO IMPORTA, na prática: os grupos da aba Dia (Fora, Home,
-- Presencial, OFF) e os filtros estavam escritos à mão no código. Era preciso
-- lembrar de atualizar a lista a cada categoria nova — e foi exatamente o que
-- não aconteceu quando a Assunção foi criada, que ficou de fora até alguém
-- reparar. Com os campos no banco, os grupos saem do dado sozinhos.
--
-- NÃO substitui `conta_folga`: essa continua sendo quem diz se o dia consome
-- saldo, e só a Folga consome. Férias e atestado são indisponíveis SEM
-- consumir — eles suspendem o direito, que é outra coisa ainda.
--
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema.

ALTER TABLE folgas_categorias
  ADD COLUMN IF NOT EXISTS disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lugar      TEXT;

COMMENT ON COLUMN folgas_categorias.disponivel IS
  'FALSE quando o dia é ausência: não se conta com a pessoa (folga, férias, atestado).';
COMMENT ON COLUMN folgas_categorias.lugar IS
  'casa | escritorio | rua. NULL quando a pessoa não está disponível, ou quando a categoria não diz onde ela está.';

-- ── quem NÃO está disponível ────────────────────────────────────────────────
UPDATE folgas_categorias SET disponivel = FALSE, lugar = NULL
 WHERE id IN ('folga', 'ferias', 'atestado');

-- ── quem está, e onde ───────────────────────────────────────────────────────
UPDATE folgas_categorias SET disponivel = TRUE, lugar = 'casa'
 WHERE id IN ('home', 'monitoracao');

UPDATE folgas_categorias SET disponivel = TRUE, lugar = 'escritorio'
 WHERE id IN ('escritorio', 'casablanca', 'assuncao');

UPDATE folgas_categorias SET disponivel = TRUE, lugar = 'rua'
 WHERE id IN ('externa', 'deslocamento');

-- ── as arquivadas, para o histórico não ficar sem grupo ─────────────────────
UPDATE folgas_categorias SET disponivel = TRUE, lugar = 'escritorio'
 WHERE id IN ('livekasa', 'sportheca');

-- "Outro" fica disponível e SEM lugar de propósito: ele é o texto livre, e
-- dizer onde a pessoa estava seria inventar. Na tela ele vira um grupo com o
-- próprio nome, que é o certo — melhor aparecer sozinho do que sumir dentro de
-- um lugar que ninguém afirmou.
UPDATE folgas_categorias SET disponivel = TRUE, lugar = NULL
 WHERE id = 'outro';

-- Confira:
--   SELECT nome, disponivel, lugar FROM folgas_categorias ORDER BY ordem;
