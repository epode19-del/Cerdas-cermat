export default function TeamBadge({ teamName }) {
  const trimmed = teamName.trim()

  return (
    <div className="badge-panel">
      <div className="avatar">{trimmed ? trimmed[0].toUpperCase() : '?'}</div>
      <div className="badge-text">
        <div className="label">TIM KAMU</div>
        <div className="name">{trimmed || 'belum ada nama'}</div>
      </div>
    </div>
  )
}
