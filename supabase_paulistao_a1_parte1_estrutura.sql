-- ============================================================
-- Paulistao A1 26 — PARTE 1 de 2: ESTRUTURA
--
-- Liga o campeonato a Escala Geral, cria a aba Periferico, move os
-- perifericos para ela e cria as colunas do Controle com os MESMOS
-- grupos do Brasileirao.
--
-- Pequeno de proposito: a Parte 2 (os 75 jogos) e grande e o editor do
-- navegador pode cortar colagem longa. Rode esta primeiro.
-- Nao toca em Brasileirao nem Paulistao Feminino. Pode rodar de novo.
-- ============================================================

BEGIN;

-- ── 0) Ligacao com a Escala Geral ────────────────────────────────────
--    A Visao Geral mostra o painel ESCALA GERAL (Coordenador UM,
--    Produtor UM, Produtor Campo, Monitoracao) casando pelo NOME do
--    campeonato em escala_geral.campeonato. O nome vivia num mapa fixo
--    no codigo com duas entradas, por isso o A1 nao achava a escala.
--    Agora o nome mora aqui, junto do campeonato.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS escala_camps TEXT[];

COMMENT ON COLUMN competitions.escala_camps IS
  'Nomes com que este campeonato aparece em escala_geral.campeonato. '
  'Vazio = o codigo cai no mapa fixo de src/lib/escalaLink.js.';

UPDATE competitions SET escala_camps = ARRAY['Paulistão 26'] WHERE slug = 'paulistao-a1';
UPDATE competitions SET escala_camps = ARRAY['Brasileirão 26', 'BR26']
WHERE slug = 'brasileirao' AND escala_camps IS NULL;
UPDATE competitions SET escala_camps = ARRAY['Paulistão F 26', 'PFem 26']
WHERE slug = 'paulistao-fem' AND escala_camps IS NULL;

-- ── 1) A secao Periferico (filha do Paulistao A1) ────────────────────
INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, section_kind, sort_order, parent_competition_id)
SELECT 'paulistao-a1-periferico', 'Periférico A1 26', '#B91C1C', '#1a0606', 'dynamic', 'periferico', 31, p.id
FROM competitions p WHERE p.slug = 'paulistao-a1'
  AND NOT EXISTS (SELECT 1 FROM competitions WHERE slug = 'paulistao-a1-periferico');

-- ── 2) Move as 37 colunas de periferico do Controle para a secao nova ─
--    (as de identidade do jogo vao junto: cada secao tem as suas,
--     igual ao Brasileirao, onde as duas tabelas repetem rod/data/times)
UPDATE competition_columns SET competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico')
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1')
  AND key IN ('rod','data','mandante','visitante','dia','hora_brt','estadio','cidade',
             'padrao','detentor','credenciamento','drone','fornecedor_drone','minidrone',
             'fornecedor_minidrone','dslr','fornecedor_dslr','qtde_dslr','golcam',
             'fornecedor_golcam','earcam','fornecedor_earcam','ultracam','fornecedor_ultracam',
             'grua','fornecedor_grua','carrinho','fornecedor_carrinho','klover',
             'fornecedor_klover','micros_especiais','fornecedor_micros','internet_led',
             'fornecedor_internet_led','assinatura_craque','cadeirao','fornecedor_cadeirao');

-- ── 2b) Equipamentos do Periferico com botoes Sim/Nao ────────────────
--    A tela de perifericos descobre o que e equipamento pelo tipo
--    'simnao' (ver src/config/equipamentos.js). Sem isto, os 13 tipos
--    do A1 nao apareceriam como slots na aba Periferico.
UPDATE competition_columns SET type = 'simnao'
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico')
  AND key IN ('drone','minidrone','dslr','golcam','earcam','ultracam','grua',
             'carrinho','klover','micros_especiais','internet_led',
             'assinatura_craque','cadeirao');

-- ── 3) Move os 74 jogos de periferico para a secao nova ──────────────
UPDATE competition_events SET competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico')
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1');

-- ── 4) fornecedor_micros -> fornecedor_micros_especiais ──────────────
--    A tela de perifericos descobre o fornecedor pela convencao
--    fornecedor_<chave>; com o nome curto, o par de "Micros Especiais"
--    nao era encontrado. Renomeia a coluna E a chave dentro do JSONB.
UPDATE competition_columns SET key = 'fornecedor_micros_especiais'
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico')
  AND key = 'fornecedor_micros';

