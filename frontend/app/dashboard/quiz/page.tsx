"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listQuizzes, createQuiz, Quiz, ApiError } from "@/lib/api";

export default function QuizListPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    listQuizzes()
      .then((res) => setQuizzes(res.quizzes))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat kuis."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createQuiz(title.trim());
      setQuizzes((prev) => [{ ...res.quiz, questionCount: 0 }, ...prev]);
      setTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat kuis.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Kuis Saya</h1>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul kuis, misal: Cerdas Cermat IPA Kelas 5"
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
        >
          {creating ? "Membuat..." : "+ Buat Kuis"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-400">Memuat kuis...</p>
      ) : quizzes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-slate-500">
          Belum ada kuis. Buat kuis pertamamu di atas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quizzes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/dashboard/quiz/${q.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 hover:border-brand-500/50"
              >
                <div>
                  <p className="font-medium">{q.title}</p>
                  <p className="text-sm text-slate-400">{q.questionCount} soal</p>
                </div>
                <span className="text-slate-500">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
