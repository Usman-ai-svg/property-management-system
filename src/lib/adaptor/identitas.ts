import type { Section } from "@/lib/domain/enums";

/**
 * ADAPTOR IDENTITAS — satu-satunya titik sambung ke sistem login.
 *
 * Seluruh aplikasi membaca pengguna aktif lewat `ambilPengguna()` di
 * `src/lib/auth/rbac.ts`. Berkas ini menyatakan KONTRAKnya: bentuk objek yang
 * harus dikembalikan, apa pun sumber loginnya.
 *
 * Sekarang sumbernya JWT `jose` di cookie httpOnly. Di ERP sumbernya Supabase
 * Auth (`sb.auth.getUser()`) ditambah tabel `profiles`. Selama fungsi
 * penggantinya mengembalikan bentuk yang sama, tidak ada satu pun halaman,
 * query, atau server action yang perlu disentuh.
 *
 * Yang TIDAK boleh berubah bentuknya, karena seluruh penegakan hak akses
 * bertumpu padanya:
 *
 *   - `peranAktif` — SATU peran, bukan daftar. Izin mengikuti peran yang
 *     sedang dipilih saja, bukan gabungan seluruh peran yang dimiliki.
 *   - `izin` — peta sub-bagian → boleh ubah. Sub-bagian yang tidak ada di
 *     peta berarti tidak boleh dilihat sama sekali.
 *   - `semuaProyek` / `proyekIds` — pembatasan per proyek. ERP belum punya
 *     padanannya; lihat catatan di bawah.
 */

export interface Pengguna {
  id: string;
  nama: string;
  /**
   * Peran yang SEDANG dipilih. Bukan daftar.
   *
   * Inilah yang membuat pemilih "Lihat sebagai" bermakna: seseorang yang
   * merangkap Komisaris dan Project Manager benar-benar kehilangan akses
   * Keuangan saat sedang berperan Komisaris.
   */
  peranAktif: string;
  /** Seluruh peran yang dimiliki, untuk mengisi pemilih peran. */
  peran: string[];
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
 * Implementasi ERP nanti membaca sesi Supabase lalu memetakan `profiles.role`
 * ke `izin` — lihat `src/lib/auth/peran-erp.ts`.
 */
export interface SumberIdentitas {
  /** Pengguna aktif, atau null bila belum masuk. */
  ambil(): Promise<Pengguna | null>;
}

/**
 * Bentuk pengguna mentah dari sumber mana pun, sebelum diubah jadi `Pengguna`.
 *
 * Dipakai adaptor ERP: Supabase mengembalikan satu peran (`profiles.role`)
 * dan daftar modul (`my_modules`), bukan peta izin per sub-bagian.
 */
export interface PenggunaMentah {
  id: string;
  nama: string;
  peran: string[];
  peranAktif?: string;
  semuaProyek?: boolean;
  proyekIds?: string[];
}

/**
 * Periksa bahwa sebuah objek benar-benar memenuhi kontrak `Pengguna`.
 *
 * Dipakai sebagai jaring pengaman saat sumber identitas diganti: adaptor baru
 * yang lupa mengisi `izin` atau mengisi `peranAktif` dengan daftar akan
 * ketahuan di sini, bukan nanti sebagai halaman kosong tanpa penjelasan.
 */
export function periksaPengguna(u: unknown): string | null {
  if (!u || typeof u !== "object") return "Pengguna bukan objek.";
  const p = u as Partial<Pengguna>;

  if (!p.id) return "id kosong.";
  if (!p.nama) return "nama kosong.";
  if (typeof p.peranAktif !== "string" || !p.peranAktif) {
    return "peranAktif harus satu nama peran, bukan daftar atau kosong.";
  }
  if (!Array.isArray(p.peran) || p.peran.length === 0) return "peran kosong.";
  if (!p.peran.includes(p.peranAktif)) {
    return `peranAktif "${p.peranAktif}" tidak ada di dalam daftar peran.`;
  }
  if (typeof p.semuaProyek !== "boolean") return "semuaProyek harus boolean.";
  if (!Array.isArray(p.proyekIds)) return "proyekIds harus array.";
  if (p.semuaProyek && p.proyekIds.length > 0) {
    return "semuaProyek bernilai true tapi proyekIds terisi — salah satunya keliru.";
  }
  if (!(p.izin instanceof Map)) return "izin harus Map<Section, boolean>.";

  return null;
}
