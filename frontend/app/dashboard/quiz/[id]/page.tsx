"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getQuizDetail,
  updateQuizSettings,
  listQuestions,
  addQuestionToQuiz,
  removeQuestionFromQuiz,
  Quiz,
  Question,
  ApiError,
} from "@/lib/api";

type QuizQuestionRow = {
  id: string;
  order: number;
  thinkTimeSec: number;
  answerTimeSec: number;
  question: Question;
};

export default function QuizDetailPage() {
  const params = useParams<{ id: string }>();
  const quizId = params.id;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [rows, setRows] = useState<QuizQuestionRow[]>([]);
  const [bank, setBank] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pickerDifficulty, setPickerDifficulty] = useState<"ALL" | "MUDAH" | "SEDANG" | "SUSAH">("ALL");

  function refresh() {
    setLoading(true);
    Promise.all([getQuizDetail(quizId), listQuestions()])
      .then(([detail, questions]) => {
        setQuiz(detail.quiz);
        setRows(detail.questions);
        setBank(questions.questions);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat kuis."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [quizId]);

  async function saveSetting(patch: Partial<Quiz>) {
    if (!quiz) return;
    setSavingSettings(true);
    try {
      const res = await updateQuizSettings(quiz.id, patch);
      setQuiz((prev) => (prev ? { ...prev, ...res.quiz } : prev));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddQuestion(questionId: string) {
    try {
      await addQuestionToQuiz(quizId, { questionId });
      refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menambah soal.");
    }
  }

  async function handleRemoveQuestion(quizQuestionId: string) {
    try {
      await removeQuestionFromQuiz(quizId, quizQuestionId);
      setRows((prev) => prev.filter((r) => r.id !== quizQuestionId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus soal dari kuis.");
    }
  }

  if (loading) return <p className="text-slate-400">Memuat kuis...</p>;
  if (error || !quiz)
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
        {error ?? "Kuis tidak ditemukan."}
      </p>
    );

  const usedIds = new Set(rows.map((r) => r.question.id));
  const available = bank
    .filter((q) => !usedIds.has(q.id))
    .filter((q) => pickerDifficulty === "ALL" || q.difficulty === pickerDifficulty);

  // Pratinjau titik ronde "Semua Tim Menjawab" (1/4, 2/4, 3/4) berdasarkan urutan saat ini —
  // perhitungan final yang sesungguhnya dilakukan server saat sesi live dibuat (bisa beda kalau
  // urutan soal diacak random saat itu).
  const simultaneousPreviewIndexes = (() => {
    if (!quiz.simultaneousRoundEnabled || rows.length < 4) return new Set<number>();
    const n = rows.length;
    return new Set([Math.floor(n / 4), Math.floor(n / 2), Math.floor((n * 3) / 4)].map((i) => Math.min(i, n - 1)));
  })();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link href="/dashboard/quiz" className="text-sm text-slate-400 hover:text-slate-200">
          ‹ Kuis Saya
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          <Link
            href={`/dashboard/quiz/${quiz.id}/present`}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-600"
          >
            ▶ Mulai Sesi Live
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pengaturan Poin & Fitur
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberSetting
            label="Poin jawaban benar"
            value={quiz.pointsCorrect}
            onSave={(v) => saveSetting({ pointsCorrect: v })}
          />
          <NumberSetting
            label="Pengurangan jika salah"
            value={quiz.pointsWrongPenalty}
            onSave={(v) => saveSetting({ pointsWrongPenalty: v })}
          />
          <NumberSetting
            label="Pengurangan jika waktu habis"
            value={quiz.pointsTimeoutPenalty}
            onSave={(v) => saveSetting({ pointsTimeoutPenalty: v })}
          />
          <NumberSetting
            label="Kartu strategi per tim"
            value={quiz.strategyCardsPerTeam}
            onSave={(v) => saveSetting({ strategyCardsPerTeam: v })}
            hint="0 = fitur nonaktif"
          />
          <label className="flex flex-col gap-1 text-sm">
            Voting Skip Soal
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => saveSetting({ skipEnabled: !quiz.skipEnabled })}
              className={`rounded-xl px-4 py-2 text-left ${
                quiz.skipEnabled
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-black/20 text-slate-400"
              }`}
            >
              {quiz.skipEnabled ? "Aktif" : "Nonaktif"}
            </button>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Mode Tingkat Kesulitan
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => saveSetting({ difficultyModeEnabled: !quiz.difficultyModeEnabled })}
              className={`rounded-xl px-4 py-2 text-left ${
                quiz.difficultyModeEnabled
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-black/20 text-slate-400"
              }`}
            >
              {quiz.difficultyModeEnabled ? "Aktif" : "Nonaktif"}
            </button>
            <span className="text-xs text-slate-500">Filter/susun soal per label Mudah/Sedang/Susah supaya tidak monoton</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ronde Semua Tim Menjawab
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => saveSetting({ simultaneousRoundEnabled: !quiz.simultaneousRoundEnabled })}
              className={`rounded-xl px-4 py-2 text-left ${
                quiz.simultaneousRoundEnabled
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-black/20 text-slate-400"
              }`}
            >
              {quiz.simultaneousRoundEnabled ? "Aktif" : "Nonaktif"}
            </button>
            <span className="text-xs text-slate-500">
              Soal di titik 1/4, 2/4, 3/4 urutan kuis otomatis dijawab SEMUA tim sekaligus (bukan rebutan bel);
              salah tidak mengurangi poin
            </span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Soal di Kuis Ini ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-slate-500">
            Belum ada soal. Tambahkan dari bank soal di bawah.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  {r.question.text}
                  {r.question.difficulty && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                      {DIFFICULTY_BADGE[r.question.difficulty]}
                    </span>
                  )}
                  {simultaneousPreviewIndexes.has(i) && (
                    <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">
                      ⚡ Serentak
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleRemoveQuestion(r.id)}
                  className="text-sm text-red-400 hover:underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tambah dari Bank Soal
        </h2>
        {quiz.difficultyModeEnabled && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Filter:</span>
            {(["ALL", "MUDAH", "SEDANG", "SUSAH"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setPickerDifficulty(d)}
                className={`rounded-full px-3 py-1 text-xs ${
                  pickerDifficulty === d ? "bg-brand-500 text-white" : "bg-black/20 text-slate-400 hover:bg-white/10"
                }`}
              >
                {d === "ALL" ? "Semua" : DIFFICULTY_BADGE[d]}
              </button>
            ))}
          </div>
        )}
        {available.length === 0 ? (
          <p className="text-sm text-slate-500">
            Semua soal di bank soal sudah dipakai, atau bank soal masih kosong.{" "}
            <Link href="/dashboard/bank-soal" className="text-brand-500 hover:underline">
              Tambah soal baru
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  {q.text}
                  {q.difficulty && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                      {DIFFICULTY_BADGE[q.difficulty]}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleAddQuestion(q.id)}
                  className="text-sm text-brand-500 hover:underline"
                >
                  + Tambah
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const DIFFICULTY_BADGE: Record<"MUDAH" | "SEDANG" | "SUSAH", string> = {
  MUDAH: "🟢 Mudah",
  SEDANG: "🟡 Sedang",
  SUSAH: "🔴 Susah",
};

function NumberSetting({
  label,
  value,
  onSave,
  hint,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
  hint?: string;
}) {
  const [local, setLocal] = useState(value);

  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="number"
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onBlur={() => local !== value && onSave(local)}
        className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
      />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
