// Mesin sesi lomba realtime (mode buzzer, dikontrol panitia).
// Sengaja di memori server (bukan database) — sesi hanya hidup selama
// lomba berlangsung; hasil akhirnya baru disimpan permanen begitu selesai
// (lihat markResultSaved & matchGateway.ts).

import { CARD_TYPES, CardId, cardType, isCardId } from "./cardTypes";

export type MatchPhase =
  | "lobby" // sesi dibuat, panitia belum menampilkan soal pertama
  | "question-shown" // soal tampil, menunggu ada tim yang buzz
  | "buzzed" // satu tim sudah buzz, timer jawab berjalan
  | "simultaneous" // ronde "semua tim menjawab": bukan rebutan bel, tiap tim dinilai sendiri-sendiri
  | "revealed" // sudah dinilai (benar/salah/waktu habis), menunggu lanjut ke soal berikutnya
  | "ended"; // soal terakhir sudah dinilai

/** Kartu yang sedang terpasang di satu tim, menunggu diselesaikan (kecuali kartu instant). */
export interface ActiveCard {
  cardId: CardId;
  target: { id: string; name: string } | null;
  status: "pending" | "revealed";
  /** Soal yang JADI TARGET efek kartu ini: untuk kartu 'during' = soal saat ini,
   *  untuk kartu 'before' = soal BERIKUTNYA (currentIndex + 1 saat diaktifkan).
   *  Dipakai buat tahu kartu mana yang basi & harus hangus saat ganti soal. */
  boundQuestionIndex: number;
  activatedAt: number;
}

export interface CardLogEntry {
  ts: number;
  questionIndex: number;
  teamId: string;
  teamName: string;
  cardId: CardId;
  cardName: string;
  targetName: string | null;
  outcome: "berhasil" | "hangus";
}

/**
 * Notifikasi realtime bertingkat: 'toast' = notifikasi kecil (pojok atas,
 * hilang otomatis) yang aman dilihat semua orang karena TIDAK membocorkan
 * nama kartu/target. 'popup' = popup besar (tengah layar) hanya dikirim ke
 * tim yang berkaitan (pengguna & target) setelah hasil kartu benar-benar
 * dipastikan. Diisi oleh matches.ts, dikuras & disiarkan oleh matchGateway.ts.
 */
export interface CardNotification {
  kind: "toast" | "popup";
  /** 'all' -> disiarkan ke seluruh tim + layar display. 'team' -> hanya ke teamIds tertentu (privat). */
  audience: "all" | "team";
  teamIds?: string[];
  text: string;
  tone?: "success" | "fail" | "info";
}

/** Riwayat perubahan stok kartu oleh panitia lewat panel Pengaturan Kartu. */
export interface CardAdminLogEntry {
  ts: number;
  teamName: string; // "Semua Tim" kalau berlaku untuk semua tim sekaligus
  cardName: string;
  description: string;
}

export interface MatchTeam {
  id: string;
  name: string;
  score: number;
  /** Stok kartu strategi tersisa per jenis kartu. Kosong ({}) kalau fitur kartu nonaktif untuk kuis ini. */
  cardStock: Partial<Record<CardId, number>>;
  /** Berapa kali tiap jenis kartu SUDAH dipakai tim ini sepanjang sesi — dipakai untuk memvalidasi
   *  panel Pengaturan Kartu milik host (tidak boleh set jumlah kartu di bawah yang sudah dipakai). */
  cardStockUsed: Partial<Record<CardId, number>>;
  /** Sudah pakai 1 kartu untuk soal saat ini (maks 1 kartu aktif per tim per soal). */
  usedCardThisQuestion: boolean;
  activeCard: ActiveCard | null;
  /** Hasil kartu FIFTY (penghapus pilihan) untuk soal saat ini: 2 index opsi yang boleh tim ini lihat. null = tidak dipakai/tidak berlaku. */
  fiftyRevealedIndexes: number[] | null;
  /** true kalau tim ini sudah membuka kartu PETUNJUK untuk soal saat ini (clue-nya baru dikirim ke tim ini, bukan disiarkan). */
  hintRevealed: boolean;
}

export interface MatchQuestion {
  quizQuestionId: string;
  order: number;
  answerTimeSec: number;
  text: string;
  mediaType: "NONE" | "IMAGE" | "VIDEO";
  mediaUrl: string | null;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN";
  options: string[] | null;
  /** Index opsi benar (khusus MULTIPLE_CHOICE) — dipakai server buat efek kartu FIFTY. TIDAK PERNAH dikirim ke display/team. */
  correctOptionIndex: number | null;
  /** Jawaban benar dalam bentuk mudah dibaca panitia. TIDAK PERNAH dikirim ke display/team. */
  correctAnswerDisplay: string;
  /** Kata kunci/sinonim lain yang juga dianggap benar — hanya untuk panitia. */
  acceptableAnswers: string[] | null;
  /** Disimpan saja, belum ditampilkan/dipakai saat permainan. */
  clue: string | null;
  /** Ronde "Semua Tim Menjawab": true di soal-soal titik 1/4, 2/4, 3/4 urutan kuis
   *  (kalau Quiz.simultaneousRoundEnabled ON) — lihat computeSimultaneousIndexes(). */
  isSimultaneous: boolean;
}

