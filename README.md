# Cerdas Cermat Online

> **Status project ini:** `backend/.env` sudah saya isi dengan `DATABASE_URL`
> dan `JWT_SECRET` yang kamu berikan, jadi kamu tinggal `npm install` lalu
> `npx prisma migrate dev` — tidak perlu isi ulang. **Tapi penting:** karena
> password database itu sempat diketik di chat, sebaiknya kamu ganti password
> database Supabase-nya (Project Settings → Database → Reset database
> password) begitu sempat, lalu update `DATABASE_URL` di `.env` dengan
> password baru. `.env` sendiri sudah otomatis diabaikan git (lihat
> `.gitignore`) jadi tidak akan ikut ter-push ke GitHub.

Fitur yang sudah jalan:

1. **Akun guru + bank soal + kuis** — login/daftar guru (atau mode tamu
   sekali klik), kelola bank soal (pilihan ganda, benar/salah, isian,
   lengkap dengan gambar, upload video langsung, atau link video
   YouTube/Vimeo/link langsung), buat kuis, atur poin benar/salah/waktu
   habis, aktifkan voting skip.
2. **Sesi live mode buzzer** — panel kontrol panitia, layar proyektor
   (tanpa jawaban), tombol buzz per tim (peserta bisa gabung mandiri lewat
   Nama Tim + Kode Sesi di `/gabung`), voting skip soal, dan panitia
   punya kendali penuh atas kapan soal berganti — semua tersambung realtime
   lewat
   Socket.IO. Timer baru berjalan setelah ada tim yang buzz.
3. **Riwayat hasil & ekspor** — papan skor akhir tersimpan otomatis ke
   database, bisa diunduh sebagai Excel atau dicetak ke PDF.

```
cerdas-cermat-realtime/
├── backend/
│   ├── prisma/schema.prisma   Teacher, Question, Quiz, QuizQuestion, MatchResult
│   └── src/
│       ├── server.ts          Express + mount REST API + Socket.IO
│       ├── matches.ts         Mesin sesi live mode buzzer (di memori)
│       ├── matchGateway.ts    Event Socket.IO: admin, layar, tombol buzz
│       ├── auth.ts            Hash password, JWT, middleware requireAuth
│       └── routes/            auth, questions (bank soal), quizzes, results
└── frontend/
    ├── app/login, app/register        Login, daftar, & mode tamu
    ├── app/display/[matchCode]        Layar proyektor (publik, tanpa jawaban)
    ├── app/buzzer/[matchCode]/[teamId] Tombol buzz per tim (publik)
    └── app/dashboard/
        ├── bank-soal/                 List + form tambah soal (3 tipe + gambar)
        ├── quiz/                      List kuis, detail (pengaturan + susun soal)
        ├── quiz/[id]/present/         Panel kontrol panitia (mulai sesi live)
        └── hasil/                     Riwayat hasil + ekspor Excel/PDF
```

---

## 1. Jalankan di komputer sendiri (localhost)

### Prasyarat
Install **Node.js versi 18 ke atas** dari https://nodejs.org (pilih versi LTS).
Cek dengan:
```bash
node -v
npm -v
```

