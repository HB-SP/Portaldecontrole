-- ============================================================
-- Portal de Controle - Host Broadcast
-- Supabase Setup SQL
-- ============================================================
-- ⚠ ORDEM OBRIGATÓRIA: este arquivo cria as tabelas, mas quem
-- define QUEM PODE VER E EDITAR é o supabase_seguranca.sql.
-- Rode SEMPRE nesta ordem (ver ORDEM_DE_EXECUCAO.md):
--   1) supabase_setup.sql   2) supabase_phase1.sql
--   3) supabase_seguranca.sql  ← sem este, o banco fica fechado
--
-- Até 09/2026 este arquivo terminava cada tabela com
-- "DISABLE ROW LEVEL SECURITY" — herança de quando o Portal não
-- tinha login. Re-rodá-lo em produção DESTRANCAVA o banco inteiro
-- e expunha a escala a qualquer pessoa com a chave anon (pública
-- no site). Agora as tabelas nascem TRANCADAS: se este arquivo
-- rodar por engano, o pior caso é o acesso ficar fechado demais
-- (some com nada, resolve-se rodando o supabase_seguranca.sql).
-- ============================================================

-- ============================================================
-- Table 1: brasileirao_jogos
-- ============================================================
CREATE TABLE IF NOT EXISTS brasileirao_jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eu TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  ppv TEXT,
  um TEXT,
  nome_numero TEXT,
  sng_premiere TEXT,
  sng_host TEXT,
  gerador TEXT,
  supervisores_1 TEXT,
  liveu_1 TEXT,
  supervisores_2 TEXT,
  liveu_2 TEXT,
  dtv TEXT,
  op_vmix TEXT,
  op_audio TEXT,
  teleporto TEXT,
  satelite TEXT,
  service_start_gmt TEXT,
  abertura_brt TEXT,
  service_end_gmt TEXT,
  fechamento_brt TEXT,
  total_horas TEXT,
  banda TEXT,
  status TEXT DEFAULT 'Pendente',
  reserva TEXT,
  transponder TEXT,
  uplink TEXT,
  downlink TEXT,
  satelite_globo TEXT,
  status_g TEXT DEFAULT 'Pendente',
  reserva_g TEXT,
  transponder_g TEXT,
  uplink_g TEXT,
  downlink_g TEXT,
  aspecto TEXT,
  compressao TEXT,
  transmissao TEXT,
  modulacao TEXT,
  sr TEXT,
  fec TEXT,
  biss_code TEXT,
  ficha_jogo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brasileirao_jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE brasileirao_jogos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE brasileirao_jogos;

-- ============================================================
-- Table 2: perifericos_brasileirao
-- ============================================================
CREATE TABLE IF NOT EXISTS perifericos_brasileirao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  credenciamento TEXT,
  drone TEXT,
  fornecedor_drone TEXT,
  minidrone TEXT,
  fornecedor_minidrone TEXT,
  dslr TEXT,
  qtde TEXT,
  fornecedor_dslr TEXT,
  grua TEXT,
  fornecedor_grua TEXT,
  goalcam TEXT,
  fornecedor_goalcam TEXT,
  trilho TEXT,
  fornecedor_trilho TEXT,
  carrinho TEXT,
  fornecedor_carrinho TEXT,
  clipcam TEXT,
  fornecedor_clipcam TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE perifericos_brasileirao ENABLE ROW LEVEL SECURITY;
ALTER TABLE perifericos_brasileirao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE perifericos_brasileirao;

-- ============================================================
-- Table 3: paulistao_feminino_jogos
-- ============================================================
CREATE TABLE IF NOT EXISTS paulistao_feminino_jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  cidade TEXT,
  estadio TEXT,
  padrao TEXT,
  detentor TEXT,
  um TEXT,
  gerador TEXT,
  dslr TEXT,
  refcam TEXT,
  drone TEXT,
  minidrone TEXT,
  supervisor_um_host TEXT,
  grua TEXT,
  coordenador TEXT,
  dtv TEXT,
  op_vmix TEXT,
  teleporto TEXT,
  satelite TEXT,
  status TEXT DEFAULT 'Pendente',
  reserva TEXT,
  transponder TEXT,
  uplink TEXT,
  downlink TEXT,
  banda TEXT,
  aspecto TEXT,
  compressao TEXT,
  transmissao TEXT,
  modulacao TEXT,
  sr TEXT,
  fec TEXT,
  service_start_gmt TEXT,
  abertura_brt TEXT,
  service_end_gmt TEXT,
  fechamento_brt TEXT,
  total_horas TEXT,
  audio_1_2 TEXT,
  audio_3_4 TEXT,
  biss_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE paulistao_feminino_jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE paulistao_feminino_jogos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE paulistao_feminino_jogos;

-- ============================================================
-- Table 4: perifericos_paulistao
-- ============================================================
CREATE TABLE IF NOT EXISTS perifericos_paulistao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  credenciamento TEXT,
  drone TEXT,
  fornecedor_drone TEXT,
  minidrone TEXT,
  fornecedor_minidrone TEXT,
  dslr TEXT,
  qtde TEXT,
  fornecedor_dslr TEXT,
  grua TEXT,
  fornecedor_grua TEXT,
  goalcam TEXT,
  fornecedor_goalcam TEXT,
  trilho TEXT,
  fornecedor_trilho TEXT,
  carrinho TEXT,
  fornecedor_carrinho TEXT,
  clipcam TEXT,
  fornecedor_clipcam TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE perifericos_paulistao ENABLE ROW LEVEL SECURITY;
ALTER TABLE perifericos_paulistao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE perifericos_paulistao;

-- ============================================================
-- Table 5: nba_prime_video
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_prime_video (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo TEXT,
  data TEXT,
  dia TEXT,
  hora_brt TEXT,
  visitante TEXT,
  mandante TEXT,
  coordenador_lm TEXT,
  teleporto TEXT DEFAULT 'Almirante',
  detentor TEXT DEFAULT 'Prime Video',
  status TEXT DEFAULT 'Pendente',
  total_horas TEXT,
  abertura_brt TEXT,
  start_gmt TEXT,
  fechamento_brt TEXT,
  end_gmt TEXT,
  fibra TEXT DEFAULT 'Aldea',
  reserva TEXT,
  source_nba TEXT,
  destination_sao TEXT,
  source_sao TEXT,
  destination_lax TEXT,
  satelite TEXT,
  banda TEXT,
  reserva2 TEXT,
  custo TEXT,
  transponder TEXT,
  uplink TEXT,
  downlink TEXT,
  aspecto TEXT DEFAULT '16:9',
  compressao TEXT DEFAULT 'Mpeg-4',
  transmissao TEXT DEFAULT 'DVB-S2',
  modulacao TEXT DEFAULT 'DVB-S2/ 8PSK',
  symbol_rate TEXT DEFAULT '7500',
  fec TEXT DEFAULT '2/3',
  nimbra TEXT DEFAULT 'TRUE',
  srt_rtmp TEXT DEFAULT 'TRUE',
  url_rtmp TEXT DEFAULT 'rtmp://a.rtmp.youtube.com/live2',
  rtmp_key TEXT,
  audio_1_2 TEXT DEFAULT 'Full mix Eng',
  audio_3_4 TEXT DEFAULT 'BG',
  audio_5_6 TEXT DEFAULT 'None/Ads',
  observacao TEXT DEFAULT 'Ok',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nba_prime_video ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_prime_video REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE nba_prime_video;
