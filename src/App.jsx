import { useState, useMemo, useEffect } from 'react'
import Header from './components/Header'
import TablePage from './components/TablePage'
import JogosOverview from './components/JogosOverview'
import HomeView from './components/HomeView'
import FornecedoresPage from './components/FornecedoresPage'
import EscalaGeralView from './components/EscalaGeralView'
import EscalarView from './components/EscalarView'
import NewCompetitionDialog from './components/NewCompetitionDialog'
import LoginGate, { PendentePortal } from './components/LoginGate'
import UsuariosPortal from './components/UsuariosPortal'
import LinksExternosView from './components/LinksExternosView'
import EscalaPrestador from './components/EscalaPrestador'
import { supabase, isConfigured } from './lib/supabase'
import { useCompetitions } from './hooks/useCompetitions'

// Garante o perfil do Portal (nasce 'pendente'; admin aprova depois).
// Também cobre quem já tem conta do Hub: primeiro login aqui = pendente.
async function ensurePortalProfile(user) {
  const { data } = await supabase.from('portal_profiles').select('role').eq('id', user.id).maybeSingle()
  if (data) return data.role
  const nome = user.user_metadata?.nome || user.user_metadata?.full_name || ''
  const { error } = await supabase.from('portal_profiles').insert([{ id: user.id, nome, email: user.email, role: 'pendente' }])
  if (error && error.code !== '23505') console.warn('[auth] falha ao criar portal_profile:', error.message)
  return 'pendente'
}

function cleanComp(label) {
  if (!label) return ''
  const s = String(label)
  if (/paulist[aã]/i.test(s) && /fem/i.test(s)) return 'Paulistão F'
  return s.replace(/\s+(\d{2})$/, (_, yr) => ` 20${yr}`).trim()
}

