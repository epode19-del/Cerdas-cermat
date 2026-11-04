"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, guestLogin, setToken, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ email, password });
      setToken(res.token);
      router.push("/dashboard/bank-soal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal login. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError(null);
    setGuestLoading(true);
    try {
      const res = await guestLogin();
      setToken(res.token);
      router.push("/dashboard/bank-soal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk sebagai tamu. Coba lagi.");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
        ‹ Kembali
      </Link>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8"
      >
        <h1 className="font-display text-2xl font-semibold">Login Host</h1>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? "Masuk..." : "Masuk"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Belum punya akun?{" "}
          <Link href="/register" className="text-brand-500 hover:underline">
            Daftar
          </Link>
        </p>
      </form>

      <div className="flex w-full max-w-sm items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-white/10" />
        atau
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={handleGuest}
        disabled={guestLoading}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
      >
        {guestLoading ? "Menyiapkan..." : "⚡ Mulai Cepat Tanpa Daftar (Mode Tamu)"}
      </button>
      <p className="max-w-sm text-center text-xs text-slate-500">
        Cocok buat coba-coba. Kuis & soal yang kamu buat tetap tersimpan,
        tapi kamu masuk otomatis tanpa isi form.
      </p>
    </main>
  );
}
