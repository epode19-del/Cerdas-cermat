"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getResult, MatchResult, ApiError } from "@/lib/api";

export default function HasilDetailPage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getResult(params.id)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat hasil."));
  }, [params.id]);

  async function handleExportExcel() {
    if (!result) return;
    setExporting(true);
    try {
      // Load SheetJS hanya saat dibutuhkan (client-side), bukan di bundle awal.
      const XLSX = await import("xlsx");
      const rows = result.teams.map((t) => ({
        Peringkat: t.rank,
        Tim: t.name,
        Skor: t.score,
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 10 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Hasil");
      const filename = `hasil-${result.quizTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="rounded-lg border border-buzz-500/40 bg-buzz-500/10 px-4 py-3 text-buzz-400">{error}</p>
        <Link href="/dashboard/hasil" className="mt-4 inline-block text-sm text-[#8a8371] hover:text-[#c9c2ac]">
          ‹ Riwayat Hasil
        </Link>
      </div>
    );
  }

  if (!result) return <p className="text-[#8a8371]">Memuat...</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="print:hidden">
        <Link href="/dashboard/hasil" className="text-sm text-[#8a8371] hover:text-[#c9c2ac]">
          ‹ Riwayat Hasil
        </Link>
      </div>

      <div id="print-area" className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{result.quizTitle}</h1>
          <p className="mt-1 text-sm text-[#8a8371]">
            {new Date(result.playedAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
            {" · "}Kode sesi {result.matchCode} · {result.totalQuestions} soal
          </p>
        </div>

        <ol className="flex flex-col gap-2">
          {result.teams.map((t) => (
            <li
              key={t.id}
              className={`flex items-center justify-between rounded-xl border px-5 py-4 ${
                t.rank === 1 ? "border-brand-500 bg-brand-500/10" : "border-white/10 bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="font-display text-lg font-bold text-brand-500">
                  {["🥇", "🥈", "🥉"][t.rank - 1] ?? `#${t.rank}`}
                </span>
                <span className="font-semibold">{t.name}</span>
              </span>
              <span className="font-display text-lg font-bold">{t.score} poin</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-3 print:hidden">
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          {exporting ? "Menyiapkan..." : "⬇ Unduh Excel"}
        </button>
        <button
          onClick={handlePrint}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
        >
          🖨 Cetak / Simpan sebagai PDF
        </button>
      </div>
    </div>
  );
}
