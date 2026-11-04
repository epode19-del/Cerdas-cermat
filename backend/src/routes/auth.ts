import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../auth";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.teacher.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email sudah terdaftar. Silakan login." });
    return;
  }

  const teacher = await prisma.teacher.create({
    data: { name, email, password: await hashPassword(password) },
  });

  const token = signToken(teacher.id);
  res.status(201).json({
    token,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
  });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

// ---- Mode tamu: langsung masuk tanpa isi form daftar, buat panitia yang
// cuma mau coba cepat. Di belakang layar tetap membuat akun host asli
// (dengan email/password acak) supaya kuis & sesi live tetap bisa dimiliki
// dan disimpan seperti akun biasa. ----
authRouter.post("/guest", async (_req, res) => {
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `tamu-${suffix}@guest.local`;
  const randomPassword = crypto.randomBytes(16).toString("hex");

  const teacher = await prisma.teacher.create({
    data: {
      name: `Panitia Tamu ${suffix}`,
      email,
      password: await hashPassword(randomPassword),
    },
  });

  const token = signToken(teacher.id);
  res.status(201).json({
    token,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }
  const { email, password } = parsed.data;

  const teacher = await prisma.teacher.findUnique({ where: { email } });
  const passwordOk = teacher ? await verifyPassword(password, teacher.password) : false;

  if (!teacher || !passwordOk) {
    // Pesan sengaja disamakan untuk email salah maupun password salah,
    // supaya tidak bocor info "email ini terdaftar atau tidak".
    res.status(401).json({ message: "Email atau password salah." });
    return;
  }

  const token = signToken(teacher.id);
  res.json({
    token,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: req.teacherId! },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!teacher) {
    res.status(404).json({ message: "Akun tidak ditemukan." });
    return;
  }
  res.json({ teacher });
});
