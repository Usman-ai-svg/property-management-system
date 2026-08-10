import { prisma } from "@/lib/db";
import { filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { jatuhTempo, ringkasKontrak, statusHutang } from "@/lib/calc/keuangan";
import { nilaiUnit, nilaiSarpras } from "@/lib/data/proyek";
import { rp, tanggal } from "@/lib/format";

/** Warna kategori — dipakai donat dan penanda jenis biaya. */
export const WARNA_JENIS: Record<string, string> = {
  Kontraktor: "#cf6a57",
  "Upah Borongan": "#3b82c4",
  "Upah Harian": "#e0619a",
  Material: "#d9a441",
  Subkon: "#8b7fd6",
  "Lain-lain proyek": "#4bbf87",
};

export const WARNA_PERUNTUKAN: Record<string, string> = {
  "Unit (rumah dijual)": "#3b82c4",
  "Prasarana & Sarana": "#d9a441",
  "Perijinan & Ormas": "#e0619a",
  "Pengolahan Lahan": "#8b7fd6",
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Ringkasan keuangan tiap proyek: RAB, RAP, dan realisasi.
 *
 * RAB & RAP dihitung lewat `nilaiUnit`/`nilaiSarpras` — fungsi yang SAMA dengan
 * Master Proyek — jadi angkanya selalu sinkron antar-halaman: RAB = Σ BOQ unit
 * (termasuk kerja tambah) + Σ RAB sarpras; RAP = Σ (Material+Tenaga+Subkon+5%)
 * unit & sarpras. Menggantikan "nilai kontrak" lama yang sebenarnya harga jual.
 */
export async function keuanganPerProyek(u: Pengguna) {
  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      units: {
        select: {
          rapUpahVolume: true, rapUpahHarga: true,
          boqItems: { select: { volume: true, hargaSatuan: true } },
          rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
          customWorks: {
            select: {
              boqItems: { select: { volume: true, hargaSatuan: true } },
              rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
              rapUpahVolume: true, rapUpahHarga: true,
            },
          },
        },
      },
      infrastructures: {
        select: {
          rab: true, rapUpahVolume: true, rapUpahHarga: true,
          boqItems: { select: { volume: true, hargaSatuan: true } },
          rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
        },
      },
      expenses: { select: { total: true } },
    },
  });

  return proyek.map((p) => {
    const rab =
      p.units.reduce((s, x) => s + nilaiUnit(x).rab, 0) +
      p.infrastructures.reduce((s, x) => s + nilaiSarpras(x).rab, 0);
    const rap =
      p.units.reduce((s, x) => s + nilaiUnit(x).rap, 0) +
      p.infrastructures.reduce((s, x) => s + nilaiSarpras(x).rap, 0);
    return {
      id: p.id, kode: p.kode, nama: p.nama,
      status: p.status, statusLahan: p.statusLahan,
      jumlahUnit: p.units.length,
      rab,
      rap,
      realisasi: p.expenses.reduce((s, e) => s + e.total, 0),
    };
  });
}

/** Komposisi pengeluaran per jenis atau per peruntukan, siap dipakai donat. */
export function komposisi(
  expenses: { jenis: string; peruntukan: string; total: number }[],
  mode: "jenis" | "peruntukan",
) {
  const peta = new Map<string, number>();
  for (const e of expenses) {
    const k = mode === "jenis" ? e.jenis : e.peruntukan;
    peta.set(k, (peta.get(k) ?? 0) + e.total);
  }
  const warna = mode === "jenis" ? WARNA_JENIS : WARNA_PERUNTUKAN;

  return [...peta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, nilai]) => ({ label, nilai, warna: warna[label] ?? "#999" }));
}

/**
 * Tren pengeluaran 12 bulan terakhir.
 *
 * Dihitung dari transaksi sungguhan, bukan angka tetap seperti pada
 * prototipe — sehingga grafiknya ikut bergerak saat pengeluaran dicatat.
 */