export interface Match {
  code: string;
  teacherId: string;
  quizId: string;
  quizTitle: string;
  pointsCorrect: number;
  pointsWrongPenalty: number;
  pointsTimeoutPenalty: number;
  skipEnabled: boolean;
  /** 0 = fitur kartu strategi nonaktif untuk kuis ini. */
  strategyCardsPerTeam: number;
  cardLog: CardLogEntry[];
  /** Riwayat perubahan stok kartu oleh host lewat panel Pengaturan Kartu (bukan riwayat pemakaian). */
  cardAdminLog: CardAdminLogEntry[];
  /** Antrean notifikasi toast/popup yang belum disiarkan — dikuras matchGateway.ts tiap broadcast(). */
  pendingNotifications: CardNotification[];
  /** Hasil penilaian tiap tim untuk soal SAAT INI, HANYA kalau soalnya isSimultaneous.
   *  Direset tiap showQuestion(). Kartu strategi TIDAK berlaku di ronde ini.
   *  RAHASIA: cuma boleh dikirim ke Host (AdminMatchState) dan ke tim yang bersangkutan sendiri
   *  lewat channel privat (toMySimultaneousState) — JANGAN PERNAH taruh field ini apa adanya di
   *  PublicMatchState, karena publicState disiarkan ke SEMUA tim sekaligus (lihat matchGateway.ts). */
  simultaneousGrades: Partial<Record<string, "correct" | "wrong">>;
  /** Jawaban mentah yang dikirim tiap tim lewat halaman Buzzer untuk soal SAAT INI (isSimultaneous).
   *  Direset tiap showQuestion(). Sama rahasianya dengan simultaneousGrades di atas. */
  simultaneousAnswers: Partial<Record<string, { value: string | number | boolean; submittedAt: number }>>;
  questions: MatchQuestion[];
  currentIndex: number; // -1 = belum mulai soal manapun
  phase: MatchPhase;
  teams: Map<string, MatchTeam>;
  buzzedTeamId: string | null;
  /** Tim yang sudah mencoba & salah/waktu habis untuk SOAL INI, tidak boleh buzz lagi sampai soal ganti. */
  excludedTeamIds: Set<string>;
  /** Tim yang sudah vote setuju skip untuk SOAL INI. */
  skipVotes: Set<string>;
  timerDuration: number | null;
  timerStartedAt: number | null; // epoch ms, null jika timer tidak berjalan
  lastOutcome: "correct" | "wrong" | "timeout" | null;
  createdAt: number;
  teamSeq: number;
  /** true setelah hasil akhir sesi ini disimpan ke database, cegah simpan dobel. */
  resultSaved: boolean;
}

const matches = new Map<string, Match>();

function generateMatchCode(): string {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (matches.has(code));
  return code;
}

/** Stok kartu awal tiap tim: semua jenis kartu diberi jumlah yang sama sesuai pengaturan kuis. */
function freshCardStock(strategyCardsPerTeam: number): Partial<Record<CardId, number>> {
  if (!strategyCardsPerTeam || strategyCardsPerTeam <= 0) return {};
  const stock: Partial<Record<CardId, number>> = {};
  for (const c of CARD_TYPES) stock[c.id] = strategyCardsPerTeam;
  return stock;
}

/**
 * Titik-titik soal (index, 0-based) yang jadi ronde "Semua Tim Menjawab": kira-kira
 * di 1/4, 2/4 (tengah), dan 3/4 urutan kuis. Dihitung dari soal yang SUDAH ADA —
 * tidak perlu soal terpisah. Kuis pendek (<4 soal) tidak dapat ronde serentak sama
 * sekali supaya tidak aneh (mis. soal pertama/terakhir jadi serentak).
 */
export function computeSimultaneousIndexes(totalQuestions: number): Set<number> {
  if (totalQuestions < 4) return new Set();
  const raw = [
    Math.floor(totalQuestions * (1 / 4)),
    Math.floor(totalQuestions * (2 / 4)),
    Math.floor(totalQuestions * (3 / 4)),
  ];
  const clamped = raw.map((i) => Math.min(Math.max(i, 0), totalQuestions - 1));
  return new Set(clamped);
}

export function createMatch(params: {
  teacherId: string;
  quizId: string;
  quizTitle: string;
  pointsCorrect: number;
  pointsWrongPenalty: number;
  pointsTimeoutPenalty: number;
  skipEnabled: boolean;
  strategyCardsPerTeam: number;
  questions: MatchQuestion[];
}): Match {
  const code = generateMatchCode();
  const match: Match = {
    code,
    teacherId: params.teacherId,
    quizId: params.quizId,
    quizTitle: params.quizTitle,
    pointsCorrect: params.pointsCorrect,
    pointsWrongPenalty: params.pointsWrongPenalty,
    pointsTimeoutPenalty: params.pointsTimeoutPenalty,
    skipEnabled: params.skipEnabled,
    strategyCardsPerTeam: params.strategyCardsPerTeam,
    cardLog: [],
    cardAdminLog: [],
    pendingNotifications: [],
    simultaneousGrades: {},
    simultaneousAnswers: {},
    questions: params.questions,
    currentIndex: -1,
    phase: "lobby",
    teams: new Map(),
    buzzedTeamId: null,
    excludedTeamIds: new Set(),
    skipVotes: new Set(),
    timerDuration: null,
    timerStartedAt: null,
    lastOutcome: null,
    createdAt: Date.now(),
    teamSeq: 1,
    resultSaved: false,
  };
  matches.set(code, match);
  return match;
}

export function getMatch(code: string): Match | undefined {
  return matches.get(code);
}

export function addTeam(
  code: string,
  name: string
): { team: MatchTeam } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { error: "Nama tim tidak boleh kosong." };

  const nameTaken = Array.from(match.teams.values()).some(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (nameTaken) return { error: "Nama tim ini sudah dipakai di sesi ini. Pilih nama lain." };

  const team: MatchTeam = {
    id: `t${match.teamSeq++}`,
    name: trimmed,
    score: 0,
    cardStock: freshCardStock(match.strategyCardsPerTeam),
    cardStockUsed: {},
    usedCardThisQuestion: false,
    activeCard: null,
    fiftyRevealedIndexes: null,
    hintRevealed: false,
  };
  match.teams.set(team.id, team);
  return { team };
}

/**
 * Dipakai halaman join peserta (nama tim + kode sesi). Sama seperti
 * addTeam, tapi juga menolak kalau sesi sudah lewat fase "lobby" — supaya
 * tim baru tidak tiba-tiba muncul di tengah soal yang sedang berjalan.
 */
export function joinTeamByCode(
  code: string,
  name: string
): { team: MatchTeam; matchCode: string } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Kode sesi tidak ditemukan." };
  if (match.phase === "ended") return { error: "Sesi ini sudah selesai." };

  const result = addTeam(code, name);
  if ("error" in result) return result;
  return { team: result.team, matchCode: match.code };
}

export function removeTeam(code: string, teamId: string): void {
  const match = matches.get(code);
  if (!match) return;
  match.teams.delete(teamId);
  match.excludedTeamIds.delete(teamId);
  match.skipVotes.delete(teamId);
  if (match.buzzedTeamId === teamId) {
    match.buzzedTeamId = null;
    match.timerStartedAt = null;
    if (match.phase === "buzzed") match.phase = "question-shown";
  }
}

