-- ============================================================
-- CONTROLE DE FOLGAS E PRESENÇA — Sinal Inter e Operações
--
-- Hoje isso vive em duas planilhas separadas, com a mesma forma:
-- um dia por linha, uma pessoa por coluna, e a célula diz onde a
-- pessoa está. A do Operações usa uma lista curta (14 valores); a
-- do Sinal Inter é texto livre e por isso tem 667 valores
-- diferentes, com "LiveKsa" convivendo com "LiveKasa" e "RJ" com
-- "Rio de Janeiro".
--
-- Aqui as duas viram UMA tabela, com um filtro de time.
--
-- A regra que dá sentido à tela: como o time trabalha fim de
-- semana, cada sábado, cada domingo e cada feriado GERA uma folga
-- de direito. O saldo "a tirar" é folgas usadas menos folgas de
-- direito, contado só até hoje.
--
-- ⚠ Este arquivo já cria as próprias policies, então a tabela
-- nunca fica aberta entre rodar isto e rodar o
-- supabase_seguranca.sql. Ver ORDEM_DE_EXECUCAO.md.
--
-- Pode ser rodado de novo sem estragar nada.
-- ============================================================

-- ── Os times ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folgas_times (
  id    TEXT PRIMARY KEY,          -- 'sinal-inter', 'operacoes'
  nome  TEXT NOT NULL,
  cor   TEXT,
  ordem INT DEFAULT 0
);

-- ── As pessoas ──────────────────────────────────────────────
-- `profile_id` liga a pessoa ao login do Portal, quando ela tem
-- um. É o que permite "cada um edita a sua coluna" sem PIN.
CREATE TABLE IF NOT EXISTS folgas_pessoas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id    TEXT REFERENCES folgas_times(id) ON DELETE SET NULL,
  nome       TEXT NOT NULL,
  cor        TEXT,
  ordem      INT DEFAULT 0,
  ativo      BOOLEAN DEFAULT TRUE,
  profile_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folgas_pessoas_time ON folgas_pessoas(time_id);

-- ── As categorias de dia ────────────────────────────────────
-- `time_id` NULL = vale para todos os times.
-- `conta_folga`  = é este tipo que consome o saldo devido.
-- `fixa`         = não pode ser apagada, porque o cálculo depende dela.
CREATE TABLE IF NOT EXISTS folgas_categorias (
  id              TEXT PRIMARY KEY,   -- 'folga', 'home', 'vila-olimpia'...
  nome            TEXT NOT NULL,
  curto           TEXT,
  cor             TEXT,
  time_id         TEXT REFERENCES folgas_times(id) ON DELETE CASCADE,
  fixa            BOOLEAN DEFAULT FALSE,
  conta_folga     BOOLEAN DEFAULT FALSE,
  eh_deslocamento BOOLEAN DEFAULT FALSE,
  pede_detalhe    BOOLEAN DEFAULT FALSE,
  exige_detalhe   BOOLEAN DEFAULT FALSE,
  dica_detalhe    TEXT,
  presets         TEXT[],             -- Home / Home - MM / Home - monitoração
  campeonatos     TEXT[],             -- para Externa
  ordem           INT DEFAULT 0,
  arquivada       BOOLEAN DEFAULT FALSE
);

-- ── O dia de cada pessoa ────────────────────────────────────
-- Uma linha por pessoa por dia. A chave primária composta impede
-- que a mesma pessoa tenha dois registros no mesmo dia.
CREATE TABLE IF NOT EXISTS folgas_dias (
  pessoa_id    UUID NOT NULL REFERENCES folgas_pessoas(id) ON DELETE CASCADE,
  dia          DATE NOT NULL,
  categoria_id TEXT REFERENCES folgas_categorias(id) ON DELETE SET NULL,
  detalhe      TEXT,
  campeonato   TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID,
  PRIMARY KEY (pessoa_id, dia)
);
CREATE INDEX IF NOT EXISTS idx_folgas_dias_dia ON folgas_dias(dia);

-- ── Feriados ────────────────────────────────────────────────
-- Cada feriado soma 1 folga de direito no dia em que cai.
CREATE TABLE IF NOT EXISTS folgas_feriados (
  dia  DATE PRIMARY KEY,
  nome TEXT NOT NULL
);

-- ── Ajustes manuais de saldo ────────────────────────────────
-- Para zerar o saldo depois de uma folga longa ou de férias. Fica
-- registrado quem fez e por quê — o histórico é visível a todos.
CREATE TABLE IF NOT EXISTS folgas_ajustes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id  UUID NOT NULL REFERENCES folgas_pessoas(id) ON DELETE CASCADE,
  vale_de    DATE NOT NULL,      -- o ajuste passa a valer deste dia em diante
  delta      INT NOT NULL,
  motivo     TEXT,
  feito_por  UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folgas_ajustes_pessoa ON folgas_ajustes(pessoa_id);

-- ── Tempo real ──────────────────────────────────────────────
-- Duas pessoas preenchendo ao mesmo tempo precisam ver uma a outra.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'folgas_times','folgas_pessoas','folgas_categorias',
    'folgas_dias','folgas_feriados','folgas_ajustes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;  -- já estava publicada
    END;
  END LOOP;
END $$;

-- ── Travas ──────────────────────────────────────────────────
-- Mesmo padrão das outras tabelas do Portal: qualquer pessoa
-- logada LÊ; escrever exige portal_pode_editar(). Sem policy para
-- anon = a chave pública não alcança nada disto.
--
-- Estas policies são as mesmas que o supabase_seguranca.sql
-- aplica; ficam repetidas aqui para que a tabela não passe nem um
-- minuto aberta entre um arquivo e outro.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'folgas_times','folgas_pessoas','folgas_categorias',
    'folgas_dias','folgas_feriados','folgas_ajustes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.portal_pode_editar())', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.portal_pode_editar()) WITH CHECK (public.portal_pode_editar())', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.portal_pode_editar())', t, t);
  END LOOP;
END $$;

-- Confira depois de rodar:
--   node scripts/verificar_rls_portal.mjs
