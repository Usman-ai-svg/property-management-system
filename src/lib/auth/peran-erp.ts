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

// ===========================================================================
// PEMETAAN POSISI ERP → PERAN MODUL PROYEK
// ===========================================================================
//
// Ditetapkan bersama Usman pada 2026-09-09, dari daftar pengguna ERP yang
// sebenarnya (kolom POSISI dan DIVISI). Ditulis di kode, bukan disepakati
// lisan, supaya tidak ada yang menebak sendiri saat migrasi.
//
// Kenapa POSISI, bukan `profiles.role`. ERP menyimpan dua hal: peran kasar
// (`director`/`accountant`/`manager`/`admin`/`staff` — lihat PETA_PERAN_ERP di
// atas) dan posisi sebenarnya di daftar pegawai. Peran kasar terlalu tumpul
// untuk modul proyek: `staff` yang sama dipakai Logistic Staff, Junior Arsitek,
// dan Security, padahal ketiganya butuh akses yang jauh berbeda. POSISI-lah
// yang membedakannya.
//
// Nilainya berupa NAMA PERAN kita, bukan peta izin. Itu disengaja: izinnya
// sendiri sudah ada di tabel `RoleSectionPermission` yang sejak Kelompok C
// dikunci ke nama peran, jadi seluruh isinya bisa ditempel apa adanya ke ERP.
// Menyalin izinnya ke sini akan melahirkan sumber kebenaran kedua yang bisa
// hanyut sendiri.

/**
 * Posisi di ERP → peran di modul PROYEK.
 *
 * Daftar berisi LEBIH DARI SATU peran berarti orangnya merangkap dan bisa
 * berpindah lewat pemilih "Lihat sebagai" — izin selalu mengikuti peran yang
 * sedang dipakai, tidak pernah gabungan.
 *
 * Posisi yang TIDAK ada di peta ini tidak berhak membuka modul proyek sama
 * sekali. Itu daftar putih, dan disengaja: posisi baru di ERP tidak otomatis
 * mendapat akses.
 */
export const PETA_POSISI_ERP: Record<string, string[]> = {
  // --- Pimpinan ---
  Director: ["BOD"],

  /**
   * Head of Operation merangkap DUA peran, atas keputusan Usman.
   *
   * Head Operation Office memberi sisi kantor (deskripsi, unit, sarpras, harga
   * RAB, keuangan); Head Operation Project memberi sisi lapangan (progres,
   * aset) DAN tahap "Setujui" pada alur petty cash. Tanpa yang kedua, laporan
   * petty cash mentok di DiverifikasiQS dan tidak pernah bisa direimburse.
   */
  "Head of Operation": ["Head Operation Office", "Head Operation Project"],

  // --- Produksi ---
  /**
   * Manager Proyek merangkap Supervisor, atas
   * keputusan Usman: merekalah pemegang dana petty cash di lapangan.
   *
   * Perlu diketahui konsekuensinya. Izin mengikuti peran AKTIF, dan Project
   * Manager tidak berhak mengubah petty cash. Jadi untuk mencatat pengeluaran
   * dana talangannya, Manager Proyek harus berpindah ke peran Supervisor lebih
   * dulu lewat pemilih "Lihat sebagai". Itu bukan
   * kerepotan yang tak disengaja — memegang uang tunai perusahaan memang
   * tindakan yang berbeda dari mengelola proyek.
   */
  "Manager Proyek": ["Project Manager", "Supervisor"],
  /**
   * Logistic Staff MURNI Supervisor, bukan Procurement. Keputusan Usman: yang
   * memegang daftar induk alat adalah QS Asst, sementara logistik mengurus
   * pergerakan barangnya di lapangan. Praktisnya, ia bisa mencatat penyesuaian
   * stok (Hilang / Rusak / Koreksi Stok) tetapi tidak mendaftarkan alat baru.
   */
  "Logistic Staff": ["Supervisor"],
  "Junior Arsitek Staff": ["Arsitek"],
  /** Verifikator petty cash (tahap DiverifikasiQS) dan pemegang harga RAB. */
  "Quantity Surveyor Asst": ["Quantity Surveyor", "Procurement"],

  // --- Operasional ---
  /** Pemegang tahap Reimburse pada alur petty cash. */
  "Finance & Tax": ["Finance"],
  /**
   * Admin dan Finance berprofil izin IDENTIK di sistem ini, jadi rangkap ini
   * tidak menambah satu pun kewenangan pada matriks. Yang ditambahkannya justru
   * hal yang tak terlihat dari matriks: tahap "Reimburse" petty cash menuntut
   * NAMA peran "Finance" persis. Dengan rangkap ini, pencairan reimburse tidak
   * berhenti bila Finance & Tax sedang berhalangan.
   */
  "Staff Administration": ["Admin", "Finance"],
  "HRD Staff": ["HRD"],
  "Customer Service": ["Customer Care"],

  // --- Marketing ---
  // Kelimanya berprofil izin IDENTIK di sistem ini: enam sub-bagian baca-saja
  // (deskripsi, daftar unit, daftar sarpras, dokumen teknis, aset, penyesuaian
  // aset). Peran yang dipilih hanya menentukan label, bukan kewenangan.
  "Manager Marketing": ["Head Marketing & Sales"],
  "Sales & Marketing": ["Sales"],
  "Agent Coordinator": ["Agent Coordinator"],
  "Copy Writer": ["Head Content & Media"],
  "Design Graphic Staff": ["Editor"],
  "Graphic Designer": ["Social Media"],
};