export async function trenBulanan(u: Pengguna, projectId?: string) {
  const sekarang = new Date();
  const mulai = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 11, 1));

  const expenses = await prisma.expense.findMany({
    where: {
      project: filterProyek(u),
      ...(projectId ? { projectId } : {}),
      tanggal: { gte: mulai },
    },
    select: { tanggal: true, total: true },
  });

  const peta = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 11 + i, 1));
    peta.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, 0);
  }

  for (const e of expenses) {
    const k = `${e.tanggal.getUTCFullYear()}-${e.tanggal.getUTCMonth()}`;
    if (peta.has(k)) peta.set(k, peta.get(k)! + e.total);
  }

  return [...peta.entries()].map(([k, nilai]) => {
    const [tahun, bulan] = k.split("-").map(Number);
    return {
      bulan: BULAN[bulan],
      // Tahun ikut dibawa supaya grafik bisa menyebut bulannya secara utuh —
      // rentang 12 bulan selalu melewati pergantian tahun, dan "Jan" saja
      // tidak cukup untuk tahu tahun berapa.
      label: `${BULAN[bulan]} ${tahun}`,
      nilai,
    };
  });
}

// ---------------------------------------------------------------------------
// Pengambilan data per halaman
//
// Halaman tidak lagi memanggil Prisma sendiri. Bentuk datanya ditetapkan di
// sini, sehingga saat modul ini diserap ERP cukup berkas ini yang berganti isi
// menjadi pemanggilan RPC — halamannya tidak perlu disentuh.
// ---------------------------------------------------------------------------

/**
 * Hutang berjalan (pengeluaran metode "Hutang" yang sisanya > 0) lintas proyek.
 *
 * Dipakai pengingat di dashboard: mana yang lewat tenggat, mana yang mendekati.
 * Sisa & status diturunkan dari cicilan — bukan disimpan — agar selalu sinkron.
 */
export async function hutangBerjalan(u: Pengguna) {
  const rows = await prisma.expense.findMany({
    where: { project: filterProyek(u), metode: "Hutang" },
    orderBy: { tenggat: "asc" },
    select: {
      id: true, uraian: true, kreditur: true, tenggat: true, total: true,
      project: { select: { kode: true, nama: true } },
      cicilan: { select: { nominal: true } },
    },
  });

  const sekarang = new Date();
  return rows
    .map((h) => {
      const terbayar = h.cicilan.reduce((s, c) => s + c.nominal, 0);
      return {
        id: h.id,
        kreditur: h.kreditur ?? "—",
        uraian: h.uraian,
        proyek: h.project.nama,
        kodeProyek: h.project.kode,
        total: h.total,
        terbayar,
        sisa: h.total - terbayar,
        status: statusHutang(h.total, terbayar),
        tenggat: h.tenggat ? tanggal(h.tenggat) : "—",
        jatuhTempo: jatuhTempo(h.tenggat, sekarang),
      };
    })
    .filter((h) => h.sisa > 0);
}

/** Data halaman daftar Keuangan Proyek. */
export async function dataKeuangan(u: Pengguna) {
  const [proyek, tren, expenses, hutang] = await Promise.all([
    keuanganPerProyek(u),
    trenBulanan(u),
    prisma.expense.findMany({
      where: { project: filterProyek(u) },
      orderBy: { tanggal: "desc" },
      select: {
        id: true, tanggal: true, jenis: true, peruntukan: true, total: true,
        uraian: true, pic: true,
        project: { select: { nama: true } },
      },
    }),
    hutangBerjalan(u),
  ]);

  return { proyek, tren, expenses, hutang };
}

