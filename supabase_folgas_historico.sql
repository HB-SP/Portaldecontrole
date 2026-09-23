-- ─── A ESCALA INTERNA ENTRA NO "QUEM ALTEROU O QUÊ" ──────────────────────────
-- O Portal já tem rastreabilidade estilo planilha do Google: portal_atividades,
-- alimentada pelo gatilho log_atividade(), com autor, campos alterados e o que
-- mudou. Ela cobre os jogos e a escala geral desde o começo — só as tabelas da
-- escala interna tinham ficado de fora.
--
-- Duas coisas acontecem aqui:
--
--   1. O RÓTULO passa a saber falar de escala. Hoje ele monta "Mandante x
--      Visitante", que não diz nada para um dia de folga. Para folgas_dias o
--      rótulo vira "Nome · dd/mm", que é como a pessoa procura: "quem mexeu na
--      minha sexta?". Para as outras tabelas da escala, o nome do registro.
--
--   2. O GATILHO é ligado nas cinco tabelas da escala.
--
-- Rode no SQL Editor do Supabase, DEPOIS de supabase_atividades.sql.
-- Pode rodar mais de uma vez sem problema.

-- ── 1. o rótulo aprende a falar de escala ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_atividade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  quem TEXT;
  j JSONB := to_jsonb(COALESCE(NEW, OLD));
  rot TEXT;
  mudados TEXT[];
BEGIN
  IF uid IS NULL THEN
    quem := CASE WHEN TG_TABLE_NAME = 'escala_confirmacoes' THEN 'Prestador (link externo)' ELSE 'Sistema' END;
  ELSE
    SELECT COALESCE(NULLIF(nome, ''), email) INTO quem FROM portal_profiles WHERE id = uid;
    IF quem IS NULL THEN SELECT email INTO quem FROM auth.users WHERE id = uid; END IF;
  END IF;

  -- Um dia de escala não tem mandante nem visitante: o que identifica ele é de
  -- QUEM é e de QUE DIA. É assim que a pergunta chega — "quem mexeu na minha
  -- sexta?" — e é assim que o rótulo tem de responder.
  IF TG_TABLE_NAME = 'folgas_dias' THEN
    SELECT CONCAT(COALESCE(p.nome, 'alguém'), ' · ', to_char((j->>'dia')::date, 'DD/MM'))
      INTO rot
      FROM folgas_pessoas p
     WHERE p.id = (j->>'pessoa_id')::uuid;
    rot := COALESCE(rot, CONCAT('dia ', j->>'dia'));

  ELSIF TG_TABLE_NAME = 'folgas_ajustes' THEN
    SELECT CONCAT('saldo de ', COALESCE(p.nome, 'alguém'))
      INTO rot
      FROM folgas_pessoas p
     WHERE p.id = (j->>'pessoa_id')::uuid;

  ELSE
    rot := COALESCE(
      j->>'jogo_label',
      NULLIF(CONCAT(j->>'mandante', ' x ', j->>'visitante'), ' x '),
      j->>'nome'
    );
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(n.key), '{}') INTO mudados
    FROM jsonb_each_text(to_jsonb(NEW)) n
    LEFT JOIN jsonb_each_text(to_jsonb(OLD)) o ON o.key = n.key
    WHERE o.value IS DISTINCT FROM n.value
      AND n.key NOT IN ('updated_at', 'created_at');
    IF mudados = '{}' THEN RETURN NULL; END IF; -- update sem mudança real não polui o feed
  END IF;

  INSERT INTO portal_atividades (usuario, acao, tabela, rotulo, campos)
  VALUES (
    quem,
    CASE TG_OP WHEN 'INSERT' THEN 'criou' WHEN 'UPDATE' THEN 'editou' ELSE 'excluiu' END,
    TG_TABLE_NAME, rot, mudados
  );

  -- Retenção: ~2% das gravações limpam o que passou de 60 dias.
  IF random() < 0.02 THEN
    DELETE FROM portal_atividades WHERE created_at < NOW() - INTERVAL '60 days';
  END IF;
  RETURN NULL;
END $$;

-- ── 2. o gatilho nas tabelas da escala ──────────────────────────────────────
-- folgas_dias é o que mais importa: é onde a escala de cada um vive.
-- As outras entram porque mexer em pessoa, categoria ou feriado muda a leitura
-- de todo mundo, e isso também precisa ter dono.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'folgas_dias', 'folgas_pessoas', 'folgas_categorias',
    'folgas_feriados', 'folgas_ajustes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_atividade ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_log_atividade AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_atividade()', t);
  END LOOP;
END $$;
