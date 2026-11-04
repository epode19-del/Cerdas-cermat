"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { VT323, Press_Start_2P } from "next/font/google";
import { getSocket } from "@/lib/socket";
import { PublicMatchState } from "@/lib/matchSocket";
import { MediaBlock } from "@/components/MediaBlock";
import { QrCode } from "@/components/QrCode";

/**
 * Layar proyektor peserta — tema "boss battle" pixel-art, diadaptasi dari
 * BossBattleQuiz.jsx (referensi desain) tapi digerakkan oleh data realtime
 * asli (match:public-state via socket), bukan data dummy.
 *
 * Pemetaan konsep boss-battle -> data asli:
 *  - HP boss           = sisa soal (state.totalQuestions - state.currentIndex)
 *  - "boss kena damage" = ada tim yang barusan JAWAB BENAR (lastOutcome === "correct")
 *  - "tim diserang"     = ada tim yang barusan SALAH/timeout & skornya berkurang
 *  - skip toast         = event match:question-skipped (sama seperti sebelumnya)
 *  - defeat overlay      = phase "ended" -> podium juara
 *
 * Video boss di arena (panel besar) berpindah src sesuai bossMode:
 *  - idle    -> video loop terus-menerus (kondisi normal)
 *  - attack  -> main sekali (tidak loop) saat ada tim yang salah jawab,
 *               lalu otomatis balik ke idle begitu video ini selesai (onEnded)
 *  - correct -> main sekali (tidak loop) saat ada tim yang jawab benar
 *               (boss "diserang balik"), lalu otomatis balik ke idle juga
 */

// Aset boss.
const BOSS_IDLE_SRC = "/boss/idle.mp4";
const BOSS_ATTACK_SRC = "/boss/attack.mp4";
const BOSS_CORRECT_SRC = "/boss/correct.mp4";

const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323" });
const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-press" });

const OUTCOME_LABEL: Record<string, { text: string; color: string }> = {
  correct: { text: "✓ BENAR", color: "var(--agree)" },
  wrong: { text: "✗ SALAH", color: "var(--hp-full)" },
  timeout: { text: "⏱ WAKTU HABIS", color: "var(--hp-mid)" },
};

type Floating = { id: number; target: string; text: string; penalty: boolean; offset: number };

let floatId = 0;
let audioCtx: AudioContext | null = null;

function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playHitSfx() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);
  } catch {
    /* audio not available */
  }
}

function playHurtSfx() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    gain2.gain.setValueAtTime(0.2, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.3);
  } catch {
    /* audio not available */
  }
}

