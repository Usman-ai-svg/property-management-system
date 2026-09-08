/**
 * Angka RAB & RAP sebuah objek proyek. Murni — tanpa Prisma, tanpa framework.
 *
 * Dua fungsi ini sebelumnya tinggal di `lib/data/proyek.ts` bersama query
 * Prisma, padahal keduanya tidak pernah menyentuh database: masukannya baris
 * BOQ/RAP yang sudah dibaca, keluarannya angka. Mereka dipakai oleh Master
 * Proyek, Keuangan Proyek, dan halaman detail unit, jadi begitu ikut lapisan
 * murni, ketiga halaman itu memakai satu sumber angka yang sama dan bisa
 * disalin ke ERP apa adanya.
 */

import { rapKategori, totalRap } from "@/lib/calc/boq";

/**
 * Hitung RAB & RAP "unit ini" dari baris snapshot-nya — dasar Tipe DITAMBAH
 * seluruh Kerja Tambah, disatukan jadi satu angka. Berlaku sama untuk unit
 * default (tanpa kerja tambah, sehingga sama dengan RAB/RAP tipe) maupun
 * unit custom.
 */
export function nilaiUnit(u: {
  boqItems?: { volume: number; hargaSatuan: number }[];
  rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[];
  rapUpahVolume?: number;
  rapUpahHarga?: number;
  customWorks?: {
    boqItems?: { volume: number; hargaSatuan: number }[] | false;
    rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[] | false;
    rapUpahVolume?: number | false;
    rapUpahHarga?: number | false;
  }[];
}) {
  const jumlah = (rows?: { volume: number; hargaSatuan: number }[] | false) =>
    (rows || []).reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

  const rabStandar = jumlah(u.boqItems);
  const kerjaTambah = (u.customWorks ?? []).reduce((s, c) => s + jumlah(c.boqItems), 0);

  // RAP: Material + Tenaga + Subkon + Lain-lain 5% (lewat `rapKategori`).
  // rapMaterial/rapUpah tetap dikembalikan sebagai rincian mentah untuk tampilan.
  const rincianStandar = rapKategori({
    rapUpahVolume: u.rapUpahVolume ?? 0, rapUpahHarga: u.rapUpahHarga ?? 0,
    rapItems: u.rapItems ?? [],
  });
  const rapKerjaTambah = (u.customWorks ?? []).reduce(
    (s, c) =>
      s +
      totalRap({
        rapUpahVolume: c.rapUpahVolume || 0, rapUpahHarga: c.rapUpahHarga || 0,
        rapItems: c.rapItems || [],
      }),
    0,
  );

  return {
    rabStandar,
    kerjaTambah,
    rab: rabStandar + kerjaTambah,
    rap: rincianStandar.total + rapKerjaTambah,
    rapMaterial: rincianStandar.material + rincianStandar.subkon,
    rapUpah: rincianStandar.tenaga,
    rapKerjaTambah,
    // Rincian RAP dasar (Tipe) per 4 kategori — dipakai kartu Ringkasan agar
    // angkanya identik dengan tabel RAP (yang juga memakai rumus rapKategori).
    rap4: rincianStandar,
  };
}

/**
 * RAB & RAP satu item sarpras.
 *
 * Mengikuti artifact: RAB adalah jumlah baris BOQ-nya, dan RAP ditaksir
 * 90% dari RAB selama rincian RAP sarpras belum dibuat sendiri.
 */
export function nilaiSarpras(s: {
  rab?: number;
  boqItems?: { volume: number; hargaSatuan: number }[];
  rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[];
  rapUpahVolume?: number | null;
  rapUpahHarga?: number | null;
}) {
  const dariBoq = (s.boqItems ?? []).reduce((a, r) => a + r.volume * r.hargaSatuan, 0);
  const rab = dariBoq || s.rab || 0;

  // RAP nyata (dari rincian material/upah + Lain-lain 5%) dipakai bila ada;
  // bila sarpras belum punya rincian RAP, jatuh ke taksiran lama 90% dari RAB
  // supaya angkanya tidak tiba-tiba nol.
  const rapRinci = totalRap({
    rapUpahVolume: s.rapUpahVolume ?? 0, rapUpahHarga: s.rapUpahHarga ?? 0,
    rapItems: s.rapItems ?? [],
  });
  return { rab, rap: rapRinci > 0 ? rapRinci : Math.round(rab * 0.9) };
}
