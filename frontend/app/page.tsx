"use client";

import { useState } from "react";
import Link from "next/link";
import { Press_Start_2P, VT323 } from "next/font/google";
import styles from "./page.module.css";

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

const INVADERS = [
  { char: "▲", style: { top: 64, left: "7%" } },
  {
    char: "◆",
    style: { top: 58, left: "24%", fontSize: 14, animationDelay: "0.8s" },
  },
  { char: "◆", style: { top: 110, right: "9%", animationDelay: "1.5s" } },
  {
    char: "✦",
    style: { top: 74, right: "22%", fontSize: 15, animationDelay: "2.4s" },
  },
  { char: "✦", style: { bottom: 150, left: "5%", animationDelay: "3s" } },
  {
    char: "●",
    style: { bottom: 170, left: "20%", fontSize: 15, animationDelay: "1.1s" },
  },
  { char: "◆", style: { bottom: 150, right: "6%", animationDelay: "2s" } },
  {
    char: "▲",
    style: { bottom: 180, right: "26%", fontSize: 14, animationDelay: "2.8s" },
  },
  {
    char: "■",
    style: { top: 130, left: "14%", fontSize: 13, animationDelay: "1.9s" },
  },
  {
    char: "■",
    style: { top: 145, right: "15%", fontSize: 13, animationDelay: "0.4s" },
  },
  {
    char: "✦",
    style: { top: 200, left: "9%", fontSize: 12, animationDelay: "2.2s" },
  },
  {
    char: "●",
    style: { top: 190, right: "12%", fontSize: 12, animationDelay: "0.6s" },
  },
  {
    char: "▲",
    style: { bottom: 210, left: "32%", fontSize: 12, animationDelay: "1.4s" },
  },
  {
    char: "◆",
    style: { bottom: 220, right: "34%", fontSize: 12, animationDelay: "2.6s" },
  },
  {
    char: "■",
    style: { top: 96, left: "42%", fontSize: 11, animationDelay: "3.4s" },
  },
  {
    char: "✦",
    style: { top: 88, right: "40%", fontSize: 11, animationDelay: "1.7s" },
  },
];

export default function HomePage() {
  const [powerOnVisible, setPowerOnVisible] = useState(true);

  return (
    <div
      className={`${pressStart.variable} ${vt323.variable} ${styles.epodeRoot}`}
    >
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
            <svg
              className={styles.charm}
              width="30"
              height="26"
              viewBox="0 0 24 20"
              shapeRendering="crispEdges"
            >
              <rect
                x="8"
                y="0"
                width="8"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect
                x="0"
                y="4"
                width="24"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect
                x="0"
                y="8"
                width="24"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect
                x="0"
                y="12"
                width="24"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect
                x="0"
                y="16"
                width="8"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect
                x="16"
                y="16"
                width="8"
                height="4"
                fill="var(--phosphor-bright)"
              />
              <rect x="4" y="8" width="4" height="4" fill="#0c0f09" />
              <rect x="16" y="8" width="4" height="4" fill="#0c0f09" />
            </svg>
          </div>

          <div className={`${styles.keychain} ${styles["kc-mid"]}`}>
            <div className={styles.ring} />
            <div className={styles.cord} />
            <svg
              className={styles.charm}
              width="26"
              height="24"
              viewBox="0 0 20 20"
              shapeRendering="crispEdges"
            >
              <rect x="4" y="0" width="12" height="4" fill="var(--amber)" />
              <rect x="0" y="4" width="20" height="4" fill="var(--amber)" />
              <rect x="0" y="8" width="20" height="4" fill="var(--amber)" />
              <rect x="0" y="12" width="20" height="4" fill="var(--amber)" />
              <rect x="0" y="16" width="4" height="4" fill="var(--amber)" />
              <rect x="8" y="16" width="4" height="4" fill="var(--amber)" />
              <rect x="16" y="16" width="4" height="4" fill="var(--amber)" />
              <rect x="4" y="8" width="4" height="4" fill="#3a2c05" />
              <rect x="12" y="8" width="4" height="4" fill="#3a2c05" />
            </svg>
          </div>

          <div className={`${styles.keychain} ${styles["kc-right"]}`}>
            <div className={styles.ring} />
            <div className={styles.cord} />
            <svg
              className={styles.charm}
              width="28"
              height="26"
              viewBox="0 0 24 24"
              shapeRendering="crispEdges"
            >
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
              <div className={styles["static-overlay"]}>
                <svg>
                  <filter id="noiseFilter">
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.85"
                      numOctaves="2"
                      stitchTiles="stitch"
                      result="noise"
                    />
                    <feColorMatrix
                      in="noise"
                      type="matrix"
                      values="0 0 0 0 0.61  0 0 0 0 0.89  0 0 0 0 0.58  0 0 0 0.55 0"
                    />
                  </filter>
                  <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                </svg>
              </div>

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

              <div
                className={styles["mini-label"]}
                style={{ top: 42, left: 60 }}
              >
                <span className={styles.sq} />
                BANK SOAL 3 TIPE
              </div>
              <div
                className={styles["mini-label"]}
                style={{ top: 42, right: 60 }}
              >
                <span className={styles.sq} />
                SOCKET.IO LIVE
              </div>

              {INVADERS.map((inv, i) => (
                <span key={i} className={styles.invader} style={inv.style}>
                  {inv.char}
                </span>
              ))}

              <svg
                className={styles.smog}
                viewBox="0 0 800 70"
                preserveAspectRatio="none"
              >
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
                CERDAS CERMAT TERMINAL<span className={styles.cursor}>_</span>
              </div>
              <h1>
                CERDAS
                <br />
                CERMAT
              </h1>

              <div className={styles.buttons}>
                <Link href="/login" className={`${styles.btn} ${styles.host}`}>
                  HOST
                </Link>
                <Link
                  href="/gabung"
                  className={`${styles.btn} ${styles.player}`}
                >
                  PLAYER
                </Link>
              </div>
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
        <div
          className={styles["power-on"]}
          onAnimationEnd={() => setPowerOnVisible(false)}
        />
      )}
    </div>
  );
}