export default function DisplayPage() {
  const params = useParams<{ matchCode: string }>();
  const matchCode = params.matchCode;

  const [state, setState] = useState<PublicMatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState(0);
  /** URL "gabung sesi" buat QR di layar lobby — dihitung di client (butuh window.location), null saat SSR. */
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const [skipToast, setSkipToast] = useState({ show: false, text: "" });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const [flashKey, setFlashKey] = useState(0);
  const [bossShakeKey, setBossShakeKey] = useState(0);
  const [bossMode, setBossMode] = useState<"idle" | "attack" | "correct">("idle");
  const [memberShake, setMemberShake] = useState<string | null>(null);
  const [floating, setFloating] = useState<Floating[]>([]);

  const prevScoresRef = useRef<Record<string, number>>({});
  const processedRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/gabung?code=${matchCode}`);
  }, [matchCode]);

  useEffect(() => {
    const socket = getSocket();

    function onState(s: PublicMatchState) {
      setState(s);
    }
    function onSkipped() {
      showSkipToast("Tim setuju skip — soal ini dilewati");
    }
    function onCardToast(t: { text: string }) {
      showSkipToast(t.text);
    }
    socket.on("match:public-state", onState);
    socket.on("match:question-skipped", onSkipped);
    socket.on("match:toast", onCardToast);

    socket.emit(
      "display:join-match",
      { matchCode },
      (res: { ok: boolean; state?: PublicMatchState; message?: string }) => {
        if (res.ok && res.state) setState(res.state);
        else setError(res.message ?? "Sesi tidak ditemukan.");
      }
    );

    return () => {
      socket.off("match:public-state", onState);
      socket.off("match:question-skipped", onSkipped);
      socket.off("match:toast", onCardToast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCode]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const showSkipToast = (text: string) => {
    setSkipToast({ show: true, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSkipToast((s) => ({ ...s, show: false })), 2400);
  };

  const spawnFloating = (target: string, text: string, penalty: boolean) => {
    const id = ++floatId;
    setFloating((f) => [...f, { id, target, text, penalty, offset: Math.round((Math.random() - 0.5) * 30) }]);
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== id)), 1000);
  };

  // "attack" dan "correct" sekarang sama-sama punya video sungguhan yang
  // normalnya berhenti sendiri lewat onEnded di bawah — timeout di sini cuma
  // jaring pengaman kalau video gagal memicu onEnded (misalnya arena lagi
  // menampilkan media soal, bukan video boss).
  const setBossModeTimed = (mode: "attack" | "correct") => {
    setBossMode(mode);
    if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
    bossTimerRef.current = setTimeout(() => setBossMode("idle"), 3200);
  };

  // Video attack/correct di arena tidak di-loop; begitu selesai main, balik ke idle.
  const handleArenaVideoEnded = () => {
    if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
    setBossMode("idle");
  };

  const bossVideoSrc = (mode: "idle" | "attack" | "correct") =>
    mode === "attack" ? BOSS_ATTACK_SRC : mode === "correct" ? BOSS_CORRECT_SRC : BOSS_IDLE_SRC;

  // Deteksi "soal barusan dijawab" dari perubahan phase/lastOutcome/skor asli,
  // lalu picu animasi boss-battle yang sesuai.
  useEffect(() => {
    if (!state) return;
    const signature = `${state.currentIndex}-${state.phase}-${state.lastOutcome ?? "-"}`;

    if (state.phase === "revealed" && state.lastOutcome && processedRef.current !== signature) {
      processedRef.current = signature;

      const prevScores = prevScoresRef.current;
      const buzzedTeam = state.teams.find((t) => t.id === state.buzzedTeamId) ?? null;
      const diff = buzzedTeam ? buzzedTeam.score - (prevScores[buzzedTeam.id] ?? buzzedTeam.score) : 0;

      if (state.lastOutcome === "correct") {
        setFlashKey((k) => k + 1);
        setBossShakeKey((k) => k + 1);
        setBossModeTimed("correct");
        if (buzzedTeam && diff > 0) spawnFloating(buzzedTeam.id, `+${diff}`, false);
        spawnFloating("boss", diff > 0 ? `-${diff}` : "HIT!", false);
        playHitSfx();
      } else {
        setBossModeTimed("attack");
        if (buzzedTeam) {
          setMemberShake(buzzedTeam.id);
          setTimeout(() => setMemberShake(null), 400);
          if (diff < 0) spawnFloating(buzzedTeam.id, `${diff}`, true);
        }
        playHurtSfx();
      }
    }

    const snapshot: Record<string, number> = {};
    state.teams.forEach((t) => (snapshot[t.id] = t.score));
    prevScoresRef.current = snapshot;
  }, [state]);

  const fontVars = `${vt323.variable} ${pressStart.variable}`;

  if (error) {
    return (
      <main className={`bbq-root ${fontVars}`}>
        <style>{CSS}</style>
        <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
          <p className="pixel-font" style={{ fontSize: 16, color: "var(--hp-full)" }}>{error}</p>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className={`bbq-root ${fontVars}`}>
        <style>{CSS}</style>
        <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
          <p className="pixel-font" style={{ fontSize: 16, opacity: 0.7 }}>Menghubungkan...</p>
        </div>
      </main>
    );
  }

  const total = Math.max(1, state.totalQuestions);
  const solved =
    state.phase === "ended" ? total : Math.max(0, Math.min(total, state.currentIndex));
  const remaining = total - solved;
  const pct = Math.round((remaining / total) * 100);
  const hpColor = pct > 60 ? "var(--hp-full)" : pct > 25 ? "var(--hp-mid)" : "var(--hp-low)";

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const remainingSec =
    state.phase === "buzzed" && state.timerStartedAt && state.timerDuration
      ? Math.max(0, state.timerDuration - (now - state.timerStartedAt) / 1000)
      : null;

  const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);
  const MEDALS = ["🥇", "🥈", "🥉"];
  const finished = state.phase === "ended";
  const hasMedia = !!state.currentQuestion && state.currentQuestion.mediaType !== "NONE";

  return (
    <main className={`bbq-root ${fontVars}`}>
      <style>{CSS}</style>

      <div className={`flash-overlay ${flashKey ? "hit" : ""}`} key={flashKey} />

      <div className="screen">
        <div className="scanlines" />
        <div className="content">
          <div className={`skip-toast ${skipToast.show ? "show" : ""}`}>
            <span className="skip-icon">SKIP</span>
            <span>{skipToast.text || "Tim setuju skip — soal ini dilewati"}</span>
          </div>

          {needsUnlock && (
            <button
              onClick={() => {
                setSoundEnabled(true);
                setNeedsUnlock(false);
              }}
              className="sound-unlock"
            >
              🔇 Klik untuk suara
            </button>
          )}

          <div className="statusbar pixel-font">
            <div className="left">
              <span className="dot blink" />
              <span>{state.quizTitle}</span>
            </div>
            <div className="right">
              <span>{mm}:{ss}</span>
            </div>
          </div>

          <div
            className="boss-panel window floating-text-anchor"
            key={bossShakeKey ? `shake-${bossShakeKey}` : "no-shake"}
          >
            <div className="window-title">
              <span>SESI KUIS</span>
              <span className="x">×</span>
            </div>
            <div className="window-body">
              <div className="boss-row">
                <div className={`boss-face ${bossMode}`}>
                  <video
                    key={bossMode}
                    src={bossVideoSrc(bossMode)}
                    autoPlay
                    loop={bossMode === "idle"}
                    muted
                    playsInline
                  />
                </div>
                <div className="boss-info">
                  <p className="boss-name pixel-font">
                    <span>HP</span>
                    <span>{remaining}/{total}</span>
                  </p>
                  <div className="hp-shell">
                    <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor }} />
                  </div>
                  <div className="hp-label">
                    <span>tiap soal terjawab = 1 damage</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              </div>
              {floating.filter((f) => f.target === "boss").map((f) => (
                <div
                  key={f.id}
                  className={`floating-dmg${f.penalty ? " penalty" : ""}`}
                  style={{ left: `calc(50% + ${f.offset}px)` }}
                >
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          <div className="boss-stage window">
            <div className="window-title">
              <span>ARENA</span>
              <span className="x">×</span>
            </div>
            <div className="window-body">
              {hasMedia ? (
                <MediaBlock
                  mediaType={state.currentQuestion!.mediaType}
                  mediaUrl={state.currentQuestion!.mediaUrl}
                  autoPlay={state.currentQuestion!.mediaType === "VIDEO"}
                  soundEnabled={soundEnabled}
                  onSoundBlocked={() => {
                    setSoundEnabled(false);
                    setNeedsUnlock(true);
                  }}
                  className="arena-media"
                />
              ) : (
                <div className="boss-visual-wrap">
                  <video
                    key={bossMode}
                    className={`boss-visual ${bossMode}`}
                    src={bossVideoSrc(bossMode)}
                    autoPlay
                    loop={bossMode === "idle"}
                    muted
                    playsInline
                    onEnded={handleArenaVideoEnded}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="question-area">
            <div className="battle-box window">
              <div className="window-title">
                <span>SOAL</span>
                <span className="x">×</span>
              </div>
              <div className="window-body">

                {state.phase === "lobby" && (
                  <div className="lobby-join">
                    <p className="q-text">Menunggu panitia memulai soal pertama...</p>
                    <p className="q-eyebrow pixel-font" style={{ marginTop: 18 }}>
                      SCAN UNTUK GABUNG
                    </p>
                    {joinUrl && (
                      <div className="lobby-qr">
                        <QrCode value={joinUrl} size={200} />
                      </div>
                    )}
                    <p className="lobby-code pixel-font">{matchCode}</p>
                    <p className="answer-note">atau ketik kode di atas di halaman /gabung</p>
                  </div>
                )}

                {finished && (
                  <>
                    <p className="q-eyebrow pixel-font">BOSS TERKALAHKAN!</p>
                    <div className="podium">
                      {sortedTeams.map((t, i) => (
                        <div key={t.id} className={`podium-row${i === 0 ? " first" : ""}`}>
                          <span>{MEDALS[i] ?? `#${i + 1}`} {t.name}</span>
                          <span className="pixel-font">{t.score}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!finished && state.phase !== "lobby" && state.currentQuestion && (
                  <>
                    <p className="q-eyebrow pixel-font">
                      SOAL {Math.min(state.currentIndex + 1, total)} DARI {total}
                      {state.currentQuestion.isSimultaneous && (
                        <span style={{ marginLeft: 10, color: "#ffcf6b" }}>⚡ SEMUA TIM MENJAWAB</span>
                      )}
                    </p>
                    <p className="q-text">{state.currentQuestion.text}</p>

                    {state.currentQuestion.options && (
                      <div className="option-grid">
                        {state.currentQuestion.options.map((opt, i) => (
                          <div key={i} className="option-item">
                            <span className="pixel-font option-letter">{String.fromCharCode(65 + i)}</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {state.phase === "question-shown" && state.skipEnabled && state.skipVotes.length > 0 && (
                      <p className="answer-note">
                        ⏭ {state.skipVotes.length}/{state.teams.length} tim setuju skip
                      </p>
                    )}
                    {state.phase === "buzzed" && (
                      <div>
                        <p className="prompt-line buzz">{state.buzzedTeamName} menjawab!</p>
                        {remainingSec !== null && (
                          <p className="countdown pixel-font">{Math.ceil(remainingSec)}s</p>
                        )}
                      </div>
                    )}
                    {state.phase === "simultaneous" && (
                      <div>
                        <p className="prompt-line" style={{ color: "#ffcf6b" }}>
                          ⚡ Semua tim sedang menjawab lewat halaman Buzzer masing-masing...
                        </p>
                        {state.simultaneousProgress && (
                          <p className="answer-note">
                            {state.simultaneousProgress.submitted}/{state.simultaneousProgress.total} tim sudah
                            mengirim jawaban · {state.simultaneousProgress.graded}/{state.simultaneousProgress.total}{" "}
                            sudah dinilai panitia
                          </p>
                        )}
                      </div>
                    )}
                    {state.phase === "revealed" && state.lastOutcome && (
                      <p
                        className="prompt-line pixel-font"
                        style={{ color: OUTCOME_LABEL[state.lastOutcome].color }}
                      >
                        {OUTCOME_LABEL[state.lastOutcome].text} — {state.buzzedTeamName}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="team-panel window">
            <div className="window-title">
              <span>SKOR TIM</span>
              <span className="x">×</span>
            </div>
            <div className="window-body">
              <p className="team-title">{state.teams.length} tim</p>
              <div className="team-list">
                {sortedTeams.map((t) => (
                  <div
                    key={t.id}
                    className={`member floating-text-anchor${memberShake === t.id ? " shake" : ""}${
                      state.buzzedTeamId === t.id ? " active" : ""
                    }`}
                  >
                    <div className="mname">{t.name}</div>
                    <div className="mscore">{t.score}</div>
                    <div className="mscore-label">poin</div>
                    {floating.filter((f) => f.target === t.id).map((f) => (
                      <div
                        key={f.id}
                        className={`floating-dmg${f.penalty ? " penalty" : ""}`}
                        style={{ left: `calc(50% + ${f.offset}px)` }}
                      >
                        {f.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bottombar">
            <div className="progress-dots">
              {Array.from({ length: total }).map((_, i) => (
                <i key={i} className={i < solved ? "done" : ""} />
              ))}
            </div>
            <span>{Math.min(solved + (finished ? 0 : 0), total)}/{total}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------- CSS: adaptasi dari BossBattleQuiz.jsx (tema pixel/boss-battle) ----------
const CSS = `
  .bbq-root { --cream:#e6e2cb; --cream-dim:#c9c4a4; --ink:#12131f; --ink-2:#1b1d2e;
    --screen:#0d0e18; --line:#e6e2cb; --hp-full:#c94f4f; --hp-mid:#d99a3b; --hp-low:#8f2a2a;
    --agree:#5fae6b; --wait:#5a5c74; font-family: var(--font-vt323), monospace; }
  .bbq-root * { box-sizing: border-box; }
  .pixel-font { font-family: var(--font-press), monospace; }
  .bbq-root .screen { position: relative; width: 100%; min-height: 100dvh; background: var(--screen);
    color: var(--cream); overflow-x: hidden; overflow-y: auto; display: flex; flex-direction: column;
    gap: clamp(10px, 1.6vw, 16px); padding: clamp(12px, 2.4vw, 28px);
    box-shadow: inset 0 0 60px rgba(0,0,0,0.55); }
  .flash-overlay { position: fixed; inset: 0; background: rgba(201,40,40,0.55); pointer-events: none;
    opacity: 0; z-index: 999; }
  .flash-overlay.hit { animation: screenFlash 0.25s ease-out; }
  @keyframes screenFlash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
  @keyframes shakeIt { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-6px,3px); }
    40% { transform: translate(6px,-3px); } 60% { transform: translate(-5px,-2px); }
    80% { transform: translate(5px,2px); } }
  .shake { animation: shakeIt 0.35s ease-in-out; }
  .floating-text-anchor { position: relative; }
  .floating-dmg { position: absolute; left: 50%; top: 40%; transform: translate(-50%,0);
    font-family: var(--font-press), monospace; font-size: clamp(16px,2.6vw,26px); color: var(--hp-full);
    text-shadow: 2px 2px 0 var(--ink), -2px -2px 0 var(--ink), 2px -2px 0 var(--ink), -2px 2px 0 var(--ink);
    pointer-events: none; z-index: 20; animation: floatUp 1s ease-out forwards; white-space: nowrap; }
  .floating-dmg.penalty { color: #e0743a; }
  @keyframes floatUp { 0% { opacity:1; transform: translate(-50%,0); } 100% { opacity:0; transform: translate(-50%,-70px); } }
  .scanlines { position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 3px);
    mix-blend-mode: multiply; }
  .content { width: 100%; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column;
    gap: clamp(10px,1.6vw,16px); position: relative; }
  @media (min-width: 900px) {
    .content { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.25fr);
      grid-template-areas: "boss question" "stage question" "stage team" "stage bottombar";
      align-content: start; gap: 16px 24px; }
    .boss-panel { grid-area: boss; } .boss-stage { grid-area: stage; }
    .team-panel { grid-area: team; } .question-area { grid-area: question; }
    .bottombar { grid-area: bottombar; align-self: end; } .skip-toast { grid-column: 1 / -1; }
  }
  @media (min-width: 1200px) { .content { grid-template-columns: minmax(0,0.85fr) minmax(0,1.4fr); } }
  @media (max-width: 599px) {
    .content { gap: 10px; } .q-text { font-size: 18px; } .team-list { flex-wrap: wrap; }
    .member { min-width: 90px; } .bottombar { flex-direction: column; align-items: stretch; gap: 8px; }
    .bottombar > div { flex-wrap: wrap; justify-content: center; }
  }
  .window { border: 2px solid var(--cream); box-shadow: 3px 3px 0 rgba(0,0,0,0.5); background: var(--ink-2); }
  .window-title { display: flex; align-items: center; justify-content: space-between; background: var(--cream);
    color: var(--ink); font-family: var(--font-press), monospace; font-size: 10px; letter-spacing: 0.5px; padding: 6px 8px; }
  .window-title .x { width: 12px; height: 12px; border: 1px solid var(--ink); display: flex; align-items: center;
    justify-content: center; font-size: 9px; line-height: 1; }
  .window-body { padding: 12px 14px; }
  .statusbar { display: flex; align-items: center; justify-content: space-between; font-size: 12px; letter-spacing: 0.5px; }
  .statusbar .left, .statusbar .right { display: flex; align-items: center; gap: 8px; }
  .statusbar .left span:last-child { max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 6px; height: 6px; background: var(--cream); display: inline-block; }
  .blink { animation: blink 1.2s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0.2; } }
  .boss-row { display: flex; align-items: center; gap: 14px; }
  .boss-face { width: 44px; height: 44px; flex: 0 0 auto; background: var(--cream); overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--cream); box-shadow: 0 0 0 2px var(--ink) inset; transition: box-shadow 0.15s; }
  .boss-face video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .boss-face.attack { box-shadow: 0 0 0 2px var(--hp-full) inset, 0 0 10px var(--hp-full); }
  .boss-face.correct { box-shadow: 0 0 0 2px var(--agree) inset, 0 0 10px var(--agree); }
  .boss-info { flex: 1; min-width: 0; }
  .boss-name { font-size: 12px; margin: 0 0 8px; letter-spacing: 0.5px; display: flex; justify-content: space-between; gap: 6px; }
  .hp-shell { height: 14px; background: var(--ink); border: 2px solid var(--cream); padding: 2px; }
  .hp-fill { height: 100%; background: var(--hp-full); transition: width 0.45s steps(12);
    background-image: repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 3px, transparent 3px 6px); }
  .hp-label { font-size: 11px; margin-top: 6px; opacity: 0.8; display: flex; justify-content: space-between; }
  .boss-stage .window-body { position: relative; min-height: 240px; height: clamp(240px,34vw,420px); display: flex;
    align-items: center; justify-content: center; padding: 0; overflow: hidden; background: var(--screen); }
  @media (min-width: 900px) { .boss-stage .window-body { height: clamp(320px,46vw,560px); } }
  .arena-media { max-width: 100%; max-height: 100%; object-fit: contain; }
  .boss-visual-wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  .boss-visual { height: 100%; width: auto; max-width: 100%; object-fit: contain;
    animation: bossFloat 2.4s ease-in-out infinite; filter: drop-shadow(0 0 12px rgba(230,226,203,0.25)); }
  .boss-visual.attack { animation: bossHit 0.35s ease-in-out; filter: drop-shadow(0 0 24px var(--hp-full)) saturate(1.5) brightness(1.05); }
  .boss-visual.correct { animation: bossHit 0.35s ease-in-out; filter: drop-shadow(0 0 24px var(--agree)) saturate(1.3); }
  @keyframes bossFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes bossHit { 0%,100% { transform: translate(0,0) scale(1); } 30% { transform: translate(-8px,4px) scale(0.96); }
    60% { transform: translate(8px,-4px) scale(1.05); } }
  .skip-toast { position: absolute; top: 14px; left: 50%; transform: translate(-50%,-140%); z-index: 5;
    background: var(--cream); color: var(--ink); border: 2px solid var(--ink); box-shadow: 3px 3px 0 rgba(0,0,0,0.5);
    padding: 8px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; letter-spacing: 0.3px; opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease; pointer-events: none; white-space: nowrap; }
  .skip-toast.show { transform: translate(-50%,0%); opacity: 1; }
  .skip-toast .skip-icon { font-family: var(--font-press), monospace; font-size: 10px; background: var(--hp-full); color: var(--cream); padding: 3px 6px; }
  .sound-unlock { position: fixed; bottom: 18px; right: 18px; z-index: 50; background: var(--cream); color: var(--ink);
    border: 2px solid var(--ink); box-shadow: 3px 3px 0 rgba(0,0,0,0.5); padding: 8px 14px; font-size: 13px; cursor: pointer; }
  .team-title { font-size: 11px; margin: 0 0 12px; opacity: 0.85; letter-spacing: 0.5px; }
  .team-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .member { flex: 1; min-width: 100px; background: var(--ink); border: 2px solid var(--cream-dim); padding: 14px 8px 12px; text-align: center; }
  .member.active { border-color: var(--hp-full); box-shadow: 0 0 0 2px var(--hp-full) inset; }
  .member .mname { font-size: 17px; letter-spacing: 0.4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .member .mscore { margin-top: 8px; font-family: var(--font-press), monospace; font-size: 16px; color: var(--cream); }
  .member .mscore-label { margin-top: 4px; font-size: 10px; opacity: 0.55; letter-spacing: 0.5px; }
  .question-area { padding: 0; display: flex; }
  .battle-box { width: 100%; position: relative; }
  .battle-box .window-body { padding: 26px 28px; text-align: center; }
  .q-eyebrow { font-size: 11px; opacity: 0.75; margin: 0 0 16px; letter-spacing: 1px; }
  .q-text { font-size: 24px; line-height: 1.45; margin: 0; }
  .option-grid { margin-top: 18px; display: grid; grid-template-columns: 1fr; gap: 8px; text-align: left; }
  @media (min-width: 640px) { .option-grid { grid-template-columns: 1fr 1fr; } }
  .option-item { display: flex; align-items: center; gap: 10px; border: 2px solid var(--cream-dim); padding: 10px 12px; font-size: 18px; }
  .option-letter { font-size: 11px; background: var(--cream); color: var(--ink); padding: 3px 6px; flex: 0 0 auto; }
  .prompt-line { margin-top: 18px; font-size: 18px; opacity: 0.9; }
  .prompt-line.buzz { font-size: 22px; color: var(--hp-mid); }
  .countdown { margin-top: 8px; font-size: clamp(40px, 8vw, 72px); color: var(--hp-full); }
  .answer-note { margin-top: 10px; font-size: 12px; opacity: 0.55; letter-spacing: 0.3px; }
  .lobby-join { display: flex; flex-direction: column; align-items: center; }
  .lobby-qr { margin-top: 10px; display: flex; justify-content: center; }
  .lobby-code { margin-top: 14px; font-size: clamp(28px, 6vw, 44px); letter-spacing: 0.3em; color: var(--hp-full); }
  .podium { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .podium-row { display: flex; justify-content: space-between; border: 2px solid var(--cream-dim); padding: 10px 14px; font-size: 18px; }
  .podium-row.first { border-color: var(--hp-mid); box-shadow: 0 0 0 2px var(--hp-mid) inset; }
  .bottombar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .progress-dots { display: flex; gap: 5px; flex-wrap: wrap; }
  .progress-dots i { width: 7px; height: 7px; background: var(--cream-dim); display: inline-block; }
  .progress-dots i.done { background: var(--cream); }
`;
