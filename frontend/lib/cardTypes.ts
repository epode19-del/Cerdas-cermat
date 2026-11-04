// Metadata TAMPILAN kartu strategi untuk frontend (label, ikon pixel-art, teks
// bantuan). Aturan/efek sesungguhnya (siapa boleh pakai kapan, apa efeknya ke
// skor) ada di backend/src/cardTypes.ts + matches.ts — di sini cuma dipakai
// untuk UI, supaya tidak ada celah curang kalau logikanya cuma ditiru di klien.
//
// Ikon kartu memakai pixel-art SVG (lihat components/CardIcon.tsx), BUKAN emoji.

export type CardId = "double" | "shield" | "steal" | "swap" | "fifty" | "hint";

export interface CardTypeDef {
  id: CardId;
  name: string;
  timing: "before" | "during";
  needsTarget: boolean;
  instant: boolean;
  short: string;
  info: string;
}

export const CARD_TYPES: CardTypeDef[] = [
  {
    id: "steal",
    name: "AMBIL POIN",
    timing: "before",
    needsTarget: true,
    instant: false,
    short: "Tim target menjawab, untung/rugi jadi milikmu.",
    info: "Pilih satu tim target. Jika tim target menjawab BENAR, poin berpindah ke timmu. Jika tim target SALAH, timmu yang kena pengurangan poin (target sendiri tidak terpengaruh). Bisa diaktifkan kapan saja — berlaku untuk soal berikutnya.",
  },
  {
    id: "double",
    name: "POIN GANDA",
    timing: "before",
    needsTarget: false,
    instant: false,
    short: "Poin soal berikutnya dikali 2 (benar & salah).",
    info: "Jawaban BENAR mendapat poin 2x lipat. Jawaban SALAH mendapat pengurangan poin 2x lipat juga. Bisa diaktifkan kapan saja — berlaku untuk soal berikutnya.",
  },
  {
    id: "shield",
    name: "PERISAI",
    timing: "during",
    needsTarget: false,
    instant: false,
    short: "Jawaban salah tidak mengurangi poin.",
    info: "Melindungi timmu dari satu kali pengurangan poin. Bisa dipakai saat soal sedang berlangsung.",
  },
  {
    id: "swap",
    name: "PINDAH POSISI",
    timing: "during",
    needsTarget: true,
    instant: false,
    short: "Alihkan giliran jawabmu ke tim lain.",
    info: "Dipakai SETELAH timmu mendapat giliran menjawab. Pilih 1 tim pengganti — hak jawab & seluruh hasil (poin maupun pengurangan) pindah penuh ke tim itu. Timer diulang dari awal.",
  },
  {
    id: "fifty",
    name: "PENGHAPUS PILIHAN",
    timing: "during",
    needsTarget: false,
    instant: true,
    short: "Hapus 2 opsi salah pada soal pilihan ganda.",
    info: "Hanya untuk soal PILIHAN GANDA. Menghapus dua pilihan yang salah sehingga tersisa dua pilihan (1 benar, 1 salah). Selain itu, kartu tetap hangus.",
  },
  {
    id: "hint",
    name: "PETUNJUK",
    timing: "during",
    needsTarget: false,
    instant: true,
    short: "Buka petunjuk soal ini, hanya timmu yang lihat.",
    info: "Memberikan petunjuk tambahan untuk soal ini. Hanya dapat dilihat oleh timmu dan panitia. Kalau soal ini tidak diisi petunjuk, kartu tetap hangus.",
  },
];

export function cardType(id: CardId): CardTypeDef {
  const t = CARD_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Jenis kartu tidak dikenal: ${id}`);
  return t;
}
