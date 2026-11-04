"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAdminSocket, AdminMatchState, MatchTeam, AdminTeam, QuestionType } from "@/lib/matchSocket";
import { MediaBlock } from "@/components/MediaBlock";
import { CardId, CARD_TYPES, cardType } from "@/lib/cardTypes";
import { CardIcon } from "@/components/CardIcon";
import { QrCode } from "@/components/QrCode";

const OUTCOME_LABEL: Record<string, string> = {
  correct: "✓ BENAR",
  wrong: "✗ SALAH",
  timeout: "⏱ WAKTU HABIS",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PresentQuizPage() {
  const params = useParams<{ id: string }>();
  const quizId = params.id;

  const [state, setState] = useState<AdminMatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [now, setNow] = useState(Date.now());
  const [randomOrder, setRandomOrder] = useState(false);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [editingScoreTeamId, setEditingScoreTeamId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [qrModal, setQrModal] = useState<{ title: string; subtitle: string; url: string } | null>(null);

  useEffect(() => {
    const socket = getAdminSocket();
    function onAdminState(s: AdminMatchState) {
      setState(s);
    }
    socket.on("match:admin-state", onAdminState);
    return () => {
      socket.off("match:admin-state", onAdminState);
    };
  }, []);

  // Tick lokal buat hitung mundur timer tanpa nunggu event server tiap detik.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  function call(event: string, payload: Record<string, unknown>) {
    const socket = getAdminSocket();
    socket.emit(event, payload, (res: { ok: boolean; message?: string }) => {
      if (!res.ok) alert(res.message ?? "Gagal.");
    });
  }

  function handleStartSession() {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    const socket = getAdminSocket();
    socket.emit(
      "admin:create-match",
      { quizId, randomOrder },
      (res: { ok: boolean; matchCode?: string; state?: AdminMatchState; message?: string }) => {
        setStarting(false);
        if (res.ok && res.state) {
          setState(res.state);
        } else {
          startedRef.current = false;
          setError(res.message ?? "Gagal membuat sesi.");
        }
      }
    );
  }

  function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !state) return;
    call("admin:add-team", { matchCode: state.matchCode, name: teamName.trim() });
    setTeamName("");
  }

  function copyBuzzerLink(team: MatchTeam) {
    if (!state) return;
    const url = `${window.location.origin}/buzzer/${state.matchCode}/${team.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTeamId(team.id);
      setTimeout(() => setCopiedTeamId(null), 1500);
    });
  }

  function showJoinQr() {
    if (!state) return;
    const url = `${window.location.origin}/gabung?code=${state.matchCode}`;
    setQrModal({ title: "Scan untuk Gabung Sesi", subtitle: `Kode: ${state.matchCode}`, url });
  }

  function showTeamQr(team: MatchTeam) {
    if (!state) return;
    const url = `${window.location.origin}/buzzer/${state.matchCode}/${team.id}`;
    setQrModal({ title: `Scan untuk Tim ${team.name}`, subtitle: "Langsung masuk ke halaman bel tim ini", url });
  }

  function startEditScore(team: MatchTeam) {
    setEditingScoreTeamId(team.id);
    setScoreInput(String(team.score));
  }

  function saveScore(teamId: string) {
    if (!state) return;
    const value = Number(scoreInput);
    if (!Number.isFinite(value)) return;
    call("admin:set-score", { matchCode: state.matchCode, teamId, score: Math.round(value) });
    setEditingScoreTeamId(null);
  }

  function adjustScore(teamId: string, delta: number) {
    if (!state) return;
    call("admin:adjust-score", { matchCode: state.matchCode, teamId, delta });
  }

  function handleEndMatch() {
    if (!state) return;
    if (!confirm("Akhiri sesi sekarang dan tampilkan hasil akhir? Ini tidak bisa dibatalkan.")) return;
    call("admin:end-match", { matchCode: state.matchCode });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="rounded-lg border border-buzz-500/40 bg-buzz-500/10 px-4 py-3 text-buzz-400">
          {error}
        </p>
        <Link href={`/dashboard/quiz/${quizId}`} className="mt-4 inline-block text-sm text-[#8a8371] hover:text-[#c9c2ac]">
          ‹ Kembali ke pengaturan kuis
        </Link>
      </div>
    );
  }

  // ---- Layar setup: pilih urutan soal sebelum sesi dibuat ----
  if (!state) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Link href={`/dashboard/quiz/${quizId}`} className="text-sm text-[#8a8371] hover:text-[#c9c2ac]">
          ‹ Pengaturan Kuis
        </Link>
        <h1 className="font-display text-2xl font-semibold">Mulai Sesi Live</h1>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8a8371]">
            Urutan Soal
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRandomOrder(false)}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                !randomOrder ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-white/10 text-[#8a8371]"
              }`}
            >
              📋 Berurutan
            </button>
            <button
              type="button"
              onClick={() => setRandomOrder(true)}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                randomOrder ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-white/10 text-[#8a8371]"
              }`}
            >
              🔀 Acak
            </button>
          </div>
        </div>

        <button
          onClick={handleStartSession}
          disabled={starting}
          className="rounded-xl bg-brand-500 px-6 py-3 font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          {starting ? "Menyiapkan..." : "▶ Buat Sesi"}
        </button>
      </div>
    );
  }

  const remainingSec =
    state.phase === "buzzed" && state.timerStartedAt && state.timerDuration
      ? Math.max(0, state.timerDuration - (now - state.timerStartedAt) / 1000)
      : null;

  const displayUrl = `/display/${state.matchCode}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/dashboard/quiz/${quizId}`} className="text-sm text-[#8a8371] hover:text-[#c9c2ac]">
            ‹ Pengaturan Kuis
          </Link>
          <h1 className="font-display mt-1 text-2xl font-semibold">{state.quizTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-brand-500">Kode Sesi</p>
            <p className="text-2xl font-bold tracking-[0.2em]">{state.matchCode}</p>
          </div>
          <button
            onClick={showJoinQr}
            className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20"
            title="Tampilkan QR code buat discan peserta"
          >
            🔳 QR Gabung
          </button>
          <Link
            href={displayUrl}
            target="_blank"
            className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20"
          >
            🖥 Buka Layar Peserta ↗
          </Link>
          {state.phase !== "ended" && (
            <button
              onClick={handleEndMatch}
              className="rounded-xl border border-buzz-500/40 px-4 py-3 text-sm font-semibold text-buzz-400 hover:bg-buzz-500/10"
            >
              🏁 Akhiri Sesi
            </button>
          )}
        </div>
      </div>

      {/* ---- Tim ---- */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8a8371]">
          Tim ({state.teams.length})
        </h2>
        <form onSubmit={handleAddTeam} className="mb-4 flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Nama tim baru"
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-600">
            + Tambah Tim
          </button>
        </form>
        <p className="mb-3 text-xs text-[#8a8371]">
          Atau bagikan kode sesi <strong>{state.matchCode}</strong> — peserta bisa gabung sendiri di{" "}
          <code className="rounded bg-black/30 px-1">/gabung</code>, atau tinggal scan tombol{" "}
          <strong>🔳 QR Gabung</strong> di atas.
        </p>

        {state.teams.length === 0 ? (
          <p className="text-sm text-[#8a8371]">Belum ada tim. Tambahkan minimal 1 tim untuk memulai.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {state.teams.map((team) => (
              <li
                key={team.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  state.buzzedTeamId === team.id
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{team.name}</p>
                  {editingScoreTeamId === team.id ? (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => saveScore(team.id)}
                        className="rounded bg-brand-500 px-2 py-1 text-xs font-semibold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingScoreTeamId(null)}
                        className="rounded border border-white/10 px-2 py-1 text-xs"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-[#8a8371]">
                      <button
                        onClick={() => adjustScore(team.id, -10)}
                        className="rounded border border-white/10 px-1.5 hover:bg-white/10"
                        title="-10"
                      >
                        −
                      </button>
                      <button onClick={() => startEditScore(team)} className="hover:underline">
                        {team.score} poin
                      </button>
                      <button
                        onClick={() => adjustScore(team.id, 10)}
                        className="rounded border border-white/10 px-1.5 hover:bg-white/10"
                        title="+10"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <TeamCardInfo team={team} matchCode={state.matchCode} call={call} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => showTeamQr(team)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                    title="Tampilkan QR code langsung ke bel tim ini"
                  >
                    🔳
                  </button>
                  <button
                    onClick={() => copyBuzzerLink(team)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                    title="Salin link tombol buzz untuk tim ini"
                  >
                    {copiedTeamId === team.id ? "Tersalin!" : "🔗"}
                  </button>
                  <button
                    onClick={() => call("admin:remove-team", { matchCode: state.matchCode, teamId: team.id })}
                    className="rounded-lg border border-buzz-500/40 px-2 py-1 text-xs text-buzz-400 hover:bg-buzz-500/10"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Kontrol Soal ---- */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a8371]">
            Soal {state.currentIndex >= 0 ? state.currentIndex + 1 : "-"} / {state.totalQuestions}
          </h2>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-[#8a8371]">
            {state.phase}
          </span>
        </div>

        {state.phase === "ended" ? (
          <EndedPanel teams={state.teams} />
        ) : state.phase === "lobby" ? (
          <div className="text-center">
            <p className="mb-4 text-[#8a8371]">Sesi siap. Tampilkan soal pertama saat semua tim sudah bergabung.</p>
            <button
              disabled={state.teams.length < 1}
              onClick={() => call("admin:show-question", { matchCode: state.matchCode, index: 0 })}
              className="rounded-xl bg-brand-500 px-6 py-3 font-semibold hover:bg-brand-600 disabled:opacity-40"
            >
              Tampilkan Soal #1
            </button>
            {state.teams.length < 1 && (
              <p className="mt-2 text-xs text-[#8a8371]">Tambahkan minimal 1 tim dulu.</p>
            )}
          </div>
        ) : (
          state.currentQuestion && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-500">
                    {state.currentQuestion.type}
                    {state.currentQuestion.isSimultaneous && (
                      <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        ⚡ SEMUA TIM MENJAWAB
                      </span>
                    )}
                  </p>
                  {(state.phase === "question-shown" || state.phase === "buzzed" || state.phase === "simultaneous") && (
                    <button
                      onClick={() => call("admin:skip-question", { matchCode: state.matchCode })}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-[#8a8371] hover:bg-white/10"
                    >
                      ⏭ Skip Soal (tanpa pengaruh skor)
                    </button>
                  )}
                </div>
                {state.currentQuestion.mediaType !== "NONE" && (
                  <div className={state.currentQuestion.mediaType === "IMAGE" ? "mt-2 h-28 w-28" : "mt-2 w-56"}>
                    <MediaBlock
                      mediaType={state.currentQuestion.mediaType}
                      mediaUrl={state.currentQuestion.mediaUrl}
                      className={
                        state.currentQuestion.mediaType === "IMAGE"
                          ? "h-full w-full rounded-lg border border-white/10 object-cover"
                          : "w-full rounded-lg border border-white/10"
                      }
                    />
                  </div>
                )}
                <p className="mt-1 text-lg">{state.currentQuestion.text}</p>
                {state.currentQuestion.options && (
                  <ul className="mt-2 grid gap-1 text-sm text-[#8a8371]">
                    {state.currentQuestion.options.map((opt, i) => (
                      <li key={i}>
                        {String.fromCharCode(65 + i)}. {opt}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 inline-block rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-sm text-green-300">
                  Jawaban benar: {state.currentQuestion.correctAnswerDisplay}
                </p>
                {state.currentQuestion.acceptableAnswers && state.currentQuestion.acceptableAnswers.length > 0 && (
                  <p className="mt-2 text-sm text-[#c9c2ac]">
                    Kemungkinan jawaban lain: {state.currentQuestion.acceptableAnswers.join(", ")}
                  </p>
                )}
              </div>

              {state.phase === "question-shown" && (
                <div>
                  <p className="mb-2 text-sm text-[#8a8371]">
                    Menunggu tim buzz... atau tandai manual tim yang mengangkat tangan:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {state.teams.map((team) => {
                      const excluded = state.excludedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          disabled={excluded}
                          onClick={() => call("admin:mark-buzzed", { matchCode: state.matchCode, teamId: team.id })}
                          title={excluded ? "Tim ini sudah mencoba & salah untuk soal ini" : undefined}
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:border-brand-500 hover:text-brand-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-inherit"
                        >
                          ✋ {team.name}
                        </button>
                      );
                    })}
                  </div>

                  {state.skipEnabled && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-[#8a8371]">
                        Vote Skip Soal ({state.skipVotes.length}/{state.teams.length})
                      </p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {state.teams.map((team) => (
                          <span
                            key={team.id}
                            className={state.skipVotes.includes(team.id) ? "text-green-400" : "text-slate-500"}
                          >
                            {team.name} {state.skipVotes.includes(team.id) ? "✅" : "❌"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {state.phase === "buzzed" && (
                <div className="rounded-xl border border-brand-500/50 bg-brand-500/10 p-4">
                  <p className="font-semibold text-brand-400">
                    {state.teams.find((t) => t.id === state.buzzedTeamId)?.name ?? "Tim"} sedang menjawab
                  </p>
                  {remainingSec !== null && (
                    <p className="mt-1 text-3xl font-bold tabular-nums">{remainingSec.toFixed(1)}s</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => call("admin:score", { matchCode: state.matchCode, correct: true })}
                      className="rounded-lg bg-green-500/90 px-4 py-2 font-semibold text-black hover:bg-green-400"
                    >
                      ✓ Benar
                    </button>
                    <button
                      onClick={() => call("admin:score", { matchCode: state.matchCode, correct: false })}
                      className="rounded-lg bg-red-500/90 px-4 py-2 font-semibold text-black hover:bg-red-400"
                    >
                      ✗ Salah
                    </button>
                    <button
                      onClick={() => call("admin:reset-buzz", { matchCode: state.matchCode })}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      ↺ Reset (salah tim)
                    </button>
                  </div>
                </div>
              )}

              {state.phase === "simultaneous" && state.currentQuestion && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
                  {(() => {
                    const simQuestion = state.currentQuestion!;
                    return (
                  <>
                  <p className="mb-1 font-semibold text-amber-300">⚡ Ronde Semua Tim Menjawab</p>
                  <p className="mb-3 text-sm text-[#8a8371]">
                    Bukan rebutan bel — tiap tim jawab lewat halaman Buzzer masing-masing (jawaban tim lain TIDAK
                    terlihat oleh tim lain). Nilai satu-satu di bawah. Salah TIDAK mengurangi poin. Kartu strategi
                    tidak berlaku di soal ini.
                    <br />
                    Kunci jawaban: <span className="font-semibold text-[#c9c2ac]">{simQuestion.correctAnswerDisplay}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    {state.teams.map((team) => {
                      const grade = state.simultaneousGrades[team.id];
                      const answer = state.simultaneousAnswers[team.id];
                      return (
                        <div
                          key={team.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{team.name}</span>
                            <span className="text-xs text-[#8a8371]">
                              {answer
                                ? `Jawaban: ${formatSimAnswer(simQuestion, answer.value)}`
                                : "Belum mengirim jawaban..."}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {grade && (
                              <span className={grade === "correct" ? "text-sm text-green-400" : "text-sm text-red-400"}>
                                {grade === "correct" ? "✓ Benar" : "✗ Salah"}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                call("admin:grade-simultaneous", { matchCode: state.matchCode, teamId: team.id, correct: true })
                              }
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                grade === "correct" ? "bg-green-500 text-black" : "bg-green-500/20 text-green-300 hover:bg-green-500/40"
                              }`}
                            >
                              ✓ Benar
                            </button>
                            <button
                              onClick={() =>
                                call("admin:grade-simultaneous", { matchCode: state.matchCode, teamId: team.id, correct: false })
                              }
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                grade === "wrong" ? "bg-red-500 text-black" : "bg-red-500/20 text-red-300 hover:bg-red-500/40"
                              }`}
                            >
                              ✗ Salah
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => call("admin:next-question", { matchCode: state.matchCode })}
                    className="mt-4 rounded-xl bg-brand-500 px-5 py-2.5 font-semibold hover:bg-brand-600"
                  >
                    {state.currentIndex + 1 >= state.totalQuestions ? "Selesaikan Sesi" : "Soal Berikutnya ›"}
                  </button>
                  {state.teams.some((t) => !state.simultaneousGrades[t.id]) && (
                    <p className="mt-2 text-xs text-amber-300/80">
                      Masih ada tim yang belum dinilai — tetap bisa lanjut, tim yang belum dinilai dianggap tidak
                      mendapat poin untuk soal ini.
                    </p>
                  )}
                  </>
                    );
                  })()}
                </div>
              )}

              {state.phase === "revealed" && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-lg font-bold">
                    {state.lastOutcome ? OUTCOME_LABEL[state.lastOutcome] : ""} —{" "}
                    {state.teams.find((t) => t.id === state.buzzedTeamId)?.name ?? "Tim"}
                  </p>
                  <p className="mt-1 text-sm text-[#8a8371]">
                    Soal tetap tampil sampai kamu memutuskan langkah berikutnya.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => call("admin:reopen-for-others", { matchCode: state.matchCode })}
                      className="rounded-xl border border-brand-500/40 px-5 py-2.5 font-semibold text-brand-400 hover:bg-brand-500/10"
                    >
                      🤚 Beri Kesempatan Tim Lain
                    </button>
                    <button
                      onClick={() => call("admin:next-question", { matchCode: state.matchCode })}
                      className="rounded-xl bg-brand-500 px-5 py-2.5 font-semibold hover:bg-brand-600"
                    >
                      {state.currentIndex + 1 >= state.totalQuestions ? "Selesaikan Sesi" : "Soal Berikutnya ›"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </section>

      {/* ---- Pengaturan Kartu (host mengatur jumlah kartu tiap tim) ---- */}
      {state.teams.length > 0 && <CardSettingsPanel state={state} call={call} />}

      {/* ---- Riwayat Perubahan Stok Kartu oleh Host ---- */}
      {state.cardAdminLog.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8a8371]">
            Riwayat Perubahan Kartu
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {state.cardAdminLog.slice(0, 12).map((entry, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[#c9c2ac]">
                {entry.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Log Kartu Strategi ---- */}
      {state.strategyCardsPerTeam > 0 && state.cardLog.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8a8371]">
            Log Kartu Strategi
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {state.cardLog.slice(0, 12).map((entry, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <CardIcon id={entry.cardId} size={16} /> <strong>{entry.teamName}</strong> pakai {entry.cardName}
                  {entry.targetName ? ` → ${entry.targetName}` : ""}{" "}
                  <span className="text-[#8a8371]">(soal #{entry.questionIndex + 1})</span>
                </span>
                <span className={entry.outcome === "berhasil" ? "text-green-400" : "text-slate-500"}>
                  {entry.outcome === "berhasil" ? "✓ berhasil" : "✗ hangus"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#14161f] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">{qrModal.title}</h3>
            <p className="text-sm text-[#8a8371]">{qrModal.subtitle}</p>
            <QrCode value={qrModal.url} size={240} />
            <p className="max-w-[240px] truncate text-xs text-[#8a8371]">{qrModal.url}</p>
            <button
              onClick={() => setQrModal(null)}
              className="mt-1 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold hover:bg-brand-600"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Badge stok kartu tim + kontrol resolve manual kalau ada kartu 'pending'. */
/** Format jawaban mentah yang dikirim tim di ronde "Semua Tim Menjawab" jadi teks yang gampang dibaca host. */
function formatSimAnswer(
  q: { type: QuestionType; options: string[] | null },
  value: string | number | boolean
): string {
  if (q.type === "MULTIPLE_CHOICE" && typeof value === "number" && q.options) {
    const letter = String.fromCharCode(65 + value);
    return `${letter}. ${q.options[value] ?? "?"}`;
  }
  if (q.type === "TRUE_FALSE") return value ? "BENAR" : "SALAH";
  return String(value);
}

function TeamCardInfo({
  team,
  matchCode,
  call,
}: {
  team: AdminTeam;
  matchCode: string;
  call: (event: string, payload: Record<string, unknown>) => void;
}) {
  const stockIds = Object.keys(team.cardStock) as CardId[];
  if (stockIds.length === 0 && !team.activeCard) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {stockIds.map((id) => (
        <span
          key={id}
          title={cardType(id).name}
          className="flex items-center gap-1 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[11px] text-[#c9c2ac]"
        >
          <CardIcon id={id} size={14} /> {team.cardStock[id]}
        </span>
      ))}
      {team.activeCard && (
        <span className="flex items-center gap-1 rounded border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[11px] text-yellow-300">
          <CardIcon id={team.activeCard.cardId} size={14} /> {cardType(team.activeCard.cardId).name}
          {team.activeCard.target ? ` → ${team.activeCard.target.name}` : ""}
          {team.activeCard.status === "pending" && (
            <>
              <button
                title="Tandai berhasil"
                onClick={() => call("admin:resolve-card", { matchCode, teamId: team.id, outcome: "berhasil" })}
                className="ml-1 rounded bg-green-500/80 px-1 font-bold text-black hover:bg-green-400"
              >
                ✓
              </button>
              <button
                title="Tandai hangus"
                onClick={() => call("admin:resolve-card", { matchCode, teamId: team.id, outcome: "hangus" })}
                className="rounded bg-red-500/80 px-1 font-bold text-black hover:bg-red-400"
              >
                ✗
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Panel "Pengaturan Kartu" milik host: atur jumlah TOTAL tiap jenis kartu per tim, atau
 * untuk semua tim sekaligus, lewat tombol +/- atau input angka langsung. Semua perubahan
 * tersinkron realtime ke halaman tim lewat broadcast admin-state (tidak perlu refresh).
 */
function CardSettingsPanel({
  state,
  call,
}: {
  state: AdminMatchState;
  call: (event: string, payload: Record<string, unknown>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function totalFor(team: AdminTeam, cardId: CardId): number {
    return (team.cardStock[cardId] ?? 0) + (team.cardStockUsed[cardId] ?? 0);
  }

  function adjust(teamId: string | "all", cardId: CardId, delta: number) {
    call("admin:adjust-card-quantity", { matchCode: state.matchCode, teamId, cardId, delta });
  }

  function commitDraft(key: string, teamId: string | "all", cardId: CardId) {
    const raw = drafts[key];
    if (raw === undefined) return;
    const value = Number(raw);
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    if (!Number.isFinite(value) || value < 0) return;
    call("admin:set-card-quantity", { matchCode: state.matchCode, teamId, cardId, total: Math.round(value) });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[#8a8371]">🃏 Pengaturan Kartu</h2>
      <p className="mb-4 text-xs text-[#8a8371]">
        Atur jumlah TOTAL kartu tiap tim. Tidak bisa diturunkan sampai lebih kecil dari jumlah yang sudah dipakai.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[#8a8371]">
              <th className="px-2 py-1">Kartu</th>
              {state.teams.map((team) => (
                <th key={team.id} className="px-2 py-1 text-center">
                  {team.name}
                </th>
              ))}
              <th className="px-2 py-1 text-center text-brand-400">Semua Tim</th>
            </tr>
          </thead>
          <tbody>
            {CARD_TYPES.map((cardDef) => (
              <tr key={cardDef.id} className="rounded-xl bg-black/20">
                <td className="whitespace-nowrap rounded-l-xl border border-r-0 border-white/10 px-2 py-2">
                  <span className="flex items-center gap-2">
                    <CardIcon id={cardDef.id} size={18} />
                    {cardDef.name}
                  </span>
                </td>
                {state.teams.map((team) => {
                  const key = `${team.id}:${cardDef.id}`;
                  const total = totalFor(team, cardDef.id);
                  return (
                    <td key={team.id} className="border-y border-white/10 px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => adjust(team.id, cardDef.id, -1)}
                          className="h-6 w-6 rounded border border-white/10 text-xs hover:bg-white/10"
                          title="-1"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={drafts[key] ?? total}
                          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                          onBlur={() => commitDraft(key, team.id, cardDef.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-12 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-sm"
                        />
                        <button
                          onClick={() => adjust(team.id, cardDef.id, 1)}
                          className="h-6 w-6 rounded border border-white/10 text-xs hover:bg-white/10"
                          title="+1"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="rounded-r-xl border border-l-0 border-white/10 px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => adjust("all", cardDef.id, -1)}
                      className="h-6 w-6 rounded border border-brand-500/40 text-xs text-brand-400 hover:bg-brand-500/10"
                      title="-1 semua tim"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      placeholder="±"
                      value={drafts[`all:${cardDef.id}`] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [`all:${cardDef.id}`]: e.target.value }))}
                      onBlur={() => commitDraft(`all:${cardDef.id}`, "all", cardDef.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-12 rounded border border-brand-500/40 bg-black/30 px-1 py-0.5 text-center text-sm"
                    />
                    <button
                      onClick={() => adjust("all", cardDef.id, 1)}
                      className="h-6 w-6 rounded border border-brand-500/40 text-xs text-brand-400 hover:bg-brand-500/10"
                      title="+1 semua tim"
                    >
                      +
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EndedPanel({ teams }: { teams: MatchTeam[] }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div>
      <p className="mb-4 text-center text-lg font-semibold text-brand-500">🏆 Sesi Selesai</p>
      <ul className="flex flex-col gap-2">
        {sorted.map((t, i) => (
          <li
            key={t.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              i === 0 ? "border-brand-500 bg-brand-500/10" : "border-white/10 bg-black/20"
            }`}
          >
            <span>
              {MEDALS[i] ?? `#${i + 1}`} {t.name}
            </span>
            <span className="font-semibold">{t.score} poin</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-sm text-[#8a8371]">
        Hasil ini otomatis tersimpan.{" "}
        <Link href="/dashboard/hasil" className="text-brand-500 hover:underline">
          Lihat & unduh Excel/PDF di Riwayat Hasil ›
        </Link>
      </p>
    </div>
  );
}
