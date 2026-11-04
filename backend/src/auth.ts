import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Sengaja langsung gagal saat start-up daripada diam-diam pakai kunci
  // lemah — token host menjaga akses ke bank soal & kuis, jadi harus jelas.
  throw new Error(
    "JWT_SECRET belum di-set. Isi di file .env (lihat .env.example)."
  );
}

const TOKEN_EXPIRY = "30d";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function signToken(teacherId: string): string {
  return jwt.sign({ sub: teacherId }, JWT_SECRET as string, {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function verifyToken(token: string): { teacherId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as { sub: string };
    return { teacherId: payload.sub };
  } catch {
    return null;
  }
}

// Menambahkan field teacherId ke Request setelah lolos auth.
declare global {
  namespace Express {
    interface Request {
      teacherId?: string;
    }
  }
}

/** Middleware: wajib login Host. Ambil token dari header "Authorization: Bearer <token>". */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Belum login. Sertakan token di header Authorization." });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Token tidak valid atau sudah kedaluwarsa. Login ulang." });
    return;
  }

  req.teacherId = payload.teacherId;
  next();
}
