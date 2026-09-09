// Fatia os 75 jogos do Controle em pedacos pequenos, cada um seguro de
// rodar em qualquer ordem e quantas vezes for.
//
// A guarda muda: antes era "so insere se o campeonato estiver vazio", o que
// so funciona com um arquivo unico. Agora e por JOGO — nao insere se ja
// existir linha com o mesmo rod+data+mandante+visitante. Assim cada fatia e
// independente.
import { readFileSync, writeFileSync } from 'node:fs'

const origem = process.argv[2]
const porFatia = Number(process.argv[3] || 25)

const linhas = readFileSync(origem, 'utf8').split(/\r?\n/)
const jogos = linhas.filter(l => /^ {2}\('\{.*'\),?$/.test(l))
  .map(l => l.replace(/,$/, ''))
if (jogos.length === 0) { console.error('nenhuma linha de jogo encontrada'); process.exit(1) }

const fatias = []
for (let i = 0; i < jogos.length; i += porFatia) fatias.push(jogos.slice(i, i + porFatia))

fatias.forEach((fatia, idx) => {
  const n = idx + 1
  const L = []
  L.push('-- ============================================================')
  L.push(`-- Paulistao A1 26 — jogos do Controle, fatia ${n} de ${fatias.length}`)
  L.push(`-- ${fatia.length} jogos`)
  L.push('--')
  L.push('-- Rode DEPOIS da parte1_estrutura. As fatias podem ir em qualquer')
  L.push('-- ordem e quantas vezes for: cada jogo so entra se ainda nao houver')
  L.push('-- linha com o mesmo rod + data + mandante + visitante.')
  L.push('-- ============================================================')
  L.push('')
  L.push('BEGIN;')
  L.push('')
  L.push('INSERT INTO competition_events (competition_id, data, status)')
  L.push("SELECT c.id, v.data::jsonb, NULLIF(v.status, '')")
  L.push('FROM competitions c, (VALUES')
  L.push(fatia.join(',\n'))
  L.push(') AS v(data, status)')
  L.push("WHERE c.slug = 'paulistao-a1'")
  L.push('  AND NOT EXISTS (')
  L.push('    SELECT 1 FROM competition_events e')
  L.push('    WHERE e.competition_id = c.id')
  L.push("      AND e.data->>'rod'       = (v.data::jsonb)->>'rod'")
  L.push("      AND e.data->>'data'      = (v.data::jsonb)->>'data'")
  L.push("      AND e.data->>'mandante'  = (v.data::jsonb)->>'mandante'")
  L.push("      AND e.data->>'visitante' = (v.data::jsonb)->>'visitante'")
  L.push('  );')
  L.push('')
  L.push('COMMIT;')
  L.push('')
  L.push(`-- Conferencia: apos as ${fatias.length} fatias, jogos deve ser ${jogos.length}`)
  L.push("SELECT 'jogos no Controle: ' || count(*) AS resultado")
  L.push('FROM competition_events')
  L.push("WHERE competition_id = (SELECT id FROM competitions WHERE slug = 'paulistao-a1');")

  const texto = L.join('\n')
  const nome = `supabase_paulistao_a1_jogos_${n}de${fatias.length}.sql`
  writeFileSync(nome, texto, 'utf8')
  console.log(`${nome}: ${fatia.length} jogos, ${texto.length} caracteres`)
})
console.log(`total distribuido: ${fatias.reduce((s, f) => s + f.length, 0)} jogos`)
