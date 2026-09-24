// ─── RODA UM ARQUIVO .SQL NO BANCO ───────────────────────────────────────────
// A service key fala com o banco pelo PostgREST, que lê e grava DADOS mas não
// muda ESTRUTURA: criar coluna, tabela ou gatilho precisa de conexão direta ao
// Postgres. Sem isso, toda mudança de schema dependia de alguém abrir o SQL
// Editor do Supabase e colar à mão — e é por isso que o desenho do banco nunca
// ficou versionado.
//
// A senha NÃO entra por argumento: fica em .env.local, que o Git ignora.
// Argumento de linha de comando aparece na lista de processos da máquina.
//
//   .env.local:
//     DATABASE_URL=postgresql://postgres:SENHA@db.<projeto>.supabase.co:5432/postgres
//
// Uso:
//   node scripts/sql.mjs supabase_folgas_jogo.sql          # mostra o que vai rodar
//   node scripts/sql.mjs supabase_folgas_jogo.sql --rodar
//   node scripts/sql.mjs --teste                           # só confere a conexão

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env.local', 'utf8').split(/\r?\n/)
const valorDe = chave => {
  const linha = env.find(l => l.startsWith(`${chave}=`))
  return linha ? linha.slice(chave.length + 1).trim() : ''
}

const URL = valorDe('DATABASE_URL')
if (!URL) {
  console.error(`Falta DATABASE_URL em .env.local.

  Pegue em: Supabase → Settings → Database → Connection string (URI)
  e troque [YOUR-PASSWORD] pela senha do banco.

  Se a conexão direta não funcionar na sua rede, use a do POOLER, que o
  Supabase mostra na mesma tela — ela atende por IPv4.`)
  process.exit(1)
}
if (/\[YOUR-PASSWORD\]|\[SENHA\]/i.test(URL)) {
  console.error('A DATABASE_URL ainda está com o [YOUR-PASSWORD] no lugar da senha.')
  process.exit(1)
}

const arquivo = process.argv.slice(2).find(a => !a.startsWith('--'))
const RODAR = process.argv.includes('--rodar')
const TESTE = process.argv.includes('--teste')

const cliente = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })

try {
  await cliente.connect()
  const { rows } = await cliente.query('SELECT current_database() AS banco, version() AS v')
  console.log(`conectado: ${rows[0].banco} · ${rows[0].v.split(',')[0]}`)
  if (TESTE || !arquivo) { await cliente.end(); process.exit(0) }

  const sql = readFileSync(arquivo, 'utf8')
  const linhas = sql.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--'))
  console.log(`\n${arquivo}: ${linhas.length} linhas de comando`)

  if (!RODAR) {
    console.log('\n(simulação — passe --rodar para executar)')
    await cliente.end()
    process.exit(0)
  }

  // Tudo dentro de UMA transação: se um comando falhar, nada fica pela metade.
  // Um schema meio aplicado é pior que um schema não aplicado — o código passa
  // a encontrar metade do que espera, e o erro aparece longe da causa.
  await cliente.query('BEGIN')
  try {
    await cliente.query(sql)
    await cliente.query('COMMIT')
    console.log('rodou, e a transação foi confirmada.')
  } catch (e) {
    await cliente.query('ROLLBACK')
    console.error(`\nFALHOU — nada foi aplicado:\n  ${e.message}`)
    if (e.position) console.error(`  perto de: ...${sql.slice(Math.max(0, e.position - 60), Number(e.position) + 60)}...`)
    process.exitCode = 1
  }
} catch (e) {
  console.error(`não deu para conectar: ${e.message}`)
  if (/ENOTFOUND|ETIMEDOUT|ENETUNREACH/.test(e.message)) {
    console.error(`
  O host direto do Supabase só responde por IPv6. Se a sua rede é IPv4,
  use a string do POOLER (Settings → Database → Connection pooling),
  que tem "pooler.supabase.com" no meio.`)
  }
  process.exitCode = 1
} finally {
  await cliente.end().catch(() => {})
}
