# Ordem de execução dos arquivos `.sql`

Leia isto **antes** de rodar qualquer `.sql` deste repositório no Supabase.

Nenhum desses arquivos roda sozinho. Não há migração automática, não há CI, o
deploy da Vercel não os executa. Eles só rodam quando alguém abre o SQL Editor
do Supabase e cola o conteúdo à mão. Ou seja: o estrago só acontece por ação
humana — e é justamente por isso que a ordem precisa estar escrita.

## A regra de ouro

> **O `supabase_seguranca.sql` é sempre o último.**

Ele é quem define quem pode ver e editar cada tabela. Os arquivos de criação
montam a estrutura; sem o `seguranca.sql` rodado depois, o banco fica fechado
(ninguém entra) — que é o lado seguro de errar.

## Ordem completa, num banco novo

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `supabase_setup.sql` | Cria as 5 tabelas antigas (Brasileirão, Paulistão Fem., periféricos, NBA) |
| 2 | `supabase_phase1.sql` | Cria o modelo dinâmico (`competitions`, `competition_columns`, `competition_events`, `dropdown_options`) |
| 3 | `supabase_escala_geral.sql` | Cria a tabela da Escala Geral |
| 4 | `supabase_link_hub.sql` | Adiciona `hub_jogo_id` (elo com o Hub Financeiro) |
| 5 | **`supabase_seguranca.sql`** | **Liga as travas.** Cria `portal_profiles`, as funções de permissão e as policies |
| 6 | `supabase_links_externos.sql` | Links dos prestadores + os dois RPCs públicos |
| 7 | `supabase_escala_publicada.sql` | Coluna `escala_publicada` e a versão final do RPC do prestador |
| 8 | `supabase_atividades.sql` | Histórico de "quem alterou o quê" |
| — | `supabase_cadastrar_fornecedor.sql`, `supabase_renomear_fornecedor.sql` | Utilitários, rode quando precisar |
| — | `supabase_paulistao_a1_perifericos.sql` | Importa o histórico de periféricos do Paulistão A1 26 (74 jogos). Cria o campeonato pelo modelo dinâmico; não toca em nenhuma tabela existente e pode ser rodado de novo sem duplicar. Gerado por `scripts/gerar_import_a1_perifericos.mjs`, conferido por `scripts/conferir_import_a1_perifericos.mjs` |
| — | `supabase_escala_camps.sql` | Liga cada campeonato aos nomes que ele usa na Escala Geral (`competitions.escala_camps`). Sem isso, ligar campeonato novo exigia editar `src/lib/escalaLink.js` e publicar o site. Seguro rodar antes ou depois do deploy |
| — | `supabase_paulistao_a1_controle.sql` | Importa a parte operacional do Paulistão A1 26 (75 jogos, 49 colunas) e reorganiza o campeonato em duas abas — Controle e Periférico — como o Brasileirão. Gerado/conferido por `scripts/*_import_a1_controle.mjs`. Rodar DEPOIS de `supabase_paulistao_a1_perifericos.sql` |

Depois de terminar, confirme com:

```bash
node scripts/verificar_rls_portal.mjs
```

⚠ Esse verificador testa a trava de escrita **tentando escrever de verdade**.
Se alguma tabela estiver destrancada, ele deixa uma linha vazia de lixo lá
dentro. Num banco de produção saudável isso nunca acontece (a escrita é
recusada), mas saiba disso antes de rodar.

## A armadilha que existia até 09/2026

Os arquivos 1, 2 e 3 terminavam cada tabela com:

```sql
ALTER TABLE <tabela> DISABLE ROW LEVEL SECURITY;
```

Herança de quando o Portal não tinha login nenhum. As tabelas eram criadas com
`IF NOT EXISTS` — mas esse `DISABLE` **não** tinha proteção: rodava sempre.

Consequência: re-rodar qualquer um daqueles três arquivos num banco já em
produção — para consertar uma tabela, para recriar uma coluna, por qualquer
motivo — **destrancava o banco inteiro**. A chave `anon` fica pública no bundle
do site (qualquer um lê no navegador), então o efeito era expor a escala
completa, com nomes, telefones dos supervisores e os valores `$` da Escala
Geral, para leitura, edição e exclusão por qualquer pessoa na internet.

E não havia nada escrito avisando disso.

**Hoje isso foi invertido:** aqueles comandos viraram `ENABLE ROW LEVEL
SECURITY`. Os arquivos agora falham para o lado seguro — rodar por engano
fecha demais o acesso (o Portal para de mostrar dados até o `seguranca.sql`
rodar de novo), nunca abre. Perda de acesso é chato; vazamento não tem volta.

## O que ainda falta (não resolvido)

O schema versionado aqui está **atrás** do banco real. Pelo menos duas peças
foram criadas direto no Supabase e nunca salvas neste repositório:

- **`public.norm_ddmm()`** — função usada pelo `supabase_escala_publicada.sql`
  (linha 21). O comentário diz "criada no matcher", mas ela não existe em
  nenhum `.sql` daqui.
- **`escala_geral.obs`** — coluna lida pelo RPC `escala_do_prestador`
  (`supabase_links_externos.sql:50`), que nenhum arquivo daqui cria.

Enquanto isso não for corrigido, **não é possível recriar o banco do zero
seguindo só estes arquivos** — a sequência acima quebra no passo 7. Na prática
vocês dependem do backup do Supabase, não do repositório.

Para resolver: extrair o schema real do banco (`pg_dump --schema-only`) e
comparar com o que está versionado aqui.