export function currentQuestion(match: Match): MatchQuestion | null {
  if (match.currentIndex < 0 || match.currentIndex >= match.questions.length) return null;
  return match.questions[match.currentIndex];
}

export function showQuestion(
  code: string,
  index: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (index < 0 || index >= match.questions.length)
    return { error: "Nomor soal di luar jangkauan." };

  const q = match.questions[index];
  match.currentIndex = index;
  match.phase = q.isSimultaneous ? "simultaneous" : "question-shown";
  match.buzzedTeamId = null;
  match.excludedTeamIds = new Set();
  match.skipVotes = new Set();
  match.timerDuration = null;
  match.timerStartedAt = null;
  match.lastOutcome = null;
  match.simultaneousGrades = {};
  match.simultaneousAnswers = {};

  // Soal baru dimulai: kartu pending yang TIDAK ditargetkan buat soal ini
  // (boundQuestionIndex-nya beda) otomatis hangus (stok tetap berkurang).
  // Kartu 'before' yang sengaja diaktifkan panitia/tim sebelum soal ini
  // ditampilkan (boundQuestionIndex === index) TETAP hidup, menunggu
  // diselesaikan lewat scoreAnswer/applyTimeout untuk soal ini.
  // PENGECUALIAN: soal ronde "Semua Tim Menjawab" tidak lewat alur
  // buzz/scoreAnswer sama sekali, jadi kartu strategi TIDAK berlaku di
  // sana — kartu yang kebetulan terikat ke soal ini langsung hangus.
  for (const team of match.teams.values()) {
    const active = team.activeCard;
    if (active && active.status === "pending") {
      if (active.boundQuestionIndex !== index || q.isSimultaneous) {
        // Kartu basi (mis. tim tidak sempat dapat giliran jawab soal yang jadi targetnya,
        // atau soal ini kebetulan jadi ronde serentak yang tidak dilayani kartu) -> hangus.
        pushCardLog(match, team, active, "hangus");
        if (active.cardId === "steal" && active.target) {
          // Kartu AMBIL POIN yang gagal: umumkan gagal ke tim pengguna & tim target (privat),
          // tim lain hanya tahu "sebuah kartu gagal digunakan".
          notifyTeams(match, [team.id], "Kartu Ambil Poin gagal digunakan.", "fail");
          notifyTeams(
            match,
            [active.target.id],
            "Ada kartu yang menargetkan tim Anda, tetapi gagal digunakan.",
            "fail"
          );
          notifyAll(match, "Sebuah kartu gagal digunakan.", "fail");
        }
        team.activeCard = null;
      } else {
        // Kartu ini baru sekarang benar-benar berlaku (soal berikutnya sudah dimulai) — umumkan
        // secara GENERIK ke semua orang, tanpa nama kartu maupun target, supaya strategi tetap rahasia.
        notifyAll(match, `Tim ${team.name} menggunakan sebuah kartu.`);
      }
    }
    team.usedCardThisQuestion = false;
    team.fiftyRevealedIndexes = null;
    team.hintRevealed = false;
  }

  return { match };
}

function pushCardLog(match: Match, team: MatchTeam, active: ActiveCard, outcome: "berhasil" | "hangus") {
  const type = cardType(active.cardId);
  match.cardLog = [
    {
      ts: Date.now(),
      questionIndex: active.boundQuestionIndex,
      teamId: team.id,
      teamName: team.name,
      cardId: type.id,
      cardName: type.name,
      targetName: active.target ? active.target.name : null,
      outcome,
    },
    ...match.cardLog,
  ].slice(0, 30);
}

/** Notifikasi kecil ke semua orang (tim + display) — TIDAK boleh berisi nama kartu/target. */
function notifyAll(match: Match, text: string, tone: CardNotification["tone"] = "info") {
  match.pendingNotifications.push({ kind: "toast", audience: "all", text, tone });
}

/** Notifikasi kecil ke semua orang TAPI boleh berisi nama kartu (khusus kartu non-target). */
function notifyAllNamed(match: Match, text: string) {
  match.pendingNotifications.push({ kind: "toast", audience: "all", text, tone: "info" });
}

/** Popup besar hanya untuk tim tertentu (pengguna kartu dan/atau tim target). */
function notifyTeams(match: Match, teamIds: string[], text: string, tone: CardNotification["tone"]) {
  match.pendingNotifications.push({ kind: "popup", audience: "team", teamIds, text, tone });
}

/** Apakah tim ini boleh memakai jenis kartu tertentu sekarang. */
export function canUseCard(match: Match, team: MatchTeam, cardId: CardId): boolean {
  if (!match.strategyCardsPerTeam) return false;
  if (team.usedCardThisQuestion) return false;
  if ((team.cardStock[cardId] || 0) <= 0) return false;
  if (team.activeCard) return false;

  const type = cardType(cardId);
  // 'before': kartu "berlaku pada soal berikutnya" boleh diaktifkan KAPAN SAJA, termasuk saat
  // soal sedang berlangsung — efeknya tetap terikat ke soal berikutnya (lihat boundQuestionIndex
  // di useCard). Satu-satunya fase yang tidak masuk akal adalah setelah sesi berakhir.
  if (type.timing === "before" && match.phase === "ended") return false;
  // 'during': hanya boleh saat soal sedang tampil atau sedang dijawab.
  if (type.timing === "during" && !(match.phase === "question-shown" || match.phase === "buzzed")) return false;

  // PINDAH POSISI hanya masuk akal dipakai OLEH tim yang SEDANG memegang giliran jawab.
  if (cardId === "swap" && !(match.phase === "buzzed" && match.buzzedTeamId === team.id)) return false;

  return true;
}

/**
 * Tim memakai kartu strategi. Kartu instant (fifty) langsung selesai &
 * masuk log. Kartu lain jadi 'pending' — menunggu panitia menandai
 * BERHASIL/HANGUS lewat resolveActiveCard (lihat matchGateway "host:resolve-card").
 */
