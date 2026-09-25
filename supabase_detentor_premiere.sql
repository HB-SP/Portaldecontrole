-- ─── BRASILEIRÃO: O PREMIERE ENTRA NO DETENTOR ───────────────────────────────
-- No Brasileirão, quando o jogo é da CazeTV e da Record, o Premiere também é
-- detentor. A planilha já escrevia assim em 23 dos 35 jogos; os outros 12
-- ficaram com a forma curta, provavelmente porque a lista de opções da tela
-- só oferecia "CazeTV/Record" (equipe, 25/09/2026).
--
-- A mudança é só essa: onde está exatamente "CazeTV/Record", passa a ser
-- "CazeTV/Record/Premiere". Nada mais é tocado — nem Amazon, nem o Paulistão
-- (que tem detentores próprios), nem a Copinha.
--
-- Vale para as DUAS tabelas do Brasileirão: a dos jogos e a dos periféricos.
-- São visões dos mesmos jogos; se só uma mudasse, as duas abas passariam a
-- dizer coisas diferentes sobre o mesmo jogo.

update brasileirao_jogos
   set detentor = 'CazeTV/Record/Premiere'
 where detentor = 'CazeTV/Record';

update perifericos_brasileirao
   set detentor = 'CazeTV/Record/Premiere'
 where detentor = 'CazeTV/Record';

-- Conferência: depois disto não pode sobrar nenhum "CazeTV/Record" puro.
do $$
declare sobrou int;
begin
  select (select count(*) from brasileirao_jogos      where detentor = 'CazeTV/Record')
       + (select count(*) from perifericos_brasileirao where detentor = 'CazeTV/Record')
    into sobrou;
  if sobrou > 0 then
    raise exception 'ainda sobraram % linhas com CazeTV/Record puro', sobrou;
  end if;
end $$;
