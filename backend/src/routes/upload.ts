import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { requireAuth } from "../auth";

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "videos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/ogg",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — video disimpan lokal di server, jaga wajar
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Format video tidak didukung. Gunakan MP4, WebM, MOV, atau AVI."));
      return;
    }
    cb(null, true);
  },
});

/** POST /api/upload/video — multipart form-data, field name "video". Balikin path relatif untuk disimpan sebagai mediaUrl soal. */
uploadRouter.post("/video", (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err.message ?? "Gagal upload video." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "Tidak ada file video yang dikirim." });
      return;
    }
    // Path relatif — frontend menggabungkannya dengan alamat backend saat menampilkan.
    res.status(201).json({ url: `/uploads/videos/${req.file.filename}` });
  });
});
