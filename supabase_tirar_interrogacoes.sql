-- ─── SAI O "????" DA ESCALA ──────────────────────────────────────────────────
-- Três linhas do Brasileirão tinham "Gui Soria / ????" e "Gui Soria / ???" no
-- produtor UM. O "????" é o segundo nome do par que ninguém sabia ainda — a
-- convenção "A / B" da planilha com o B em aberto.
--
-- Vazio já quer dizer "falta preencher", e diz melhor: o filtro "só o que
-- falta" da tela Escalar enxerga vazio, mas enxergava "????" como preenchido
-- (equipe, 25/09/2026).
--
-- Some só o "????" e a barra; o nome que estava junto fica.

update escala_geral
   set produtor_um = trim(regexp_replace(produtor_um, '\s*/\s*\?+\s*$', ''))
 where produtor_um ~ '\?\?';

-- Conferência: não pode sobrar interrogação em coluna nenhuma da escala.
do $$
declare sobrou int;
begin
  select count(*) into sobrou from escala_geral
   where coalesce(coordenador_um,'')   ~ '\?\?'
      or coalesce(produtor_um,'')      ~ '\?\?'
      or coalesce(produtor_campo,'')   ~ '\?\?'
      or coalesce(monitoracao,'')      ~ '\?\?'
      or coalesce(producao_executiva,'') ~ '\?\?';
  if sobrou > 0 then
    raise exception 'ainda sobraram % linhas com ??', sobrou;
  end if;
end $$;
