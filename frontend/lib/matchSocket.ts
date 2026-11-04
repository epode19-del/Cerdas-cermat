"use client";

import { io, Socket } from "socket.io-client";
import { getToken } from "./api";
import type { CardId } from "./cardTypes";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let adminSocket: Socket | null = null;

/** Socket khusus panitia/host — mengirim token JWT saat connect supaya server tahu pemilik sesi. */
export function getAdminSocket(): Socket {
  if (!adminSocket) {
    adminSocket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
      auth: { token: getToken() ?? undefined },
    });
  }
  return adminSocket;
}

export type MatchPhase = "lobby" | "question-shown" | "buzzed" | "simultaneous" | "revealed" | "ended";
export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN";
export type Outcome = "correct" | "wrong" | "timeout" | null;

export interface MatchTeam {
  id: string;
  name: string;
  score: number;
}

/** Kartu yang sedang terpasang di satu tim, menunggu diselesaikan (kecuali kartu instant). */
export interface ActiveCard {
  cardId: CardId;
  target: { id: string; name: string } | null;
  status: "pending" | "revealed";
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

/** Tim seperti yang dilihat panitia — termasuk detail kartu milik tim ini. */
export interface AdminTeam extends MatchTeam {
  cardStock: Partial<Record<CardId, number>>;
  cardStockUsed: Partial<Record<CardId, number>>;
  usedCardThisQuestion: boolean;
  activeCard: ActiveCard | null;
  fiftyRevealedIndexes: number[] | null;
  hintRevealed: boolean;
}

/** Riwayat perubahan stok kartu oleh host lewat panel Pengaturan Kartu. */
export interface CardAdminLogEntry {
  ts: number;
  teamName: string;
  cardName: string;
  description: string;
}

/** Notifikasi kecil (pojok atas, hilang otomatis) — event "match:toast". */
export interface CardToast {
  text: string;
  tone: "success" | "fail" | "info";
}

/** Popup besar (tengah layar) — event "match:popup", hanya dikirim ke tim yang berkaitan. */
export interface CardPopup {
  text: string;
  tone: "success" | "fail" | "info";
}

/** Info kartu milik satu tim tertentu (privat) — dikirim lewat "match:my-card-state". */
export interface MyCardState {
  cardStock: Partial<Record<CardId, number>>;
  usedCardThisQuestion: boolean;
  activeCard: ActiveCard | null;
  fiftyRevealedIndexes: number[] | null;
  revealedClue: string | null;
}

export interface AdminMatchQuestion {
  quizQuestionId: string;
  order: number;
  answerTimeSec: number;
  text: string;
  mediaType: "NONE" | "IMAGE" | "VIDEO";
  mediaUrl: string | null;
  type: QuestionType;
  options: string[] | null;
  correctAnswerDisplay: string;
  acceptableAnswers: string[] | null;
  clue: string | null;
  index: number;
  /** true = ronde "Semua Tim Menjawab" (bukan rebutan bel) untuk soal ini. */
  isSimultaneous: boolean;
}

export interface AdminMatchState {
  matchCode: string;
  quizTitle: string;
  phase: MatchPhase;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: AdminMatchQuestion | null;
  teams: AdminTeam[];
  buzzedTeamId: string | null;
  excludedTeamIds: string[];
  skipEnabled: boolean;
  skipVotes: string[];
  timerDuration: number | null;
  timerStartedAt: number | null;
  lastOutcome: Outcome;
  strategyCardsPerTeam: number;
  cardLog: CardLogEntry[];
  cardAdminLog: CardAdminLogEntry[];
  /** Hasil penilaian ronde "Semua Tim Menjawab" untuk soal saat ini, keyed by teamId. */
  simultaneousGrades: Partial<Record<string, "correct" | "wrong">>;
  /** Jawaban mentah tiap tim untuk soal saat ini, keyed by teamId — HANYA di sini (host). */
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
    mediaType: "NONE" | "IMAGE" | "VIDEO";
    mediaUrl: string | null;
    type: QuestionType;
    options: string[] | null;
    isSimultaneous: boolean;
  } | null;
  teams: MatchTeam[];
  buzzedTeamId: string | null;
  buzzedTeamName: string | null;
  excludedTeamIds: string[];
  skipEnabled: boolean;
  skipVotes: string[];
  timerDuration: number | null;
  timerStartedAt: number | null;
  lastOutcome: Outcome;
  strategyCardsEnabled: boolean;
  /** Ringkasan progres ronde "Semua Tim Menjawab" — SENGAJA cuma angka agregat, bukan per-tim,
   *  supaya tidak ada tim yang bisa lihat siapa sudah jawab apa/benar-salah sebelum panitia sendiri
   *  yang memberi tahu. Detail per-tim ada di AdminMatchState (host) & MySimultaneousState (privat). */
  simultaneousProgress: { submitted: number; graded: number; total: number } | null;
}

/** Status ronde "Semua Tim Menjawab" milik tim SENDIRI — dikirim lewat channel privat, event "match:my-simultaneous-state". */
export interface MySimultaneousState {
  submitted: boolean;
  value: string | number | boolean | null;
  grade: "correct" | "wrong" | null;
}
