"use client";

import { useEffect, useRef, useState } from "react";
import {
  listQuestions,
  createQuestion,
  deleteQuestion,
  uploadVideo,
  Question,
  QuestionType,
  MediaType,
  Difficulty,
  ApiError,
} from "@/lib/api";
import { fileToCompressedDataUrl } from "@/lib/image";
import { MediaBlock } from "@/components/MediaBlock";

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Pilihan Ganda",
  TRUE_FALSE: "Benar/Salah",
  FILL_IN: "Isian",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  MUDAH: "🟢 Mudah",
  SEDANG: "🟡 Sedang",
  SUSAH: "🔴 Susah",
};

/** Bentuk file .json yang diunduh/diimpor lewat tombol Unduh & Impor Soal. */
interface QuestionExportFile {
  format: "cerdas-cermat-bank-soal";
  version: 1;
  exportedAt: string;
  questions: Array<Record<string, unknown>>;
}

export default function BankSoalPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "ALL">("ALL");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  function refresh() {
    setLoading(true);
    listQuestions()
      .then((res) => setQuestions(res.questions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat soal."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleDelete(id: string) {
    if (!confirm("Hapus soal ini dari bank soal?")) return;
    try {
      await deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus soal.");
    }
  }

  /** Unduh SEMUA soal di bank soal jadi satu file .json — bisa dipakai lagi lewat "Impor Soal". */
  function handleDownload() {
    const payload: QuestionExportFile = {
      format: "cerdas-cermat-bank-soal",
      version: 1,
      exportedAt: new Date().toISOString(),
      // id & createdAt sengaja tidak disertakan — akan dibuat baru otomatis saat diimpor.
      questions: questions.map(({ id, createdAt, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bank-soal-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Impor soal dari file .json yang diunduh sebelumnya — otomatis masuk ke bank soal, tanpa isi form manual. */
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // supaya bisa pilih file yang sama lagi kalau perlu
    if (!file) return;

    setImportMsg(null);
    setImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      const items: Array<Record<string, unknown>> = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
      if (items.length === 0) {
        setImportMsg("File tidak berisi soal yang bisa dibaca.");
        return;
      }

      let ok = 0;
      let failed = 0;
      for (const item of items) {
        try {
          const type = item.type as QuestionType;
          if (type !== "MULTIPLE_CHOICE" && type !== "TRUE_FALSE" && type !== "FILL_IN") {
            failed++;
            continue;
          }
          const base = {
            text: String(item.text ?? ""),
            mediaType: (item.mediaType as MediaType) ?? "NONE",
            mediaUrl: (item.mediaUrl as string | null) ?? null,
            acceptableAnswers: (item.acceptableAnswers as string[] | null) ?? null,
            clue: (item.clue as string | null) ?? null,
          };
          if (!base.text.trim()) {
            failed++;
            continue;
          }
          if (type === "MULTIPLE_CHOICE") {
            await createQuestion({
              ...base,
              type,
              options: (item.options as string[]) ?? [],
              correctIndex: Number(item.correctIndex ?? 0),
            });
          } else if (type === "TRUE_FALSE") {
            await createQuestion({ ...base, type, correctAnswer: Boolean(item.correctAnswer) });
          } else {
            await createQuestion({ ...base, type, correctAnswer: String(item.correctAnswer ?? "") });
          }
          ok++;
        } catch {
          failed++;
        }
      }
      setImportMsg(
        failed > 0 ? `${ok} soal berhasil diimpor, ${failed} gagal (format tidak dikenali).` : `${ok} soal berhasil diimpor.`
      );
      refresh();
    } catch {
      setImportMsg("Gagal membaca file. Pastikan file .json hasil unduhan dari Bank Soal.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Bank Soal</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={questions.length === 0}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            title="Unduh semua soal jadi file .json"
          >
            ⬇ Unduh Soal
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            title="Impor soal dari file .json"
          >
            {importing ? "Mengimpor..." : "⬆ Impor Soal"}
          </button>
          <input ref={importInputRef} type="file" accept=".json,application/json" hidden onChange={handleImportFile} />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium hover:bg-brand-600"
          >
            {showForm ? "Tutup form" : "+ Tambah Soal"}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#c9c2ac]">
          {importMsg}
        </div>
      )}

      {showForm && (
        <QuestionForm
          onCreated={(q) => {
            setQuestions((prev) => [q, ...prev]);
            setShowForm(false);
          }}
        />
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[#8a8371]">Filter tingkat kesulitan:</span>
          {(["ALL", "MUDAH", "SEDANG", "SUSAH"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              className={`rounded-full px-3 py-1 text-xs ${
                difficultyFilter === d ? "bg-brand-500 text-white" : "bg-black/20 text-slate-400 hover:bg-white/10"
              }`}
            >
              {d === "ALL" ? "Semua" : DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Memuat soal...</p>
      ) : questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-slate-500">
          Belum ada soal. Tambahkan soal pertamamu.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions
            .filter((q) => difficultyFilter === "ALL" || q.difficulty === difficultyFilter)
            .map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                {q.mediaType === "IMAGE" && (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                    <MediaBlock mediaType={q.mediaType} mediaUrl={q.mediaUrl} className="h-full w-full object-cover" />
                  </div>
                )}
                {q.mediaType === "VIDEO" && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-2xl">
                    ▶️
                  </div>
                )}
                <div className="flex-1">
                  <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs text-brand-500">
                    {TYPE_LABEL[q.type]}
                  </span>
                  {q.difficulty && (
                    <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </span>
                  )}
                  {q.mediaType === "VIDEO" && (
                    <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">
                      🎬 Video
                    </span>
                  )}
                  <p className="mt-2">{q.text}</p>
                  {q.type === "MULTIPLE_CHOICE" && (
                    <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
                      {q.options.map((opt, i) => (
                        <li key={i} className={i === q.correctIndex ? "text-emerald-400" : ""}>
                          {i === q.correctIndex ? "✓ " : "· "}
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === "TRUE_FALSE" && (
                    <p className="mt-2 text-sm text-emerald-400">
                      Jawaban benar: {q.correctAnswer ? "Benar" : "Salah"}
                    </p>
                  )}
                  {q.type === "FILL_IN" && (
                    <p className="mt-2 text-sm text-emerald-400">
                      Jawaban benar: {q.correctAnswer}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="shrink-0 text-sm text-red-400 hover:underline"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionForm({ onCreated }: { onCreated: (q: Question) => void }) {
  const [type, setType] = useState<QuestionType>("MULTIPLE_CHOICE");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [trueFalseAnswer, setTrueFalseAnswer] = useState(true);
  const [fillInAnswer, setFillInAnswer] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("NONE");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [clue, setClue] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetMedia() {
    setMediaType("NONE");
    setMediaUrl(null);
    setVideoInput("");
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // biar bisa pilih file yang sama lagi kalau mau ganti
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File yang dipilih bukan gambar.");
      return;
    }
    setImageProcessing(true);
    setError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setMediaType("IMAGE");
      setMediaUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses gambar.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleVideoFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("File yang dipilih bukan video.");
      return;
    }
    setVideoUploading(true);
    setError(null);
    try {
      const res = await uploadVideo(file);
      setMediaType("VIDEO");
      setMediaUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal upload video.");
    } finally {
      setVideoUploading(false);
    }
  }

  function handleVideoLinkSave() {
    const trimmed = videoInput.trim();
    if (!trimmed) return;
    setMediaType("VIDEO");
    setMediaUrl(trimmed);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const cleanedAcceptable = acceptableAnswers.map((a) => a.trim()).filter(Boolean);
    const trimmedClue = clue.trim();
    try {
      let res;
      if (type === "MULTIPLE_CHOICE") {
        const cleaned = options.map((o) => o.trim()).filter(Boolean);
        if (cleaned.length < 2) {
          setError("Isi minimal 2 opsi jawaban.");
          setSaving(false);
          return;
        }
        res = await createQuestion({
          type, text, mediaType, mediaUrl,
          acceptableAnswers: cleanedAcceptable.length ? cleanedAcceptable : null,
          clue: trimmedClue || null,
          difficulty: difficulty || null,
          options: cleaned, correctIndex,
        });
      } else if (type === "TRUE_FALSE") {
        res = await createQuestion({
          type, text, mediaType, mediaUrl,
          acceptableAnswers: cleanedAcceptable.length ? cleanedAcceptable : null,
          clue: trimmedClue || null,
          difficulty: difficulty || null,
          correctAnswer: trueFalseAnswer,
        });
      } else {
        res = await createQuestion({
          type, text, mediaType, mediaUrl,
          acceptableAnswers: cleanedAcceptable.length ? cleanedAcceptable : null,
          clue: trimmedClue || null,
          difficulty: difficulty || null,
          correctAnswer: fillInAnswer,
        });
      }
      setClue("");
      setDifficulty("");
      setAcceptableAnswers([""]);
      onCreated(res.question);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan soal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6"
    >
      <div className="flex gap-2">
        {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              type === t ? "bg-brand-500 text-white" : "bg-black/20 text-slate-400"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Pertanyaan
        <textarea
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span>Media (opsional)</span>

        {mediaType !== "NONE" && mediaUrl ? (
          <div className="flex items-start gap-3">
            {mediaType === "IMAGE" ? (
              <MediaBlock
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                className="h-24 w-24 rounded-lg border border-white/10 object-cover"
              />
            ) : (
              <MediaBlock mediaType={mediaType} mediaUrl={mediaUrl} className="w-56 rounded-lg border border-white/10" />
            )}
            <button
              type="button"
              onClick={resetMedia}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
            >
              Hapus {mediaType === "IMAGE" ? "gambar" : "video"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-slate-400 hover:border-brand-500 hover:text-brand-400">
              <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              {imageProcessing ? "Memproses..." : "📷 Pilih gambar dari perangkat"}
            </label>

            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-slate-400 hover:border-brand-500 hover:text-brand-400">
              <input type="file" accept="video/*" className="hidden" onChange={handleVideoFilePick} />
              {videoUploading ? "Mengunggah..." : "🎥 Upload video dari perangkat"}
            </label>

            <div className="flex items-center gap-2">
              <input
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="🎬 Atau tempel link video (YouTube/Vimeo/.mp4)"
                className="w-64 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={handleVideoLinkSave}
                className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10"
              >
                Pakai
              </button>
            </div>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Clue / Petunjuk (opsional — <span className="text-slate-500">disimpan saja, belum aktif di permainan</span>)
        <input
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          placeholder="Contoh: Ibu kotanya diawali huruf J"
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tingkat Kesulitan (opsional — dipakai kalau kuis mengaktifkan Mode Tingkat Kesulitan)
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
        >
          <option value="">Tanpa label</option>
          <option value="MUDAH">🟢 Mudah</option>
          <option value="SEDANG">🟡 Sedang</option>
          <option value="SUSAH">🔴 Susah</option>
        </select>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span>Kemungkinan Jawaban Lain (opsional — kata kunci/sinonim buat bantu panitia menilai)</span>
        {acceptableAnswers.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={val}
              onChange={(e) => {
                const next = [...acceptableAnswers];
                next[i] = e.target.value;
                setAcceptableAnswers(next);
              }}
              placeholder="Contoh: Jakarta Raya"
              className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-brand-500"
            />
            {acceptableAnswers.length > 1 && (
              <button
                type="button"
                onClick={() => setAcceptableAnswers(acceptableAnswers.filter((_, idx) => idx !== i))}
                className="rounded-lg border border-red-500/40 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
              >
                Hapus
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAcceptableAnswers([...acceptableAnswers, ""])}
          className="w-fit rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-xs text-slate-400 hover:border-brand-500 hover:text-brand-400"
        >
          + Tambah kata kunci
        </button>
      </div>

      {type === "MULTIPLE_CHOICE" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">Opsi jawaban (klik radio untuk tandai benar)</span>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
              />
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Opsi ${i + 1}`}
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
              />
            </div>
          ))}
        </div>
      )}

      {type === "TRUE_FALSE" && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={trueFalseAnswer === true}
              onChange={() => setTrueFalseAnswer(true)}
            />
            Benar
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={trueFalseAnswer === false}
              onChange={() => setTrueFalseAnswer(false)}
            />
            Salah
          </label>
        </div>
      )}

      {type === "FILL_IN" && (
        <label className="flex flex-col gap-1 text-sm">
          Jawaban benar
          <input
            required
            value={fillInAnswer}
            onChange={(e) => setFillInAnswer(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
          />
          <span className="text-xs text-slate-500">
            Dicocokkan tanpa peduli huruf besar/kecil saat kuis berjalan.
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={saving || imageProcessing || videoUploading}
        className="self-start rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "Menyimpan..." : "Simpan Soal"}
      </button>
    </form>
  );
}
