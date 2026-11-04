"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Press_Start_2P, VT323 } from "next/font/google";
import { getSocket } from "@/lib/socket";
// Sengaja IMPOR ULANG css module Home persis apa adanya — supaya bingkai TV,
// scanline, keychain, dst di halaman ini 100% sama dengan Home. Satu-satunya
// yang beda memang isi layarnya: di sini form gabung, bukan tombol HOST/PLAYER.
import styles from "../page.module.css";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
});
const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
});

const CODE_LEN = 6;

const INVADERS = [
  { char: "▲", style: { top: 64, left: "7%" } },
  { char: "◆", style: { top: 58, left: "24%", fontSize: 14, animationDelay: "0.8s" } },
  { char: "◆", style: { top: 110, right: "9%", animationDelay: "1.5s" } },
  { char: "✦", style: { top: 74, right: "22%", fontSize: 15, animationDelay: "2.4s" } },
  { char: "✦", style: { bottom: 150, left: "5%", animationDelay: "3s" } },
  { char: "●", style: { bottom: 170, left: "20%", fontSize: 15, animationDelay: "1.1s" } },
  { char: "◆", style: { bottom: 150, right: "6%", animationDelay: "2s" } },
  { char: "▲", style: { bottom: 180, right: "26%", fontSize: 14, animationDelay: "2.8s" } },
];

function CodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setChar(index: number, char: string) {
    const chars = value.split("");
    while (chars.length < CODE_LEN) chars.push("");
    chars[index] = char;
    onChange(chars.join("").slice(0, CODE_LEN));
  }

  function handleInput(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    setChar(index, clean);
    if (clean && index < CODE_LEN - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const chars = value.padEnd(CODE_LEN, " ").split("");
    for (let j = 0; j < text.length && index + j < CODE_LEN; j++) {
      chars[index + j] = text[j];
    }
    const merged = chars.join("").replace(/ /g, "").slice(0, CODE_LEN);
    onChange(merged);
    const nextIndex = Math.min(index + text.length, CODE_LEN - 1);
    inputRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={styles.codeRow}>
      {Array.from({ length: CODE_LEN }).map((_, index) => {
        const char = value[index] ?? "";
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={char}
            onChange={(e) => handleInput(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
            className={`${styles.codeBox} ${char ? styles.filled : ""}`}
          />
        );
      })}
    </div>
  );
}

function GabungForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [powerOnVisible, setPowerOnVisible] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [matchCode, setMatchCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const teamNameInputRef = useRef<HTMLInputElement | null>(null);

  const nameOk = teamName.trim().length > 0;
  const codeOk = matchCode.replace(/[^A-Z0-9]/g, "").length === CODE_LEN;
  const canJoin = nameOk && codeOk;

  // Kalau datang dari scan QR code (link berisi ?code=XXXXXX dari layar Host), kode sesi
  // otomatis terisi — peserta tinggal isi nama tim, tidak perlu ketik ulang 6 karakter kode.
  useEffect(() => {
    const fromQr = searchParams?.get("code");
    if (fromQr) {
      setMatchCode(fromQr.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN));
      teamNameInputRef.current?.focus();
    }
  }, [searchParams]);

  useEffect(() => {
    setError(null);
  }, [teamName, matchCode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = teamName.trim();
    const trimmedCode = matchCode.trim().toUpperCase();
    if (!trimmedName || trimmedCode.length !== CODE_LEN) {
      setError("Masukkan nama tim dan 6 karakter kode sesi.");
      return;
    }

    setSubmitting(true);
    const socket = getSocket();
    socket.emit(
      "team:join-by-code",
      { matchCode: trimmedCode, teamName: trimmedName },
      (res: { ok: boolean; matchCode?: string; teamId?: string; message?: string }) => {
        setSubmitting(false);
        if (res.ok && res.matchCode && res.teamId) {
          router.push(`/buzzer/${res.matchCode}/${res.teamId}`);
        } else {
          setError(res.message ?? "Gagal bergabung. Coba lagi.");
        }
      }
    );
  }

  return (
    <div className={`${pressStart.variable} ${vt323.variable} ${styles.epodeRoot}`}>
      <div className={styles.stage}>
        <div className={styles["tv-frame"]}>
          <div className={styles["brand-plate"]}>CERDAS CERMAT // ONLINE</div>
          <div className={`${styles.screw} ${styles.tl}`} />
          <div className={`${styles.screw} ${styles.tr}`} />
          <div className={`${styles.screw} ${styles.bl}`} />
          <div className={`${styles.screw} ${styles.br}`} />
          <div className={styles["vent-marks"]}>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className={`${styles.keychain} ${styles["kc-left"]}`}>
            <div className={styles.ring} />
            <div className={styles.cord} />
            <svg className={styles.charm} width="30" height="26" viewBox="0 0 24 20" shapeRendering="crispEdges">
              <rect x="8" y="0" width="8" height="4" fill="var(--phosphor-bright)" />
              <rect x="0" y="4" width="24" height="4" fill="var(--phosphor-bright)" />
              <rect x="0" y="8" width="24" height="4" fill="var(--phosphor-bright)" />
              <rect x="0" y="12" width="24" height="4" fill="var(--phosphor-bright)" />
              <rect x="0" y="16" width="8" height="4" fill="var(--phosphor-bright)" />
              <rect x="16" y="16" width="8" height="4" fill="var(--phosphor-bright)" />
              <rect x="4" y="8" width="4" height="4" fill="#0c0f09" />
              <rect x="16" y="8" width="4" height="4" fill="#0c0f09" />
            </svg>
          </div>

          <div className={`${styles.keychain} ${styles["kc-right"]}`}>
            <div className={styles.ring} />
            <div className={styles.cord} />
            <svg className={styles.charm} width="28" height="26" viewBox="0 0 24 24" shapeRendering="crispEdges">
              <rect x="4" y="0" width="4" height="4" fill="var(--phosphor)" />
              <rect x="16" y="0" width="4" height="4" fill="var(--phosphor)" />
              <rect x="8" y="4" width="8" height="4" fill="var(--phosphor)" />
              <rect x="0" y="8" width="24" height="4" fill="var(--phosphor)" />
              <rect x="0" y="12" width="24" height="4" fill="var(--phosphor)" />
              <rect x="0" y="16" width="24" height="4" fill="var(--phosphor)" />
              <rect x="4" y="20" width="4" height="4" fill="var(--phosphor)" />
              <rect x="12" y="20" width="4" height="4" fill="var(--phosphor)" />
              <rect x="20" y="20" width="4" height="4" fill="var(--phosphor)" />
              <rect x="6" y="12" width="4" height="4" fill="#0c0f09" />
              <rect x="14" y="12" width="4" height="4" fill="#0c0f09" />
            </svg>
          </div>

          <div className={styles["screen-wrap"]}>
            <div className={styles.screen}>
              <div className={styles.scanlines} />
              <div className={styles.vignette} />
              <div className={styles["glow-sweep"]} />
              <div className={styles["title-glow"]} />

              <div className={styles["status-row"]}>
                <span>
                  <span className={styles.dot} /> SYSTEM READY
                </span>
                <span>
                  SIGNAL 100% <span className={styles.dot} />
                </span>
              </div>

              <div className={`${styles.corner} ${styles.tl}`} />
              <div className={`${styles.corner} ${styles.tr}`} />
              <div className={`${styles.corner} ${styles.bl}`} />
              <div className={`${styles.corner} ${styles.br}`} />

              <div className={styles.ruler}>
                <span>25</span>
                <span>20</span>
                <span>15</span>
                <span>10</span>
                <span>05</span>
                <span>0.7e</span>
              </div>

              <div className={styles["mini-label"]} style={{ top: 42, left: 60 }}>
                <span className={styles.sq} />
                MASUKKAN KODE
              </div>
              <div className={styles["mini-label"]} style={{ top: 42, right: 60 }}>
                <span className={styles.sq} />
                SOCKET.IO LIVE
              </div>

              {INVADERS.map((inv, i) => (
                <span key={i} className={styles.invader} style={inv.style}>
                  {inv.char}
                </span>
              ))}

              <svg className={styles.smog} viewBox="0 0 800 70" preserveAspectRatio="none">
                <path
                  d="M0,40 Q40,10 80,35 T160,32 T240,42 T320,28 T400,38 T480,30 T560,40 T640,32 T720,42 T800,34 L800,70 L0,70 Z"
                  fill="var(--phosphor-dim)"
                />
                <path
                  d="M0,55 Q60,35 120,50 T240,48 T360,55 T480,46 T600,55 T720,48 T800,52 L800,70 L0,70 Z"
                  fill="var(--phosphor-dim)"
                  opacity="0.6"
                />
              </svg>

              <div className={styles.eyebrow}>
                GABUNG SESI TIM<span className={styles.cursor}>_</span>
              </div>
              <h1 style={{ fontSize: "clamp(22px, 5vw, 38px)" }}>
                GABUNG
                <br />
                SESI
              </h1>

              <form onSubmit={handleSubmit} className={styles.formWrap}>
                <div className={styles.teamBadge} style={{ visibility: teamName.trim() ? "visible" : "hidden" }}>
                  <div className={styles.teamBadgeAvatar}>{teamName.trim()[0]?.toUpperCase() || "?"}</div>
                  <div>
                    <div className={styles.teamBadgeLabel}>TIM KAMU</div>
                    <div className={styles.teamBadgeName}>{teamName.trim() || "-"}</div>
                  </div>
                </div>

                <div>
                  <label className={styles.formLabel} htmlFor="teamName">
                    NAMA TIM
                  </label>
                  <input
                    id="teamName"
                    ref={teamNameInputRef}
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="cth. Elang Merah"
                    maxLength={20}
                    autoComplete="off"
                    className={styles.textInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>KODE SESI</label>
                  <CodeInput value={matchCode} onChange={setMatchCode} />
                  <div className={`${styles.hintText} ${codeOk ? styles.ready : ""}`} style={{ marginTop: 8 }}>
                    {codeOk ? "kode oke, tinggal gabung." : "masukkan 6 karakter kode dari host"}
                  </div>
                </div>

                {error && <div className={styles.errorBox}>{error}</div>}

                <button type="submit" disabled={!canJoin || submitting} className={`${styles.btn} ${styles.player}`}>
                  {submitting ? "MENGHUBUNGKAN..." : "GABUNG"}
                </button>
              </form>
            </div>
          </div>

          <div className={styles["tv-base"]}>
            <div className={styles.knob} />
            <div className={styles.knob} />
            <div className={styles.knob} />
          </div>
        </div>
      </div>

      {powerOnVisible && (
        <div className={styles["power-on"]} onAnimationEnd={() => setPowerOnVisible(false)} />
      )}
    </div>
  );
}

// useSearchParams() (dipakai buat baca ?code=... dari QR) wajib dibungkus Suspense di Next 14
// App Router kalau halamannya mau ikut static prerendering — tanpa ini build produksi gagal.
export default function GabungPage() {
  return (
    <Suspense fallback={null}>
      <GabungForm />
    </Suspense>
  );
}