/** Satu proyek beserta unit, sarpras, dan seluruh pengeluarannya. */
export async function proyekKeuangan(kodeProyek: string) {
  return prisma.project.findUnique({
    where: { kode: kodeProyek },
    select: {
      id: true, kode: true, nama: true, statusLahan: true,
      units: {
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, kode: true, nomor: true, hargaJual: true, rapUpahVolume: true, rapUpahHarga: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true } },
          boqItems: { select: { volume: true, hargaSatuan: true } },
          rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
          customWorks: {
            select: {
              boqItems: { select: { volume: true, hargaSatuan: true } },
              rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
              rapUpahVolume: true, rapUpahHarga: true,
            },
          },
        },
      },
      infrastructures: {
        orderBy: { kode: "asc" },
        select: {
          id: true, kode: true, nama: true, jenis: true, volume: true,
          status: true, progress: true, rab: true,
          rapUpahVolume: true, rapUpahHarga: true,
          boqItems: { select: { volume: true, hargaSatuan: true } },
          rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
        },
      },
      expenses: {
        orderBy: { tanggal: "desc" },
        select: {
          id: true, tanggal: true, jenis: true, peruntukan: true, metode: true,
          uraian: true, total: true, status: true, pic: true, bukti: true, buktiKey: true,
          kreditur: true, tenggat: true,
          contractId: true, pembelianId: true,
          alokasi: {
            select: { id: true, unitId: true, infrastructureId: true, nominal: true },
          },
          cicilan: {
            orderBy: { tanggal: "asc" },
            select: {
              id: true, tanggal: true, nominal: true, metode: true,
              bukti: true, buktiKey: true, pic: true,
            },
          },
          contract: {
            select: { kode: true, vendorId: true, vendor: { select: { nama: true } } },
          },
          pembelian: { select: { nomor: true, pemasok: { select: { nama: true } } } },
        },
      },
    },
  });
}

/**
 * Seluruh PO / pembelian material sebuah proyek beserta barang dan termin
 * pembayarannya. Nilai/terbayar/hutang dihitung di tampilan dari data mentah
 * di sini (Σ item qty×harga vs Σ Expense pembayaran).
 */
export async function pembelianProyek(projectId: string) {
  return prisma.pembelian.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { tanggal: "desc" }],
    select: {
      id: true, nomor: true, status: true, tanggal: true, keterangan: true,
      tanggalTerima: true, penerima: true,
      pemasok: { select: { id: true, nama: true, kategori: true } },
      items: {
        orderBy: { urutan: "asc" },
        select: { id: true, uraian: true, satuan: true, qty: true, harga: true },
      },
      pembayaran: {
        orderBy: { tanggal: "asc" },
        select: { id: true, tanggal: true, uraian: true, total: true, metode: true, status: true },
      },
    },
  });
}

/** Pemasok aktif — pilihan saat membuat PO di Keuangan Proyek. */
export async function pemasokUntukPembelian() {
  return prisma.pemasok.findMany({
    where: { status: "Aktif" },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, kategori: true },
  });
}

/** Harga dasar ringkas untuk menaut baris PO ke price book (opsional). */
export async function hargaDasarUntukPembelian() {
  return prisma.hargaDasar.findMany({
    orderBy: { kode: "asc" },
    select: { id: true, kode: true, uraian: true, satuan: true, hargaAcuan: true },
  });
}

/**
 * Data untuk pintu masuk tunggal "Catat Pembayaran": tiap proyek beserta
 * kontrak & PO yang MASIH punya sisa bayar, plus unit/sarpras untuk pembebanan
 * pengeluaran manual/PO.
 *
 * Dengan menawarkan kontrak/PO yang bisa dibayar langsung di sini, pengguna
 * tidak perlu (dan tidak diberi jalan) mencatat pembayaran kontrak/PO sebagai
 * pengeluaran manual lepas — itulah yang dulu membuka celah baris ganda tanpa
 * tautan. Sisa dihitung sama seperti di modul asalnya (kontrak: nilai efektif −
 * terbayar; PO: Σ item − Σ terbayar).
 */
