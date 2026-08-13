/**
 * Penyesuaian stok aset: kehilangan, kerusakan, dan koreksi opname.
 *
 * Jumlah aset tidak pernah diketik langsung. Ia hanya berubah lewat
 * penyesuaian, sehingga tiap pergerakan stok selalu punya alasan, tanggal,
 * dan penanggung jawab. Sebelumnya jumlah bisa disunting bebas: jejak audit
 * mencatat "5 → 3", tetapi tidak pernah tahu apakah dua unit itu hilang,
 * rusak, dipindah, atau memang salah hitung sejak awal.
 *
 * Yang membedakan tiap jenis adalah akibatnya pada angka:
 *
 *   - **Hilang** mengurangi `jumlah`. Barangnya memang tidak ada lagi.
 *   - **Rusak** TIDAK mengurangi `jumlah`, hanya menambah `jumlahRusak`.
 *     Barangnya masih dimiliki perusahaan dan masih bisa diperbaiki —
 *     mengurangi jumlah akan membuatnya lenyap dari daftar aset.
 *   - **Perbaikan Selesai** mengurangi `jumlahRusak`.
 *   - **Koreksi Stok** menambah atau mengurangi `jumlah` setelah opname fisik.
 *
 * Nilai rupiah aset sengaja TIDAK disentuh di sini. Penyusutan dan pembukuan
 * kerugian dikerjakan Finance di luar modul ini; nilai perolehan sebuah aset
 * lama bukan angka kerugian yang benar, dan mengarangnya di sini justru
 * menyesatkan.
 */

export type JenisPenyesuaian = "Hilang" | "Rusak" | "Perbaikan Selesai" | "Koreksi Stok";

export interface StokAset {
  jumlah: number;
  jumlahRusak: number;
}

export interface HasilPenyesuaian {
  /** Stok sesudah penyesuaian. */
  stok: StokAset;
  /** Pesan galat berbahasa manusia; null bila penyesuaian sah. */
  galat: string | null;
}

/**
 * Terapkan satu penyesuaian pada stok sebuah aset.
 *
 * @param stok    keadaan stok sekarang
 * @param jenis   jenis penyesuaian
 * @param banyak  banyaknya unit; selalu positif kecuali Koreksi Stok yang
 *                boleh negatif untuk mengurangi
 */
export function terapkanPenyesuaian(
  stok: StokAset,
  jenis: JenisPenyesuaian,
  banyak: number,
): HasilPenyesuaian {
  const tetap = { stok, galat: null as string | null };

  if (!Number.isInteger(banyak)) {
    return { ...tetap, galat: "Banyaknya unit harus bilangan bulat." };
  }
  if (banyak === 0) {
    return { ...tetap, galat: "Banyaknya unit tidak boleh nol." };
  }
  if (jenis !== "Koreksi Stok" && banyak < 0) {
    return { ...tetap, galat: `Banyaknya unit pada penyesuaian "${jenis}" harus lebih dari nol.` };
  }

  const terpakai = stok.jumlah - stok.jumlahRusak;

  switch (jenis) {
    case "Hilang": {
      if (banyak > stok.jumlah) {
        return {
          ...tetap,
          galat: `Tidak bisa mencatat ${banyak} unit hilang: stok tercatat hanya ${stok.jumlah}.`,
        };
      }
      // Kehilangan diambil lebih dulu dari unit yang masih baik. Bila yang
      // hilang melebihi itu, sisanya terpaksa diambil dari yang rusak —
      // barang rusak pun bisa ikut hilang.
      const dariRusak = Math.max(0, banyak - terpakai);
      return {
        stok: { jumlah: stok.jumlah - banyak, jumlahRusak: stok.jumlahRusak - dariRusak },
        galat: null,
      };
    }

    case "Rusak": {
      if (banyak > terpakai) {
        return {
          ...tetap,
          galat:
            `Tidak bisa mencatat ${banyak} unit rusak: hanya ${terpakai} unit yang masih ` +
            `terpakai dari ${stok.jumlah} unit tercatat.`,
        };
      }
      return { stok: { jumlah: stok.jumlah, jumlahRusak: stok.jumlahRusak + banyak }, galat: null };
    }

    case "Perbaikan Selesai": {
      if (banyak > stok.jumlahRusak) {
        return {
          ...tetap,
          galat: `Tidak bisa memperbaiki ${banyak} unit: yang tercatat rusak hanya ${stok.jumlahRusak}.`,
        };
      }
      return { stok: { jumlah: stok.jumlah, jumlahRusak: stok.jumlahRusak - banyak }, galat: null };
    }

    case "Koreksi Stok": {
      const baru = stok.jumlah + banyak;
      if (baru < 0) {
        return { ...tetap, galat: `Koreksi membuat stok menjadi ${baru}; jumlah tidak boleh negatif.` };
      }
      if (baru < stok.jumlahRusak) {
        return {
          ...tetap,
          galat:
            `Koreksi membuat stok menjadi ${baru}, padahal ${stok.jumlahRusak} unit tercatat rusak. ` +
            `Catat perbaikan atau kehilangan unit rusak itu lebih dulu.`,
        };
      }
      return { stok: { jumlah: baru, jumlahRusak: stok.jumlahRusak }, galat: null };
    }
  }
}

