import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
// As regras (coluna -> função, comparação de nome) vivem em config/funcoesFornecedor.
// Reexportadas aqui para que quem já importava do hook siga funcionando.
export {
  MATCH, getApelidosForColumn, getColumnPredicate, FUNCAO_DA_COLUNA, estaCadastrado,
} from '../config/funcoesFornecedor'

// ── Assinatura ÚNICA compartilhada ────────────────────────────────────────
// O supabase-js novo (≥2.4x) reutiliza canais pelo topic: dois
// useHubFornecedores montados ao mesmo tempo (ex.: EscalaView + GameModal
// aberto por cima) chamavam .on() num canal JÁ inscrito e derrubavam o app
// ("cannot add postgres_changes callbacks after subscribe()"). Um único
// canal em nível de módulo alimenta todos os consumidores; o canal vive
// pela sessão inteira (dado usado em todo o app, não vale desligar).
let fornCache = []
let fornCarregado = false
let fornCanal = null
const fornOuvintes = new Set()

async function carregarFornecedores() {
  const { data } = await supabase
    .from('app_state')
    .select('value')
    .eq('key', 'fornecedores')
    .single()
  fornCache = Array.isArray(data?.value) ? data.value : []
  fornCarregado = true
  fornOuvintes.forEach(fn => fn())
}

function garantirCanalFornecedores() {
  if (fornCanal || !isConfigured) return
  fornCanal = supabase
    .channel('hub_fornecedores')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.fornecedores' },
      carregarFornecedores,
    )
    .subscribe()
  carregarFornecedores()
}

export function useHubFornecedores() {
  const [fornecedores, setFornecedores] = useState(fornCache)
  const [loading, setLoading] = useState(isConfigured && !fornCarregado)

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    const ouvinte = () => { setFornecedores(fornCache); setLoading(false) }
    fornOuvintes.add(ouvinte)
    garantirCanalFornecedores()
    if (fornCarregado) ouvinte()
    return () => { fornOuvintes.delete(ouvinte) }
  }, [])

  return { fornecedores, loading }
}

// Cadastro rápido na base COMPARTILHADA (app_state.fornecedores do Hub) via
// RPC atômico portal_cadastrar_fornecedor: o append acontece no banco com lock
// de linha, sem read-modify-write do array inteiro (que perdia edições
// concorrentes do Hub). Se o apelido já existir (normalizado), o RPC devolve
// o existente sem duplicar.
export async function cadastrarFornecedor({ apelido, funcao, tipo }) {
  const nome = String(apelido || '').trim()
  if (!nome) throw new Error('Apelido vazio')
  const novo = {
    id: Date.now(), apelido: nome, razaoSocial: '', cnpj: '',
    funcao: String(funcao || '').trim(), area: 'Operações',
    tipo: tipo === 'Fornecedor' ? 'Fornecedor' : 'Prestador',
    nome: '', telefone: '', email: '', cpf: '', rg: '',
    origem: 'portal-quick-add',
  }
  const { data, error } = await supabase.rpc('portal_cadastrar_fornecedor', { novo })
  if (error) throw error
  return data || novo
}
