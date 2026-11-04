"use client";

import { useEffect, useRef } from "react";
import { resolveVideoEmbed } from "@/lib/media";
import { resolveMediaUrl } from "@/lib/api";

export function MediaBlock({
  mediaType,
  mediaUrl,
  className = "",
  autoPlay = false,
  soundEnabled = false,
  onSoundBlocked,
}: {
  mediaType: "NONE" | "IMAGE" | "VIDEO";
  mediaUrl: string | null;
  className?: string;
  autoPlay?: boolean;
  /** Kalau true, coba putar video dengan suara. Kalau browser menolak, otomatis fallback ke mute. */
  soundEnabled?: boolean;
  /** Dipanggil kalau browser menolak autoplay bersuara, supaya halaman bisa tampilkan tombol kecil "aktifkan suara". */
  onSoundBlocked?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const embed = mediaType === "VIDEO" && mediaUrl ? resolveVideoEmbed(mediaUrl) : null;
  const directSrc = embed && embed.kind === "direct" ? resolveMediaUrl(embed.url) : null;

  // Setiap kali soal (src) berganti, video di-remount lewat `key` di bawah,
  // jadi effect ini selalu jalan ulang dari awal untuk mencoba autoplay
  // bersuara pada soal yang baru — bukan cuma soal pertama.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !autoPlay || !directSrc) return;
    el.muted = !soundEnabled;
    const playPromise = el.play();
    if (playPromise && soundEnabled) {
      playPromise.catch(() => {
        // Browser menolak autoplay bersuara (kebijakan browser) — putar tanpa
        // suara dulu, lalu minta halaman tampilkan tombol kecil untuk
        // mengaktifkan suara secara manual.
        el.muted = true;
        el.play().catch(() => {});
        onSoundBlocked?.();
      });
    }
  }, [directSrc, soundEnabled, autoPlay]);

  if (mediaType === "NONE" || !mediaUrl) return null;

  if (mediaType === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="" className={className} loading="lazy" decoding="async" />;
  }

  if (embed && (embed.kind === "youtube" || embed.kind === "vimeo")) {
    const params = new URLSearchParams();
    if (autoPlay) params.set("autoplay", "1");
    params.set("mute", soundEnabled ? "0" : "1");
    return (
      <div className={`aspect-video ${className}`}>
        <iframe
          // key: paksa iframe reload penuh tiap soal berganti, bukan cuma ganti src,
          // supaya parameter autoplay/mute yang baru benar-benar diterapkan lagi.
          key={`${embed.embedUrl}:${soundEnabled}`}
          src={`${embed.embedUrl}${params.toString() ? `?${params.toString()}` : ""}`}
          className="h-full w-full rounded-[inherit] border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <video
      key={directSrc}
      ref={videoRef}
      src={directSrc ?? undefined}
      controls
      autoPlay={autoPlay}
      // "metadata": browser cuma ambil durasi/dimensi dulu, bukan seluruh file, sampai
      // benar-benar diputar — mengurangi buffering/kuota kalau videonya besar tapi
      // ternyata soal itu belum tentu ditonton penuh.
      preload="metadata"
      playsInline
      className={className}
    />
  );
}
