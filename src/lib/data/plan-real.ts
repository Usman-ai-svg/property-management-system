import { prisma } from "@/lib/db";
import { type Pengguna } from "@/lib/auth/rbac";
import { ringkasKontrak } from "@/lib/calc/keuangan";

/**
 * Perbandingan rencana dan realisasi.
 *
 * Rencana berasal dari Business Plan. Realisasi diturunkan dari data yang
 * benar-benar tercatat — pengeluaran, pembayaran kontrak, dan penerimaan
 * penjualan — bukan dari perkiraan "rencana × progres" seperti prototipe.
 *
 * Konsekuensinya, pos yang belum punya transaksi akan menunjukkan nol.
 * Itu memang keadaannya: pada laporan yang dipakai mengambil keputusan,
 * angka yang dikarang lebih berbahaya daripada angka yang kosong.
 */

/** Peruntukan pengeluaran yang membiayai tiap pos HPP. */
const SUMBER_HPP: Record<string, string[]> = {
  "Perolehan Tanah": [],
  "Pengolahan Lahan": ["Pengolahan Lahan"],
  "Perijinan & Legalitas": ["Perijinan & Ormas"],
  "Prasarana & Sarana": ["Prasarana & Sarana"],
  "Konstruksi Rumah": ["Unit (rumah dijual)"],
};

