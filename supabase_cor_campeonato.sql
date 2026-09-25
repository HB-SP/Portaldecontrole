-- ─── A COR DE CADA CAMPEONATO, TIRADA DA LOGO DELE ───────────────────────────
-- As cores gravadas não tinham relação com os campeonatos: o Paulistão
-- Feminino era ROSA e a logo dele é roxa; o Paulistão A1 era VERMELHO e a logo
-- é azul-marinho. A barra de progresso e o "abrir" do card saíam de uma cor e
-- a logo ao lado de outra (equipe, 25/09/2026).
--
-- POR QUE DUAS CORES E NÃO UMA
-- A cor do campeonato aparece em dois papéis muito diferentes: preenchendo
-- (barra de progresso, fio do card, fundo de botão) e escrevendo (o "abrir", a
-- borda, texto em outras telas). O verde-limão do Brasileirão e o amarelo da
-- Copinha são ótimos preenchendo e ilegíveis escrevendo — 1,2:1 de contraste
-- no branco, quando o mínimo para texto pequeno é 3:1. Medido, não achado.
--
--   accent_color  a cor que ESCREVE: texto, borda, botão com letra branca.
--   accent_fill   a cor que PREENCHE, quando é diferente. Vazio = usa a outra.
--
-- Os valores saíram das próprias logos (as cores mais presentes em cada uma),
-- não de escolha no olho.

alter table competitions add column if not exists accent_fill text;

comment on column competitions.accent_fill is
  'Cor viva da marca, para barra e fios. Vazio = usa accent_color. Existe porque cor de marca clara (verde-limão, amarelo) não serve como texto.';

update competitions set accent_color = '#121226', accent_fill = '#C5FF00' where slug = 'brasileirao';
update competitions set accent_color = '#1E1E3C', accent_fill = '#A8DA00' where slug = 'periferico-br';

update competitions set accent_color = '#292A75', accent_fill = null where slug = 'paulistao-a1';
update competitions set accent_color = '#334B9F', accent_fill = null where slug = 'paulistao-a1-periferico';

update competitions set accent_color = '#A104F0', accent_fill = null where slug = 'paulistao-fem';
update competitions set accent_color = '#7818C0', accent_fill = null where slug = 'periferico-pf';

update competitions set accent_color = '#1A1A1A', accent_fill = '#FAE141' where slug = 'copinha';
update competitions set accent_color = '#3A3A2A', accent_fill = '#E0C93A' where slug = 'copinha-periferico';
