"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "cerdas-cermat:token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export const API_BASE_URL = API_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Wrapper fetch yang otomatis menyertakan token host & melempar ApiError yang rapi. */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? "Terjadi kesalahan pada server.", res.status);
  }
  return data as T;
}

// ---- Tipe data ----
export interface Teacher {
  id: string;
  name: string;
  email: string;
}

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN";

export type MediaType = "NONE" | "IMAGE" | "VIDEO";

export type Difficulty = "MUDAH" | "SEDANG" | "SUSAH";

export type Question =
  | { id: string; type: "MULTIPLE_CHOICE"; text: string; mediaType: MediaType; mediaUrl: string | null; acceptableAnswers: string[] | null; clue: string | null; difficulty: Difficulty | null; options: string[]; correctIndex: number; createdAt: string }
  | { id: string; type: "TRUE_FALSE"; text: string; mediaType: MediaType; mediaUrl: string | null; acceptableAnswers: string[] | null; clue: string | null; difficulty: Difficulty | null; correctAnswer: boolean; createdAt: string }
  | { id: string; type: "FILL_IN"; text: string; mediaType: MediaType; mediaUrl: string | null; acceptableAnswers: string[] | null; clue: string | null; difficulty: Difficulty | null; correctAnswer: string; createdAt: string };

export interface Quiz {
  id: string;
  title: string;
  pointsCorrect: number;
  pointsWrongPenalty: number;
  pointsTimeoutPenalty: number;
  skipEnabled: boolean;
  strategyCardsPerTeam: number;
  /** Mode Tingkat Kesulitan ON/OFF — kalau ON, penyusun kuis bisa filter/susun soal per label Mudah/Sedang/Susah. */
  difficultyModeEnabled: boolean;
  /** Ronde "Semua Tim Menjawab" ON/OFF — kalau ON, soal di titik 1/4, 2/4, 3/4 urutan kuis otomatis jadi mode serentak. */
  simultaneousRoundEnabled: boolean;
  questionCount: number;
  createdAt: string;
}

// ---- Auth ----
export function register(data: { name: string; email: string; password: string }) {
  return request<{ token: string; teacher: Teacher }>("/api/auth/register", {
    method: "POST",
    body: data,
  });
}

export function login(data: { email: string; password: string }) {
  return request<{ token: string; teacher: Teacher }>("/api/auth/login", {
    method: "POST",
    body: data,
  });
}

/** Mode tamu: langsung dapat akun & token tanpa isi form, buat coba cepat. */
export function guestLogin() {
  return request<{ token: string; teacher: Teacher }>("/api/auth/guest", {
    method: "POST",
  });
}

export function getMe() {
  return request<{ teacher: Teacher }>("/api/auth/me");
}

// ---- Bank soal ----
export function listQuestions() {
  return request<{ questions: Question[] }>("/api/questions");
}

export function createQuestion(
  data:
    | { type: "MULTIPLE_CHOICE"; text: string; mediaType?: MediaType; mediaUrl?: string | null; acceptableAnswers?: string[] | null; clue?: string | null; difficulty?: Difficulty | null; options: string[]; correctIndex: number }
    | { type: "TRUE_FALSE"; text: string; mediaType?: MediaType; mediaUrl?: string | null; acceptableAnswers?: string[] | null; clue?: string | null; difficulty?: Difficulty | null; correctAnswer: boolean }
    | { type: "FILL_IN"; text: string; mediaType?: MediaType; mediaUrl?: string | null; acceptableAnswers?: string[] | null; clue?: string | null; difficulty?: Difficulty | null; correctAnswer: string }
) {
  return request<{ question: Question }>("/api/questions", { method: "POST", body: data });
}

export function deleteQuestion(id: string) {
  return request<void>(`/api/questions/${id}`, { method: "DELETE" });
}

// ---- Kuis ----
export function listQuizzes() {
  return request<{ quizzes: Quiz[] }>("/api/quizzes");
}

export function createQuiz(title: string) {
  return request<{ quiz: Quiz }>("/api/quizzes", { method: "POST", body: { title } });
}

export function updateQuizSettings(id: string, data: Partial<Omit<Quiz, "id" | "questionCount" | "createdAt">>) {
  return request<{ quiz: Quiz }>(`/api/quizzes/${id}`, { method: "PUT", body: data });
}

export function getQuizDetail(id: string) {
  return request<{
    quiz: Quiz;
    questions: { id: string; order: number; thinkTimeSec: number; answerTimeSec: number; question: Question }[];
  }>(`/api/quizzes/${id}`);
}

export function addQuestionToQuiz(
  quizId: string,
  data: { questionId: string; thinkTimeSec?: number; answerTimeSec?: number }
) {
  return request(`/api/quizzes/${quizId}/questions`, { method: "POST", body: data });
}

export function removeQuestionFromQuiz(quizId: string, quizQuestionId: string) {
  return request<void>(`/api/quizzes/${quizId}/questions/${quizQuestionId}`, { method: "DELETE" });
}

// ---- Riwayat Hasil Sesi ----
export interface MatchResultTeam {
  id: string;
  name: string;
  score: number;
  rank: number;
}

export interface MatchResult {
  id: string;
  matchCode: string;
  quizId: string;
  quizTitle: string;
  playedAt: string;
  totalQuestions: number;
  teams: MatchResultTeam[];
}

export function listResults() {
  return request<MatchResult[]>("/api/results");
}

export function getResult(id: string) {
  return request<MatchResult>(`/api/results/${id}`);
}

export function deleteResult(id: string) {
  return request<void>(`/api/results/${id}`, { method: "DELETE" });
}

// ---- Upload video langsung (multipart, bukan lewat request() yang JSON-only) ----
export async function uploadVideo(file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("video", file);

  const res = await fetch(`${API_URL}/api/upload/video`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? "Gagal upload video.", res.status);
  }
  return data as { url: string };
}

/** Gabungkan path relatif dari backend (mis. "/uploads/videos/x.mp4") dengan alamat backend. */
export function resolveMediaUrl(url: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith("data:")) return url;
  return `${API_BASE_URL}${url}`;
}
