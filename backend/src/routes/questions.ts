import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const questionsRouter = Router();
questionsRouter.use(requireAuth);

const mediaFields = {
  mediaType: z.enum(["NONE", "IMAGE", "VIDEO"]).default("NONE"),
  // IMAGE: data URL base64 (upload langsung, dikompres di browser) atau URL
  // gambar biasa — dibatasi ~3MB base64 supaya tidak membebani database.
  // VIDEO: link ATAU path lokal hasil upload (/uploads/videos/...), dibatasi
  // jauh lebih pendek lewat superRefine di bawah.
  mediaUrl: z.string().trim().max(4_000_000).nullish(),
};

const extraFields = {
  // Kata kunci/sinonim lain yang juga dianggap benar — bantuan buat host
  // menilai jawaban lisan, terutama untuk tipe FILL_IN.
  acceptableAnswers: z.array(z.string().trim().min(1)).max(20).nullish(),
  // Disimpan saja untuk sekarang, belum dipakai saat permainan.
  clue: z.string().trim().max(500).nullish(),
  // Label tingkat kesulitan (opsional) — hanya relevan kalau kuis mengaktifkan Mode Tingkat Kesulitan.
  difficulty: z.enum(["MUDAH", "SEDANG", "SUSAH"]).nullish(),
};

const questionSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("MULTIPLE_CHOICE"),
      text: z.string().trim().min(1, "Teks soal wajib diisi"),
      ...mediaFields,
      ...extraFields,
      options: z.array(z.string().trim().min(1)).min(2, "Minimal 2 opsi").max(6, "Maksimal 6 opsi"),
      correctIndex: z.number().int().min(0),
    }),
    z.object({
      type: z.literal("TRUE_FALSE"),
      text: z.string().trim().min(1, "Teks soal wajib diisi"),
      ...mediaFields,
      ...extraFields,
      correctAnswer: z.boolean(),
    }),
    z.object({
      type: z.literal("FILL_IN"),
      text: z.string().trim().min(1, "Teks soal wajib diisi"),
      ...mediaFields,
      ...extraFields,
      correctAnswer: z.string().trim().min(1, "Jawaban benar wajib diisi"),
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.mediaType !== "NONE" && !v.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link/gambar wajib diisi kalau tipe media dipilih.",
        path: ["mediaUrl"],
      });
    }
    if (v.mediaType === "VIDEO" && (v.mediaUrl?.length ?? 0) > 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link video terlalu panjang — pastikan itu link, bukan file yang di-upload.",
        path: ["mediaUrl"],
      });
    }
  });

function toResponse(q: {
  id: string;
  type: string;
  text: string;
  mediaType: string;
  mediaUrl: string | null;
  acceptableAnswers: unknown;
  clue: string | null;
  options: unknown;
  correctAnswer: string;
  createdAt: Date;
  // NOTE: `difficulty` ada di schema.prisma tapi sandbox pengembangan ini tidak
  // punya akses jaringan ke binaries.prisma.sh, jadi @prisma/client lokal di sini
  // TIDAK bisa di-regenerate untuk memasukkan field ini ke tipe otomatisnya.
  // Dampaknya CUMA di typechecking lokal — jalankan `npx prisma migrate dev`
  // lalu `npx prisma generate` di mesin yang punya akses internet penuh sebelum
  // deploy, lalu hapus semua `as any`/komentar NOTE ini kalau mau tipe ketat lagi.
  difficulty?: "MUDAH" | "SEDANG" | "SUSAH" | null;
}) {
  const common = {
    mediaType: q.mediaType,
    mediaUrl: q.mediaUrl,
    acceptableAnswers: (q.acceptableAnswers as string[] | null) ?? null,
    clue: q.clue,
    difficulty: q.difficulty ?? null,
  };
  // Bentuk ulang biar konsisten dengan payload yang dikirim frontend saat create.
  if (q.type === "MULTIPLE_CHOICE") {
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      ...common,
      options: q.options as string[],
      correctIndex: Number(q.correctAnswer),
      createdAt: q.createdAt,
    };
  }
  if (q.type === "TRUE_FALSE") {
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      ...common,
      correctAnswer: q.correctAnswer === "true",
      createdAt: q.createdAt,
    };
  }
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    ...common,
    correctAnswer: q.correctAnswer,
    createdAt: q.createdAt,
  };
}

questionsRouter.get("/", async (req, res) => {
  const questions = await prisma.question.findMany({
    where: { teacherId: req.teacherId! },
    orderBy: { createdAt: "desc" },
  });
  res.json({ questions: questions.map(toResponse) });
});

questionsRouter.post("/", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const data = parsed.data;

  let options: string[] | null = null;
  let correctAnswer: string;

  if (data.type === "MULTIPLE_CHOICE") {
    if (data.correctIndex >= data.options.length) {
      res.status(400).json({ message: "correctIndex di luar jangkauan opsi." });
      return;
    }
    options = data.options;
    correctAnswer = String(data.correctIndex);
  } else if (data.type === "TRUE_FALSE") {
    correctAnswer = String(data.correctAnswer);
  } else {
    correctAnswer = data.correctAnswer;
  }

  const question = await prisma.question.create({
    data: {
      teacherId: req.teacherId!,
      type: data.type,
      text: data.text,
      mediaType: data.mediaType,
      mediaUrl: data.mediaType === "NONE" ? null : data.mediaUrl ?? null,
      acceptableAnswers: data.acceptableAnswers?.length ? data.acceptableAnswers : undefined,
      clue: data.clue || null,
      difficulty: data.difficulty ?? null,
      options: options ?? undefined,
      correctAnswer,
    } as any,
  });

  res.status(201).json({ question: toResponse(question) });
});

questionsRouter.put("/:id", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.teacherId !== req.teacherId) {
    res.status(404).json({ message: "Soal tidak ditemukan." });
    return;
  }

  const data = parsed.data;
  let options: string[] | null = null;
  let correctAnswer: string;

  if (data.type === "MULTIPLE_CHOICE") {
    if (data.correctIndex >= data.options.length) {
      res.status(400).json({ message: "correctIndex di luar jangkauan opsi." });
      return;
    }
    options = data.options;
    correctAnswer = String(data.correctIndex);
  } else if (data.type === "TRUE_FALSE") {
    correctAnswer = String(data.correctAnswer);
  } else {
    correctAnswer = data.correctAnswer;
  }

  const question = await prisma.question.update({
    where: { id: req.params.id },
    data: {
      type: data.type,
      text: data.text,
      mediaType: data.mediaType,
      mediaUrl: data.mediaType === "NONE" ? null : data.mediaUrl ?? null,
      acceptableAnswers: data.acceptableAnswers?.length ? data.acceptableAnswers : null,
      clue: data.clue || null,
      difficulty: data.difficulty ?? null,
      options: options ?? undefined,
      correctAnswer,
    } as any,
  });

  res.json({ question: toResponse(question) });
});

questionsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.teacherId !== req.teacherId) {
    res.status(404).json({ message: "Soal tidak ditemukan." });
    return;
  }
  await prisma.question.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