export function useCard(
  code: string,
  teamId: string,
  cardId: CardId,
  targetTeamId?: string
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak dikenali." };
  if (!isCardId(cardId)) return { error: "Jenis kartu tidak dikenal." };

  const type = cardType(cardId);
  if (!canUseCard(match, team, cardId)) return { error: "Kartu ini tidak bisa dipakai sekarang." };

  let target: { id: string; name: string } | null = null;
  if (type.needsTarget) {
    if (!targetTeamId) return { error: "Kartu ini butuh tim target." };
    const targetTeam = match.teams.get(targetTeamId);
    if (!targetTeam || targetTeam.id === team.id) return { error: "Tim target tidak valid." };
    target = { id: targetTeam.id, name: targetTeam.name };
  }

  team.cardStock[cardId] = Math.max(0, (team.cardStock[cardId] || 0) - 1);
  team.cardStockUsed[cardId] = (team.cardStockUsed[cardId] || 0) + 1;
  team.usedCardThisQuestion = true;

  // 'during' -> terikat ke soal yang SEDANG tampil sekarang.
  // 'before' -> terikat ke soal BERIKUTNYA (belum tentu sudah ditampilkan).
  const boundQuestionIndex = type.timing === "during" ? match.currentIndex : match.currentIndex + 1;

  const active: ActiveCard = {
    cardId,
    target,
    status: "pending",
    boundQuestionIndex,
    activatedAt: Date.now(),
  };
  team.activeCard = active;

  if (cardId === "swap" && target) {
    // Efeknya langsung terjadi saat dipakai: giliran jawab pindah penuh ke tim target, timer diulang.
    // Kartu ini menargetkan tim lain, jadi notifikasinya tetap generik (tidak menyebut nama kartu/target)
    // walau efeknya (perpindahan giliran) memang langsung terlihat semua orang di layar.
    const q = currentQuestion(match);
    match.buzzedTeamId = target.id;
    match.timerStartedAt = Date.now();
    if (q) match.timerDuration = q.answerTimeSec;
    pushCardLog(match, team, active, "berhasil");
    team.activeCard = null;
    notifyAll(match, `Tim ${team.name} menggunakan sebuah kartu.`);
  } else if (cardId === "fifty") {
    // Kartu non-target: langsung diumumkan ke semua orang DENGAN nama kartu (bukan popup besar).
    notifyAllNamed(match, `Tim ${team.name} menggunakan ${type.name}.`);
    const q = currentQuestion(match);
    if (q && q.type === "MULTIPLE_CHOICE" && q.options && q.correctOptionIndex !== null && q.options.length > 2) {
      const wrongIndexes = q.options.map((_, i) => i).filter((i) => i !== q.correctOptionIndex);
      const keepWrong = wrongIndexes[Math.floor(Math.random() * wrongIndexes.length)];
      team.fiftyRevealedIndexes = [q.correctOptionIndex, keepWrong].sort((a, b) => a - b);
      pushCardLog(match, team, active, "berhasil");
    } else {
      team.fiftyRevealedIndexes = null;
      pushCardLog(match, team, active, "hangus");
    }
    team.activeCard = null;
  } else if (cardId === "hint") {
    // Kartu non-target: langsung diumumkan ke semua orang DENGAN nama kartu (bukan popup besar).
    notifyAllNamed(match, `Tim ${team.name} menggunakan ${type.name}.`);
    const q = currentQuestion(match);
    if (q && q.clue && q.clue.trim()) {
      team.hintRevealed = true;
      pushCardLog(match, team, active, "berhasil");
    } else {
      team.hintRevealed = false;
      pushCardLog(match, team, active, "hangus"); // soal ini tidak diisi petunjuk oleh panitia
    }
    team.activeCard = null;
  } else if (cardId === "shield") {
    // Kartu non-target, tapi hasilnya baru diketahui saat dinilai (applyCardEffects) — pengumuman
    // pemakaiannya sendiri (bukan hasilnya) tetap langsung dengan nama kartu, sesuai kartu non-target lain.
    notifyAllNamed(match, `Tim ${team.name} menggunakan ${type.name}.`);
  }
  // 'double' & 'steal' (timing "before"): SENGAJA tidak ada notifikasi apa pun di sini — strateginya
  // baru diumumkan (generik, tanpa nama kartu) saat soal yang jadi targetnya benar-benar dimulai,
  // lihat showQuestion(). Ini yang membuat kartu "berlaku pada soal berikutnya" tetap rahasia.

  return { match };
}

/**
 * Override manual panitia: batalkan/selesaikan paksa kartu 'pending' milik
 * satu tim (mis. dipakai keliru, atau ada sengketa aturan di lapangan).
 * Untuk alur normal, SHIELD/DOUBLE/STEAL sudah otomatis terselesaikan lewat
 * scoreAnswer/applyTimeout begitu soal yang bersangkutan dinilai — panitia
 * tidak perlu klik apa pun di jalur normal.
 */
export function resolveActiveCard(
  code: string,
  teamId: string,
  outcome: "berhasil" | "hangus"
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak dikenali." };
  if (!team.activeCard || team.activeCard.status !== "pending")
    return { error: "Tidak ada kartu pending untuk tim ini." };

  pushCardLog(match, team, team.activeCard, outcome);
  team.activeCard = null;
  return { match };
}

/**
 * Set TOTAL jumlah kartu jenis tertentu milik satu tim (bukan tambah/kurang stok tersisa
 * secara langsung). Total = stok tersisa + yang sudah dipakai tim itu sepanjang sesi. Ditolak
 * kalau total baru lebih kecil dari jumlah yang sudah dipakai (tidak masuk akal "menarik kembali"
 * kartu yang sudah terpakai).
 */
function applyCardTotal(match: Match, team: MatchTeam, cardId: CardId, total: number): string | null {
  if (!Number.isFinite(total) || total < 0) return "Jumlah kartu tidak boleh negatif.";
  const used = team.cardStockUsed[cardId] || 0;
  if (total < used) {
    return `Tidak bisa mengatur jumlah kartu ${cardType(cardId).name} tim ${team.name} menjadi ${total} — tim ini sudah memakai ${used} kartu jenis ini.`;
  }
  team.cardStock[cardId] = total - used;
  return null;
}

/** Host mengatur jumlah kartu jenis tertentu untuk SATU tim. */
export function setCardQuantity(
  code: string,
  teamId: string,
  cardId: CardId,
  total: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };
  if (!isCardId(cardId)) return { error: "Jenis kartu tidak dikenal." };

  const roundedTotal = Math.round(total);
  const err = applyCardTotal(match, team, cardId, roundedTotal);
  if (err) return { error: err };

  match.cardAdminLog = [
    {
      ts: Date.now(),
      teamName: team.name,
      cardName: cardType(cardId).name,
      description: `Host mengubah jumlah kartu ${cardType(cardId).name} tim ${team.name} menjadi ${roundedTotal}.`,
    },
    ...match.cardAdminLog,
  ].slice(0, 40);

  return { match };
}

