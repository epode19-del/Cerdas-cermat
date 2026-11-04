import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import compression from "compression";
import { Server } from "socket.io";
import { authRouter } from "./routes/auth";
import { questionsRouter } from "./routes/questions";
import { quizzesRouter } from "./routes/quizzes";
import { resultsRouter } from "./routes/results";
import { uploadRouter } from "./routes/upload";
import { registerMatchHandlers } from "./matchGateway";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
// Comma-separated list of allowed frontend origins, e.g.
// "http://localhost:3000,https://your-app.vercel.app"
const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
// Kompresi gzip/brotli buat semua respons HTTP (JSON API & file statis) — bikin transfer
// jauh lebih ringan/cepat di koneksi lambat, tanpa mengubah isi respons sama sekali.
app.use(compression());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

// File video/gambar yang di-upload host disimpan di disk lokal server dan
// disajikan langsung dari sini (mis. /uploads/videos/xxxx.mp4).
// Cache-Control panjang + immutable: nama filenya sudah unik per upload (lihat
// routes/upload.ts), jadi kontennya TIDAK PERNAH berubah untuk URL yang sama —
// aman di-cache lama oleh browser peserta supaya tidak berulang kali men-download
// video/gambar yang sama tiap buka halaman (mengurangi buffering & kuota).
// CATATAN DEPLOY: kalau backend di-deploy ke platform dengan disk sementara
// (mis. Railway tanpa volume), file ini bisa hilang saat redeploy — pakai
// link video (YouTube/Vimeo/dsb) untuk video yang perlu bertahan lama, atau
// pasang volume/object storage permanen kalau upload langsung jadi andalan.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    maxAge: "365d",
    immutable: true,
    etag: true,
  })
);

// REST API host: login, bank soal, dan pengaturan kuis.
// Terpisah dari event Socket.IO di bawah, yang khusus untuk jalannya sesi
// live mode buzzer (lihat matchGateway.ts).
app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api/results", resultsRouter);
app.use("/api/upload", uploadRouter);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
  // Kompresi frame WebSocket — payload realtime (public-state, dsb) jadi lebih kecil,
  // penting buat peserta yang koneksi HP/wifi sekolahnya pas-pasan.
  perMessageDeflate: {
    threshold: 1024, // cuma kompres payload yang lumayan besar, biar tidak nambah overhead ke event kecil
  },
});

// Sesi live mode buzzer (admin, layar proyektor, tombol buzz tim) —
// satu-satunya alur realtime yang dipakai aplikasi ini.
registerMatchHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
  console.log(`Allowed frontend origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
