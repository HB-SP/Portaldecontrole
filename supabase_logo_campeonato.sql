-- ─── A LOGO DO CAMPEONATO ────────────────────────────────────────────────────
-- O card do campeonato na tela inicial mostrava só o nome numa faixa colorida.
-- A referência que a equipe trouxe (25/09/2026) põe a logo à esquerda, e ela
-- faz o trabalho que a cor sozinha não faz: identificar o campeonato antes de
-- alguém ler o nome.
--
-- Guarda o ENDEREÇO da imagem, não a imagem. Pode ser um arquivo dentro do
-- Portal ("/campeonatos/brasileirao.png") ou um link. Sem logo, o card mostra
-- as iniciais na cor do campeonato — nunca fica um buraco.

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN competitions.logo_url IS
  'Endereço da logo: arquivo em /public (ex: /campeonatos/brasileirao.png) ou link. Vazio = o card usa as iniciais.';