### A. Siapkan database (dibutuhkan untuk login guru, bank soal, & hasil sesi)
Cara tercepat untuk mulai: buat project gratis di
[Supabase](https://supabase.com) atau [Neon](https://neon.tech), lalu salin
**connection string**-nya (biasanya ada di menu Database/Connect).

### B. Jalankan backend
```bash
cd backend
cp .env.example .env
```
Buka file `.env`, isi:
- `DATABASE_URL` → connection string Postgres dari langkah A
- `JWT_SECRET` → string acak, bisa generate dengan
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Lalu jalankan:
```bash
npm install
npx prisma migrate dev --name init
npm run dev
```
`prisma migrate dev` membuat tabel Teacher, Question, Quiz, QuizQuestion di
database kamu. Kalau berhasil, terminal menampilkan
`Realtime server listening on port 4000`.
Buka `http://localhost:4000/health` di browser, harus muncul `{"ok":true}`.

### B. Jalankan frontend (di terminal baru, backend tetap jalan)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Buka `http://localhost:3000`.

### C. Coba fiturnya
1. Buka `http://localhost:3000` → klik **Masuk & Kelola Lomba** → login,
   daftar, atau pakai **Mode Tamu** buat langsung coba tanpa isi form.
2. Tambah beberapa soal di **Bank Soal**, lalu buat kuis di **Kuis Saya**
   dan masukkan soal-soal itu ke kuis tersebut.
3. Buka kuis itu, klik **▶ Mulai Sesi Live** → tambah minimal 1 tim.
4. Klik **🖥 Buka Layar Peserta** (tab baru) dan **🔗 Link Buzz** per tim
   (tab lain juga bisa, buat simulasi) → coba tampilkan soal, buzz, lalu
   nilai benar/salah. Semuanya harusnya ter-update live di semua tab tanpa
   refresh — itu bagian realtime-nya, jalan lewat WebSocket (Socket.IO).

---

## 2. Deploy ke internet (dari nol, gratis untuk mulai)

Kamu butuh 2 tempat hosting: satu untuk **backend** (server yang jalan terus
dan pegang koneksi WebSocket), satu untuk **frontend** (halaman Next.js).

### Langkah 1 — Push project ke GitHub
1. Buat akun di https://github.com kalau belum punya.
2. Buat repository baru, misal `cerdas-cermat-online`.
3. Dari folder project ini:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Cerdas Cermat Online"
   git branch -M main
   git remote add origin https://github.com/USERNAME/cerdas-cermat-online.git
   git push -u origin main
   ```

### Langkah 2 — Deploy backend ke Railway
Railway dipilih karena backend ini perlu proses yang **hidup terus-menerus**
(bukan serverless) supaya koneksi WebSocket stabil — beda kebutuhan dengan
frontend yang bisa serverless di Vercel.

1. Daftar di https://railway.app pakai akun GitHub.
2. **New Project → Deploy from GitHub repo** → pilih repo `cerdas-cermat-online`.
3. Railway biasanya mendeteksi banyak folder (monorepo). Set **Root Directory**
   ke `backend`.
4. Di tab **Variables**, tambahkan:
   - `FRONTEND_ORIGIN` = (isi nanti setelah frontend di-deploy, contoh:
     `https://cerdas-cermat.vercel.app`)
   - `PORT` biasanya sudah otomatis di-set Railway, tidak perlu diisi manual.
5. Set **Start Command**: `npm run build && npm start`.
6. Deploy. Setelah selesai, Railway memberi URL publik, contoh:
   `https://cerdas-cermat-backend-production.up.railway.app`. Catat URL ini.

### Langkah 3 — Deploy frontend ke Vercel
1. Daftar di https://vercel.com pakai akun GitHub.
2. **Add New → Project** → pilih repo yang sama.
3. Saat konfigurasi, set **Root Directory** ke `frontend`.
4. Di **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SOCKET_URL` = URL backend dari Railway (langkah sebelumnya),
     contoh `https://cerdas-cermat-backend-production.up.railway.app`
5. Deploy. Vercel memberi URL, contoh `https://cerdas-cermat.vercel.app`.

### Langkah 4 — Hubungkan balik CORS backend
1. Kembali ke Railway → Variables → update `FRONTEND_ORIGIN` dengan URL Vercel
   asli dari langkah 3.
2. Redeploy backend (Railway biasanya auto-redeploy saat variable berubah).

### Langkah 5 — Tes end-to-end
Buka `https://cerdas-cermat.vercel.app` dari HP dan laptop berbeda, login,
lalu jalankan sesi live seperti di bagian 1.C — layar proyektor dan tombol
buzz harusnya tetap update realtime seperti di localhost.

> Kalau nanti muncul error CORS di console browser, artinya `FRONTEND_ORIGIN`
> di backend belum cocok persis dengan domain frontend (harus termasuk
> `https://`, tanpa garis miring `/` di akhir).

---

## 3. Database — status saat ini

Sudah terhubung. `backend/.env` berisi `DATABASE_URL` ke project Supabase
kamu. Yang perlu dijalankan sekali di awal (dan **setiap kali** skema di
`backend/prisma/schema.prisma` berubah — termasuk update kali ini yang
menambah tabel hasil sesi):
```bash
cd backend
npx prisma migrate dev --name init
```
Kalau sebelumnya sudah pernah migrate, jalankan lagi dengan nama migrasi baru:
```bash
npx prisma migrate dev --name add-match-results
```
Dan kalau kamu baru update ke versi dengan **fitur gambar & video soal**,
migrate sekali lagi (ini juga berlaku kalau sebelumnya sudah sempat migrate
versi gambar-saja — kolomnya sekarang berubah nama):
```bash
npx prisma migrate dev --name add-question-media
```
Dan untuk update **terbaru** (clue soal + kemungkinan jawaban lain), migrate
sekali lagi:
```bash
npx prisma migrate dev --name add-question-clue-and-acceptable-answers
```
Ini membuat/memperbarui tabel `Teacher`, `Question`, `Quiz`, `QuizQuestion`,
`MatchResult`, dan `MatchResultTeam` di database.

Untuk lihat isi database secara visual (enak buat cek data guru/soal/kuis):
```bash
npx prisma studio
```
Membuka dashboard di `http://localhost:5555`.

Saat deploy backend ke Railway nanti, tambahkan `DATABASE_URL` dan
`JWT_SECRET` yang sama persis di tab **Variables** Railway.

---

## 4. Sesi Live Mode Buzzer (Cerdas Cermat Klasik)

Ini fitur inti lombanya: satu layar untuk peserta (proyektor/TV), satu panel
kontrol untuk panitia, dan opsional tombol buzz digital per tim.

### Cara pakai
1. Login sebagai guru, buat kuis di **Kuis Saya** dan isi soal-soalnya
   (lihat bagian Bank Soal).
2. **Penting:** kalau mau skor berkurang saat jawaban salah/waktu habis,
   atur dulu **Pengurangan jika salah** dan **Pengurangan jika waktu habis**
   di halaman pengaturan kuis — defaultnya 0 (tidak ada pengurangan).
3. Buka kuis itu, klik **▶ Mulai Sesi Live**. Sistem otomatis membuat sesi
   dan menampilkan **kode sesi** 6 digit.
4. Tambahkan tim lewat form di panel kontrol (opsional — lihat langkah 6),
   atau biarkan peserta gabung sendiri.
5. Klik **🖥 Buka Layar Peserta** — buka tab ini di laptop yang tersambung ke
   proyektor/TV, lalu fullscreen (F11).
6. **Dua cara tim bergabung:**
   - **Mandiri (disarankan):** peserta buka `/gabung` di HP masing-masing,
     isi Nama Tim + Kode Sesi 6 digit, langsung masuk ke halaman buzzer.
     Nama tim harus unik dalam satu sesi.
   - **Manual oleh panitia:** tambah tim lewat form di panel kontrol, lalu
     klik **🔗 Link Buzz** untuk menyalin link tombol buzz tim itu dan buka
     di HP tim tersebut.
7. Klik **Tampilkan Soal #1**. Soal muncul di layar peserta **tanpa jawaban**
   dan **timer belum jalan**.
8. Begitu ada tim menekan BUZZ (atau panitia klik nama tim secara manual),
   timer otomatis mulai berjalan mengikuti durasi jawab yang diatur di soal
   itu (lihat kolom "Waktu Menjawab" saat menambah soal ke kuis).
9. Panitia mendengarkan jawaban lisan tim, lalu klik **✓ Benar** atau
   **✗ Salah** di panel kontrol. Kalau waktu habis sebelum dinilai, sistem
   otomatis menandai **Waktu Habis** dan mengurangi skor sesuai pengaturan.
10. **Soal TIDAK otomatis berganti** setelah salah/waktu habis — panitia
    memilih salah satu:
    - **🤚 Beri Kesempatan Tim Lain** — buka lagi buzzer untuk soal yang
      sama; tim yang barusan salah tidak bisa buzz lagi di soal ini.
    - **Soal Berikutnya** — lanjut seperti biasa.
11. **Voting skip** (kalau diaktifkan di pengaturan kuis): tiap tim bisa
    klik ⏭ Vote Skip di halaman buzzer mereka. Panitia melihat status
    ✅/❌ tiap tim secara live. Begitu SEMUA tim setuju, soal otomatis
    dilewati — ini satu-satunya perpindahan soal yang terjadi otomatis
    tanpa panitia klik apa pun.
12. Setelah soal terakhir, layar peserta otomatis menampilkan papan
    peringkat akhir.

### Yang perlu diperhatikan
- **Jangan refresh** halaman panel kontrol setelah sesi dimulai — sesi
  disimpan di memori server (bukan database) SELAGI BERLANGSUNG, jadi
  refresh akan membuat sesi baru dengan kode berbeda dan tim harus join
  ulang. Begitu sesi mencapai soal terakhir, hasil akhirnya otomatis
  tersimpan permanen ke database (lihat bagian 5).
- Kalau server backend di-restart **di tengah** sesi yang belum selesai,
  data sesi itu hilang (memang untuk pertandingan yang berlangsung satu
  waktu). Sesi yang sudah tuntas sampai akhir sudah aman tersimpan.
- Tombol **↺ Reset (salah tim)** di fase "tim sedang menjawab" untuk
  koreksi kalau panitia salah klik nama tim — beda dari **🤚 Beri
  Kesempatan Tim Lain** yang khusus dipakai setelah jawaban benar-benar
  dinilai salah/waktu habis.
- Peserta di halaman buzzer punya tombol **‹ Keluar** untuk kembali ke
  halaman `/gabung` (skor & status timnya tetap tersimpan di sesi).

### Fitur tambahan terbaru
- **Urutan soal**: sebelum sesi dibuat, panitia pilih Berurutan atau Acak.
- **Skip Soal (panitia)**: tombol ⏭ di panel kontrol, langsung lanjut soal
  berikutnya tanpa mempengaruhi skor siapa pun — beda dari voting skip tim.
- **Batalkan Bel**: tim yang salah pencet bisa klik "❌ Batalkan Bel" selama
  panitia belum menilai (masih fase "buzzed").
- **Video otomatis bersuara**: layar proyektor menampilkan overlay "Klik
  untuk Mulai" sekali di awal — setelah diklik, video soal berikutnya
  otomatis diputar dengan suara (bukan mute), sesuai kebijakan autoplay
  browser yang butuh interaksi pengguna dulu.
- **Kemungkinan jawaban lain**: kalau diisi saat bikin soal, muncul di
  panel panitia sebagai bantuan menilai jawaban lisan.
- **Clue soal**: bisa diisi saat bikin soal (disimpan di database). Kalau
  fitur kartu strategi aktif, tim bisa membuka clue-nya lewat kartu
  **PETUNJUK** — hanya tampil di layar tim yang membukanya, bukan
  disiarkan ke tim lain atau ke layar proyektor. Backend-nya (event
  socket + efek) sudah jalan; UI kartu di halaman buzzer/panel panitia
  masih menyusul (lihat bagian 6 untuk daftar kartu & event terkait).
- **Edit skor manual**: klik skor tim di panel panitia untuk set nilai
  pasti, atau pakai tombol +/− cepat (kelipatan 10) untuk koreksi cepat.
- **Akhiri Sesi**: tombol 🏁 di panel panitia, aktif kapan saja, langsung ke
  papan hasil akhir tanpa harus menghabiskan semua soal.
- **Juara 1/2/3**: papan hasil akhir (layar proyektor, panel panitia, dan
  Riwayat Hasil) menampilkan medali 🥇🥈🥉 untuk 3 besar.

---

## 5. Riwayat Hasil & Ekspor Excel/PDF

Begitu sesi live sampai ke soal terakhir dan dinilai, hasilnya **otomatis
tersimpan** ke database (tabel `MatchResult` + `MatchResultTeam`) — tidak
perlu tindakan tambahan dari panitia.

### Cara lihat & unduh
1. Buka menu **Riwayat Hasil** di navigasi dashboard (atau klik link yang
   muncul di panel panitia setelah sesi berakhir).
2. Klik salah satu sesi untuk lihat detail papan peringkat akhirnya.
3. Dua tombol ekspor tersedia:
   - **⬇ Unduh Excel** — file `.xlsx` berisi peringkat, nama tim, dan skor,
     dibuat langsung di browser (pakai library SheetJS), tidak perlu
     request tambahan ke server.
   - **🖨 Cetak / Simpan sebagai PDF** — membuka dialog print browser;
     pilih **"Save as PDF"** sebagai printer buat dapat file PDF. Halaman
     otomatis berubah ke tampilan terang khusus buat dicetak.

### Kode terkait
- `backend/prisma/schema.prisma` — tabel `MatchResult` & `MatchResultTeam`
- `backend/src/matchGateway.ts` — fungsi `saveMatchResult()`, terpanggil
  otomatis saat sesi mencapai fase `"ended"`
- `backend/src/routes/results.ts` — `GET /api/results`,
  `GET /api/results/:id`, `DELETE /api/results/:id`
- `frontend/app/dashboard/hasil/` — halaman daftar & detail

---

## 6. Struktur event Socket.IO (referensi teknis)

Satu-satunya alur realtime di aplikasi ini sekarang: sesi live mode buzzer
(`backend/src/matchGateway.ts`).

| Event | Arah | Payload | Keterangan |
|---|---|---|---|
| `admin:create-match` | guru → server | `{ quizId }` | Butuh token JWT di `socket.handshake.auth.token`. Ack: `{ matchCode, state }` |
| `admin:add-team` / `admin:remove-team` | guru → server | `{ matchCode, name }` / `{ matchCode, teamId }` | |
| `team:join-by-code` | tim → server | `{ matchCode, teamName }` | Dari halaman `/gabung`. Nama tim wajib unik per sesi. Ack: `{ matchCode, teamId, teamName }` |
| `admin:show-question` | guru → server | `{ matchCode, index }` | Timer belum jalan setelah ini |
| `team:buzz` | tim → server | `{ matchCode, teamId }` | Dari halaman `/buzzer/[matchCode]/[teamId]`. Ditolak kalau tim ada di `excludedTeamIds` |
| `admin:mark-buzzed` | guru → server | `{ matchCode, teamId }` | Alternatif manual untuk `team:buzz` |
| `admin:score` | guru → server | `{ matchCode, correct }` | Menilai jawaban tim yang sedang buzz |
| `admin:reset-buzz` | guru → server | `{ matchCode }` | Koreksi salah tandai tim (bukan karena jawaban salah) |
| `admin:reopen-for-others` | guru → server | `{ matchCode }` | Buka lagi buzzer untuk tim lain setelah salah/waktu habis; tim sebelumnya masuk `excludedTeamIds` |
| `admin:next-question` | guru → server | `{ matchCode }` | |
| `team:vote-skip` | tim → server | `{ matchCode, teamId }` | Kalau semua tim vote, soal otomatis di-skip |
| `display:join-match` | layar → server | `{ matchCode }` | Ack berisi state publik (tanpa jawaban benar) |
| `team:join-buzzer` | tim → server | `{ matchCode, teamId }` | Dipakai saat tim masuk lewat link buzz manual dari panitia. Ack juga berisi `myCard` (state kartu privat tim ini) |
| `team:use-card` | tim → server | `{ matchCode, teamId, cardId, targetTeamId? }` | Pakai 1 kartu strategi dari stok. `targetTeamId` wajib untuk kartu yang butuh target (mis. AMBIL POIN, PINDAH POSISI) |
| `admin:resolve-card` | guru → server | `{ matchCode, teamId, outcome }` | Override manual: paksa selesaikan kartu `pending` milik 1 tim jadi `"berhasil"` atau `"hangus"`. Untuk alur normal SHIELD/DOUBLE/AMBIL POIN sudah otomatis terselesaikan lewat `admin:score`/timeout — ini cuma buat koreksi |
| `match:admin-state` | server → guru | `AdminMatchState` | Termasuk jawaban benar & detail kartu semua tim |
| `match:public-state` | server → layar & tim | `PublicMatchState` | Tanpa jawaban benar, tanpa detail kartu tim mana pun |
| `match:my-card-state` | server → 1 tim tertentu | `MyCardState` | Stok kartu, kartu aktif, hasil PENGHAPUS PILIHAN/PETUNJUK — **privat**, dikirim lewat room per-tim, tidak pernah ke `teamsRoom` bersama |
| `match:question-skipped` | server → semua | *(tanpa payload)* | Notifikasi sesaat sebelum state baru — dipakai buat toast "semua tim setuju skip" |

### Kartu Strategi ("Kartu Kekuatan")
Sumber kebenaran ada di `backend/src/cardTypes.ts` (daftar & aturan
timing tiap kartu) dan `backend/src/matches.ts` (efek ke skor). Enam
jenis kartu saat ini: DOUBLE POINT, SHIELD, AMBIL POIN, PINDAH POSISI,
PENGHAPUS PILIHAN, dan **PETUNJUK** (buka clue soal, hanya untuk tim
yang memakainya — hangus kalau soal itu tidak diisi clue). Aktif
kalau `strategyCardsPerTeam` di pengaturan kuis > 0.

Event-event ini akan bertambah nanti sesuai kebutuhan — semuanya tinggal
ditambahkan dengan pola yang sama di `matchGateway.ts`.

---

## 7. Upload Video Langsung

Selain link YouTube/Vimeo, guru bisa upload file video langsung (MP4, WebM,
MOV, AVI) dari perangkat lewat form tambah soal di Bank Soal.

**Cara kerja:** file dikirim ke `POST /api/upload/video` (multipart,
butuh login), disimpan ke `backend/uploads/videos/` di server, lalu
path-nya (`/uploads/videos/xxxx.mp4`) disimpan sebagai `mediaUrl` soal.
Saat ditampilkan, frontend otomatis menggabungkan path itu dengan alamat
backend (`NEXT_PUBLIC_API_URL`).

> ⚠️ **Catatan deploy:** kalau backend di-deploy ke platform dengan disk
> sementara (mis. Railway/Render tanpa volume permanen), file video yang
> di-upload bisa **hilang saat redeploy**. Untuk video yang perlu bertahan
> lama, lebih aman pakai link YouTube/Vimeo, atau pasang volume/object
> storage (mis. Cloudflare R2, AWS S3) kalau upload langsung jadi andalan
> utama — beri tahu saya kalau mau dibantu setup itu.
