"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { PublicMatchState, MyCardState, CardToast, CardPopup, MySimultaneousState } from "@/lib/matchSocket";
import { CardId, CARD_TYPES, cardType } from "@/lib/cardTypes";
import { CardIcon } from "@/components/CardIcon";
import "./buzzer.css";

const STATUS_TEXT: Record<string, string> = {
  normal: "SIAP",
  pressed: "DITEKAN",
  disabled: "TERKUNCI",
};

let toastSeq = 0;

export default function BuzzerPage() {
  const params = useParams<{ matchCode: string; teamId: string }>();
  const router = useRouter();
  const { matchCode, teamId } = params;

  const [state, setState] = useState<PublicMatchState | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [skipNotice, setSkipNotice] = useState(false);

  // ---- Kartu strategi ----
  const [myCard, setMyCard] = useState<MyCardState | null>(null);
  const [openCardId, setOpenCardId] = useState<CardId | null>(null);
  const [cardTarget, setCardTarget] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // ---- Ronde "Semua Tim Menjawab": status privat milik tim ini sendiri ----
  const [mySimultaneous, setMySimultaneous] = useState<MySimultaneousState | null>(null);
  const [simChoice, setSimChoice] = useState<number | null>(null); // index opsi PG yang dipilih (sebelum kirim)
  const [simFillIn, setSimFillIn] = useState(""); // teks isian (sebelum kirim)
  const [simSubmitting, setSimSubmitting] = useState(false);

  // ---- Notifikasi kartu: toast kecil (pojok atas) & popup besar (tengah layar) ----
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const [popup, setPopup] = useState<CardPopup | null>(null);
  const popupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transient visual/audio feedback on the buzzer button itself: 'pressed' plays the
  // "BZZZT" animation after a successful buzz. Menekan saat terkunci TIDAK menghasilkan
  // apa-apa lagi (dulu ada animasi/bunyi "macet", sekarang cukup diam di tampilan abu-abu).
  // Clears itself automatically; the underlying game state (from the server) always wins
  // once the animation ends.
  const [transient, setTransient] = useState<"pressed" | null>(null);
  const transientTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const socket = getSocket();

    function onState(s: PublicMatchState) {
      setState(s);
    }
    function onSkipped() {
      setSkipNotice(true);
      setTimeout(() => setSkipNotice(false), 2500);
    }
    function onMyCard(c: MyCardState) {
      setMyCard(c);
    }
    function onMySimultaneous(s: MySimultaneousState | null) {
      setMySimultaneous(s);
      // Soal simultaneous baru dimulai (belum submit) -> bersihkan form lokal biar tidak
      // ketinggalan pilihan dari soal sebelumnya.
      if (!s || !s.submitted) {
        setSimChoice(null);
        setSimFillIn("");
      }
    }
    function onToast(t: CardToast) {
      const id = ++toastSeq;
      setToasts((prev) => [...prev, { id, text: t.text, tone: t.tone }]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
    }
    function onPopup(p: CardPopup) {
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
      setPopup(p);
      popupTimeout.current = setTimeout(() => setPopup(null), 3800);
    }
    socket.on("match:public-state", onState);
    socket.on("match:question-skipped", onSkipped);
    socket.on("match:my-card-state", onMyCard);
    socket.on("match:my-simultaneous-state", onMySimultaneous);
    socket.on("match:toast", onToast);
    socket.on("match:popup", onPopup);

    socket.emit(
      "team:join-buzzer",
      { matchCode, teamId },
      (res: {
        ok: boolean;
        teamName?: string;
        state?: PublicMatchState;
        myCard?: MyCardState | null;
        mySimultaneous?: MySimultaneousState | null;
        message?: string;
      }) => {
        if (res.ok) {
          setTeamName(res.teamName ?? null);
          if (res.state) setState(res.state);
          if (res.myCard) setMyCard(res.myCard);
          if (res.mySimultaneous) setMySimultaneous(res.mySimultaneous);
        } else {
          setError(res.message ?? "Tidak bisa bergabung.");
        }
      }
    );

    return () => {
      socket.off("match:public-state", onState);
      socket.off("match:question-skipped", onSkipped);
      socket.off("match:my-card-state", onMyCard);
      socket.off("match:my-simultaneous-state", onMySimultaneous);
      socket.off("match:toast", onToast);
      socket.off("match:popup", onPopup);
      if (transientTimeout.current) clearTimeout(transientTimeout.current);
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCode, teamId]);

  // ---- Efek suara (Web Audio API) ----
  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  // Bunyi "BZZZT!" khas bel cerdas cermat saat berhasil menekan bel duluan.
  function playBuzzSound() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.5, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.35, now + 0.12);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    master.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(140, now + 0.4);

    const osc2 = ctx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(224, now);
    osc2.frequency.exponentialRampToValueAtTime(142, now + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.value = 1.2;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(master);

    osc1.start(now);
    osc1.stop(now + 0.45);
    osc2.start(now);
    osc2.stop(now + 0.45);
  }

  // (Dulu ada bunyi "macet" di sini — sudah dihapus. Sekarang menekan tombol saat
  // terkunci tidak menghasilkan bunyi maupun animasi apa pun.)

  function setTransientFor(kind: "pressed", ms: number) {
    if (transientTimeout.current) clearTimeout(transientTimeout.current);
    setTransient(kind);
    transientTimeout.current = setTimeout(() => setTransient(null), ms);
  }

  function handleBuzz() {
    if (!state) return;
    const isExcluded = state.excludedTeamIds.includes(teamId);
    const canBuzz = state.phase === "question-shown" && !isExcluded;

    if (!canBuzz) {
      // Bukan giliran tim ini (sudah dikunci/sudah mencoba/belum ada soal) -> diam saja,
      // tombol tetap dalam tampilan abu-abu terkunci, tanpa animasi atau bunyi apa pun.
      return;
    }

    playBuzzSound();
    setTransientFor("pressed", 600);
    const socket = getSocket();
    socket.emit("team:buzz", { matchCode, teamId }, () => {});
  }

  function handleSubmitSimultaneous(value: string | number | boolean) {
    if (!state || state.phase !== "simultaneous" || mySimultaneous?.submitted || simSubmitting) return;
    setSimSubmitting(true);
    const socket = getSocket();
    socket.emit(
      "team:submit-simultaneous-answer",
      { matchCode, teamId, value },
      (res: { ok: boolean; message?: string }) => {
        setSimSubmitting(false);
        if (!res.ok) alert(res.message ?? "Gagal mengirim jawaban.");
      }
    );
  }

  function handleVoteSkip() {
    const socket = getSocket();
    setSkipping(true);
    socket.emit("team:vote-skip", { matchCode, teamId }, () => {
      setSkipping(false);
    });
  }

  function handleCancelVoteSkip() {
    const socket = getSocket();
    socket.emit("team:cancel-vote-skip", { matchCode, teamId }, (res: { ok: boolean; message?: string }) => {
      if (!res.ok) alert(res.message ?? "Tidak bisa membatalkan.");
    });
  }

  function handleLeave() {
    router.push("/gabung");
  }

  // Cek kelayakan pakai kartu di klien HANYA untuk UX (abu-abukan tombol yang jelas
  // tidak akan diterima) — server (matches.ts canUseCard) tetap sumber kebenaran.
  function canUseCardClient(cardId: CardId): boolean {
    if (!state || !myCard) return false;
    if (myCard.usedCardThisQuestion) return false;
    if (myCard.activeCard) return false;
    if ((myCard.cardStock[cardId] || 0) <= 0) return false;

    const type = cardType(cardId);
    // 'before': boleh diaktifkan kapan saja (termasuk saat soal berjalan) — hanya tidak setelah sesi berakhir.
    if (type.timing === "before" && state.phase === "ended") return false;
    if (type.timing === "during" && !(state.phase === "question-shown" || state.phase === "buzzed")) return false;
    if (cardId === "swap" && !(state.phase === "buzzed" && state.buzzedTeamId === teamId)) return false;

    return true;
  }

  function handleOpenCard(cardId: CardId) {
    if (!canUseCardClient(cardId)) return;
    setCardError(null);
    setCardTarget(null);
    setOpenCardId(cardId);
  }

  function handleCloseCard() {
    if (cardBusy) return;
    setOpenCardId(null);
    setCardTarget(null);
    setCardError(null);
  }

  function handleConfirmCard() {
    if (!openCardId) return;
    const type = cardType(openCardId);
    if (type.needsTarget && !cardTarget) {
      setCardError("Pilih dulu tim targetnya.");
      return;
    }
    setCardBusy(true);
    setCardError(null);
    const socket = getSocket();
    socket.emit(
      "team:use-card",
      { matchCode, teamId, cardId: openCardId, targetTeamId: cardTarget ?? undefined },
      (res: { ok: boolean; message?: string }) => {
        setCardBusy(false);
        if (res.ok) {
          setOpenCardId(null);
          setCardTarget(null);
        } else {
          setCardError(res.message ?? "Kartu tidak bisa dipakai sekarang.");
        }
      }
    );
  }

  if (error) {
    return (
      <main className="buzzer-scope flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="pixel-font" style={{ color: "var(--led-red)", fontSize: "0.9rem" }}>
          {error}
        </p>
        <button onClick={handleLeave} className="pbtn">
          ‹ Kembali ke Halaman Masuk
        </button>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="buzzer-scope flex min-h-dvh items-center justify-center">
        <p className="pixel-font" style={{ fontSize: "0.8rem" }}>
          Menghubungkan...
        </p>
      </main>
    );
  }

  const isExcluded = state.excludedTeamIds.includes(teamId);
  const canBuzz = state.phase === "question-shown" && !isExcluded;
  const iBuzzedFirst = state.buzzedTeamId === teamId;
  const iVotedSkip = state.skipVotes.includes(teamId);
  const myScore = state.teams.find((t) => t.id === teamId)?.score ?? 0;

  // Status chip: apa yang sedang terjadi di bel tim ini sekarang.
  let statusKind: "normal" | "pressed" | "disabled" = "disabled";
  if (transient) {
    statusKind = transient;
  } else if (state.phase === "buzzed" && iBuzzedFirst) {
    statusKind = "pressed";
  } else if (canBuzz) {
    statusKind = "normal";
  }

  const statusLabel =
    state.phase === "buzzed" && iBuzzedFirst && !transient ? "KAMU DULUAN!" : STATUS_TEXT[statusKind];

  const btnWrapClass = transient ? transient : canBuzz ? "" : "disabled";

  const myGrade = mySimultaneous?.grade ?? null;

  let message = "";
  if (state.phase === "lobby") message = "Menunggu panitia menampilkan soal pertama...";
  else if (state.phase === "question-shown" && isExcluded)
    message = "Tim kamu sudah mencoba soal ini — menunggu tim lain atau soal berikutnya.";
  else if (state.phase === "question-shown" && !isExcluded)
    message = "Soal sedang tampil — tekan secepat mungkin kalau tim kamu tahu jawabannya!";
  else if (state.phase === "buzzed" && iBuzzedFirst) message = "Tim kamu duluan! Jawab lewat mikrofon sekarang.";
  else if (state.phase === "buzzed" && !iBuzzedFirst) message = `${state.buzzedTeamName} sudah lebih dulu menjawab.`;
  else if (state.phase === "simultaneous")
    message = myGrade
      ? "Sudah dinilai panitia — tunggu soal berikutnya."
      : mySimultaneous?.submitted
        ? "⚡ Jawaban terkirim — menunggu tim lain & penilaian panitia."
        : "⚡ Soal ini dijawab SEMUA TIM sekaligus — pilih jawabanmu di bawah, lalu kirim.";
  else if (state.phase === "revealed") message = "Menunggu keputusan panitia...";
  else if (state.phase === "ended") message = "Sesi sudah selesai. Terima kasih!";

  return (
    <div className="buzzer-scope">
      <div className="pixel-grain"></div>

      <div className="topbar">
        <div className="brand pixel-font">BUZZER</div>
        <div className="topbar-actions">
          <button className="pbtn" onClick={handleLeave}>
            ‹ KELUAR
          </button>
        </div>
      </div>

      {skipNotice && (
        <div
          className="pixel-font"
          style={{
            fontSize: "0.6rem",
            color: "var(--led-green)",
            border: "2px solid var(--panel-edge)",
            background: "var(--panel)",
            padding: "8px 12px",
            marginTop: "4px",
          }}
        >
          ⏭ Semua tim setuju — soal dilewati!
        </div>
      )}

      <div className="scene">
        <div className="wall-zone">
          <div className="whiteboard">
            <span className="pin red"></span>
            <span className="pin blue"></span>
            <div className="board-row">
              <span className="board-label">SOAL</span>
              <span className="board-points">
                {state.currentQuestion ? `${state.currentIndex + 1}/${state.totalQuestions}` : "—"}
              </span>
            </div>
            <div className="soal-text">
              {state.currentQuestion?.text ?? "Menunggu soal dari panitia..."}
            </div>

            <div className="jawaban-wrap">
              <div className="board-row">
                <span className="board-label">STATUS</span>
              </div>
              <div className="jawaban-text revealed" style={{ fontSize: "1.1rem" }}>
                {message}
              </div>
            </div>

            {state.skipEnabled && state.phase === "question-shown" && (
              <div className="board-controls">
                <button
                  className="pbtn"
                  onClick={iVotedSkip ? handleCancelVoteSkip : handleVoteSkip}
                  disabled={skipping}
                >
                  {iVotedSkip
                    ? `❌ BATAL VOTE (${state.skipVotes.length}/${state.teams.length})`
                    : "⏭ VOTE SKIP SOAL"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="board-tray">
          <div className="prop marker-red-prop"></div>
          <div className="prop marker-blue-prop"></div>
          <div className="prop eraser-prop"></div>
        </div>

        <div className="desk">
          <div className="nameplate">
            <div className="team-name pixel-font">{teamName ?? "TIM"}</div>
            <div className="points-row">
              <div className="points-value">{myScore}</div>
            </div>
          </div>

          <div className="buzzer-unit">
            <div className={`status-chip ${statusKind}`}>{statusLabel}</div>

            <div className="panel-housing">
              <span className="side-loop left"></span>
              <span className="screw tl"></span>
              <span className="screw tr"></span>
              <span className="screw bl"></span>
              <span className="screw br"></span>
              <div className="leds">
                <span className="led g"></span>
                <span className="led y"></span>
                <span className={`led r ${statusKind === "disabled" ? "on" : ""}`}></span>
              </div>

              <div className={`btn-wrap ${btnWrapClass}`}>
                <div className="ditekan-label pixel-font">DITEKAN!</div>
                <div className="btn-base"></div>
                <div className="btn-dome" onClick={handleBuzz}></div>
                <div className="spark-burst">
                  <svg viewBox="0 0 100 100">
                    <g fill="#ffd23f">
                      <polygon
                        points="50,0 56,40 96,46 56,52 50,100 44,52 4,46 44,40"
                        stroke="#12141f"
                        strokeWidth="3"
                        strokeLinejoin="miter"
                      />
                    </g>
                  </svg>
                </div>
                <div className="cross"></div>
              </div>
            </div>
          </div>

          <div className="cup-prop">
            <div className="cup-body"></div>
            <div className="pencil p1"></div>
            <div className="pencil p2"></div>
            <div className="pencil p3"></div>
          </div>
        </div>
      </div>

      {state.phase === "simultaneous" && !mySimultaneous?.submitted && state.currentQuestion && (
        <div className="sim-answer-panel">
          <div className="sim-answer-title pixel-font">⚡ JAWABANMU</div>
          {state.currentQuestion.type === "MULTIPLE_CHOICE" && state.currentQuestion.options && (
            <div className="sim-answer-options">
              {state.currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  className={`sim-answer-option ${simChoice === i ? "picked" : ""}`}
                  onClick={() => setSimChoice(i)}
                >
                  <span className="pixel-font">{String.fromCharCode(65 + i)}</span> {opt}
                </button>
              ))}
              <button
                className="pbtn gold"
                disabled={simChoice === null || simSubmitting}
                onClick={() => simChoice !== null && handleSubmitSimultaneous(simChoice)}
              >
                {simSubmitting ? "Mengirim..." : "Kirim Jawaban"}
              </button>
            </div>
          )}
          {state.currentQuestion.type === "TRUE_FALSE" && (
            <div className="sim-answer-options">
              <button className="pbtn gold" disabled={simSubmitting} onClick={() => handleSubmitSimultaneous(true)}>
                BENAR
              </button>
              <button className="pbtn" disabled={simSubmitting} onClick={() => handleSubmitSimultaneous(false)}>
                SALAH
              </button>
            </div>
          )}
          {state.currentQuestion.type === "FILL_IN" && (
            <div className="sim-answer-options">
              <input
                type="text"
                value={simFillIn}
                onChange={(e) => setSimFillIn(e.target.value)}
                placeholder="Ketik jawabanmu..."
                className="sim-answer-input"
              />
              <button
                className="pbtn gold"
                disabled={!simFillIn.trim() || simSubmitting}
                onClick={() => handleSubmitSimultaneous(simFillIn.trim())}
              >
                {simSubmitting ? "Mengirim..." : "Kirim Jawaban"}
              </button>
            </div>
          )}
        </div>
      )}

      {state.phase === "simultaneous" && mySimultaneous?.submitted && !myGrade && (
        <div className="card-pending-banner">
          ⚡ Jawaban terkirim{mySimultaneous.value !== null ? `: "${mySimultaneous.value}"` : ""} — menunggu tim lain
          & penilaian panitia.
        </div>
      )}

      {state.phase === "simultaneous" && myGrade && (
        <div className={`card-pending-banner ${myGrade === "correct" ? "success" : "fail"}`}>
          {myGrade === "correct" ? "✓ Jawaban timmu BENAR — poin ditambahkan." : "✗ Jawaban timmu SALAH — tidak ada pengurangan poin."}
        </div>
      )}

      {myCard?.activeCard && (
        <div className="card-pending-banner">
          <CardIcon id={myCard.activeCard.cardId} size={16} /> Kartu {cardType(myCard.activeCard.cardId).name}
          {myCard.activeCard.target ? ` → ${myCard.activeCard.target.name}` : ""}{" "}
          {myCard.activeCard.boundQuestionIndex > state.currentIndex
            ? "— Aktif untuk Soal Berikutnya"
            : "terpasang — menunggu keputusan panitia"}
        </div>
      )}

      {myCard?.revealedClue && (
        <div className="card-reveal-box">
          <div className="crb-label pixel-font">
            <CardIcon id="hint" size={14} /> PETUNJUK
          </div>
          <div className="crb-body">{myCard.revealedClue}</div>
        </div>
      )}

      {myCard?.fiftyRevealedIndexes && state.currentQuestion?.options && (
        <div className="card-reveal-box">
          <div className="crb-label pixel-font">
            <CardIcon id="fifty" size={14} /> OPSI TERSISA
          </div>
          <div className="crb-body">
            {myCard.fiftyRevealedIndexes.map((i) => (
              <span key={i} className="crb-opt">
                {String.fromCharCode(65 + i)}. {state.currentQuestion!.options![i]}
              </span>
            ))}
          </div>
        </div>
      )}

      {myCard && Object.keys(myCard.cardStock).length > 0 && (
        <div className="card-tray">
          <div className="card-tray-label-row">
            <div className="card-tray-label">KARTU STRATEGI</div>
            <button className="info-card-btn pixel-font" onClick={() => setInfoOpen(true)}>
              ℹ Info Kartu
            </button>
          </div>
          <div className="card-tray-row">
            {(Object.keys(myCard.cardStock) as CardId[]).map((id) => {
              const type = cardType(id);
              return (
                <button
                  key={id}
                  className="card-chip"
                  disabled={!canUseCardClient(id)}
                  onClick={() => handleOpenCard(id)}
                  title={type.short}
                >
                  <CardIcon id={id} size={24} />
                  <span>{type.name}</span>
                  <span className="card-stock">{myCard.cardStock[id] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <footer className="pixel-font" style={{ fontSize: "0.5rem" }}>
        CERDAS CERMAT — MODUL BEL
      </footer>

      {openCardId && (
        <div className="card-modal-backdrop" onClick={handleCloseCard}>
          <div className="card-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-title pixel-font">
              <CardIcon id={openCardId} size={28} />
              <span>{cardType(openCardId).name}</span>
            </div>
            <div className="cm-info">{cardType(openCardId).info}</div>

            {cardType(openCardId).needsTarget && (
              <div className="cm-targets">
                {state.teams
                  .filter((t) => t.id !== teamId)
                  .map((t) => (
                    <button
                      key={t.id}
                      className={`cm-target-btn ${cardTarget === t.id ? "selected" : ""}`}
                      onClick={() => setCardTarget(t.id)}
                    >
                      {cardTarget === t.id ? "✓ " : ""}
                      {t.name}
                    </button>
                  ))}
              </div>
            )}

            {cardError && (
              <p className="pixel-font" style={{ color: "var(--led-red)", fontSize: "0.55rem", marginBottom: 10 }}>
                {cardError}
              </p>
            )}

            <div className="cm-actions">
              <button className="pbtn" onClick={handleCloseCard} disabled={cardBusy}>
                Batal
              </button>
              <button className="pbtn gold" onClick={handleConfirmCard} disabled={cardBusy}>
                {cardBusy ? "..." : "Pakai Kartu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {infoOpen && (
        <div className="card-modal-backdrop" onClick={() => setInfoOpen(false)}>
          <div className="card-modal info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-title pixel-font">
              <span>ℹ Info Kartu</span>
            </div>
            <div className="info-modal-list">
              {CARD_TYPES.map((t) => (
                <div key={t.id} className="info-modal-item">
                  <div className="info-modal-item-head">
                    <CardIcon id={t.id} size={22} />
                    <span className="pixel-font" style={{ fontSize: "0.6rem" }}>
                      {t.name}
                    </span>
                  </div>
                  <p className="info-modal-item-body">{t.info}</p>
                </div>
              ))}
            </div>
            <div className="cm-actions">
              <button className="pbtn gold" onClick={() => setInfoOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifikasi kecil (pojok atas) — dilihat SEMUA tim, tidak pernah membocorkan nama kartu/target
          kecuali untuk kartu non-target (Perisai/Petunjuk/Penghapus Pilihan). */}
      <div className="card-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`card-toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Popup besar (tengah layar) — hanya dikirim ke tim ini kalau tim ini pengguna atau target kartu. */}
      {popup && (
        <div className="card-popup-backdrop" onClick={() => setPopup(null)}>
          <div className={`card-popup ${popup.tone}`}>{popup.text}</div>
        </div>
      )}
    </div>
  );
}
