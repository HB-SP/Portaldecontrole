-- ============================================================
-- LIGA A PESSOA DO TIME AO NOME QUE ELA USA NAS ESCALAS DOS JOGOS
--
-- Na grade de folgas a pessoa é "Flávio". Nas escalas dos jogos
-- ela aparece como "Flavio Barbosa" — e existe também um "Flávio
-- Melo", que é outra pessoa. Casar por nome erraria em três
-- casos (Flávio, Lucas e Rafa), e errar aqui significa mostrar
-- na folga de alguém um jogo que é de outra pessoa.
--
-- Então o vínculo é DECLARADO, uma vez, e vale para sempre.
-- Uma pessoa pode ter vários nomes: a mesma gente aparece como
-- "Bruno Gatti", "Bruno Gatti (H)" e "Bruno Gatti - Record".
-- Guardamos a forma base; as variações são normalizadas na
-- leitura.
--
-- Quem não trabalha nos jogos (a turma de operação) fica com o
-- campo vazio, e simplesmente não recebe jogo nenhum.
--
-- Pode ser rodado de novo sem estragar nada.
-- ============================================================

ALTER TABLE folgas_pessoas
  ADD COLUMN IF NOT EXISTS nomes_escala TEXT[];

COMMENT ON COLUMN folgas_pessoas.nomes_escala IS
  'Nomes com que esta pessoa aparece nas escalas dos jogos (escala_geral e as colunas de Pessoal do Controle). Vazio = não entra em escala de jogo.';
