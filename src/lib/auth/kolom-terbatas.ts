import type { Section } from "@/lib/domain/enums";

/**
 * DAFTAR KOLOM TERBATAS — satu tempat yang menyatakan kolom mana milik
 * sub-bagian mana.
 *
 * Sebelum ini, aturan "hargaJual hanya untuk pemegang hargaRabRap" tersebar
 * sebagai blok `...(bolehHarga ? { … } : {})` di sebelas tempat. Tersebar
 * berarti gampang tergeser satu per satu tanpa ada yang menyadarinya, karena
 * kolom yang bocor tidak mengubah apa pun di layar.
 *
 * Di sini aturannya dinyatakan sekali, sebagai data. Dua akibat yang
 * dimaksud:
 *
 *   1. Bisa diuji. Ada tes yang memastikan tiap kolom uang terdaftar.
 *   2. Bisa diterjemahkan. Saat modul ini diserap ERP, daftar yang sama bisa
 *      dibaca untuk membangun fungsi RPC Postgres atau policy RLS — aturannya
 *      dipindahkan, bukan ditulis ulang dari ingatan.
 *
 * Perlu diingat: yang dicegah di sini adalah kolomnya ikut di-SELECT. Bukan
 * diambil lalu disembunyikan di komponen. Untuk angka RAB/RAP dan business
 * plan, menyembunyikan di sisi klien bukan pengamanan sama sekali.
 */

/** Model yang punya kolom terbatas, dengan sub-bagian penjaganya. */
export const KOLOM_TERBATAS: Record<string, Partial<Record<Section, readonly string[]>>> = {
  unit: {
    hargaRabRap: ["hargaJual", "rapUpah", "boqItems", "rapItems"],
  },
  infrastructure: {
    hargaRabRap: ["rab", "rapUpah", "boqItems", "rapItems"],
  },
  project: {
    hargaRabRap: [
      "hargaPerM2", "biayaPembelian", "biayaNotaris", "biayaBalikNama", "biayaLegalLain",
    ],
  },
  equipment: {
    hargaRabRap: ["nilai"],
  },
  customWork: {
    hargaRabRap: ["rapUpah", "boqItems", "rapItems"],
  },
} as const;

/** Sub-bagian penjaga sebuah kolom, atau null bila kolom itu bebas dilihat. */
export function penjagaKolom(model: string, kolom: string): Section | null {
  const aturan = KOLOM_TERBATAS[model];
  if (!aturan) return null;
  for (const [section, kolomnya] of Object.entries(aturan)) {
    if (kolomnya?.includes(kolom)) return section as Section;
  }
  return null;
}

/** Seluruh kolom terbatas sebuah model, tanpa memandang sub-bagiannya. */
export function kolomTerbatas(model: string): string[] {
  const aturan = KOLOM_TERBATAS[model];
  if (!aturan) return [];
  return Object.values(aturan).flatMap((k) => [...(k ?? [])]);
}

/**
 * Saring sebuah fragmen `select` menurut izin yang dipegang.
 *
 * Kolom yang penjaganya tidak dipegang **dibuang dari select**, bukan diambil
 * lalu dikosongkan. Kolom yang tidak terdaftar sebagai terbatas dibiarkan
 * lewat — daftar di atas adalah daftar larangan, bukan daftar izin, supaya
 * menambah kolom biasa tidak perlu menyentuh berkas ini.
 */
export function saringSelect<T extends Record<string, unknown>>(
  model: string,
  fragmen: T,
  boleh: (s: Section) => boolean,
): Partial<T> {
  const hasil: Record<string, unknown> = {};
  for (const [kolom, nilai] of Object.entries(fragmen)) {
    const penjaga = penjagaKolom(model, kolom);
    if (penjaga && !boleh(penjaga)) continue;
    hasil[kolom] = nilai;
  }
  return hasil as Partial<T>;
}

/**
 * Berkas pengambilan data yang meng-SELECT kolom uang tanpa syarat, beserta
 * sub-bagian yang menjaga SELURUH jalur menuju ke sana.
 *
 * Contoh: `keuanganPerProyek()` mengambil `hargaJual` dan `rapUpah` apa
 * adanya, tapi satu-satunya halaman yang memanggilnya sudah menolak peran
 * tanpa izin "keuangan" sebelum query dijalankan. Penjagaan di tingkat
 * halaman, bukan di tingkat kolom.
 *
 * Itu aman HANYA selama setiap pemegang sub-bagian penjaga juga berhak atas
 * "hargaRabRap". Hari ini benar — tapi itu bentuk matriks hak akses saat ini,
 * bukan sifat kodenya. Satu penyuntingan matriks bisa mematahkannya tanpa
 * gejala apa pun.
 *
 * Karena itu implikasinya diuji, bukan sekadar dicatat: lihat
 * `kolom-terbatas.test.ts`.
 */
export const DIJAGA_DI_HALAMAN: Record<string, Section> = {
  "keuangan.ts": "keuangan",
  "ringkasan.ts": "keuangan",
  "plan-real.ts": "businessPlan",
  "proyek.ts": "hargaRabRap",
  // Seluruh modul Estimasi RAB (harga satuan AHSP, harga dasar, penawaran
  // pemasok) berada di bawah "hargaRabRap" dan dijaga di tiap halamannya.
  "estimasi.ts": "hargaRabRap",
};

/**
 * Sub-bagian yang pemegangnya WAJIB juga berhak atas "hargaRabRap".
 *
 * Turunan langsung dari `DIJAGA_DI_HALAMAN`: kalau sebuah jalur hanya dijaga
 * oleh "keuangan" tapi mengambil kolom RAP, maka pemegang "keuangan" tanpa
 * "hargaRabRap" akan menerima angka yang tidak berhak ia lihat.
 */
export const WAJIB_IKUT_HARGA: Section[] = ["keuangan", "businessPlan"];
