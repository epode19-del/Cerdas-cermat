"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Menampilkan QR code dari sebuah URL/teks. Dipakai supaya peserta bisa gabung sesi atau
 *  langsung masuk ke halaman bel timnya cukup dengan scan HP, tanpa ketik kode manual. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(false);
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: "#12141f", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-lg bg-white/10 text-center text-xs text-red-300"
      >
        Gagal membuat QR
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex animate-pulse items-center justify-center rounded-lg bg-white/10 text-xs text-[#8a8371]"
      >
        Memuat QR...
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data: URL, bukan aset Next/Image
    <img src={dataUrl} alt={`QR code: ${value}`} width={size} height={size} className="rounded-lg bg-white p-2" />
  );
}
