import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const resultsRouter = Router();
resultsRouter.use(requireAuth);

/** GET /api/results — riwayat semua sesi yang pernah dijalankan host ini, terbaru dulu */
resultsRouter.get("/", async (req, res) => {
  const results = await prisma.matchResult.findMany({
    where: { teacherId: req.teacherId },
    orderBy: { playedAt: "desc" },
    include: { teams: { orderBy: { rank: "asc" } } },
  });
  res.json(results);
});

/** GET /api/results/:id — detail satu sesi (dipakai buat halaman ekspor) */
resultsRouter.get("/:id", async (req, res) => {
  const result = await prisma.matchResult.findUnique({
    where: { id: req.params.id },
    include: { teams: { orderBy: { rank: "asc" } } },
  });
  if (!result || result.teacherId !== req.teacherId) {
    return res.status(404).json({ message: "Hasil sesi tidak ditemukan." });
  }
  res.json(result);
});

/** DELETE /api/results/:id — hapus satu riwayat sesi */
resultsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.matchResult.findUnique({ where: { id: req.params.id } });
  if (!result || result.teacherId !== req.teacherId) {
    return res.status(404).json({ message: "Hasil sesi tidak ditemukan." });
  }
  await prisma.matchResult.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