export default function App() {
  const { competitions, loading: compsLoading, error: compsError } = useCompetitions()
  const [activeView,    setActiveView]    = useState('home')
  const [activeComp,    setActiveComp]    = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  // Pedido de novo jogo vindo do header; a página da seção consome e abre o modal
  const [novoJogoPedido, setNovoJogoPedido] = useState(false)

  // ── Autenticação (Fase 1 de segurança) ────────────────────────────────────
  const [user, setUser] = useState(null)
  const [portalRole, setPortalRole] = useState(null)
  const [authLoading, setAuthLoading] = useState(isConfigured)

  useEffect(() => {
    if (!isConfigured) return
    let mounted = true
    // IMPORTANTE: nenhuma chamada supabase DIRETO dentro do callback — o client
    // segura um lock de auth enquanto ele roda e a query espera o mesmo lock
    // (deadlock que travou o Hub em 08/2026). setTimeout(0) solta o lock antes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session?.user) {
        const u = session.user
        if (u.app_metadata?.provider === 'google' && !u.email?.endsWith('@livemode.com')) {
          setTimeout(() => supabase.auth.signOut(), 0)
          setUser(null); setPortalRole(null); setAuthLoading(false)
          return
        }
        setUser(u)
        setAuthLoading(false)
        setTimeout(async () => {
          // Falha transitória de rede não pode rebaixar quem já estava aprovado:
          // mantém o papel anterior; só cai em 'pendente' se nunca houve papel.
          const role = await ensurePortalProfile(u).catch(() => null)
          if (mounted) setPortalRole(prev => role ?? prev ?? 'pendente')
        }, 0)
      } else {
        setUser(null); setPortalRole(null); setAuthLoading(false)
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const sair = () => supabase.auth.signOut()
  const userNome = user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''

  // Hash reativo: sem isso, abrir/mudar #escala/<token> numa aba já carregada
  // não troca a página (o hash só era lido na primeira renderização).
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (competitions.length === 0) return
    const stillExists = competitions.find(c => c.id === activeComp)
    if (!activeComp || !stillExists) {
      const first = competitions[0]
      setActiveComp(first.id)
      setActiveSection(first.sections[0]?.id || null)
    }
  }, [competitions, activeComp])

  const competition = useMemo(
    () => competitions.find(c => c.id === activeComp),
    [competitions, activeComp]
  )
  const section = competition?.sections.find(s => s.id === activeSection) || competition?.sections[0]

  // `jogoAlvo` vem do "Ficha →" da tela inicial: entrar no campeonato e cair
  // no JOGO, não só na aba. Guardado no App porque quem navega é ele; a Visão
  // Geral só o consome para rolar até o card e abri-lo.
  const [jogoAlvo, setJogoAlvo] = useState(null)

  function handleCompSelect(compId, alvo = null) {
    setActiveComp(compId)
    const comp = competitions.find(c => c.id === compId)
    setActiveSection(comp?.sections[0]?.id || null)
    setJogoAlvo(alvo)
    setActiveView('comp')
  }

  function handleHomeClick() {
    setActiveView('home')
  }

  function handleFornecedoresClick() {
    setActiveView('fornecedores')
  }

  // ── Rota PÚBLICA por hash: escala do prestador (token é a chave) ───────────
  const escalaMatch = hash.match(/^#escala\/([0-9a-fA-F-]{36})$/)
  if (escalaMatch) return <EscalaPrestador token={escalaMatch[1]} />

  // ── Gate de autenticação (antes de qualquer tela interna) ─────────────────
  if (isConfigured) {
    if (authLoading) {
      return (
        <div className="bootstrap-loader">
          <div className="skeleton-cell" style={{ width: 200, height: 14 }} />
        </div>
      )
    }
    if (!user) return <LoginGate />
    if (portalRole === null) {
      return (
        <div className="bootstrap-loader">
          <div className="skeleton-cell" style={{ width: 200, height: 14 }} />
        </div>
      )
    }
    if (portalRole === 'pendente') return <PendentePortal email={user.email} onSair={sair} />
  }

  if (compsLoading && competitions.length === 0) {
    return (
      <div className="bootstrap-loader">
        <div className="skeleton-cell" style={{ width: 200, height: 14 }} />
      </div>
    )
  }

  // Só derruba para a tela de erro se nada carregou; com campeonatos em tela,
  // uma falha transitória do reload (realtime) não pode apagar o app inteiro.
  if (compsError && competitions.length === 0) {
    return (
      <div className="bootstrap-error">
        <div className="bootstrap-error-title">Erro ao carregar campeonatos</div>
        <div className="bootstrap-error-desc">{compsError}</div>
      </div>
    )
  }

  if (activeView === 'links') {
    return (
      <div className="app">
        <Header
          activeView="links"
          user={user} userNome={userNome} viewLabel={'Links externos'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Links externos</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Cada prestador/empresa recebe um link com a própria escala e confirma presença por ele</div>
          </div>
          <LinksExternosView />
        </main>
      </div>
    )
  }

  if (activeView === 'usuarios' && portalRole === 'admin') {
    return (
      <div className="app">
        <Header
          activeView="usuarios"
          user={user} userNome={userNome} viewLabel={'Usuários'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Usuários do Portal</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Aprove cadastros e gerencie papéis de acesso</div>
          </div>
          <UsuariosPortal meuId={user?.id} />
        </main>
      </div>
    )
  }

  if (activeView === 'escalar') {
    return (
      <div className="app">
        <Header
          activeView="escalar"
          user={user} userNome={userNome} viewLabel={'Escalar'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Escalar</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Todos os campeonatos, um jogo por linha — pessoal, operações e periféricos no mesmo lugar.{' '}
              <button className="escalar-link" onClick={() => setActiveView('escala-geral')}>
                ver a Escala Geral em cards (valores e confirmação de presença)
              </button>
            </div>
          </div>
          <EscalarView competitions={competitions} />
        </main>
      </div>
    )
  }

  if (activeView === 'escala-geral') {
    return (
      <div className="app">
        <Header
          activeView="escala-geral"
          user={user} userNome={userNome} viewLabel={'Escala Geral'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Escala Geral</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Coordenador UM, Produtor UM, Produtor de Campo e Monitoração — todos os campeonatos</div>
          </div>
          <EscalaGeralView />
        </main>
      </div>
    )
  }

  if (activeView === 'fornecedores') {
    return (
      <div className="app">
        <Header
          activeView="fornecedores"
          user={user} userNome={userNome} viewLabel={'Fornecedores'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Fornecedores</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Base de fornecedores do Hub Financeiro</div>
          </div>
          <FornecedoresPage />
        </main>
      </div>
    )
  }

  // Home view — available even without a selected competition
  if (activeView === 'home') {
    return (
      <div className="app">
        <Header
          activeView="home"
          user={user} userNome={userNome} viewLabel={'Início'}
          titulo="Host Broadcast" relogio
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content main-content--home">
          <HomeView competitions={competitions} onCompSelect={handleCompSelect} />
        </main>
        {showNewDialog && (
          <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
        )}
      </div>
    )
  }

  if (!competition || !section) {
    return (
      <div className="app">
        <Header
          activeView="comp"
          user={user} userNome={userNome} viewLabel={'Portal'}
          onHomeClick={handleHomeClick}
          onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
          onNewCompetition={() => setShowNewDialog(true)}
        />
        <main className="main-content" style={{ paddingTop: 84 }}>
          <div className="empty-state-pro">
            <div className="empty-state-pro-icon">·</div>
            <div className="empty-state-pro-title">Nenhum campeonato cadastrado</div>
            <div className="empty-state-pro-desc">
              Crie o primeiro campeonato para começar.
            </div>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewDialog(true)}>
              Novo campeonato
            </button>
          </div>
        </main>
        {showNewDialog && (
          <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
        )}
      </div>
    )
  }

  const secaoTemJogos = section && !section.isOverview && !section.isEscalar
  const secaoJogosPadrao = competition.sections.find(s => !s.isOverview && !s.isEscalar)

  // Botão do header em QUALQUER aba: se a aba atual não tem cadastro de jogo
  // (a Visão Geral), pula para a primeira que tem e abre o modal lá.
  const handleNovoJogo = secaoJogosPadrao ? () => {
    if (!secaoTemJogos) setActiveSection(secaoJogosPadrao.id)
    setNovoJogoPedido(true)
  } : undefined

  return (
    <div className="app">
      <Header
        activeView="comp"
          user={user} userNome={userNome} viewLabel={cleanComp(competition.label)}
        onHomeClick={handleHomeClick}
        onFornecedoresClick={handleFornecedoresClick}
          onEscalarClick={() => setActiveView('escalar')}
          onLinksClick={() => setActiveView('links')}
          onUsuariosClick={portalRole === 'admin' ? () => setActiveView('usuarios') : undefined}
          onSair={isConfigured ? sair : undefined}
        onNewCompetition={() => setShowNewDialog(true)}
        onNewJogo={handleNovoJogo}
        accentColor={competition.accentColor}
      />

      <div className="sub-tabs-bar">
        <div className="sub-tabs-comp" style={{ '--ac': competition.accentColor }}>
          <span className="sub-tabs-comp-dot" style={{ background: competition.accentColor }} />
          <span className="sub-tabs-comp-name">
            {cleanComp(competition.label)}
          </span>
        </div>
        <div className="sub-tabs-sep" />
        {competition.sections.map(s => {
          const isActive = s.id === activeSection
          return (
            <button
              key={s.id}
              className={`sub-tab${isActive ? ' active' : ''}`}
              style={isActive ? { borderBottomColor: competition.accentColor, color: '#000' } : {}}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <main className="main-content">
        {section.isOverview ? (
          <JogosOverview key={section.id} config={section.config} accentColor={section.config.accentColor}
            jogoAlvo={jogoAlvo} />
        ) : section.isEscalar ? (
          <EscalarView key={section.id} competitions={competitions} compFixa={competition.id} />
        ) : (
          <TablePage key={section.id} config={section.config}
            novoJogoPedido={novoJogoPedido} onNovoJogoConsumido={() => setNovoJogoPedido(false)} />
        )}
      </main>

      {showNewDialog && (
        <NewCompetitionDialog onClose={() => setShowNewDialog(false)} />
      )}
    </div>
  )
}
