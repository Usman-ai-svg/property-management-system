import type { Section } from "@/lib/domain/enums";
import type { Pengguna, PenggunaMentah } from "@/lib/adaptor/identitas";

/**
 * RBAC GANDA — jembatan ke model hak akses ERP, dengan saklar.
 *
 * ERP Nanoland menjawab pertanyaan "siapa boleh masuk modul": satu peran per
 * pengguna (`profiles.role`) ditambah daftar modul yang dicentang. Sistem ini
 * menjawab pertanyaan yang lebih halus, "apa yang boleh dilihat di dalamnya":
 * sepuluh sub-bagian, masing-masing dengan tingkat lihat atau ubah.
 *
 * Keputusannya: saat diserap ERP, **RBAC ERP yang berlaku** supaya operasional
 * yang sedang berjalan tidak terganggu, sementara model kita dipasang di
 * belakang dan bisa dinyalakan kapan saja.
 *
 * Modul ini berisi jembatannya. Yang perlu dipahami sebelum menyentuhnya:
 *
 *   1. "Punya akses modul proyek" TIDAK sama dengan "boleh lihat semuanya".
 *      Tanpa peta di bawah, peran `staff` akan melihat angka RAB/RAP dan
 *      business plan — padahal di sistem ini keduanya tertutup untuk
 *      Supervisor.
 *   2. ERP tidak punya pembatasan per proyek. Selama mode ERP aktif, setiap
 *      pengguna melihat SELURUH proyek. Itu pelonggaran nyata, dicatat di
 *      sini supaya tidak ditemukan sebagai kejutan.
 */

export type ModeRbac = "erp" | "internal";

/**
 * Mode yang sedang berlaku.
 *
 * Dibaca dari variabel lingkungan supaya bisa dibalik tanpa menyentuh kode.
 * Nilai bawaan "internal" — selama aplikasi masih berdiri sendiri, model
 * sendirilah yang benar.
 */
export function modeRbac(env: Record<string, string | undefined> = process.env): ModeRbac {
  return env.RBAC_MODE === "erp" ? "erp" : "internal";
}

/** Tingkat izin sebuah sub-bagian. */
export type Tingkat = "tidak" | "lihat" | "ubah";

/**
 * Peta peran ERP → izin sub-bagian.
 *
 * Sub-bagian yang tidak disebut berarti "tidak" — tidak boleh dilihat sama
 * sekali. Daftar putih, bukan daftar hitam: menambah sub-bagian baru tidak
 * otomatis membukanya untuk semua orang.
 *
 * Kesetaraan peran dikonfirmasi pemilik sistem:
 *   director   = BOD
 *   accountant = Finance / Consultant Finance
 *   manager    = Project Manager / Head Operation Project
 *   admin      = Admin (Staff Administration) — BUKAN Administrator Sistem
 *   staff      = Supervisor dan setingkat
 *
 * `sales`, `viewer`, dan `hrd` sengaja tidak ada di peta: ketiganya memang
 * tidak berhak membuka modul proyek di ERP.
 */
export const PETA_PERAN_ERP: Record<string, Partial<Record<Section, Tingkat>>> = {
  director: {
    deskripsi: "ubah", daftarUnit: "ubah", daftarSarpras: "ubah", dokumenTeknis: "ubah",
    hargaRabRap: "ubah", setujuiRab: "ubah", businessPlan: "ubah", keuangan: "ubah",
    pettyCash: "ubah", progress: "ubah", aset: "ubah", penyesuaianAset: "ubah",
  },
  accountant: {
    deskripsi: "lihat", daftarUnit: "lihat", daftarSarpras: "lihat", dokumenTeknis: "lihat",
    hargaRabRap: "lihat", keuangan: "ubah", pettyCash: "ubah", progress: "lihat", aset: "lihat",
  },
  manager: {
    deskripsi: "lihat", daftarUnit: "ubah", daftarSarpras: "ubah", dokumenTeknis: "ubah",
    hargaRabRap: "lihat", setujuiRab: "ubah", keuangan: "lihat", pettyCash: "ubah", progress: "ubah",
    aset: "ubah", penyesuaianAset: "ubah",
  },
  admin: {
    deskripsi: "lihat", daftarUnit: "lihat", daftarSarpras: "lihat", dokumenTeknis: "lihat",
    hargaRabRap: "lihat", keuangan: "ubah", pettyCash: "lihat", aset: "lihat",
  },
  staff: {
    deskripsi: "lihat", daftarUnit: "lihat", daftarSarpras: "lihat", dokumenTeknis: "lihat",
    pettyCash: "ubah", progress: "ubah", aset: "lihat", penyesuaianAset: "ubah",
  },
};

/**
 * Sub-bagian yang TIDAK BOLEH terbuka untuk peran ERP tingkat pelaksana.
 *
 * Dinyatakan terpisah dari peta supaya bisa diuji sebagai aturan tersendiri:
 * kalau suatu saat `staff` diberi `hargaRabRap` karena dianggap praktis, tes
 * yang gagal akan menjelaskan kenapa itu bukan ide bagus.
 */
export const TERTUTUP_UNTUK_PELAKSANA: { peran: string; section: Section[] }[] = [
  { peran: "staff", section: ["hargaRabRap", "businessPlan", "keuangan"] },
  { peran: "admin", section: ["businessPlan", "progress"] },
  { peran: "manager", section: ["businessPlan"] },
  { peran: "accountant", section: ["businessPlan", "penyesuaianAset"] },
];

/** Ubah peta tingkat menjadi peta izin yang dipakai `bolehLihat`/`bolehUbah`. */
export function izinDariPeranErp(peranErp: string): Map<Section, boolean> {
  const peta = PETA_PERAN_ERP[peranErp] ?? {};
  const izin = new Map<Section, boolean>();
  for (const [section, tingkat] of Object.entries(peta)) {
    if (tingkat === "tidak") continue;
    izin.set(section as Section, tingkat === "ubah");
  }
  return izin;
}

/**
 * Susun `Pengguna` dari identitas ERP.
 *
 * `semuaProyek` selalu true: ERP tidak menyimpan pembatasan per proyek, dan
 * memalsukannya menjadi daftar kosong akan membuat setiap halaman tampak
 * kosong tanpa penjelasan. Melonggarkan lebih jujur daripada memutus, selama
 * pelonggarannya tertulis.
 */
export function penggunaDariErp(mentah: PenggunaMentah & { peranErp: string }): Pengguna {
  return {
    id: mentah.id,
    nama: mentah.nama,
    peranAktif: mentah.peranErp,
    peran: [mentah.peranErp],
    semuaProyek: true,
    proyekIds: [],
    izin: izinDariPeranErp(mentah.peranErp),
  };
}

/** Apakah sebuah peran ERP berhak membuka modul proyek sama sekali. */
export const bolehBukaModulProyek = (peranErp: string): boolean =>
  peranErp in PETA_PERAN_ERP;
