/**
 * KONTRAK PENULISAN DATA — fondasi.
 *
 * Tiap aksi yang menulis data punya dua hal di lapisan ini: sebuah TIPE MASUKAN
 * berupa objek biasa, dan sebuah fungsi `periksa*` yang murni. Keduanya tidak
 * tahu apa-apa soal `FormData`, Prisma, maupun sesi.
 *
 * Kenapa dipisah begini. Server Action menerima `FormData` — transport khas
 * Next.js. RPC Postgres menerima JSONB. Selama masukan tiap aksi belum berupa
 * objek yang terdokumentasi, menerjemahkannya ke RPC berarti membaca ribuan
 * baris `actions.ts` sambil menebak nama field-nya. Dengan lapisan ini, aksi
 * tinggal jadi tiga langkah yang seragam:
 *
 *   1. baca `FormData` menjadi objek masukan
 *   2. panggil `periksa*` — kalau ada pesan, tolak
 *   3. tulis
 *
 * Langkah 1 dan 3 memang berganti di ERP. Langkah 2 tidak: ia disalin apa
 * adanya, dan tes-tesnya jadi acuan menguji RPC-nya.
 *
 * BATAS YANG PENTING. Yang diperiksa di sini hanyalah yang bisa diputuskan
 * TANPA database: bentuk masukan, aturan antar-field, dan nilai yang harus
 * masuk akal. Syarat yang butuh membaca data lain — "PO sudah lunas", "unit ini
 * milik proyek itu", "kontrak tidak ditemukan" — tetap ditegakkan di sisi
 * server, dan didaftar sebagai invarian di `KONTRAK-RPC.md`. Memaksakannya ke
 * sini akan melahirkan fungsi murni yang berbohong.
 */

/** Pesan kesalahan yang memang untuk dibaca pengguna, atau null bila lolos. */
export type Galat = string | null;

/**
 * Kembalikan galat pertama yang ditemukan.
 *
 * Sengaja berhenti di yang pertama, bukan mengumpulkan semuanya: form di repo
 * ini menampilkan satu pesan, dan memperlihatkan lima kesalahan sekaligus
 * membuat orang memperbaiki yang paling belakang lebih dulu.
 */
export function pertamaGagal(...periksa: Galat[]): Galat {
  for (const g of periksa) if (g) return g;
  return null;
}

/** Teks wajib isi. Spasi saja dianggap kosong. */
export function wajibTeks(nilai: string | null | undefined, label: string): Galat {
  return (nilai ?? "").trim() === "" ? `${label} wajib diisi.` : null;
}

/** Teks wajib isi dengan batas panjang — penjaga kolom yang punya lebar tetap. */
export function wajibTeksMaks(
  nilai: string | null | undefined,
  label: string,
  maks: number,
): Galat {
  const kosong = wajibTeks(nilai, label);
  if (kosong) return kosong;
  return (nilai ?? "").trim().length > maks
    ? `${label} terlalu panjang (maksimal ${maks} karakter).`
    : null;
}

/** Angka yang harus benar-benar angka, dan minimal `min`. */
export function angkaMinimal(nilai: number, min: number, label: string): Galat {
  if (!Number.isFinite(nilai)) return `${label} harus berupa angka.`;
  return nilai < min ? `${label} minimal ${min}.` : null;
}

/** Angka dalam rentang tertutup, mis. progres 0–100. */
export function angkaRentang(
  nilai: number,
  min: number,
  maks: number,
  label: string,
): Galat {
  if (!Number.isFinite(nilai)) return `${label} harus berupa angka.`;
  return nilai < min || nilai > maks ? `${label} harus di antara ${min} dan ${maks}.` : null;
}

/**
 * Nilai harus salah satu dari daftar yang sah.
 *
 * Daftarnya selalu datang dari `domain/enums.ts`, tidak pernah diketik ulang di
 * pemanggil — itu yang membuat nilai enum baru otomatis ikut diterima, dan
 * nilai yang dihapus otomatis ditolak.
 */
export function pilihanSah<T extends string>(
  nilai: string,
  sah: readonly T[],
  label: string,
): Galat {
  return (sah as readonly string[]).includes(nilai)
    ? null
    : `Nilai "${nilai}" tidak sah untuk ${label}.`;
}

/** Tanggal dalam bentuk teks ISO yang bisa diurai. Kosong dianggap tidak sah. */
export function tanggalSah(nilai: string | null | undefined, label: string): Galat {
  const kosong = wajibTeks(nilai, label);
  if (kosong) return kosong;
  return Number.isNaN(new Date(nilai as string).getTime()) ? `${label} tidak sah.` : null;
}

/** Identitas baris yang wajib ada. Dipakai hampir seluruh aksi ubah dan hapus. */
export const wajibId = (id: string | null | undefined, label = "Id"): Galat =>
  wajibTeks(id, label);

/**
 * Masukan yang bentuknya cuma sebuah id.
 *
 * Sekitar sepertiga aksi di repo ini berbentuk begini — seluruh `hapus*` dan
 * beberapa penanda status. Menyatukannya di satu tipe adalah penanda paling
 * awal untuk B4: aksi-aksi ini bisa dilebur jadi sedikit RPC saja.
 */
export interface MasukanId {
  id: string;
}

/** Pemeriksaan untuk {@link MasukanId}. */
export const periksaId = (m: MasukanId, label = "Id"): Galat => wajibId(m.id, label);
