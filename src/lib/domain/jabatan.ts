/**
 * JABATAN — satu-satunya definisi siapa boleh apa di modul Proyek.
 *
 * ------------------------------------------------------------------------
 * KENAPA JABATAN, BUKAN `profiles.role`
 * ------------------------------------------------------------------------
 * ERP memakai dua lapis yang berbeda pertanyaannya:
 *
 *   LUAR   `profiles.role` — modul mana yang kelihatan. Delapan nilai, TIDAK
 *          disentuh sama sekali oleh modul ini.
 *   DALAM  jabatan di `hris.employees` — di dalam modul Proyek boleh apa.
 *
 * Peta hak akses dikunci ke lapis DALAM. Sebabnya `profiles.role` terlalu
 * tumpul: nilai `staff` yang sama dipakai Logistic Staff, Junior Arsitek, dan
 * Security, padahal ketiganya butuh akses yang jauh berbeda. Jabatan yang
 * membedakannya.
 *
 * Konsekuensi yang perlu diketahui: orang tanpa data karyawan HRIS tidak punya
 * jabatan, jadi tidak punya hak apa pun di Proyek meski modulnya dicentang.
 * Itu perilaku yang benar — akun yang bukan karyawan memang bukan siapa-siapa
 * di sini.
 *
 * ------------------------------------------------------------------------
 * KENAPA KUNCI BAKU, BUKAN TEKS HRIS LANGSUNG
 * ------------------------------------------------------------------------
 * Matriks dikunci ke `kunci` (`quantity_surveyor_asst`), bukan ke `jabatanHris`
 * ("quantity surveyor asst"). Selama belum dipastikan kolom jabatan di HRIS
 * punya daftar tertutup (lihat `docs/jabatan-erp.md`), teksnya harus dianggap
 * bebas — dan satu salah ketik "Quantity Surveyor asst" akan mencabut seluruh
 * akses seseorang TANPA pesan apa pun. Dengan lapisan ini, salah ketik seperti
 * itu berbiaya satu baris di `ALIAS_HRIS`, bukan membangun ulang matriks.
 *
 * ------------------------------------------------------------------------
 * SATU ORANG BISA LEBIH DARI SATU JABATAN
 * ------------------------------------------------------------------------
 * Izinnya gabungan, tingkat tertinggi yang menang (ubah > lihat > tidak).
 * Tidak ada pemilih "Lihat sebagai": kewenangan tidak pernah disembunyikan di
 * balik pilihan yang harus diingat orang. Gerbang yang dulu bersandar pada
 * perpindahan peran sekarang ditulis sebagai aturan — lihat aturan lintas
 * transisi di `src/lib/calc/petty-cash.ts`.
 */

/** Pengelompokan jabatan, dipakai untuk pewarnaan chip di UI. */
export type GrupJabatan =
  | "lead"
  | "ops"
  | "tech"
  | "cc"
  | "fin"
  | "hr"
  | "mkt"
  | "media";

/**
 * Cakupan sebuah jabatan.
 *
 *   proyek — bekerja di dalam modul Proyek.
 *   luar   — pekerjaannya di luar modul ini; boleh melihat sebagai konteks,
 *            TIDAK PERNAH boleh mengubah apa pun. Dijaga tes.
 */
export type Cakupan = "proyek" | "luar";

export interface Jabatan {
  /** Dipakai di kode, di matriks, dan di SQL. Tidak pernah berubah. */
  kunci: string;
  /** Nilai apa adanya di `hris.employees`. Boleh berubah; lihat ALIAS_HRIS. */
  jabatanHris: string;
  /** Yang dilihat pengguna. */
  label: string;
  grup: GrupJabatan;
  cakupan: Cakupan;
  /**
   * Peran repo yang dulu menempel pada jabatan ini.
   *
   * Bukan konsep yang hidup — "peran" sudah tidak ada lagi sebagai sumbu izin.
   * Disimpan sebagai ASAL-USUL: matriks per-jabatan diturunkan dari matriks
   * per-peran lewat penggabungan, dan tanpa daftar ini tidak ada yang bisa
   * memeriksa ulang bahwa penggabungannya benar. Juga menjelaskan kenapa
   * sebuah jabatan punya hak yang kelihatannya tidak berhubungan.
   */
  peranAsal: string[];
}