/**
 * Posisi yang sengaja TIDAK diberi akses modul proyek.
 *
 * Dinyatakan eksplisit, bukan sekadar absen dari peta, supaya bedanya jelas
 * antara "sudah diputuskan tidak" dan "belum sempat dipetakan".
 */
export const TANPA_AKSES_PROYEK = [
  "Security",
  /** Fungsinya di modul proyek tidak jelas; ditutup sampai diperjelas. */
  "Support Function",
];

/**
 * Posisi di ERP yang setara Administrator Sistem — MENUNGGU KONFIRMASI.
 *
 * Instruksi Usman (2026-09-09): cek dulu apakah ERP sudah punya administrator
 * sistemnya sendiri. Kalau ada, posisinya ditulis di sini dan otomatis
 * dipetakan ke peran Administrator Sistem — tidak ada tempat lain yang perlu
 * disunting.
 *
 * Sengaja dibiarkan KOSONG, bukan ditebak. Peran ini bukan sekadar label:
 *
 *   1. Ia memegang seluruh 12 sub-bagian dengan hak ubah.
 *   2. Ia adalah PERAN_SUPERUSER pada alur petty cash — satu-satunya yang
 *      boleh menembus gerbang tiap tahap (lihat superuserPetty di
 *      keuangan/petty-actions.ts). Memberikannya ke posisi yang keliru berarti
 *      seseorang bisa mengajukan, memverifikasi, menyetujui, DAN mereimburse
 *      laporan petty cash-nya sendiri.
 *
 * Yang TIDAK perlu menunggu konfirmasi ini: pengelolaan pengguna dan matriks
 * hak akses. Gerbangnya adalah hak ubah pada sub-bagian `deskripsi`, bukan
 * nama peran ini — dan Director (BOD) serta Head of Operation (Head Operation
 * Office) sudah memenuhinya. Halaman Admin bisa dipakai sejak hari pertama.
 */
export const POSISI_ADMIN_SISTEM: readonly string[] = [];

/**
 * Peran modul PROYEK untuk sebuah posisi ERP. Kosong berarti tak berhak.
 *
 * `posisiAdmin` bisa diberikan untuk pengujian; secara bawaan ia membaca
 * `POSISI_ADMIN_SISTEM` di atas.
 */
export function peranDariPosisiErp(
  posisi: string,
  posisiAdmin: readonly string[] = POSISI_ADMIN_SISTEM,
): string[] {
  if (posisiAdmin.includes(posisi)) return ["Administrator Sistem"];
  return PETA_POSISI_ERP[posisi] ?? [];
}

/** Apakah sebuah posisi ERP berhak membuka modul proyek sama sekali. */
export const posisiBolehBukaModulProyek = (
  posisi: string,
  posisiAdmin: readonly string[] = POSISI_ADMIN_SISTEM,
): boolean => peranDariPosisiErp(posisi, posisiAdmin).length > 0;

/**
 * Peran yang berhak mengelola pengguna dan matriks hak akses.
 *
 * Bukan daftar tetap melainkan turunan: gerbangnya adalah hak UBAH pada
 * sub-bagian `deskripsi` (lihat izinkanKelolaAkses di admin/actions.ts). Daftar
 * ini menyebutkan peran yang memenuhinya pada matriks bawaan, dan dipakai
 * dokumentasi serta tes — bukan sebagai penegakan.
 */
export const PERAN_KELOLA_AKSES = [
  "Administrator Sistem",
  "BOD",
  "Business Development",
  "Head Operation Office",
] as const;