/** Banyaknya unit yang masih baik (tidak rusak), terlepas dari sedang dipakai atau tidak. */
export const unitTerpakai = (s: StokAset): number => Math.max(0, s.jumlah - s.jumlahRusak);

// ===========================================================================
// PENGGUNAAN (deployment) ALAT
// ===========================================================================
//
// Ketersediaan alat DIHITUNG dari penggunaan aktif, tidak disimpan. Dengan
// begitu satu alat bisa terbagi ke beberapa proyek sekaligus (20 scaffolding
// di GN2 + 20 di NT4) tanpa saling menimpa, dan status Tersedia/Digunakan
// selalu jujur mengikuti keadaan lapangan. Semua fungsi di bawah bebas Prisma
// dan bebas framework supaya bisa diuji sendirian.

export interface PenggunaanRingkas {
  jumlah: number;
  /** "Aktif" | "Selesai". Hanya "Aktif" yang menahan stok. */
  status: string;
}

/** Total unit yang sedang tertahan oleh penggunaan berstatus "Aktif". */
export function unitDipakai(penggunaan: PenggunaanRingkas[]): number {
  return penggunaan
    .filter((p) => p.status === "Aktif")
    .reduce((s, p) => s + p.jumlah, 0);
}

/**
 * Unit yang masih bisa dialokasikan: stok baik dikurangi yang sedang dipakai.
 * Tidak pernah negatif.
 */
export function unitTersedia(stok: StokAset, dipakai: number): number {
  return Math.max(0, stok.jumlah - stok.jumlahRusak - dipakai);
}

/**
 * Status alat yang DITURUNKAN dari stok dan penggunaan aktif.
 *
 *   - Rusak    : tak ada satu pun unit yang masih baik.
 *   - Digunakan: seluruh unit baik sedang dipakai.
 *   - Sebagian : sebagian dipakai, sisanya masih tersedia.
 *   - Tersedia : tidak ada yang dipakai.
 */
export function statusAset(stok: StokAset, dipakai: number): "Tersedia" | "Sebagian" | "Digunakan" | "Rusak" {
  const baik = Math.max(0, stok.jumlah - stok.jumlahRusak);
  if (stok.jumlah > 0 && baik === 0) return "Rusak";
  if (dipakai <= 0) return "Tersedia";
  if (dipakai >= baik) return "Digunakan";
  return "Sebagian";
}

/**
 * Lama penggunaan dalam hari, dihitung inklusif.
 *
 * Sebuah pemakaian 1–10 Agustus berlangsung 10 hari, bukan 9 — hari mulai ikut
 * dihitung. Penggunaan yang belum ditutup (`selesai` null) dihitung sampai
 * `kini`. Minimal satu hari.
 */
export function durasiHari(mulai: Date, selesai: Date | null, kini = new Date()): number {
  const akhir = selesai ?? kini;
  const hari = Math.floor((akhir.getTime() - mulai.getTime()) / 864e5) + 1;
  return Math.max(1, hari);
}

/**
 * Estimasi biaya sebuah penggunaan: tarif per hari per unit × jumlah unit ×
 * lama hari. Untuk alat milik sendiri tarifnya 0, jadi biayanya pun 0.
 */
export function biayaPenggunaan(tarifPerHari: number, jumlah: number, hari: number): number {
  return Math.round(tarifPerHari * jumlah * hari);
}

/**
 * Taksiran nilai unit yang rusak, memakai nilai rata-rata per unit.
 *
 * Hanya untuk ditampilkan sebagai informasi di halaman Equipment — BUKAN angka
 * kerugian akuntansi. Nilai perolehan tidak sama dengan nilai buku setelah
 * penyusutan, dan penyusutan itu dikerjakan Finance di luar modul ini.
 */
export function taksiranNilaiRusak(s: StokAset & { nilai: number }): number {
  if (s.jumlah <= 0) return 0;
  return Math.round((s.nilai / s.jumlah) * s.jumlahRusak);
}
