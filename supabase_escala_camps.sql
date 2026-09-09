-- ============================================================
-- Liga cada campeonato do Portal aos nomes que ele usa na Escala Geral
--
-- Problema: a Visão Geral mostra, ao lado de cada jogo, a escala de
-- produção (Coordenador UM, Produtor UM, Produtor de Campo,
-- Monitoração) lida da tabela escala_geral. O casamento era por NOME,
-- e os nomes viviam num mapa fixo dentro do código
-- (src/lib/escalaLink.js, CAMP_ALIAS), com só duas entradas.
--
-- Resultado: o Paulistão A1 26, criado em 09/09/2026, não achava a
-- escala dele — na escala_geral aqueles jogos estão como
-- "Paulistão 26". Ligar um campeonato novo exigia editar o código e
-- publicar o site.
--
-- Agora o nome mora no banco, junto do campeonato. Criar campeonato e
-- ligá-lo à Escala Geral passa a ser tarefa de quem usa, não de quem
-- programa.
--
-- Seguro rodar antes OU depois do deploy do código: o código trata a
-- coluna ausente caindo no mapa antigo, e a coluna sem o código apenas
-- não é lida. Nas duas ordens nada quebra.
-- ============================================================

BEGIN;

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS escala_camps TEXT[];

COMMENT ON COLUMN competitions.escala_camps IS
  'Nomes com que este campeonato aparece em escala_geral.campeonato. '
  'Vazio = o código cai no mapa fixo de src/lib/escalaLink.js. '
  'Mais de um nome porque a planilha de planejamento já usou grafias diferentes.';

-- Paulistão A1 26 -> "Paulistão 26" (confirmado na legenda da Escala Geral)
UPDATE competitions SET escala_camps = ARRAY['Paulistão 26']
WHERE slug = 'paulistao-a1';

-- Os dois que já funcionavam pelo mapa fixo: mesmos valores, agora no
-- banco. O mapa continua no código como rede de segurança.
UPDATE competitions SET escala_camps = ARRAY['Brasileirão 26', 'BR26']
WHERE slug = 'brasileirao' AND escala_camps IS NULL;

UPDATE competitions SET escala_camps = ARRAY['Paulistão F 26', 'PFem 26']
WHERE slug = 'paulistao-fem' AND escala_camps IS NULL;

-- ── Botões Sim/Não nas colunas de equipamento do Paulistão A1 ──────────
-- Entraram como lista suspensa ('select') porque a célula de botões
-- ENGOLIA valor diferente de Sim/Não — dois jogos do A1 têm
-- "Aguardando OK" e o texto não aparecia em lugar nenhum. Isso foi
-- corrigido no DataTable (o valor estranho agora aparece em âmbar ao
-- lado dos botões), então dá para usar os botões sem perder dado.
-- credenciamento fica de fora: os valores dele são Enviado/Parcial.
UPDATE competition_columns SET type = 'simnao'
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1')
  AND key IN ('drone', 'minidrone', 'dslr', 'golcam', 'earcam', 'ultracam',
              'grua', 'carrinho', 'klover', 'micros_especiais',
              'internet_led', 'assinatura_craque', 'cadeirao');

COMMIT;

-- ── Conferência ────────────────────────────────────────────────────────
-- Esperado: paulistao-a1 = {Paulistão 26} · brasileirao = {Brasileirão 26,BR26}
--           paulistao-fem = {Paulistão F 26,PFem 26}
SELECT slug, label, escala_camps
FROM competitions
WHERE slug IN ('paulistao-a1', 'brasileirao', 'paulistao-fem')
ORDER BY sort_order;

-- Esperado: 13 colunas com botões Sim/Não
SELECT count(*) AS colunas_simnao
FROM competition_columns
WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1')
  AND type = 'simnao';

-- Quantos jogos do A1 a Visão Geral vai encontrar na Escala Geral
-- (0 aqui significaria que o nome "Paulistão 26" está diferente no banco)
SELECT count(*) AS jogos_do_a1_na_escala_geral
FROM escala_geral WHERE campeonato = 'Paulistão 26';