UPDATE competition_events
SET data = (data - 'fornecedor_micros')
           || jsonb_build_object('fornecedor_micros_especiais', data->>'fornecedor_micros')
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico')
  AND data ? 'fornecedor_micros';

-- ── 5) As colunas do Controle (operacional) ──────────────────────────
INSERT INTO competition_columns (competition_id, key, label, type, options, width, col_group, sticky, status_color, sort_order)
SELECT c.id, v.key, v.label, v.type, v.options::jsonb, v.width, v.col_group, v.sticky, v.status_color, v.sort_order
FROM competitions c, (VALUES
  ('rod', 'Rod', 'text', '[]', 50, 'Jogo', true, false, 10),
  ('data', 'Data', 'text', '[]', 62, 'Jogo', true, false, 20),
  ('mandante', 'Mandante', 'text', '[]', 120, 'Jogo', true, false, 30),
  ('visitante', 'Visitante', 'text', '[]', 120, 'Jogo', true, false, 40),
  ('dia', 'Dia', 'select', '["segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado","domingo"]', 100, 'Jogo', false, false, 50),
  ('hora_brt', 'Hora BRT', 'text', '[]', 72, 'Jogo', false, false, 60),
  ('estadio', 'Estádio', 'text', '[]', 150, 'Jogo', false, false, 70),
  ('cidade', 'Cidade', 'text', '[]', 120, 'Jogo', false, false, 80),
  ('padrao', 'Padrão', 'select', '["B1","B2","B2 +","B3","FeedB"]', 72, 'Jogo', false, false, 90),
  ('detentor', 'Detentor', 'select', '["HBO MAX","HBO/TNT","YTCazeTV/Record/HBO","Todos"]', 165, 'Jogo', false, false, 100),
  ('um', 'UM', 'text', '[]', 130, 'Equipe Técnica', false, false, 110),
  ('nome_numero', 'Nome/N°', 'text', '[]', 110, 'Equipe Técnica', false, false, 120),
  ('sng', 'SNG', 'text', '[]', 110, 'Equipe Técnica', false, false, 130),
  ('camera_by', 'Camera By', 'simnao', '["Sim","Não"]', 95, 'Equipe Técnica', false, false, 140),
  ('gerador', 'Gerador', 'text', '[]', 110, 'Equipe Técnica', false, false, 150),
  ('um_virtual', 'UM Virtual', 'simnao', '["Sim","Não"]', 98, 'Equipe Técnica', false, false, 160),
  ('supervisor_um_host', 'Supervisor UM/Host', 'text', '[]', 200, 'Equipe Técnica', false, false, 170),
  ('liveu', 'LiveU', 'text', '[]', 100, 'Equipe Técnica', false, false, 180),
  ('sup_virtual', 'Sup. Virtual', 'text', '[]', 200, 'Equipe Técnica', false, false, 190),
  ('dtv', 'DTV', 'text', '[]', 130, 'Equipe Técnica', false, false, 200),
  ('op_vmix', 'Op. Vmix', 'text', '[]', 155, 'Equipe Técnica', false, false, 210),
  ('op_audio', 'Op. Áudio', 'text', '[]', 140, 'Equipe Técnica', false, false, 220),
  ('um_by', 'UM By', 'simnao', '["Sim","Não"]', 88, 'Equipe Técnica', false, false, 230),
  ('teleporto', 'Teleporto', 'text', '[]', 100, 'Transmissão', false, false, 240),
  ('satelite', 'Satélite', 'text', '[]', 95, 'Transmissão', false, false, 250),
  ('service_start_gmt', 'Service Start (GMT)', 'text', '[]', 125, 'Transmissão', false, false, 260),
  ('abertura_brt', 'Abertura (BRT)', 'text', '[]', 115, 'Transmissão', false, false, 270),
  ('service_end_gmt', 'Service End (GMT)', 'text', '[]', 125, 'Transmissão', false, false, 280),
  ('fechamento_brt', 'Fechamento (BRT)', 'text', '[]', 125, 'Transmissão', false, false, 290),
  ('total_horas', 'Total de horas', 'text', '[]', 105, 'Transmissão', false, false, 300),
  ('banda', 'Banda', 'text', '[]', 80, 'Transmissão', false, false, 310),
  ('status', 'Status', 'select', '["Confirmado","Reservado","Pendente","Cancelado","Em andamento","Aguardando","Alteração"]', 110, 'Transmissão', false, true, 320),
  ('reserva', 'Reserva', 'text', '[]', 95, 'Transmissão', false, false, 330),
  ('transponder', 'Transponder', 'text', '[]', 170, 'Transmissão', false, false, 340),
  ('uplink', 'Uplink', 'text', '[]', 110, 'Transmissão', false, false, 350),
  ('downlink', 'Downlink', 'text', '[]', 110, 'Transmissão', false, false, 360),
  ('satelite_feedb', 'Satélite FEED B', 'text', '[]', 115, 'FEED B', false, false, 370),
  ('status_feedb', 'Status FEED B', 'select', '["Confirmado","Reservado","Pendente","Cancelado","Em andamento","Aguardando","Alteração"]', 115, 'FEED B', false, false, 380),
  ('reserva_feedb', 'Reserva FEED B', 'text', '[]', 115, 'FEED B', false, false, 390),
  ('transponder_feedb', 'Transponder FEED B', 'text', '[]', 170, 'FEED B', false, false, 400),
  ('uplink_feedb', 'Uplink FEED B', 'text', '[]', 120, 'FEED B', false, false, 410),
  ('downlink_feedb', 'Downlink FEED B', 'text', '[]', 120, 'FEED B', false, false, 420),
  ('aspecto', 'Aspecto', 'text', '[]', 80, 'Técnico', false, false, 430),
  ('compressao', 'Compressão', 'text', '[]', 105, 'Técnico', false, false, 440),
  ('transmissao', 'Transmissão', 'text', '[]', 105, 'Técnico', false, false, 450),
  ('modulacao', 'Modulação', 'text', '[]', 135, 'Técnico', false, false, 460),
  ('sr', 'SR', 'text', '[]', 70, 'Técnico', false, false, 470),
  ('fec', 'FEC', 'text', '[]', 65, 'Técnico', false, false, 480),
  ('biss_code', 'BISS Code', 'text', '[]', 135, 'Técnico', false, false, 490)
) AS v(key, label, type, options, width, col_group, sticky, status_color, sort_order)
WHERE c.slug = 'paulistao-a1'
-- DO UPDATE, nao DO NOTHING: se uma versao anterior deste arquivo ja
-- criou as colunas com outros grupos, esta rodada CORRIGE em vez de
-- ignorar. E o que alinha o A1 aos grupos do Brasileirao.
ON CONFLICT (competition_id, key) DO UPDATE SET
  label = EXCLUDED.label, type = EXCLUDED.type, options = EXCLUDED.options,
  width = EXCLUDED.width, col_group = EXCLUDED.col_group, sticky = EXCLUDED.sticky,
  status_color = EXCLUDED.status_color, sort_order = EXCLUDED.sort_order;

COMMIT;

-- Conferencia: os grupos devem virar Jogo / Equipe Técnica / Transmissão /
-- FEED B / Técnico, e escala_camps deve mostrar {Paulistão 26}
SELECT string_agg(x, '  |  ') AS resultado FROM (
  SELECT 'grupos: ' || coalesce(string_agg(DISTINCT col_group, ','), 'NENHUM') AS x
  FROM competition_columns
  WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1')
  UNION ALL
  SELECT 'escala_camps: ' || coalesce(array_to_string(escala_camps, ','), 'vazio')
  FROM competitions WHERE slug = 'paulistao-a1'
  UNION ALL
  SELECT 'secao periferico: ' || CASE WHEN EXISTS (SELECT 1 FROM competitions WHERE slug = 'paulistao-a1-periferico') THEN 'SIM' ELSE 'NAO' END
  UNION ALL
  SELECT 'jogos no Periferico: ' || (SELECT count(*)::text FROM competition_events WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1-periferico'))
  UNION ALL
  SELECT 'jogos no Controle: ' || (SELECT count(*)::text FROM competition_events WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1'))
) t;