import { useEffect, useMemo, useState } from 'react'
import CodeInput, { CODE_LEN } from './CodeInput.jsx'
import TeamBadge from './TeamBadge.jsx'

const JOIN_STATE = {
  idle: '> GABUNG',
  connecting: '> MENGHUBUNGKAN...',
  connected: '> TERHUBUNG',
}

export default function App() {
  const [teamName, setTeamName] = useState('')
  const [code, setCode] = useState('')
  const [joinState, setJoinState] = useState('idle')
  const [clock, setClock] = useState('--:--')

  const nameOk = teamName.trim().length > 0
  const codeOk = code.length === CODE_LEN
  const canJoin = nameOk && codeOk
  const showToast = useMemo(() => canJoin && joinState === 'idle', [canJoin, joinState])

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      setClock(`${hh}:${mm}`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const handleJoin = () => {
    if (!canJoin || joinState !== 'idle') return
    setJoinState('connecting')
    setTimeout(() => setJoinState('connected'), 900)
  }

  return (
    <div className="device">
      <div className="device-label">CERDAS CERMAT ONLINE — HANDHELD ED.</div>
      <div className="screen">
        <div className="titlebar">
          <span>GABUNG_SESI.EXE</span>
          <div className="dots">
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>

        <div className="content">
          <p className="eyebrow">// masuk arena</p>
          <h1>GABUNG SESI CERDAS CERMAT</h1>

          <TeamBadge teamName={teamName} />

          <div className="field">
            <label htmlFor="teamName">NAMA TIM</label>
            <input
              type="text"
              id="teamName"
              placeholder="cth. Elang Merah"
              maxLength={20}
              autoComplete="off"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>KODE SESI</label>
            <CodeInput value={code} onChange={setCode} />
            <div className="hint">
              {canJoin ? 'kode oke, tinggal gabung.' : 'masukkan 6 karakter kode dari gurumu'}
            </div>
          </div>

          <button className="join" disabled={!canJoin || joinState !== 'idle'} onClick={handleJoin}>
            {JOIN_STATE[joinState]}
          </button>

          <div className={`toast${showToast ? ' show' : ''}`}>
            <div className="t-close" onClick={() => setCode('')}>X</div>
            <div className="t-title">TIM SIAP!</div>
            <div className="t-body">Kode sesi lengkap. Kamu tinggal tekan GABUNG untuk masuk arena.</div>
          </div>
        </div>

        <div className="statusbar">
          <span>● ROOM</span>
          <span className="rt">{clock}</span>
        </div>
      </div>
    </div>
  )
}
