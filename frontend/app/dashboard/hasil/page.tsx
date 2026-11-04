"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listResults, deleteResult, MatchResult, ApiError } from "@/lib/api";

export default function HasilListPage() {
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setResults(await listResults());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat riwayat.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Hapus riwayat sesi ini? Tidak bisa dikembalikan.")) return;
    await deleteResult(id);
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Riwayat Hasil</h1>
        <p className="mt-1 text-sm text-[#c9c2ac]">
          Semua sesi live yang sudah selesai dijalankan, lengkap dengan papan skor akhirnya.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-buzz-500/40 bg-buzz-500/10 px-4 py-3 text-buzz-400">
          {error}
        </p>
      )}

      {results === null && !error && <p className="text-[#8a8371]">Memuat...</p>}

      {results?.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-[#8a8371]">
          Belum ada sesi yang selesai dimainkan. Riwayat akan muncul di sini
          begitu sesi live pertamamu tuntas sampai soal terakhir.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {results?.map((r) => {
          const champion = r.teams.find((t) => t.rank === 1);
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <Link href={`/dashboard/hasil/${r.id}`} className="flex-1">
                <p className="font-semibold">{r.quizTitle}</p>
                <p className="mt-0.5 text-sm text-[#8a8371]">
                  {new Date(r.playedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {r.teams.length} tim · {r.totalQuestions} soal
                </p>
                {champion && (
                  <p className="mt-1 text-sm text-brand-500">
                    🏆 {champion.name} — {champion.score} poin
                  </p>
                )}
              </Link>
              <button
                onClick={() => handleDelete(r.id)}
                className="shrink-0 rounded-lg border border-buzz-500/40 px-3 py-1.5 text-sm text-buzz-400 hover:bg-buzz-500/10"
              >
                Hapus
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