/** Host mengatur jumlah kartu jenis tertentu untuk SEMUA tim sekaligus (validasi dulu semua, baru diterapkan). */
export function setCardQuantityAllTeams(
  code: string,
  cardId: CardId,
  total: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (!isCardId(cardId)) return { error: "Jenis kartu tidak dikenal." };
  if (match.teams.size === 0) return { error: "Belum ada tim di sesi ini." };

  const roundedTotal = Math.round(total);
  // Validasi semua tim dulu supaya perubahan tetap atomik (semua diterapkan atau tidak sama sekali).
  for (const team of match.teams.values()) {
    const used = team.cardStockUsed[cardId] || 0;
    if (roundedTotal < used) {
      return {
        error: `Tidak bisa mengatur jumlah kartu ${cardType(cardId).name} menjadi ${roundedTotal} untuk semua tim — tim ${team.name} sudah memakai ${used} kartu jenis ini.`,
      };
    }
  }
  for (const team of match.teams.values()) {
    team.cardStock[cardId] = roundedTotal - (team.cardStockUsed[cardId] || 0);
  }

  match.cardAdminLog = [
    {
      ts: Date.now(),
      teamName: "Semua Tim",
      cardName: cardType(cardId).name,
      description: `Host mengubah jumlah kartu ${cardType(cardId).name} SEMUA TIM menjadi ${roundedTotal}.`,
    },
    ...match.cardAdminLog,
  ].slice(0, 40);

  return { match };
}

/** Host menambah/mengurangi (+1/-1, dst) jumlah kartu jenis tertentu untuk satu tim, relatif dari total saat ini. */
export function adjustCardQuantity(
  code: string,
  teamId: string,
  cardId: CardId,
  delta: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };
  if (!isCardId(cardId)) return { error: "Jenis kartu tidak dikenal." };

  const currentTotal = (team.cardStock[cardId] || 0) + (team.cardStockUsed[cardId] || 0);
  const newTotal = currentTotal + Math.round(delta);
  const err = applyCardTotal(match, team, cardId, newTotal);
  if (err) return { error: err };

  match.cardAdminLog = [
    {
      ts: Date.now(),
      teamName: team.name,
      cardName: cardType(cardId).name,
      description:
        delta > 0
          ? `Host memberikan ${delta} kartu ${cardType(cardId).name} kepada Tim ${team.name}.`
          : `Host mengurangi ${Math.abs(delta)} kartu ${cardType(cardId).name} dari Tim ${team.name}.`,
    },
    ...match.cardAdminLog,
  ].slice(0, 40);

  return { match };
}

/** Host menambah/mengurangi (+1/-1, dst) jumlah kartu jenis tertentu untuk SEMUA tim sekaligus. */
export function adjustCardQuantityAllTeams(
  code: string,
  cardId: CardId,
  delta: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (!isCardId(cardId)) return { error: "Jenis kartu tidak dikenal." };
  if (match.teams.size === 0) return { error: "Belum ada tim di sesi ini." };

  const roundedDelta = Math.round(delta);
  for (const team of match.teams.values()) {
    const currentTotal = (team.cardStock[cardId] || 0) + (team.cardStockUsed[cardId] || 0);
    const newTotal = currentTotal + roundedDelta;
    const used = team.cardStockUsed[cardId] || 0;
    if (newTotal < used) {
      return {
        error: `Tidak bisa mengurangi kartu ${cardType(cardId).name} untuk semua tim — tim ${team.name} sudah memakai ${used} kartu jenis ini.`,
      };
    }
  }
  for (const team of match.teams.values()) {
    const currentTotal = (team.cardStock[cardId] || 0) + (team.cardStockUsed[cardId] || 0);
    const newTotal = currentTotal + roundedDelta;
    team.cardStock[cardId] = newTotal - (team.cardStockUsed[cardId] || 0);
  }

  match.cardAdminLog = [
    {
      ts: Date.now(),
      teamName: "Semua Tim",
      cardName: cardType(cardId).name,
      description:
        roundedDelta > 0
          ? `Host memberikan ${roundedDelta} kartu ${cardType(cardId).name} kepada SEMUA TIM.`
          : `Host mengurangi ${Math.abs(roundedDelta)} kartu ${cardType(cardId).name} dari SEMUA TIM.`,
    },
    ...match.cardAdminLog,
  ].slice(0, 40);

  return { match };
}

/** Cek & tandai selesai satu kartu 'pending' milik tim ini untuk soal saat ini, kalau jenis & targetnya cocok. */
function takeTeamCard(match: Match, team: MatchTeam, cardId: CardId): ActiveCard | null {
  if (
    team.activeCard &&
    team.activeCard.status === "pending" &&
    team.activeCard.cardId === cardId &&
    team.activeCard.boundQuestionIndex === match.currentIndex
  ) {
    return team.activeCard;
  }
  return null;
}

/** Cari tim lain yang punya kartu AMBIL POIN (steal) pending menargetkan tim yang baru saja dijawab/dijawab soal ini. */
function findStealerTargeting(match: Match, targetTeamId: string): MatchTeam | null {
  for (const t of match.teams.values()) {
    const ac = t.activeCard;
    if (
      ac &&
      ac.status === "pending" &&
      ac.cardId === "steal" &&
      ac.boundQuestionIndex === match.currentIndex &&
      ac.target?.id === targetTeamId
    ) {
      return t;
    }
  }
  return null;
}

/**
 * Terapkan efek SHIELD & DOUBLE milik tim yang menjawab, lalu efek STEAL
 * dari tim lain (kalau ada) yang mengalihkan hasil akhirnya. Dipanggil dari
 * scoreAnswer & applyTimeout supaya logikanya tidak dobel.
 * `wasCorrect`: true = jawaban benar, false = salah ATAU waktu habis.
 */