/**
 * Delapan belas jabatan, dari tabel 2.2 dokumen perbaikan.
 *
 * Tiga jabatan menampung lebih dari satu peran, dan hak aksesnya jadi gabungan:
 *
 *   director               Administrator Sistem + BOD. Tidak ada peran sistem
 *                          terpisah di ERP; director yang memegang modul
 *                          Pengaturan dan jejak audit, jadi dialah
 *                          administratornya.
 *   head of operation      Head Operation Office + Head Operation Project +
 *                          Business Development. Hasilnya hak ubah di seluruh
 *                          dua belas sub-bagian, termasuk businessPlan.
 *                          Disengaja dan sudah disetujui.
 *   quantity surveyor asst Quantity Surveyor + Procurement. Dapat hak ubah
 *                          `aset` dari sisi Procurement, dan TETAP tidak boleh
 *                          menyetujui RAB — ia yang menyusunnya.
 *
 * `komisaris` dan `consultant finance` sengaja ada tanpa orangnya: barisnya
 * sudah siap di matriks, tinggal diisi.
 */
export const JABATAN: readonly Jabatan[] = [
  {
    kunci: "director",
    jabatanHris: "director",
    label: "Director",
    grup: "lead",
    cakupan: "proyek",
    peranAsal: ["BOD"],
  },
  {
    kunci: "komisaris",
    jabatanHris: "komisaris",
    label: "Komisaris",
    grup: "lead",
    // Bercakupan proyek, tapi tanpa satu pun hak ubah: pengawas melihat
    // segalanya dan tidak menyentuh apa pun. Bedanya dengan jabatan `luar`
    // ada di apa yang boleh dilihat — komisaris melihat businessPlan dan
    // keuangan, jabatan luar tidak.
    cakupan: "proyek",
    peranAsal: ["Komisaris"],
  },
  {
    kunci: "head_of_operation",
    jabatanHris: "head of operation",
    label: "Head of Operation",
    grup: "ops",
    cakupan: "proyek",
    peranAsal: ["Head Operation Office", "Head Operation Project", "Business Development"],
  },
  {
    kunci: "manager_proyek",
    jabatanHris: "manager proyek",
    label: "Manager Proyek",
    grup: "ops",
    cakupan: "proyek",
    peranAsal: ["Project Manager"],
  },
  {
    kunci: "logistic_staff",
    jabatanHris: "logistic staff",
    label: "Logistic Staff",
    grup: "ops",
    cakupan: "proyek",
    peranAsal: ["Supervisor"],
  },
  {
    kunci: "quantity_surveyor_asst",
    jabatanHris: "quantity surveyor asst",
    label: "Quantity Surveyor Asst",
    grup: "tech",
    cakupan: "proyek",
    peranAsal: ["Quantity Surveyor", "Procurement"],
  },
  {
    kunci: "junior_arsitek_staff",
    jabatanHris: "junior arsitek staff",
    label: "Junior Arsitek Staff",
    grup: "tech",
    cakupan: "proyek",
    peranAsal: ["Arsitek"],
  },
  {
    kunci: "consultant_finance",
    jabatanHris: "consultant finance",
    label: "Consultant Finance",
    grup: "fin",
    cakupan: "proyek",
    peranAsal: ["Consultant Finance"],
  },
  {
    kunci: "finance_tax",
    jabatanHris: "Finance & Tax",
    label: "Finance & Tax",
    grup: "fin",
    cakupan: "proyek",
    peranAsal: ["Finance"],
  },
  {
    kunci: "staff_administration",
    jabatanHris: "staff administration",
    label: "Staff Administration",
    grup: "fin",
    cakupan: "proyek",
    peranAsal: ["Admin"],
  },
  {
    kunci: "hrd_staff",
    jabatanHris: "HRD staff",
    label: "HRD Staff",
    grup: "hr",
    cakupan: "luar",
    peranAsal: ["HRD"],
  },
  {
    kunci: "sales_marketing",
    jabatanHris: "Sales & Marketing",
    label: "Sales & Marketing",
    grup: "mkt",
    cakupan: "luar",
    peranAsal: ["Sales"],
  },
  {
    kunci: "customer_service",
    jabatanHris: "customer service",
    label: "Customer Service",
    grup: "cc",
    cakupan: "luar",
    peranAsal: ["Customer Care"],
  },
  {
    kunci: "manager_marketing",
    jabatanHris: "Manager marketing",
    label: "Manager Marketing",
    grup: "mkt",
    cakupan: "luar",
    peranAsal: ["Head Marketing & Sales"],
  },
  {
    kunci: "agent_coordinator",
    jabatanHris: "agent coordinator",
    label: "Agent Coordinator",
    grup: "mkt",
    cakupan: "luar",
    peranAsal: ["Agent Coordinator"],
  },
  {
    kunci: "copy_writer",
    jabatanHris: "copy writer",
    label: "Copy Writer",
    grup: "media",
    cakupan: "luar",
    peranAsal: ["Head Content & Media"],
  },
  {
    kunci: "design_graphic_staff",
    jabatanHris: "design graphic staff",
    label: "Design Graphic Staff",
    grup: "media",
    cakupan: "luar",
    peranAsal: ["Editor"],
  },
  {
    kunci: "graphic_designer",
    jabatanHris: "graphic designer",
    label: "Graphic Designer",
    grup: "media",
    cakupan: "luar",
    peranAsal: ["Social Media"],
  },
];

