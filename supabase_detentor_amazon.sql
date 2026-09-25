-- ─── BRASILEIRÃO: UM NOME SÓ PARA A AMAZON ───────────────────────────────────
-- O mesmo canal estava escrito de dois jeitos: "Amazon" em 21 jogos e
-- "AmazonPrime" em 12. Para o banco são dois detentores diferentes, e o filtro
-- de detentor da tela aparecia partido em dois — quem escolhesse um deles via
-- só metade dos jogos.
--
-- Fica "Amazon Prime", com espaço, como a equipe escreve (equipe, 25/09/2026).
--
-- Nas duas tabelas do Brasileirão, que são visões dos mesmos jogos. Fora delas
-- não existe nenhuma linha com Amazon: nem no Paulistão, nem na Copinha.

update brasileirao_jogos
   set detentor = 'Amazon Prime'
 where detentor in ('Amazon', 'AmazonPrime');

update perifericos_brasileirao
   set detentor = 'Amazon Prime'
 where detentor in ('Amazon', 'AmazonPrime');

-- Conferência: não pode sobrar nenhuma grafia antiga.
do $$
declare sobrou int;
begin
  select (select count(*) from brasileirao_jogos       where detentor in ('Amazon', 'AmazonPrime'))
       + (select count(*) from perifericos_brasileirao where detentor in ('Amazon', 'AmazonPrime'))
    into sobrou;
  if sobrou > 0 then
    raise exception 'ainda sobraram % linhas com a grafia antiga', sobrou;
  end if;
end $$;
