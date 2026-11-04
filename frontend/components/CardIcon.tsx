"use client";

// Ikon pixel-art untuk kartu strategi. Semua digambar dengan <rect> blok
// (shapeRendering="crispEdges") senada dengan gaya pixel yang sudah dipakai
// di landing page (lihat app/page.tsx charm svg) — TIDAK memakai emoji sama
// sekali, sesuai revisi UI kartu.

import type { CardId } from "@/lib/cardTypes";

function Px({ x, y, w = 1, h = 1, fill }: { x: number; y: number; w?: number; h?: number; fill: string }) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} />;
}

/** Pixel Coin Bag / Treasure — kartu AMBIL POIN. */
function IconSteal() {
  const gold = "#f4c542";
  const goldDark = "#c9922a";
  const sack = "#8a5a2b";
  const sackDark = "#5e3c1c";
  const tie = "#d9b26b";
  return (
    <>
      <Px x={5} y={2} w={6} h={2} fill={tie} />
      <Px x={4} y={4} w={8} h={1} fill={sackDark} />
      <Px x={3} y={5} w={10} h={7} fill={sack} />
      <Px x={3} y={11} w={10} h={2} fill={sackDark} />
      <Px x={4} y={13} w={8} h={1} fill={sackDark} />
      <Px x={7} y={7} w={4} h={4} fill={gold} />
      <Px x={7} y={7} w={4} h={1} fill={goldDark} />
      <Px x={7} y={10} w={4} h={1} fill={goldDark} />
      <Px x={8} y={8} w={2} h={2} fill={goldDark} />
    </>
  );
}

/** Pixel Crystal — kartu X2. */
function IconDouble() {
  const c1 = "#7ee0f0";
  const c2 = "#3fb8d6";
  const c3 = "#1f7f99";
  return (
    <>
      <Px x={7} y={1} w={2} h={2} fill={c1} />
      <Px x={5} y={3} w={6} h={2} fill={c1} />
      <Px x={4} y={5} w={8} h={2} fill={c2} />
      <Px x={5} y={7} w={6} h={3} fill={c2} />
      <Px x={6} y={10} w={4} h={2} fill={c3} />
      <Px x={7} y={12} w={2} h={2} fill={c3} />
      <Px x={5} y={3} w={2} h={2} fill="#c8f5fc" />
    </>
  );
}

/** Pixel Shield — kartu PERISAI. */
function IconShield() {
  const blue = "#5b8def";
  const blueDark = "#2f5fc4";
  const rim = "#dfe8ff";
  return (
    <>
      <Px x={4} y={2} w={8} h={1} fill={rim} />
      <Px x={3} y={3} w={10} h={2} fill={blue} />
      <Px x={3} y={5} w={10} h={4} fill={blue} />
      <Px x={4} y={9} w={8} h={2} fill={blueDark} />
      <Px x={5} y={11} w={6} h={2} fill={blueDark} />
      <Px x={7} y={13} w={2} h={1} fill={blueDark} />
      <Px x={7} y={5} w={2} h={5} fill={rim} />
      <Px x={5} y={7} w={6} h={1} fill={rim} />
    </>
  );
}

/** Pixel Swap Arrows — kartu PINDAH POSISI. */
function IconSwap() {
  const a = "#f08a5d";
  const b = "#f6c453";
  return (
    <>
      <Px x={2} y={4} w={8} h={2} fill={a} />
      <Px x={8} y={2} w={2} h={2} fill={a} />
      <Px x={8} y={6} w={2} h={2} fill={a} />
      <Px x={6} y={10} w={8} h={2} fill={b} />
      <Px x={6} y={8} w={2} h={2} fill={b} />
      <Px x={6} y={12} w={2} h={2} fill={b} />
    </>
  );
}

/** Pixel Eraser — kartu PENGHAPUS PILIHAN. */
function IconFifty() {
  const body = "#ec6ea5";
  const bodyDark = "#c14a80";
  const metal = "#c9cede";
  return (
    <>
      <Px x={3} y={9} w={8} h={4} fill={body} />
      <Px x={3} y={12} w={8} h={1} fill={bodyDark} />
      <Px x={5} y={3} w={6} h={7} fill={body} />
      <Px x={5} y={3} w={6} h={2} fill={bodyDark} />
      <Px x={3} y={9} w={2} h={4} fill={bodyDark} />
      <Px x={2} y={9} w={9} h={1} fill={metal} />
    </>
  );
}

/** Pixel Scroll — kartu PETUNJUK. */
function IconHint() {
  const paper = "#f1e3bd";
  const paperDark = "#c9b57f";
  const wood = "#8a5a2b";
  return (
    <>
      <Px x={3} y={2} w={10} h={2} fill={wood} />
      <Px x={3} y={4} w={10} h={7} fill={paper} />
      <Px x={4} y={6} w={8} h={1} fill={paperDark} />
      <Px x={4} y={8} w={8} h={1} fill={paperDark} />
      <Px x={3} y={11} w={10} h={2} fill={wood} />
    </>
  );
}

const ICONS: Record<CardId, () => JSX.Element> = {
  steal: IconSteal,
  double: IconDouble,
  shield: IconShield,
  swap: IconSwap,
  fifty: IconFifty,
  hint: IconHint,
};

export function CardIcon({ id, size = 22 }: { id: CardId; size?: number }) {
  const Inner = ICONS[id];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
      aria-hidden="true"
    >
      <Inner />
    </svg>
  );
}
