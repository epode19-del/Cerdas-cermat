"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register, setToken, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register({ name, email, password });
      setToken(res.token);
      router.push("/dashboard/bank-soal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mendaftar. Coba lagi.");
    } finally {
      setLoading(false);
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
        <h1 className="font-display text-2xl font-semibold">Daftar Akun Host</h1>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Nama
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
          />
        </label>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 outline-none focus:border-brand-500"
          />
          <span className="text-xs text-slate-500">Minimal 6 karakter</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? "Mendaftar..." : "Daftar"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-brand-500 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
