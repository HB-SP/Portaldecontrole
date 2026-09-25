-- ─── DUAS FALHAS QUE NÃO DAVAM ERRO NENHUM ───────────────────────────────────

-- 1. O SUB 20 ESTAVA LIGADO À METADE DA PRÓPRIA ESCALA
--
-- A escala do Sub 20 está gravada sob DOIS nomes: "PS20" nas 8 datas futuras
-- (times ainda "TBD") e "Sub 20" nos 2 jogos que já aconteceram — justamente os
-- que têm gente escalada de verdade.
--
-- Ao criar o campeonato hoje eu liguei só em "PS20". Resultado: os dois únicos
-- jogos com escala apareciam SEM escala na Visão Geral e na Transmissão. Nada
-- quebrava, nada avisava — só faltava (25/09/2026).
update competitions
   set escala_camps = array['PS20', 'Sub 20']
 where slug = 'paulistao-sub20';

-- 2. DUAS PESSOAS SEPARADAS POR "+" EM VEZ DE "/"
--
-- A convenção da planilha e do portal inteiro é "Fulano / Ciclano", e é por ela
-- que o portal parte a célula para saber quem está escalado. A função do banco
-- que monta o link do prestador faz string_to_array(valor, '/').
--
-- Com "+", ela lê "Natan Raddatz + Laís Amorim" como UM nome só — e aí nem a
-- Laís nem o Natan encontram esse jogo no link deles. Cinco linhas, todas em
-- produção executiva.
update escala_geral
   set producao_executiva = regexp_replace(producao_executiva, '\s*\+\s*', ' / ', 'g')
 where producao_executiva like '%+%';

-- Conferência: não pode sobrar "+" em nenhuma coluna de gente.
do $$
declare sobrou int;
begin
  select count(*) into sobrou from escala_geral
   where coalesce(coordenador_um,'')     like '%+%'
      or coalesce(produtor_um,'')        like '%+%'
      or coalesce(produtor_campo,'')     like '%+%'
      or coalesce(producao_executiva,'') like '%+%'
      or coalesce(monitoracao,'')        like '%+%';
  if sobrou > 0 then
    raise exception 'ainda sobraram % linhas com +', sobrou;
  end if;
end $$;
