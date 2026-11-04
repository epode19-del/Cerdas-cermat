import { Server, Socket } from "socket.io";
import { prisma } from "./db";
import { verifyToken } from "./auth";
import {
  createMatch,
  getMatch,
  addTeam,
  joinTeamByCode,
  removeTeam,
  showQuestion,
  buzz,
  resetBuzz,
  reopenForOtherTeams,
  scoreAnswer,
  applyTimeout,
  nextQuestion,
  skipQuestionByHost,
  voteSkip,
  cancelVoteSkip,
  adjustTeamScore,
  setTeamScore,
  endMatchNow,
  findExpiredMatches,
  cleanupStaleMatches,
  markResultSaved,
  toAdminState,
  toPublicState,
  useCard,
  resolveActiveCard,
  toMyCardState,
  setCardQuantity,
  setCardQuantityAllTeams,
  adjustCardQuantity,
  adjustCardQuantityAllTeams,
  gradeSimultaneous,
  submitSimultaneousAnswer,
  toMySimultaneousState,
  computeSimultaneousIndexes,
  MatchQuestion,
} from "./matches";
import { CardId } from "./cardTypes";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function adminRoom(code: string) {
  return `match:${code}:admin`;
}
function displayRoom(code: string) {
  return `match:${code}:display`;
}
function teamsRoom(code: string) {
  return `match:${code}:teams`;
}
/** Room privat 1 tim — dipakai buat kirim stok/status kartu strategi tim itu, TIDAK boleh bocor ke tim lain. */
function teamPrivateRoom(code: string, teamId: string) {
  return `match:${code}:team:${teamId}`;
}

/** Membentuk ulang soal dari database jadi bentuk yang dipakai mesin sesi (termasuk jawaban benar, hanya untuk panitia). */
function toMatchQuestion(qq: {
  id: string;
  order: number;
  answerTimeSec: number;
  question: {
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN";
    text: string;
    mediaType: "NONE" | "IMAGE" | "VIDEO";
    mediaUrl: string | null;
    options: unknown;
    correctAnswer: string;
    acceptableAnswers: unknown;
    clue: string | null;
  };
}): MatchQuestion {
  const q = qq.question;
  let correctAnswerDisplay: string;
  let options: string[] | null = null;

  if (q.type === "MULTIPLE_CHOICE") {
    options = q.options as string[];
    const idx = Number(q.correctAnswer);
    correctAnswerDisplay = options[idx] ?? `Opsi #${idx + 1}`;
  } else if (q.type === "TRUE_FALSE") {
    correctAnswerDisplay = q.correctAnswer === "true" ? "Benar" : "Salah";
  } else {
    correctAnswerDisplay = q.correctAnswer;
  }

  return {
    quizQuestionId: qq.id,
    order: qq.order,
    answerTimeSec: qq.answerTimeSec,
    text: q.text,
    mediaType: q.mediaType,
    mediaUrl: q.mediaUrl,
    type: q.type,
    options,
    correctOptionIndex: q.type === "MULTIPLE_CHOICE" ? Number(q.correctAnswer) : null,
    correctAnswerDisplay,
    acceptableAnswers: (q.acceptableAnswers as string[] | null) ?? null,
    clue: q.clue,
    isSimultaneous: false, // dihitung ulang di admin:create-match berdasarkan Quiz.simultaneousRoundEnabled
  };
}

