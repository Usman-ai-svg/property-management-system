/**
 * Peta kolom database → daftar nilai enum yang sah untuknya.
 *
 * Dua alasan berkas ini ada.
 *
 * PERTAMA, komentar `///` di `prisma/schema.prisma` sudah terbukti bisa basi
 * tanpa ada yang sadar: `Expense.jenis` sempat kehilangan "Kontraktor" dan
 * `Expense.metode` kehilangan "Hutang" setelah keduanya ditambahkan di
 * `enums.ts`. Selama komentar cuma prosa, tidak ada mesin yang bisa
 * membandingkannya. Registri ini membuat perbandingan itu mungkin — lihat
 * `kolom-enum.test.ts`.
 *
 * KEDUA, saat modul diserap ERP, kolom-kolom ini jadi `text` + CHECK constraint
 * di Postgres. Daftar di bawah adalah masukan generator DDL-nya, sehingga
 * CHECK-nya lahir dari `enums.ts` — bukan dari komentar yang bisa basi.
 *
 * Kolom yang TIDAK didaftar di sini ada dua macam. Teks bebas — mis.
 * `OperationalCost.kategori`, yang harus cocok dengan nama pos business plan, dan
 * `Equipment.kategori`. Serta himpunan nilai tertutup yang belum punya konstanta
 * di `enums.ts`: `Document.kategori` (model3d, gambarKerjaPdf, ...) dan
 * `kategori` pada keempat model RapItem ("Material" | "Subkon"). Keduanya perlu
 * diputuskan saat E2: didaftarkan ke `enums.ts` agar dapat CHECK, atau dibiarkan
 * bebas dengan sadar.
 */

import {
  JENIS_ASET,
  JENIS_BIAYA,
  JENIS_BIAYA_KONTRAK,
  JENIS_HAK_ATAS_TANAH,
  JENIS_KONTRAK,
  JENIS_PENYESUAIAN_ASET,
  JENIS_SARPRAS,
  JENIS_TOPUP_PETTY,
  KATEGORI_HARGA_DASAR,
  KATEGORI_PEMASOK,
  KEPEMILIKAN_ASET,
  METODE_BAYAR,
  METODE_TUNAI,
  PERUNTUKAN_BIAYA,
  STATUS_BAYAR,
  STATUS_JUAL,
  STATUS_PEMASOK,
  STATUS_PEMBANGUNAN,
  STATUS_PEMBELIAN,
  STATUS_PENGGUNAAN,
  STATUS_PETTY_CASH,
  STATUS_PROYEK,
  STATUS_RAB_ESTIMASI,
  STATUS_SARPRAS,
  STATUS_VENDOR,
  STATUS_VO,
} from "./enums";

/**
 * Kunci berbentuk `Model.kolom`, persis seperti tertulis di schema.prisma.
 * Nilainya daftar yang sah — boleh seluruh enum, boleh himpunan bagiannya bila
 * kolom itu memang hanya menerima sebagian (mis. pembayaran tunai tak boleh
 * bermetode "Hutang").
 */
export const KOLOM_ENUM = {
  "Project.status": STATUS_PROYEK,
  "Legality.jenisHak": JENIS_HAK_ATAS_TANAH,
  "Unit.statusPembangunan": STATUS_PEMBANGUNAN,
  "Unit.statusJual": STATUS_JUAL,
  "Infrastructure.jenis": JENIS_SARPRAS,
  "Infrastructure.status": STATUS_SARPRAS,
  "Vendor.status": STATUS_VENDOR,
  "Contract.jenis": JENIS_KONTRAK,
  "Contract.jenisBiaya": JENIS_BIAYA_KONTRAK,
  "VariationOrder.status": STATUS_VO,
  "Expense.peruntukan": PERUNTUKAN_BIAYA,
  "Expense.jenis": JENIS_BIAYA,
  "Expense.metode": METODE_BAYAR,
  "Expense.status": STATUS_BAYAR,
  "HutangCicilan.metode": METODE_TUNAI,
  "PettyCashTopUp.jenis": JENIS_TOPUP_PETTY,
  "PettyCashReport.status": STATUS_PETTY_CASH,
  "OperationalCost.status": STATUS_BAYAR,
  "Equipment.jenis": JENIS_ASET,
  "Equipment.kepemilikan": KEPEMILIKAN_ASET,
  "EquipmentUsage.status": STATUS_PENGGUNAAN,
  "EquipmentAdjustment.jenis": JENIS_PENYESUAIAN_ASET,
  "Pemasok.kategori": KATEGORI_PEMASOK,
  "Pemasok.status": STATUS_PEMASOK,
  "HargaDasar.kategori": KATEGORI_HARGA_DASAR,
  "RabEstimasi.status": STATUS_RAB_ESTIMASI,
  "Pembelian.status": STATUS_PEMBELIAN,
} as const satisfies Record<string, readonly string[]>;

/** Kunci registri, mis. "Expense.jenis". */
export type KolomEnum = keyof typeof KOLOM_ENUM;

/**
 * Enum di `SEMUA_ENUM` yang memang TIDAK menempel pada kolom mana pun, beserta
 * alasannya. Daftar ini bukan pengecualian yang boleh diisi asal — ia dijaga
 * tes, supaya enum baru yang lupa didaftarkan tidak lolos diam-diam dengan cara
 * dianggap "tak berkolom".
 */
export const ENUM_TANPA_KOLOM: Record<string, string> = {
  StatusAset:
    "Nilai turunan dari stok dan penggunaan aktif — dihitung `statusAset()`, tidak pernah disimpan.",
};