export async function pintuBayar(u: Pengguna) {
  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, nama: true,
      units: {
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: { id: true, nomor: true, phase: { select: { kode: true } } },
      },
      infrastructures: {
        orderBy: { kode: "asc" },
        select: { id: true, nama: true, jenis: true },
      },
      contracts: {
        orderBy: { kode: "asc" },
        select: {
          id: true, kode: true, deskripsi: true, jenis: true, jenisBiaya: true, nominal: true, retensiPct: true,
          vendor: { select: { nama: true } },
          expenses: { select: { total: true } },
          variationOrders: { select: { nominal: true, status: true } },
          _count: { select: { units: true, infrastructures: true } },
        },
      },
      pembelian: {
        orderBy: { tanggal: "desc" },
        select: {
          id: true, nomor: true, status: true,
          pemasok: { select: { nama: true } },
          items: { select: { qty: true, harga: true } },
          pembayaran: { select: { total: true } },
        },
      },
      expenses: {
        where: { metode: "Hutang" },
        orderBy: { tenggat: "asc" },
        select: {
          id: true, uraian: true, kreditur: true, tenggat: true, total: true,
          cicilan: { select: { nominal: true } },
        },
      },
    },
  });

  const sekarang = new Date();

  return proyek.map((p) => ({
    id: p.id,
    nama: p.nama,
    units: p.units.map((x) => ({ id: x.id, label: `${x.phase.kode}-${x.nomor}` })),
    sarpras: p.infrastructures.map((s) => ({ id: s.id, label: `${s.nama} · ${s.jenis}` })),
    kontrak: p.contracts
      .map((k) => {
        const r = ringkasKontrak(k);
        return {
          id: k.id,
          label: `${k.kode} · ${k.vendor.nama} — ${k.deskripsi}`,
          // Ringkasan nilai, ditampilkan sebagai info saat kontrak dipilih —
          // bukan lagi diimpit ke dalam label pilihan.
          nilai: r.nilaiEfektif,
          terbayar: r.terbayar,
          sisa: r.sisa,
          retensi: r.retensi,
          retensiPct: k.retensiPct,
          // Terkunci di form pembayaran: peruntukan mengikuti lingkup kontrak,
          // jenis biaya mengikuti jenisBiaya kontrak, pembebanan otomatis dibagi
          // ke sekian objek cakupan.
          peruntukan: k.jenis === "Unit" ? "Unit (rumah dijual)" : "Prasarana & Sarana",
          jenisBiaya: k.jenisBiaya,
          cakupan: k._count.units + k._count.infrastructures,
        };
      })
      .filter((k) => k.sisa > 0),
    po: p.pembelian
      .map((b) => {
        const total = b.items.reduce((s, i) => s + i.qty * i.harga, 0);
        const terbayar = b.pembayaran.reduce((s, e) => s + e.total, 0);
        return {
          id: b.id,
          label: `${b.nomor} · ${b.pemasok.nama}`,
          sisa: total - terbayar,
          diterima: b.status === "Diterima",
        };
      })
      .filter((b) => b.sisa > 0),
    hutang: p.expenses
      .map((h) => {
        const sisa = h.total - h.cicilan.reduce((s, c) => s + c.nominal, 0);
        return {
          id: h.id,
          label: `${h.kreditur ?? "—"} — ${h.uraian} · sisa ${rp(sisa)}`,
          kreditur: h.kreditur ?? "—",
          sisa,
          tenggat: h.tenggat ? tanggal(h.tenggat) : "—",
          jatuhTempo: jatuhTempo(h.tenggat, sekarang),
        };
      })
      .filter((h) => h.sisa > 0),
  }));
}

/** Kontrak sebuah proyek, dipakai membagi realisasi ke unit dan sarpras. */
export async function kontrakUntukAlokasi(projectId: string) {
  const [kontrakUnit, kontrakSarpras] = await Promise.all([
    prisma.contract.findMany({
      where: { projectId, jenis: "Unit" },
      select: {
        id: true, nominal: true, retensiPct: true,
        expenses: { select: { total: true } },
        variationOrders: { select: { nominal: true, status: true } },
        units: { select: { unitId: true, nilaiOverride: true } },
      },
    }),
    prisma.contract.findMany({
      where: { projectId, jenis: "Sarpras" },
      select: {
        id: true, nominal: true, retensiPct: true,
        expenses: { select: { total: true } },
        variationOrders: { select: { nominal: true, status: true } },
        infrastructures: { select: { infrastructureId: true, nilaiOverride: true } },
      },
    }),
  ]);
  return { kontrakUnit, kontrakSarpras };
}