export async function planVsRealisasi(u: Pengguna, kode: string) {
  const proyek = await prisma.project.findUnique({
    where: { kode },
    select: {
      id: true, kode: true, nama: true, status: true,
      biayaPembelian: true, biayaNotaris: true, biayaBalikNama: true, biayaLegalLain: true,
      units: {
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, nomor: true, luasTanah: true, hargaJual: true,
          statusJual: true, progress: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true, luasBangunan: true } },
          // Harga dasar rencana (Omset) — dipakai sebagai target penjualan.
          bpOmzet: { select: { hargaDasar: true } },
          penerimaan: {
            orderBy: { tanggal: "asc" as const },
            select: { id: true, tanggal: true, uraian: true, nominal: true },
          },
        },
      },
      expenses: { select: { peruntukan: true, total: true, contractId: true } },
      biayaOperasional: { select: { kategori: true, nominal: true } },
      contracts: {
        where: { jenis: "Sarpras" },
        select: {
          nominal: true, retensiPct: true,
          expenses: { select: { total: true } },
          variationOrders: { select: { nominal: true, status: true } },
        },
      },
    },
  });

  if (!proyek) return null;

  const rencana = await prisma.businessPlan.findUnique({
    where: { projectId: proyek.id },
    select: {
      hpp: {
        orderBy: { urutan: "asc" },
        select: { id: true, nama: true, rows: { select: { volume: true, harga: true } } },
      },
      operasional: {
        orderBy: { urutan: "asc" },
        select: { id: true, nama: true, rows: { select: { nilai: true } } },
      },
    },
  });
  if (!rencana) return null;

  const perolehanLahan =
    proyek.biayaPembelian + proyek.biayaNotaris + proyek.biayaBalikNama + proyek.biayaLegalLain;

  const sarprasTerbayar = proyek.contracts.reduce((s, k) => s + ringkasKontrak(k).terbayar, 0);

  const perPeruntukan = new Map<string, number>();
  // Pengeluaran sarpras yang TIDAK tertaut kontrak — dijumlah terpisah karena
  // pembayaran kontrak sarpras sudah masuk lewat `sarprasTerbayar`. Kalau kedua
  // sumber sama-sama dijumlah dari `perPeruntukan`, biaya kontrak sarpras
  // terhitung dua kali.
  let sarprasLangsung = 0;
  for (const e of proyek.expenses) {
    perPeruntukan.set(e.peruntukan, (perPeruntukan.get(e.peruntukan) ?? 0) + e.total);
    if (e.peruntukan === "Prasarana & Sarana" && !e.contractId) sarprasLangsung += e.total;
  }

  const biaya = rencana.hpp.map((h, i) => {
    const plan = h.rows.reduce((s, r) => s + r.volume * r.harga, 0);
    let real = 0;
    let sumber: string;

    if (h.nama === "Perolehan Tanah") {
      real = perolehanLahan;
      sumber = "biaya perolehan lahan di Landbank";
    } else if (h.nama === "Prasarana & Sarana") {
      // Sarpras dibiayai lewat kontrak dan pengeluaran langsung. Hanya
      // pengeluaran non-kontrak yang ditambahkan; pembayaran kontrak sudah
      // dihitung di `sarprasTerbayar` agar tak ganda.
      real = sarprasTerbayar + sarprasLangsung;
      sumber = "pembayaran kontrak sarpras + pengeluaran";
    } else {
      const peruntukan = SUMBER_HPP[h.nama] ?? [];
      real = peruntukan.reduce((s, p) => s + (perPeruntukan.get(p) ?? 0), 0);
      sumber = peruntukan.length ? `pengeluaran · ${peruntukan.join(", ")}` : "belum ada sumber data";
    }

    return { kode: String.fromCharCode(65 + i), nama: h.nama, plan, real, sumber };
  });

  // Realisasi biaya operasional dicocokkan lewat nama kategorinya, yang memang
  // dipilih dari daftar pos pada business plan saat pencatatan.
  const perKategori = new Map<string, number>();
  for (const b of proyek.biayaOperasional) {
    perKategori.set(b.kategori, (perKategori.get(b.kategori) ?? 0) + b.nominal);
  }

  const ops = rencana.operasional.map((o) => ({
    nama: o.nama,
    plan: o.rows.reduce((s, r) => s + r.nilai, 0),
    real: perKategori.get(o.nama) ?? 0,
  }));

  const sales = proyek.units.map((x) => {
    const akad = x.statusJual === "Akad" || x.statusJual === "Serah Terima";
    // Target = harga dasar rencana (Omset); default hargaJual bila belum di-override.
    const target = x.bpOmzet?.hargaDasar ?? x.hargaJual;
    return {
      id: x.id,
      no: `${x.phase.kode}-${x.nomor}`,
      tipe: x.unitType.nama,
      luasBangunan: x.unitType.luasBangunan,
      luasTanah: x.luasTanah,
      target,
      akad,
      real: akad ? x.hargaJual : 0,
      pencairan: akad ? x.hargaJual : 0,
      sudahCair: x.penerimaan.reduce((s, p) => s + p.nominal, 0),
      // Riwayat ikut dibawa supaya pencairannya bisa disunting dari tabel
      // penjualan tanpa query tambahan per baris.
      penerimaan: x.penerimaan.map((p) => ({
        id: p.id,
        tanggal: p.tanggal.toISOString().slice(0, 10),
        uraian: p.uraian,
        nominal: p.nominal,
      })),
    };
  });

  // Rencana penjualan = Σ harga dasar rencana seluruh unit (non-PPN).
  const penjualanPlan = sales.reduce((s, x) => s + x.target, 0);
  const penjualanReal = sales.reduce((s, x) => s + x.sudahCair, 0);

  const hppPlan = biaya.reduce((s, x) => s + x.plan, 0);
  const hppReal = biaya.reduce((s, x) => s + x.real, 0);
  const opsPlan = ops.reduce((s, x) => s + x.plan, 0);
  const opsReal = ops.reduce((s, x) => s + x.real, 0);

  const progres = proyek.units.length
    ? proyek.units.reduce((s, x) => s + x.progress, 0) / proyek.units.length / 100
    : 0;

  return {
    proyek: { id: proyek.id, kode: proyek.kode, nama: proyek.nama, status: proyek.status },
    progres,
    biaya, ops, sales,
    penjualanPlan, penjualanReal,
    hppPlan, hppReal, opsPlan, opsReal,
    labaKotorPlan: penjualanPlan - hppPlan,
    labaKotorReal: penjualanReal - hppReal,
    labaBersihPlan: penjualanPlan - hppPlan - opsPlan,
    labaBersihReal: penjualanReal - hppReal - opsReal,
    marginPlan: penjualanPlan ? (penjualanPlan - hppPlan - opsPlan) / penjualanPlan : 0,
    marginReal: penjualanReal ? (penjualanReal - hppReal - opsReal) / penjualanReal : 0,
  };
}
