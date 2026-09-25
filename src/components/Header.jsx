import { useState, useEffect, useRef } from 'react'
import PresencaBar from './PresencaBar'
import HistoricoAlteracoes from './HistoricoAlteracoes'
import LiveClock from './LiveClock'

// Header enxuto: presença + ação principal (Novo Jogo) sempre visíveis; a
// navegação (Início, Escalar, Folgas, Fornecedores, Links, Usuários, Sair) vive
// no menu ☰. A preferência "menu fixo aberto" fica no navegador.
// `titulo` e `relogio` são usados pela tela inicial: antes viviam numa faixa
// própria dentro dela ("PORTAL DE CONTROLE / Host Broadcast" + hora), que
// gastava uma linha inteira da página para dizer pouco. Subiram para cá.
export default function Header({ activeView, onHomeClick, onFornecedoresClick, onEscalarClick, onFolgasClick, onCampeonatosClick, onLinksClick, onUsuariosClick, onSair, onNewCompetition, onNewJogo, accentColor, user, userNome, viewLabel, titulo, relogio }) {
  const [expandido, setExpandido] = useState(() => {
    try { return localStorage.getItem('header_expandido') === '1' } catch { return false }
  })
  const [menuAberto, setMenuAberto] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const menuRef = useRef(null)

  const alternarExpandido = () => {
    setExpandido(e => {
      const novo = !e
      try { localStorage.setItem('header_expandido', novo ? '1' : '0') } catch { /* sem storage */ }
      return novo
    })
    setMenuAberto(false)
  }

  useEffect(() => {
    if (!menuAberto) return
    const fechar = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [menuAberto])

  const ITENS = [
    { key: 'home', label: 'Início', onClick: onHomeClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M6 15V9h4v6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ) },
    { key: 'escalar', label: 'Escalar', onClick: onEscalarClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ) },
    { key: 'folgas', label: 'Folgas e presença', onClick: onFolgasClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="6" cy="9.5" r="1" fill="currentColor"/>
        <circle cx="10" cy="11.5" r="1" fill="currentColor"/>
      </svg>
    ) },
    onCampeonatosClick && { key: 'campeonatos', label: 'Campeonatos', onClick: onCampeonatosClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M4.5 2h7v4a3.5 3.5 0 01-7 0V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M4.5 3H2.5v1a2.5 2.5 0 002.5 2.5M11.5 3h2v1A2.5 2.5 0 0111 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M8 9.5V12M5.5 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ) },
    { key: 'fornecedores', label: 'Fornecedores', onClick: onFornecedoresClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ) },
    onLinksClick && { key: 'links', label: 'Links', onClick: onLinksClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6.5 9.5a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.2l-1 1M9.5 6.5a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.2l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ) },
    onUsuariosClick && { key: 'usuarios', label: 'Usuários', onClick: onUsuariosClick, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2.8 13.5c.7-2.4 2.8-3.7 5.2-3.7s4.5 1.3 5.2 3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ) },
    user && { key: 'historico', label: 'Histórico de alterações', onClick: () => setHistoricoAberto(true), icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M8 4.5V8l2.5 1.5M14 8A6 6 0 112.6 5.5M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) },
    onSair && { key: 'sair', label: 'Sair', onClick: onSair, icon: (
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 2H3.5A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) },
  ].filter(Boolean)

  const botaoNav = it => (
    <button key={it.key}
      className={`header-nav-btn${activeView === it.key ? ' header-nav-active' : ''}`}
      onClick={() => { setMenuAberto(false); it.onClick() }}>
      {it.icon}
      {it.label}
    </button>
  )

  return (
    <header className="header">
      <div className="logo-area" onClick={onHomeClick} style={{ cursor: 'pointer' }} title="Início">
        {/* A marca de verdade, no lugar do quadrado preto com o ponto verde que
            fazia as vezes dela. O destaque que o quadrado ganhava quando a tela
            era a inicial saiu junto: pintar o fundo de verde por trás de uma
            logo transparente viraria uma placa. Qual tela está aberta o menu já
            diz (equipe, 25/09/2026). */}
        {/* Só a logo. O "Livemode / Portal de Controle" escrito ao lado dela
            saiu: a logo já diz Livemode, e "Portal de Controle" aparecia duas
            vezes na mesma linha do cabeçalho — aqui e em cima de Host
            Broadcast (equipe, 25/09/2026). */}
        <img className="logo-icon" src="/livemode.png" alt="Livemode" />
      </div>

      {titulo && (
        <div className="hd-titulo">
          <span className="hd-titulo-eyebrow">Portal de Controle</span>
          <span className="hd-titulo-nome">{titulo}</span>
        </div>
      )}

      {/* A escala interna do time fica escondida no menu, e é o que a equipe
          abre todo dia. Aqui ela ganha um atalho ao lado do título, na tela
          inicial — que é por onde todo mundo entra. */}
      {titulo && onFolgasClick && (
        <button className="hd-time" onClick={onFolgasClick}
          title="Time HB — folgas, home, externas e férias da equipe">
          <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="6" cy="9.5" r="1" fill="currentColor"/>
            <circle cx="10" cy="11.5" r="1" fill="currentColor"/>
          </svg>
          Time HB
        </button>
      )}

      <div className="header-actions">
        {relogio && <LiveClock />}
        {user && <PresencaBar user={user} nome={userNome} viewLabel={viewLabel} />}

        {/* Modo expandido: todos os botões na barra (comportamento antigo) */}
        {expandido && ITENS.map(botaoNav)}

        {/* Ação principal sempre visível */}
        {onNewJogo ? (
          <button className="header-new-btn" onClick={onNewJogo} title="Novo jogo"
            style={accentColor ? { background: accentColor, borderColor: accentColor, color: '#fff' } : undefined}>
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Novo Jogo
          </button>
        ) : onNewCompetition && (
          <button className="header-new-btn" onClick={onNewCompetition} title="Novo campeonato">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Novo
          </button>
        )}

        {/* Menu ☰ (modo compacto) / recolher (modo expandido) */}
        <div className="hd-menu-wrap" ref={menuRef}>
          <button className={`header-nav-btn${menuAberto ? ' header-nav-active' : ''}`}
            title={expandido ? 'Recolher botões no menu' : 'Menu'}
            onClick={() => (expandido ? alternarExpandido() : setMenuAberto(a => !a))}>
            {expandido ? (
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
            {expandido ? 'Recolher' : 'Menu'}
          </button>

          {menuAberto && !expandido && (
            <div className="hd-menu">
              {ITENS.map(botaoNav)}
              <div className="hd-menu-sep" />
              <button className="header-nav-btn" onClick={alternarExpandido} title="Mostra todos os botões na barra">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Fixar botões na barra
              </button>
            </div>
          )}
        </div>

        {historicoAberto && <HistoricoAlteracoes onClose={() => setHistoricoAberto(false)} />}
      </div>
    </header>
  )
}
