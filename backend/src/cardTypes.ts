// Definisi kartu strategi ("Kartu Kekuatan"). Sumber kebenaran timing/efek
// kartu ada di sini (backend) — frontend hanya menampilkan berdasarkan data
// yang dikirim server, supaya tidak ada celah curang di sisi klien.

export type CardId = "double" | "shield" | "steal" | "swap" | "fifty" | "hint";

export interface CardTypeDef {
  id: CardId;
  name: string;
  /** 'before' = harus diaktifkan sebelum soal berikutnya tampil (saat fase lobby/revealed).
   *  'during' = hanya bisa dipakai saat soal sedang tampil/berjalan. */
  timing: "before" | "during";
  needsTarget: boolean;
  /** true = langsung selesai saat dipakai (tidak masuk status 'pending' menunggu panitia). */
  instant: boolean;
  short: string;
  info: string;
}

export const CARD_TYPES: CardTypeDef[] = [
  {
    id: "double",
    name: "POIN GANDA",
    timing: "before",
    needsTarget: false,
    instant: false,
    short: "Poin soal berikutnya dikali 2 (benar & salah).",
    info: "Aktifkan SEBELUM soal berikutnya dimulai. Jika timmu menjawab BENAR, poin yang didapat menjadi 2x. Jika SALAH, pengurangan poin juga 2x. Hanya berlaku untuk 1 soal berikutnya — jika timmu tidak mendapat giliran atau tidak menjawab, kartu tetap hangus.",
  },
  {
    id: "shield",
    name: "PERISAI",
    timing: "during",
    needsTarget: false,
    instant: false,
    short: "Jawaban salah tidak mengurangi poin.",
    info: "Bisa diaktifkan saat soal sedang berlangsung. Jika jawaban SALAH, tidak ada pengurangan poin. Jika BENAR, poin tetap normal. Hanya berlaku untuk soal yang sedang berjalan.",
  },
  {
    id: "steal",
    name: "AMBIL POIN",
    timing: "before",
    needsTarget: true,
    instant: false,
    short: "Tim target menjawab, untung/rugi jadi milikmu.",
    info: "Aktifkan SEBELUM soal berikutnya & pilih 1 tim target. Soal dijawab tim target, bukan kamu. Jika target BENAR, poin masuk ke timmu (target tidak dapat poin). Jika target SALAH, timmu yang kena pengurangan (target tidak rugi). Berlaku 1 soal, lalu otomatis nonaktif.",
  },
  {
    id: "swap",
    name: "PINDAH POSISI",
    timing: "during",
    needsTarget: true,
    instant: false,
    short: "Alihkan giliran jawabmu ke tim lain.",
    info: "Dipakai saat soal berlangsung, SETELAH timmu mendapat giliran menjawab. Pilih 1 tim pengganti — hak jawab & seluruh hasil (poin maupun pengurangan) pindah penuh ke tim itu. Timer diulang dari awal. Jika timmu belum dapat giliran jawab, kartu tetap hangus.",
  },
  {
    id: "fifty",
    name: "PENGHAPUS PILIHAN",
    timing: "during",
    needsTarget: false,
    instant: true,
    short: "Hapus 2 opsi salah pada soal pilihan ganda.",
    info: "Hanya berfungsi saat soal PILIHAN GANDA sedang berlangsung, menyisakan 1 opsi benar & 1 opsi salah. Jika dipakai pada jenis soal lain, kartu tetap hangus (stok tetap berkurang).",
  },
  {
    id: "hint",
    name: "PETUNJUK",
    timing: "during",
    needsTarget: false,
    instant: true,
    short: "Buka petunjuk soal ini, hanya timmu yang lihat.",
    info: "Bisa dipakai saat soal sedang tampil ATAU sedang dijawab. Langsung menampilkan petunjuk (clue) soal ini di layar timmu saja — tim lain tidak tahu. Kalau soal ini tidak diisi petunjuk oleh panitia, kartu tetap hangus (stok tetap berkurang) begitu dipakai.",
  },
];

export function cardType(id: CardId): CardTypeDef {
  const t = CARD_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Jenis kartu tidak dikenal: ${id}`);
  return t;
}

export function isCardId(v: unknown): v is CardId {
  return typeof v === "string" && CARD_TYPES.some((c) => c.id === v);
}
