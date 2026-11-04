"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe, getToken, clearToken, Teacher } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then((res) => setTeacher(res.teacher))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-slate-400">
        Memeriksa sesi login...
      </main>
    );
  }

  const navItems = [
    { href: "/dashboard/bank-soal", label: "Bank Soal" },
    { href: "/dashboard/quiz", label: "Kuis Saya" },
    { href: "/dashboard/hasil", label: "Riwayat Hasil" },
  ];

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-display font-semibold">Cerdas Cermat</span>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname?.startsWith(item.href)
                    ? "text-brand-500"
                    : "text-slate-400 hover:text-slate-200"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>{teacher?.name}</span>
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
          >
            Keluar
          </button>
        </div>
      </header>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}
