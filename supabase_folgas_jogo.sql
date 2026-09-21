-- ─── O JOGO APONTADO NA ESCALA INTERNA ───────────────────────────────────────
-- Tem gente do time que vai ao jogo sem ter função na escala DELE — não é
-- produtor, nem cinegrafista, nem supervisor, então não aparece em lugar
-- nenhum da escala do jogo. Antes disso, essa pessoa marcava "Externa" e
-- escrevia o confronto à mão: cada um escrevia de um jeito, e nada virava link.
--
-- Agora ela ESCOLHE o jogo numa lista dos que existem naquele dia, e o dia
-- passa a apontar para ele.
--
-- Por que guardar data/mandante/visitante e não só um id: é assim que o Portal
-- acha um jogo para abrir a ficha (`chaveJogo`, em JogosOverview). O id fica
-- junto por garantia, para o dia em que a abertura passar a usá-lo.
--
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema.

ALTER TABLE folgas_dias
  ADD COLUMN IF NOT EXISTS jogo_comp_id   UUID,   -- qual campeonato abrir
  ADD COLUMN IF NOT EXISTS jogo_id        TEXT,   -- a linha do jogo, se tiver
  ADD COLUMN IF NOT EXISTS jogo_camp      TEXT,   -- "Brasileirão 26", vira BR26
  ADD COLUMN IF NOT EXISTS jogo_data      TEXT,   -- como o Controle escreve
  ADD COLUMN IF NOT EXISTS jogo_mandante  TEXT,
  ADD COLUMN IF NOT EXISTS jogo_visitante TEXT;

-- As políticas de acesso valem para a tabela inteira, então coluna nova já
-- entra nelas: qualquer pessoa autenticada lê, e escrever exige
-- public.portal_pode_editar(). Não há nada a fazer aqui.