function applyCardEffects(
  match: Match,
  answeringTeam: MatchTeam,
  baseDelta: number,
  wasCorrect: boolean
): { delta: number; recipient: MatchTeam } {
  let delta = baseDelta;

  const shield = takeTeamCard(match, answeringTeam, "shield");
  if (shield) {
    if (!wasCorrect) {
      delta = 0;
      pushCardLog(match, answeringTeam, shield, "berhasil");
    } else {
      pushCardLog(match, answeringTeam, shield, "hangus"); // benar -> shield tidak diperlukan
    }
    answeringTeam.activeCard = null;
  }

  const double = takeTeamCard(match, answeringTeam, "double");
  if (double) {
    delta *= 2;
    pushCardLog(match, answeringTeam, double, "berhasil");
    answeringTeam.activeCard = null;
  }

  let recipient = answeringTeam;
  const stealer = findStealerTargeting(match, answeringTeam.id);
  if (stealer && stealer.activeCard) {
    pushCardLog(match, stealer, stealer.activeCard, "berhasil");
    stealer.activeCard = null;
    recipient = stealer; // poin/pengurangan sepenuhnya pindah ke tim penantang, tim target tidak terpengaruh
    notifyTeams(match, [stealer.id], "Kartu Ambil Poin berhasil mengambil poin dari tim target.", "success");
    notifyTeams(
      match,
      [answeringTeam.id],
      "Tim Anda menjadi target sebuah kartu. Efek berhasil diterapkan.",
      "success"
    );
    notifyAll(match, "Sebuah kartu berhasil digunakan.", "success");
  }

  return { delta, recipient };
}

export function buzz(code: string, teamId: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "question-shown") return { error: "Belum bisa buzz sekarang." };
  if (!match.teams.has(teamId)) return { error: "Tim tidak dikenali." };
  if (match.excludedTeamIds.has(teamId))
    return { error: "Tim ini sudah mencoba menjawab soal ini, giliran tim lain." };

  const q = currentQuestion(match);
  if (!q) return { error: "Tidak ada soal aktif." };

  match.buzzedTeamId = teamId;
  match.phase = "buzzed";
  match.timerDuration = q.answerTimeSec;
  match.timerStartedAt = Date.now();
  return { match };
}

/** Koreksi salah tandai tim di tengah buzz (bukan karena jawabannya salah) — tidak masuk daftar excluded. */
export function resetBuzz(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "buzzed") return { error: "Tidak ada buzz yang sedang berlangsung." };
  match.buzzedTeamId = null;
  match.timerDuration = null;
  match.timerStartedAt = null;
  match.phase = "question-shown";
  return { match };
}

/**
 * Tim membatalkan vote skip-nya sendiri untuk soal ini (selama soal masih
 * tampil dan belum ada tim yang buzz). Kebalikan dari voteSkip — tidak
 * mempengaruhi skor atau status buzz siapa pun.
 */
export function cancelVoteSkip(code: string, teamId: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "question-shown") return { error: "Vote skip tidak bisa dibatalkan sekarang." };
  if (!match.skipVotes.has(teamId)) return { error: "Tim ini belum vote skip." };

  match.skipVotes.delete(teamId);
  return { match };
}

/**
 * Dipanggil panitia dari fase "revealed" (setelah salah/waktu habis) untuk
 * membuka kembali buzzer buat TIM LAIN pada soal yang sama — tim yang baru
 * saja mencoba & gagal masuk daftar excluded, tidak bisa buzz lagi di soal ini.
 */
export function reopenForOtherTeams(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "revealed") return { error: "Hanya bisa dibuka lagi setelah soal dinilai." };

  if (match.buzzedTeamId) match.excludedTeamIds.add(match.buzzedTeamId);
  match.buzzedTeamId = null;
  match.timerDuration = null;
  match.timerStartedAt = null;
  match.lastOutcome = null;
  match.phase = "question-shown";
  return { match };
}

export function scoreAnswer(
  code: string,
  correct: boolean
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "buzzed" || !match.buzzedTeamId)
    return { error: "Tidak ada tim yang sedang menjawab." };

  const team = match.teams.get(match.buzzedTeamId);
  if (team) {
    const baseDelta = correct ? match.pointsCorrect : -match.pointsWrongPenalty;
    const { delta, recipient } = applyCardEffects(match, team, baseDelta, correct);
    recipient.score += delta;
  }
  match.lastOutcome = correct ? "correct" : "wrong";
  match.phase = "revealed";
  match.timerStartedAt = null;
  return { match };
}

/**
 * Tim mengirim jawabannya lewat halaman Buzzer untuk ronde "Semua Tim Menjawab" (soal
 * simultaneous). TIDAK menilai/skor sendiri (itu tetap tugas panitia lewat gradeSimultaneous,
 * sesuai mekanisme yang sudah ada) — cuma menyimpan apa yang dikirim tim itu supaya panitia
 * bisa lihat sebagai referensi saat menilai. Terkunci setelah kirim pertama (tidak bisa ganti
 * jawaban). Jawaban tim SATU TIDAK PERNAH dikirim ke tim lain lewat jalur mana pun — hanya
 * tersedia di AdminMatchState (panitia).
 */
export function submitSimultaneousAnswer(
  code: string,
  teamId: string,
  value: string | number | boolean
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "simultaneous") return { error: "Bukan soal ronde Semua Tim Menjawab." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };
  if (match.simultaneousAnswers[teamId]) return { error: "Tim ini sudah mengirim jawaban untuk soal ini." };

  match.simultaneousAnswers[teamId] = { value, submittedAt: Date.now() };
  return { match };
}

/**
 * Panitia menilai jawaban SATU tim di ronde "Semua Tim Menjawab" (soal simultaneous).
 * Beda dari scoreAnswer: tidak ada buzz, tiap tim dinilai sendiri-sendiri, boleh dinilai
 * ulang (misal panitia salah pencet), dan jawaban SALAH tidak mengurangi poin sama sekali.
 * Kartu strategi tidak berlaku di ronde ini (lihat showQuestion).
 */
export function gradeSimultaneous(
  code: string,
  teamId: string,
  correct: boolean
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "simultaneous") return { error: "Bukan soal ronde Semua Tim Menjawab." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };

  // Batalkan dulu efek penilaian sebelumnya (kalau panitia menilai ulang tim ini).
  const previous = match.simultaneousGrades[teamId];
  if (previous === "correct") team.score -= match.pointsCorrect;

  if (correct) team.score += match.pointsCorrect;
  // Salah -> TIDAK ada pengurangan poin sama sekali (sengaja, sesuai aturan ronde ini).

  match.simultaneousGrades[teamId] = correct ? "correct" : "wrong";
  return { match };
}

