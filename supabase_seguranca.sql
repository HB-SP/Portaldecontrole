-- ============================================================
-- Portal de Controle — Segurança (Fase 1)
--
-- Antes disto: nenhuma autenticação e RLS DESLIGADO em tudo —
-- qualquer pessoa com a anon key (pública no bundle do site)
-- lê e ESCREVE/APAGA a escala inteira.
--
-- Depois disto:
--   • anon  → NADA (acesso externo só via RPCs da Fase 2)
--   • logado → LÊ tudo
--   • logado com papel (equipe/admin do Portal, ou admin do Hub)
--     → edita
--
-- O login usa o MESMO Supabase Auth do projeto (um pool de
-- usuários), mas a autorização do Portal é própria
-- (portal_profiles) — ter conta no Hub não dá acesso ao Portal.
-- ============================================================

-- ── Perfis do Portal ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'pendente', -- pendente | equipe | admin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Helpers (SECURITY DEFINER: leem os perfis ignorando RLS) ─
-- Pode editar as tabelas do Portal: equipe/admin do Portal, ou
-- admin do HUB (o sync de agenda/adoção do Hub grava hub_jogo_id
-- nas tabelas do Portal a partir da sessão de um admin do Hub).
CREATE OR REPLACE FUNCTION public.portal_pode_editar()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM portal_profiles WHERE id = auth.uid() AND role IN ('equipe','admin'))
      OR EXISTS (SELECT 1 FROM profiles        WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.portal_e_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM portal_profiles WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM profiles        WHERE id = auth.uid() AND role = 'admin')
$$;

-- ── RLS de portal_profiles ───────────────────────────────────
ALTER TABLE portal_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_select" ON portal_profiles;
DROP POLICY IF EXISTS "pp_insert" ON portal_profiles;
DROP POLICY IF EXISTS "pp_update" ON portal_profiles;
DROP POLICY IF EXISTS "pp_delete" ON portal_profiles;

-- Cada um lê o próprio perfil; admins leem todos
CREATE POLICY "pp_select" ON portal_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.portal_e_admin());
-- Auto-registro: usuário logado cria o PRÓPRIO perfil, sempre pendente
CREATE POLICY "pp_insert" ON portal_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'pendente');
-- Só admin muda papel/aprova
CREATE POLICY "pp_update" ON portal_profiles FOR UPDATE TO authenticated
  USING (public.portal_e_admin()) WITH CHECK (public.portal_e_admin());
CREATE POLICY "pp_delete" ON portal_profiles FOR DELETE TO authenticated
  USING (public.portal_e_admin());

-- ── RLS nas tabelas de dados do Portal ───────────────────────
-- SELECT: qualquer logado. Escrita: portal_pode_editar().
-- anon: nenhuma policy = bloqueado.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brasileirao_jogos','perifericos_brasileirao',
    'paulistao_feminino_jogos','perifericos_paulistao',
    'nba_prime_video','competitions','competition_columns',
    'competition_events','dropdown_options','escala_geral',
    'folgas_times','folgas_pessoas','folgas_categorias',
    'folgas_dias','folgas_feriados','folgas_ajustes'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
      EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.portal_pode_editar())', t, t);
      EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.portal_pode_editar()) WITH CHECK (public.portal_pode_editar())', t, t);
      EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.portal_pode_editar())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ⚠⚠ ROLLBACK — NÃO DESCOMENTE ⚠⚠
--
-- Isto DESLIGA a segurança de todas as tabelas de uma vez. Sem
-- RLS, a chave anon (pública no bundle do site, visível em
-- qualquer navegador) lê, edita e APAGA a escala inteira —
-- nomes, telefones dos supervisores e valores $ da Escala Geral,
-- para qualquer pessoa na internet.
--
-- Está aqui só como registro do estado anterior. Não existe
-- motivo operacional para rodar isto. Se o Portal parou de
-- carregar dados, o problema é outro: confira em ORDEM_DE_
-- EXECUCAO.md e rode `node scripts/verificar_rls_portal.mjs`
-- antes de encostar nesta seção.
-- ─────────────────────────────────────────────────────────────
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['brasileirao_jogos','perifericos_brasileirao',
--     'paulistao_feminino_jogos','perifericos_paulistao','nba_prime_video',
--     'competitions','competition_columns','competition_events',
--     'dropdown_options','escala_geral'] LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--   END LOOP;
-- END $$;
-- ALTER TABLE portal_profiles DISABLE ROW LEVEL SECURITY;