export function registerMatchHandlers(io: Server) {
  function broadcast(code: string) {
    const match = getMatch(code);
    if (!match) return;
    io.to(adminRoom(code)).emit("match:admin-state", toAdminState(match));
    const publicState = toPublicState(match);
    io.to(displayRoom(code)).emit("match:public-state", publicState);
    io.to(teamsRoom(code)).emit("match:public-state", publicState);

    // Status kartu strategi (stok, kartu aktif, hasil FIFTY/PETUNJUK) itu privat per tim —
    // dikirim satu-satu ke room pribadi tiap tim, bukan disiarkan ke teamsRoom bersama.
    // Begitu juga status ronde "Semua Tim Menjawab" (jawaban & benar/salah tim ini) — TIDAK
    // BOLEH lewat publicState (dulu ada bug bocor lewat situ), harus lewat room privat masing-masing.
    for (const team of match.teams.values()) {
      const myCard = toMyCardState(match, team.id);
      if (myCard) io.to(teamPrivateRoom(code, team.id)).emit("match:my-card-state", myCard);
      io.to(teamPrivateRoom(code, team.id)).emit("match:my-simultaneous-state", toMySimultaneousState(match, team.id));
    }

    // Kuras antrean notifikasi kartu (toast kecil / popup besar) yang terkumpul dari aksi barusan,
    // lalu siarkan ke audiens yang tepat SAJA — inilah yang menjaga strategi tim tetap rahasia.
    if (match.pendingNotifications.length > 0) {
      for (const n of match.pendingNotifications) {
        if (n.audience === "all") {
          io.to(teamsRoom(code)).to(displayRoom(code)).emit("match:toast", { text: n.text, tone: n.tone ?? "info" });
        } else if (n.audience === "team" && n.teamIds) {
          for (const teamId of n.teamIds) {
            io.to(teamPrivateRoom(code, teamId)).emit("match:popup", { text: n.text, tone: n.tone ?? "info" });
          }
        }
      }
      match.pendingNotifications = [];
    }

    if (match.phase === "ended" && !match.resultSaved) {
      markResultSaved(code); // tandai duluan supaya tidak tersimpan dua kali kalau broadcast() sempat terpanggil lagi
      saveMatchResult(match).catch((err) => {
        console.error(`Gagal menyimpan hasil sesi ${code}:`, err);
      });
    }
  }

  async function saveMatchResult(match: ReturnType<typeof getMatch>) {
    if (!match) return;
    const ranked = Array.from(match.teams.values()).sort((a, b) => b.score - a.score);
    await prisma.matchResult.create({
      data: {
        matchCode: match.code,
        quizId: match.quizId,
        teacherId: match.teacherId,
        quizTitle: match.quizTitle,
        totalQuestions: match.questions.length,
        teams: {
          create: ranked.map((team, i) => ({
            name: team.name,
            score: team.score,
            rank: i + 1,
          })),
        },
      },
    });
  }

  io.on("connection", (socket: Socket) => {
    // Host terautentikasi lewat token JWT yang dikirim saat connect
    // (socket.handshake.auth.token). Display & buzzer tim tidak perlu login.
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      const payload = verifyToken(token);
      if (payload) socket.data.teacherId = payload.teacherId;
    }

    function requireTeacher(ack?: (res: any) => void): string | null {
      if (!socket.data.teacherId) {
        ack?.({ ok: false, message: "Belum login sebagai Host." });
        return null;
      }
      return socket.data.teacherId as string;
    }

    // ---- Host membuat sesi live dari salah satu kuis miliknya ----
    socket.on(
      "admin:create-match",
      async (
        payload: { quizId: string; randomOrder?: boolean },
        ack?: (res: any) => void
      ) => {
        const teacherId = requireTeacher(ack);
        if (!teacherId) return;

        const quiz = await prisma.quiz.findUnique({ where: { id: payload?.quizId } });
        if (!quiz || quiz.teacherId !== teacherId) {
          ack?.({ ok: false, message: "Kuis tidak ditemukan." });
          return;
        }

        const quizQuestions = await prisma.quizQuestion.findMany({
          where: { quizId: quiz.id },
          orderBy: { order: "asc" },
          include: { question: true },
        });
        if (quizQuestions.length === 0) {
          ack?.({ ok: false, message: "Kuis ini belum punya soal." });
          return;
        }

        let questions = quizQuestions.map(toMatchQuestion as any) as MatchQuestion[];
        if (payload?.randomOrder) questions = shuffle(questions);

        // Ronde "Semua Tim Menjawab": dihitung dari urutan FINAL (setelah acak kalau ada),
        // supaya selalu benar-benar di titik 1/4, 2/4, 3/4 urutan yang sungguh dimainkan.
        if ((quiz as any).simultaneousRoundEnabled) {
          const checkpoints = computeSimultaneousIndexes(questions.length);
          questions = questions.map((q, i) => (checkpoints.has(i) ? { ...q, isSimultaneous: true } : q));
        }

        const match = createMatch({
          teacherId,
          quizId: quiz.id,
          quizTitle: quiz.title,
          pointsCorrect: quiz.pointsCorrect,
          pointsWrongPenalty: quiz.pointsWrongPenalty,
          pointsTimeoutPenalty: quiz.pointsTimeoutPenalty,
          skipEnabled: quiz.skipEnabled,
          strategyCardsPerTeam: quiz.strategyCardsPerTeam,
          questions,
        });

        socket.join(adminRoom(match.code));
        socket.data.role = "admin";
        socket.data.matchCode = match.code;
        ack?.({ ok: true, matchCode: match.code, state: toAdminState(match) });
      }
    );

    // ---- Host menambah/menghapus tim ----
    socket.on(
      "admin:add-team",
      (payload: { matchCode: string; name: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = addTeam(payload?.matchCode, payload?.name ?? "");
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true, team: result.team });
        broadcast(payload.matchCode);
      }
    );

    socket.on(
      "admin:remove-team",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        removeTeam(payload?.matchCode, payload?.teamId);
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menampilkan soal tertentu ----
    socket.on(
      "admin:show-question",
      (payload: { matchCode: string; index: number }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = showQuestion(payload?.matchCode, payload?.index);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menandai tim tertentu "mengangkat tangan" secara manual ----
    socket.on(
      "admin:mark-buzzed",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = buzz(payload?.matchCode, payload?.teamId);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    socket.on(
      "admin:reset-buzz",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = resetBuzz(payload?.matchCode);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host membuka lagi buzzer untuk TIM LAIN setelah jawaban salah/waktu habis ----
    socket.on(
      "admin:reopen-for-others",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = reopenForOtherTeams(payload?.matchCode);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menilai jawaban tim yang sedang buzz ----
    socket.on(
      "admin:score",
      (payload: { matchCode: string; correct: boolean }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = scoreAnswer(payload?.matchCode, !!payload?.correct);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menilai jawaban SATU tim di ronde "Semua Tim Menjawab" (soal serentak) ----
    socket.on(
      "admin:grade-simultaneous",
      (payload: { matchCode: string; teamId: string; correct: boolean }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = gradeSimultaneous(payload?.matchCode, payload?.teamId, !!payload?.correct);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host lanjut ke soal berikutnya ----
    socket.on(
      "admin:next-question",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = nextQuestion(payload?.matchCode);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host melewati soal ini sepenuhnya, tanpa mempengaruhi skor ----
    socket.on(
      "admin:skip-question",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = skipQuestionByHost(payload?.matchCode);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menambah/mengurangi skor tim secara manual ----
    socket.on(
      "admin:adjust-score",
      (payload: { matchCode: string; teamId: string; delta: number }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = adjustTeamScore(payload?.matchCode, payload?.teamId, Number(payload?.delta) || 0);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host mengubah skor tim jadi nilai pasti ----
    socket.on(
      "admin:set-score",
      (payload: { matchCode: string; teamId: string; score: number }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = setTeamScore(payload?.matchCode, payload?.teamId, Number(payload?.score) || 0);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host mengakhiri sesi kapan saja ----
    socket.on(
      "admin:end-match",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        if (!requireTeacher(ack)) return;
        const result = endMatchNow(payload?.matchCode);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Layar proyektor bergabung ke sesi (tanpa login) ----
    socket.on(
      "display:join-match",
      (payload: { matchCode: string }, ack?: (res: any) => void) => {
        const match = getMatch(payload?.matchCode);
        if (!match) return ack?.({ ok: false, message: "Kode sesi tidak ditemukan." });
        socket.join(displayRoom(match.code));
        socket.data.role = "display";
        socket.data.matchCode = match.code;
        ack?.({ ok: true, state: toPublicState(match) });
      }
    );

    // ---- Perangkat buzzer tim bergabung (tanpa login, pakai teamId dari panitia) ----
    socket.on(
      "team:join-buzzer",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        const match = getMatch(payload?.matchCode);
        if (!match) return ack?.({ ok: false, message: "Kode sesi tidak ditemukan." });
        const team = match.teams.get(payload?.teamId);
        if (!team) return ack?.({ ok: false, message: "Tim tidak ditemukan di sesi ini." });

        socket.join(teamsRoom(match.code));
        socket.join(teamPrivateRoom(match.code, team.id));
        socket.data.role = "team";
        socket.data.matchCode = match.code;
        socket.data.teamId = team.id;
        ack?.({
          ok: true,
          teamName: team.name,
          state: toPublicState(match),
          myCard: toMyCardState(match, team.id),
          mySimultaneous: toMySimultaneousState(match, team.id),
        });
      }
    );

    // ---- Peserta gabung sendiri lewat Nama Tim + Kode Sesi (tanpa login, tanpa panitia) ----
    socket.on(
      "team:join-by-code",
      (payload: { matchCode: string; teamName: string }, ack?: (res: any) => void) => {
        const result = joinTeamByCode(payload?.matchCode, payload?.teamName ?? "");
        if ("error" in result) return ack?.({ ok: false, message: result.error });

        socket.join(teamsRoom(result.matchCode));
        socket.join(teamPrivateRoom(result.matchCode, result.team.id));
        socket.data.role = "team";
        socket.data.matchCode = result.matchCode;
        socket.data.teamId = result.team.id;
        const match = getMatch(result.matchCode);
        ack?.({
          ok: true,
          matchCode: result.matchCode,
          teamId: result.team.id,
          teamName: result.team.name,
          myCard: match ? toMyCardState(match, result.team.id) : null,
          mySimultaneous: match ? toMySimultaneousState(match, result.team.id) : null,
        });
        broadcast(result.matchCode);
      }
    );

    // ---- Tim menekan tombol buzz ----
    socket.on(
      "team:buzz",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        const result = buzz(payload?.matchCode, payload?.teamId);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Tim mengirim jawaban lewat halaman Buzzer untuk ronde "Semua Tim Menjawab" ----
    socket.on(
      "team:submit-simultaneous-answer",
      (
        payload: { matchCode: string; teamId: string; value: string | number | boolean },
        ack?: (res: any) => void
      ) => {
        const result = submitSimultaneousAnswer(payload?.matchCode, payload?.teamId, payload?.value);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Tim membatalkan vote skip-nya sendiri (bukan bel — bel tidak bisa dibatalkan) ----
    socket.on(
      "team:cancel-vote-skip",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        const result = cancelVoteSkip(payload?.matchCode, payload?.teamId);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Tim vote setuju skip soal ini ----
    socket.on(
      "team:vote-skip",
      (payload: { matchCode: string; teamId: string }, ack?: (res: any) => void) => {
        const result = voteSkip(payload?.matchCode, payload?.teamId);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true, allAgreed: result.allAgreed });
        if (result.allAgreed) {
          io.to(adminRoom(payload.matchCode))
            .to(displayRoom(payload.matchCode))
            .to(teamsRoom(payload.matchCode))
            .emit("match:question-skipped");
        }
        broadcast(payload.matchCode);
      }
    );

    // ---- Tim memakai satu kartu strategi dari stoknya ----
    socket.on(
      "team:use-card",
      (
        payload: { matchCode: string; teamId: string; cardId: CardId; targetTeamId?: string },
        ack?: (res: any) => void
      ) => {
        const result = useCard(payload?.matchCode, payload?.teamId, payload?.cardId, payload?.targetTeamId);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host selesaikan/batalkan paksa kartu 'pending' milik satu tim (koreksi/sengketa aturan) ----
    socket.on(
      "admin:resolve-card",
      (
        payload: { matchCode: string; teamId: string; outcome: "berhasil" | "hangus" },
        ack?: (res: any) => void
      ) => {
        if (!requireTeacher(ack)) return;
        const result = resolveActiveCard(payload?.matchCode, payload?.teamId, payload?.outcome);
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host mengatur jumlah kartu (total) milik satu tim ATAU semua tim sekaligus ----
    socket.on(
      "admin:set-card-quantity",
      (
        payload: { matchCode: string; teamId: string | "all"; cardId: CardId; total: number },
        ack?: (res: any) => void
      ) => {
        if (!requireTeacher(ack)) return;
        const result =
          payload?.teamId === "all"
            ? setCardQuantityAllTeams(payload?.matchCode, payload?.cardId, Number(payload?.total))
            : setCardQuantity(payload?.matchCode, payload?.teamId, payload?.cardId, Number(payload?.total));
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );

    // ---- Host menambah/mengurangi (+/-) jumlah kartu milik satu tim ATAU semua tim sekaligus ----
    socket.on(
      "admin:adjust-card-quantity",
      (
        payload: { matchCode: string; teamId: string | "all"; cardId: CardId; delta: number },
        ack?: (res: any) => void
      ) => {
        if (!requireTeacher(ack)) return;
        const result =
          payload?.teamId === "all"
            ? adjustCardQuantityAllTeams(payload?.matchCode, payload?.cardId, Number(payload?.delta))
            : adjustCardQuantity(payload?.matchCode, payload?.teamId, payload?.cardId, Number(payload?.delta));
        if ("error" in result) return ack?.({ ok: false, message: result.error });
        ack?.({ ok: true });
        broadcast(payload.matchCode);
      }
    );
  });

  // Cek berkala: sesi yang timer jawabnya sudah habis tapi belum dinilai panitia.
  setInterval(() => {
    const expired = findExpiredMatches();
    for (const match of expired) {
      applyTimeout(match.code);
      broadcast(match.code);
    }
  }, 500);

  setInterval(() => cleanupStaleMatches(), 1000 * 60 * 30);
}