/** Dipanggil otomatis oleh server saat waktu jawab habis tanpa dinilai panitia. */
export function applyTimeout(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "buzzed" || !match.buzzedTeamId)
    return { error: "Tidak ada tim yang sedang menjawab." };

  const team = match.teams.get(match.buzzedTeamId);
  if (team) {
    const baseDelta = -match.pointsTimeoutPenalty;
    const { delta, recipient } = applyCardEffects(match, team, baseDelta, false);
    recipient.score += delta;
  }
  match.lastOutcome = "timeout";
  match.phase = "revealed";
  match.timerStartedAt = null;
  return { match };
}

/**
 * Tim vote setuju skip soal ini. Kalau SEMUA tim yang ada di sesi sudah
 * setuju, soal otomatis ditandai skip & sistem lanjut ke soal berikutnya —
 * satu-satunya kasus di mana perpindahan soal terjadi otomatis tanpa klik
 * panitia, karena memang sudah disepakati bulat oleh semua tim.
 */
export function voteSkip(
  code: string,
  teamId: string
): { match: Match; allAgreed: boolean } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (!match.skipEnabled) return { error: "Fitur skip tidak diaktifkan untuk kuis ini." };
  if (match.phase !== "question-shown")
    return { error: "Voting skip hanya bisa dilakukan saat soal sedang ditampilkan." };
  if (!match.teams.has(teamId)) return { error: "Tim tidak dikenali." };

  match.skipVotes.add(teamId);
  const allAgreed = match.teams.size > 0 && match.skipVotes.size >= match.teams.size;

  if (allAgreed) {
    const result = nextQuestion(code);
    if ("error" in result) return result;
    return { match: result.match, allAgreed: true };
  }

  return { match, allAgreed: false };
}

export function nextQuestion(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };

  const nextIndex = match.currentIndex + 1;
  if (nextIndex >= match.questions.length) {
    match.phase = "ended";
    match.buzzedTeamId = null;
    match.timerStartedAt = null;
    return { match };
  }
  return showQuestion(code, nextIndex);
}

/** Panitia melewati soal ini sepenuhnya, TANPA mempengaruhi skor siapa pun. */
export function skipQuestionByHost(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase !== "question-shown" && match.phase !== "buzzed" && match.phase !== "simultaneous")
    return { error: "Tidak ada soal aktif untuk di-skip." };
  return nextQuestion(code);
}

/** Panitia menambah/mengurangi skor tim secara manual (koreksi penilaian). */
export function adjustTeamScore(
  code: string,
  teamId: string,
  delta: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };
  team.score += delta;
  return { match };
}

/** Panitia mengubah skor tim jadi nilai pasti (bukan tambah/kurang). */
export function setTeamScore(
  code: string,
  teamId: string,
  score: number
): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  const team = match.teams.get(teamId);
  if (!team) return { error: "Tim tidak ditemukan." };
  team.score = score;
  return { match };
}

/** Panitia mengakhiri sesi kapan saja, langsung ke papan hasil akhir. */
export function endMatchNow(code: string): { match: Match } | { error: string } {
  const match = matches.get(code);
  if (!match) return { error: "Sesi tidak ditemukan." };
  if (match.phase === "ended") return { error: "Sesi ini sudah selesai." };
  match.phase = "ended";
  match.buzzedTeamId = null;
  match.timerStartedAt = null;
  return { match };
}

/** Sesi yang sedang menunggu jawaban dan waktunya sudah habis — dipanggil dari interval berkala. */
export function findExpiredMatches(): Match[] {
  const now = Date.now();
  const expired: Match[] = [];
  for (const match of matches.values()) {
    if (
      match.phase === "buzzed" &&
      match.timerStartedAt !== null &&
      match.timerDuration !== null &&
      now - match.timerStartedAt >= match.timerDuration * 1000
    ) {
      expired.push(match);
    }
  }
  return expired;
}

export function cleanupStaleMatches(maxAgeMs = 1000 * 60 * 60 * 8): void {
  const now = Date.now();
  for (const [code, match] of matches) {
    if (now - match.createdAt > maxAgeMs) matches.delete(code);
  }
}

/** Tandai hasil sesi ini sudah ditulis ke database, cegah tersimpan dua kali. */
export function markResultSaved(code: string): void {
  const match = matches.get(code);
  if (match) match.resultSaved = true;
}

// ---------- Bentuk data yang dikirim ke tiap jenis layar ----------

/** Ringkasan tim tanpa detail kartu (aman disiarkan ke semua tim sekaligus). */
export interface PublicTeamView {
  id: string;
  name: string;
  score: number;
}

export interface AdminMatchState {
  matchCode: string;
  quizTitle: string;
  phase: MatchPhase;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: (MatchQuestion & { index: number }) | null;
  teams: MatchTeam[]; // panitia boleh lihat semua detail kartu tiap tim
  buzzedTeamId: string | null;
  excludedTeamIds: string[];
  skipEnabled: boolean;
  skipVotes: string[];
  timerDuration: number | null;
  timerStartedAt: number | null;
  lastOutcome: Match["lastOutcome"];
  strategyCardsPerTeam: number;
  cardLog: CardLogEntry[];
  cardAdminLog: CardAdminLogEntry[];
  /** Hasil penilaian ronde "Semua Tim Menjawab" untuk soal SAAT INI (kosong kalau bukan soal jenis itu). */
  simultaneousGrades: Partial<Record<string, "correct" | "wrong">>;
  /** Jawaban mentah tiap tim untuk soal SAAT INI (kosong kalau bukan soal jenis itu) — HANYA di sini (host). */
  simultaneousAnswers: Partial<Record<string, { value: string | number | boolean; submittedAt: number }>>;
}

