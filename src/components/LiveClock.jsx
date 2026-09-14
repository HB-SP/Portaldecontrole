import { useState, useEffect } from 'react'

// Relógio do cabeçalho. Morava na HomeView, dentro de uma faixa própria que
// gastava uma linha inteira da tela inicial só para dizer o título e a hora —
// subiu para o cabeçalho junto com o "Host Broadcast".
export default function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return (
    <div className="hv-clock" title="Horário de Brasília">
      <span className="hv-clock-hm">{hh}:{mm}</span>
      <span className="hv-clock-ss">{ss}</span>
      <span className="hv-clock-tz">BRT</span>
    </div>
  )
}
