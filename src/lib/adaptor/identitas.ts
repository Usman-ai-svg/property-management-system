import type { Section } from "@/lib/domain/enums";

/**
 * ADAPTOR IDENTITAS — satu-satunya titik sambung ke sistem login.
 *
 * Seluruh aplikasi membaca pengguna aktif lewat `ambilPengguna()` di
 * `src/lib/auth/rbac.ts`. Berkas ini menyatakan KONTRAKnya: bentuk objek yang
 * harus dikembalikan, apa pun sumber loginnya.
 *
 * Sekarang sumbernya JWT `jose` di cookie httpOnly. Di ERP sumbernya Supabase
 * Auth (`sb.auth.getUser()`) ditambah jabatan di `hris.employees`. Selama
 * fungsi penggantinya mengembalikan bentuk yang sama, tidak ada satu pun
 * halaman, query, atau server action yang perlu disentuh.
 *
 * Yang TIDAK boleh berubah bentuknya, karena seluruh penegakan hak akses
 * bertumpu padanya:
 *
 *   - `jabatan` — daftar kunci jabatan yang dipegang. Izinnya GABUNGAN, dengan
 *     tingkat tertinggi yang menang.
 *   - `izin` — peta sub-bagian → boleh ubah. Sub-bagian yang tidak ada di
 *     peta berarti tidak boleh dilihat sama sekali.
 *   - `semuaProyek` / `proyekIds` — pembatasan per proyek. ERP tidak punya
 *     padanannya; lihat catatan di `docs/jahitan-identitas.md`.
 *
 * ------------------------------------------------------------------------
 * KENAPA TIDAK ADA LAGI "PERAN AKTIF"
 * ------------------------------------------------------------------------
 * Dulu izin mengikuti satu peran yang sedang dipilih, dan orang berperan
 * rangkap berpindah lewat pemilih "Lihat sebagai". Bentuk itu dibuang: sumbu
 * izinnya sekarang jabatan, dan seseorang memegang jabatannya sekaligus —
 * tidak ada keadaan "sedang tidak menjabat".
 *
 * Akibat yang perlu disadari: kewenangan berbahaya tidak lagi tersembunyi di
 * balik perpindahan yang harus diingat orang. Gantinya aturan yang ditulis
 * eksplisit — pemegang dana tidak memverifikasi pengajuannya sendiri, dan
 * seterusnya. Lihat aturan lintas transisi di `src/lib/calc/petty-cash.ts`.
 * Gerbang yang bersandar pada ritual UI adalah gerbang yang hilang begitu
 * halamannya ditulis ulang di ERP.
 */

export interface Pengguna {
  id: string;
  nama: string;
  /**
   * Kunci jabatan yang dipegang, boleh lebih dari satu.
   *
   * Izinnya gabungan: sebuah sub-bagian boleh diubah bila SALAH SATU jabatan
   * membolehkannya. Tingkat tertinggi yang menang.
   */
  jabatan: string[];
  semuaProyek: boolean;
  /** ID proyek yang boleh diakses. Kosong bila `semuaProyek` bernilai true. */
  proyekIds: string[];
  /** section → boleh ubah. Section yang tidak ada di peta berarti tidak boleh dilihat. */
  izin: Map<Section, boolean>;
}

/**
 * Sumber identitas yang bisa dipasang.
 *
 * Implementasi sekarang: `ambilPengguna()` di `src/lib/auth/rbac.ts`.
 * Implementasi ERP nanti membaca sesi Supabase, mengambil jabatan karyawannya
 * dari HRIS, lalu memetakannya lewat `jabatanDariHris()`.
 */
export interface SumberIdentitas {
  /** Pengguna aktif, atau null bila belum masuk. */
  ambil(): Promise<Pengguna | null>;
}

/**
 * Bentuk pengguna mentah dari sumber mana pun, sebelum diubah jadi `Pengguna`.
 *
 * Dipakai adaptor ERP: Supabase mengembalikan identitas dan teks jabatan, bukan
 * peta izin per sub-bagian.
 */
export interface PenggunaMentah {
  id: string;
  nama: string;
  jabatan: string[];
  semuaProyek?: boolean;
  proyekIds?: string[];
}

/**
 * Periksa bahwa sebuah objek benar-benar memenuhi kontrak `Pengguna`.
 *
 * Dipakai sebagai jaring pengaman saat sumber identitas diganti: adaptor baru
 * yang lupa mengisi `izin` atau mengirim jabatan kosong akan ketahuan di sini,
 * bukan nanti sebagai halaman kosong tanpa penjelasan.
 */
export function periksaPengguna(u: unknown): string | null {
  if (!u || typeof u !== "object") return "Pengguna bukan objek.";
  const p = u as Partial<Pengguna>;

  if (!p.id) return "id kosong.";
  if (!p.nama) return "nama kosong.";
  if (!Array.isArray(p.jabatan)) return "jabatan harus array kunci jabatan.";
  if (p.jabatan.some((j) => typeof j !== "string" || !j)) {
    return "jabatan memuat nilai kosong atau bukan teks.";
  }
  if (typeof p.semuaProyek !== "boolean") return "semuaProyek harus boolean.";
  if (!Array.isArray(p.proyekIds)) return "proyekIds harus array.";
  if (p.semuaProyek && p.proyekIds.length > 0) {
    return "semuaProyek bernilai true tapi proyekIds terisi — salah satunya keliru.";
  }
  if (!(p.izin instanceof Map)) return "izin harus Map<Section, boolean>.";

  return null;
}

/**
 * Apakah pengguna memegang sebuah jabatan.
 *
 * Dipakai gerbang yang menyebut jabatan tertentu — pemegang petty cash,
 * penghapusan paksa. Selalu lewat sini, jangan membandingkan teks sendiri:
 * itu yang dulu menyebar ke 32 tempat di 9 berkas.
 */
export const punyaJabatan = (u: Pengguna | null, kunci: string): boolean =>
  !!u && u.jabatan.includes(kunci);

/** Apakah pengguna memegang salah satu dari sederet jabatan. */
export const punyaSalahSatuJabatan = (u: Pengguna | null, kunci: readonly string[]): boolean =>
  !!u && u.jabatan.some((j) => kunci.includes(j));

/**
 * Gabungkan izin beberapa jabatan. Tingkat tertinggi menang.
 *
 * Dipisahkan dari pengambilan data supaya bisa diuji tanpa database, dan
 * supaya sisi ERP memakai aturan penggabungan yang persis sama.
 */
export function gabungIzin(
  baris: readonly { section: string; bolehUbah: boolean }[],
): Map<Section, boolean> {
  const izin = new Map<Section, boolean>();
  for (const b of baris) {
    const s = b.section as Section;
    // `||` bukan penimpaan: satu jabatan yang membolehkan ubah cukup, dan
    // jabatan lain yang hanya boleh lihat tidak menurunkannya kembali.
    izin.set(s, (izin.get(s) ?? false) || b.bolehUbah);
  }
  return izin;
}