export interface PublicMatchState {
  matchCode: string;
  quizTitle: string;
  phase: MatchPhase;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: {
    index: number;
    text: string;
    mediaType: MatchQuestion["mediaType"];
    mediaUrl: string | null;
    type: MatchQuestion["type"];
    options: string[] | null;
    /** true = ronde "Semua Tim Menjawab" (bukan rebutan bel) untuk soal ini. */
    isSimultaneous: boolean;
  } | null;
  teams: PublicTeamView[]; // TIDAK ada stok/kartu tim lain di sini — itu rahasia sampai selesai/hangus
  buzzedTeamId: string | null;
  buzzedTeamName: string | null;
  excludedTeamIds: string[];
  skipEnabled: boolean;
  skipVotes: string[];
  timerDuration: number | null;
  timerStartedAt: number | null;
  lastOutcome: Match["lastOutcome"];
  strategyCardsEnabled: boolean;
  /** Ringkasan progres ronde "Semua Tim Menjawab" untuk soal SAAT INI — SENGAJA cuma angka
   *  agregat (bukan per-tim), supaya tidak ada tim yang bisa lihat siapa sudah jawab apa/benar
   *  atau salah sebelum panitia sendiri yang memberitahu. Detail per-tim HANYA ada di
   *  AdminMatchState (host) dan MySimultaneousState (tim yang bersangkutan, punya sendiri). */
  simultaneousProgress: { submitted: number; graded: number; total: number } | null;
  // CATATAN: cardLog SENGAJA tidak disertakan di sini (dulu ada, tapi membocorkan nama kartu &
  // target ke SEMUA tim). Pengumuman realtime sekarang lewat notifikasi toast/popup — lihat
  // CardNotification & matchGateway.ts. Riwayat lengkap hanya tersedia di AdminMatchState (host).
}

/** Info ronde "Semua Tim Menjawab" milik SATU tim tertentu (privat) — dikirim lewat
 *  channel privat tim itu sendiri, TIDAK PERNAH lewat PublicMatchState. */
export interface MySimultaneousState {
  /** Tim ini sudah kirim jawaban untuk soal SAAT INI atau belum. */
  submitted: boolean;
  /** Jawaban yang sudah dikirim tim ini sendiri (aman ditampilkan balik ke tim itu sendiri). */
  value: string | number | boolean | null;
  /** null = belum dinilai panitia. */
  grade: "correct" | "wrong" | null;
}

/** Info kartu milik SATU tim tertentu (privat) — dipakai untuk kirim state personal ke buzzer tim itu saja. */
export interface MyCardState {
  cardStock: Partial<Record<CardId, number>>;
  usedCardThisQuestion: boolean;
  activeCard: ActiveCard | null;
  /** Kalau tim ini pakai FIFTY di soal berjalan: 2 index opsi yang boleh ditampilkan (selain itu disamarkan). */
  fiftyRevealedIndexes: number[] | null;
  /** Kalau tim ini pakai PETUNJUK di soal berjalan: teks clue soal ini. null = belum dibuka/soal ini tidak punya clue. */
  revealedClue: string | null;
}

export function toMyCardState(match: Match, teamId: string): MyCardState | null {
  const team = match.teams.get(teamId);
  if (!team) return null;
  const q = currentQuestion(match);
  return {
    cardStock: team.cardStock,
    usedCardThisQuestion: team.usedCardThisQuestion,
    activeCard: team.activeCard,
    fiftyRevealedIndexes: team.fiftyRevealedIndexes,
    revealedClue: team.hintRevealed ? q?.clue ?? null : null,
  };
}

export function toAdminState(match: Match): AdminMatchState {
  const q = currentQuestion(match);
  return {
    matchCode: match.code,
    quizTitle: match.quizTitle,
    phase: match.phase,
    currentIndex: match.currentIndex,
    totalQuestions: match.questions.length,
    currentQuestion: q ? { ...q, index: match.currentIndex } : null,
    teams: Array.from(match.teams.values()),
    buzzedTeamId: match.buzzedTeamId,
    excludedTeamIds: Array.from(match.excludedTeamIds),
    skipEnabled: match.skipEnabled,
    skipVotes: Array.from(match.skipVotes),
    timerDuration: match.timerDuration,
    timerStartedAt: match.timerStartedAt,
    lastOutcome: match.lastOutcome,
    strategyCardsPerTeam: match.strategyCardsPerTeam,
    cardLog: match.cardLog,
    cardAdminLog: match.cardAdminLog,
    simultaneousGrades: match.simultaneousGrades,
    simultaneousAnswers: match.simultaneousAnswers,
  };
}

/** Info ronde "Semua Tim Menjawab" milik SATU tim — dikirim ke channel privat tim itu saja. */
export function toMySimultaneousState(match: Match, teamId: string): MySimultaneousState | null {
  if (!match.teams.has(teamId)) return null;
  const q = currentQuestion(match);
  if (!q || !q.isSimultaneous) return null;
  const answer = match.simultaneousAnswers[teamId];
  return {
    submitted: !!answer,
    value: answer?.value ?? null,
    grade: match.simultaneousGrades[teamId] ?? null,
  };
}

export function toPublicState(match: Match): PublicMatchState {
  const q = currentQuestion(match);
  const buzzedTeam = match.buzzedTeamId ? match.teams.get(match.buzzedTeamId) ?? null : null;
  return {
    matchCode: match.code,
    quizTitle: match.quizTitle,
    phase: match.phase,
    currentIndex: match.currentIndex,
    totalQuestions: match.questions.length,
    currentQuestion: q
      ? {
          index: match.currentIndex,
          text: q.text,
          mediaType: q.mediaType,
          mediaUrl: q.mediaUrl,
          type: q.type,
          options: q.options,
          isSimultaneous: q.isSimultaneous,
        }
      : null,
    teams: Array.from(match.teams.values()).map((t) => ({ id: t.id, name: t.name, score: t.score })),
    buzzedTeamId: match.buzzedTeamId,
    buzzedTeamName: buzzedTeam?.name ?? null,
    excludedTeamIds: Array.from(match.excludedTeamIds),
    skipEnabled: match.skipEnabled,
    skipVotes: Array.from(match.skipVotes),
    timerDuration: match.timerDuration,
    timerStartedAt: match.timerStartedAt,
    lastOutcome: match.lastOutcome,
    strategyCardsEnabled: match.strategyCardsPerTeam > 0,
    simultaneousProgress:
      q && q.isSimultaneous
        ? {
            submitted: Object.keys(match.simultaneousAnswers).length,
            graded: Object.keys(match.simultaneousGrades).length,
            total: match.teams.size,
          }
        : null,
  };
}