// ===========================================================================
// KONSTANTA BERNAMA
// ===========================================================================
//
// Tiap jabatan yang dibandingkan di kode punya konstantanya sendiri. Sebelum
// ini ada 32 tempat di 9 berkas yang membandingkan nama sebagai string mentah,
// dan mengganti sebuah jabatan berarti memburunya ke seluruh kode — dengan
// yang terlewat tidak menimbulkan galat, cuma seseorang kehilangan akses.

/** Administrator de facto: pemegang modul Pengaturan dan jejak audit di ERP. */
export const JABATAN_DIRECTOR = "director";
export const JABATAN_HEAD_OF_OPERATION = "head_of_operation";
export const JABATAN_MANAGER_PROYEK = "manager_proyek";
export const JABATAN_LOGISTIC_STAFF = "logistic_staff";
export const JABATAN_QS_ASST = "quantity_surveyor_asst";
export const JABATAN_FINANCE_TAX = "finance_tax";
export const JABATAN_STAFF_ADMINISTRATION = "staff_administration";
export const JABATAN_CONSULTANT_FINANCE = "consultant_finance";

/**
 * Jabatan yang boleh memegang dana petty cash.
 *
 * Dulu hanya Supervisor. Dengan satu Logistic Staff, cuma satu proyek yang bisa
 * punya dana talangan — karena itu Manager Proyek ikut.
 */
export const JABATAN_PEMEGANG_PETTY = [
  JABATAN_LOGISTIC_STAFF,
  JABATAN_MANAGER_PROYEK,
] as const;

// ===========================================================================
// TURUNAN
// ===========================================================================

export const KUNCI_JABATAN = JABATAN.map((j) => j.kunci);

export type KunciJabatan = string;

const PETA = new Map(JABATAN.map((j) => [j.kunci, j]));

/** Definisi sebuah jabatan, atau undefined bila kuncinya tak dikenal. */
export const jabatanDari = (kunci: string): Jabatan | undefined => PETA.get(kunci);

/** Label untuk ditampilkan; jatuh kembali ke kuncinya sendiri bila tak dikenal. */
export const labelJabatan = (kunci: string): string => PETA.get(kunci)?.label ?? kunci;

/** Grup sebuah jabatan, untuk pewarnaan chip. */
export const grupJabatan = (kunci: string): GrupJabatan | undefined => PETA.get(kunci)?.grup;

/** Jabatan yang tidak boleh mengubah apa pun di modul Proyek. */
export const JABATAN_LUAR = JABATAN.filter((j) => j.cakupan === "luar").map((j) => j.kunci);

/**
 * Alias teks HRIS yang menunjuk jabatan yang sama.
 *
 * Tempat menampung kenyataan sebelum ia dirapikan: ejaan lain, singkatan, atau
 * nama lama yang masih terpakai di `hris.employees`. Mengoreksi satu baris di
 * sini lebih murah — dan jauh lebih aman — daripada mengubah matriks.
 *
 * Kosong sampai daftar nilai HRIS yang sebenarnya diperiksa; lihat daftar
 * periksa di `docs/jabatan-erp.md`.
 */
export const ALIAS_HRIS: Record<string, string> = {};

/** Samakan bentuk teks jabatan sebelum dicocokkan: huruf kecil, spasi tunggal. */
const rapikan = (teks: string): string => teks.trim().toLowerCase().replace(/\s+/g, " ");

const DARI_HRIS = new Map<string, string>();
for (const j of JABATAN) DARI_HRIS.set(rapikan(j.jabatanHris), j.kunci);

/**
 * Kunci jabatan dari teks jabatan HRIS. Null berarti tidak dikenal — dan itu
 * berarti tanpa akses, bukan akses bawaan.
 *
 * Pencocokannya tidak peduli huruf besar-kecil maupun spasi berlebih, karena
 * dua hal itu adalah bentuk salah ketik yang paling sering dan paling tidak
 * layak menyebabkan seseorang kehilangan akses.
 */
export function jabatanDariHris(teks: string | null | undefined): string | null {
  if (!teks) return null;
  const bersih = rapikan(teks);
  const alias = ALIAS_HRIS[bersih];
  if (alias) return alias;
  return DARI_HRIS.get(bersih) ?? null;
}
