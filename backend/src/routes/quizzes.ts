import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

const createQuizSchema = z.object({
  title: z.string().trim().min(1, "Judul kuis wajib diisi").max(120),
});

quizzesRouter.get("/", async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.teacherId! },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true } } },
  });
  res.json({
    quizzes: quizzes.map((q: (typeof quizzes)[number]) => ({
      id: q.id,
      title: q.title,
      pointsCorrect: q.pointsCorrect,
      pointsWrongPenalty: q.pointsWrongPenalty,
      pointsTimeoutPenalty: q.pointsTimeoutPenalty,
      skipEnabled: q.skipEnabled,
      strategyCardsPerTeam: q.strategyCardsPerTeam,
      // NOTE: `as any` di sini karena sandbox pengembangan ini tidak bisa regenerate
      // @prisma/client (lihat catatan panjang di routes/questions.ts::toResponse).
      // Field ini SUDAH ada di schema.prisma — akan typecheck normal lagi begitu
      // `npx prisma generate` dijalankan di mesin dengan akses internet penuh.
      difficultyModeEnabled: (q as any).difficultyModeEnabled ?? false,
      simultaneousRoundEnabled: (q as any).simultaneousRoundEnabled ?? false,
      questionCount: q._count.questions,
      createdAt: q.createdAt,
    })),
  });
});

quizzesRouter.post("/", async (req, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const quiz = await prisma.quiz.create({
    data: { teacherId: req.teacherId!, title: parsed.data.title },
  });
  res.status(201).json({ quiz });
});

const settingsSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pointsCorrect: z.number().int().min(0).optional(),
  pointsWrongPenalty: z.number().int().min(0).optional(),
  pointsTimeoutPenalty: z.number().int().min(0).optional(),
  skipEnabled: z.boolean().optional(),
  strategyCardsPerTeam: z.number().int().min(0).max(20).optional(),
  difficultyModeEnabled: z.boolean().optional(),
  simultaneousRoundEnabled: z.boolean().optional(),
});

async function findOwnedQuiz(quizId: string, teacherId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.teacherId !== teacherId) return null;
  return quiz;
}

quizzesRouter.get("/:id", async (req, res) => {
  const quiz = await findOwnedQuiz(req.params.id, req.teacherId!);
  if (!quiz) {
    res.status(404).json({ message: "Kuis tidak ditemukan." });
    return;
  }
  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: quiz.id },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  res.json({ quiz, questions });
});

quizzesRouter.put("/:id", async (req, res) => {
  const quiz = await findOwnedQuiz(req.params.id, req.teacherId!);
  if (!quiz) {
    res.status(404).json({ message: "Kuis tidak ditemukan." });
    return;
  }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const updated = await prisma.quiz.update({ where: { id: quiz.id }, data: parsed.data as any });
  res.json({ quiz: updated });
});

quizzesRouter.delete("/:id", async (req, res) => {
  const quiz = await findOwnedQuiz(req.params.id, req.teacherId!);
  if (!quiz) {
    res.status(404).json({ message: "Kuis tidak ditemukan." });
    return;
  }
  await prisma.quiz.delete({ where: { id: quiz.id } });
  res.status(204).send();
});

const addQuestionSchema = z.object({
  questionId: z.string().min(1),
  thinkTimeSec: z.number().int().min(1).max(600).optional(),
  answerTimeSec: z.number().int().min(1).max(600).optional(),
});

quizzesRouter.post("/:id/questions", async (req, res) => {
  const quiz = await findOwnedQuiz(req.params.id, req.teacherId!);
  if (!quiz) {
    res.status(404).json({ message: "Kuis tidak ditemukan." });
    return;
  }
  const parsed = addQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const question = await prisma.question.findUnique({ where: { id: parsed.data.questionId } });
  if (!question || question.teacherId !== req.teacherId) {
    res.status(404).json({ message: "Soal tidak ditemukan di bank soal kamu." });
    return;
  }

  const currentCount = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });

  try {
    const quizQuestion = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionId: question.id,
        order: currentCount,
        thinkTimeSec: parsed.data.thinkTimeSec ?? 15,
        answerTimeSec: parsed.data.answerTimeSec ?? 20,
      },
      include: { question: true },
    });
    res.status(201).json({ quizQuestion });
  } catch {
    res.status(409).json({ message: "Soal ini sudah ada di kuis." });
  }
});

quizzesRouter.delete("/:id/questions/:quizQuestionId", async (req, res) => {
  const quiz = await findOwnedQuiz(req.params.id, req.teacherId!);
  if (!quiz) {
    res.status(404).json({ message: "Kuis tidak ditemukan." });
    return;
  }
  const qq = await prisma.quizQuestion.findUnique({ where: { id: req.params.quizQuestionId } });
  if (!qq || qq.quizId !== quiz.id) {
    res.status(404).json({ message: "Soal ini tidak ada di kuis." });
    return;
  }
  await prisma.quizQuestion.delete({ where: { id: qq.id } });
  res.status(204).send();
});
