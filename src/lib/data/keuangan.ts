import { prisma } from "@/lib/db";
import { filterProyek, type Pengguna } from "@/lib/auth/rbac";

/** Warna kategori — dipakai donat dan penanda jenis biaya. */
export const WARNA_JENIS: Record<string, string> = {
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

/** Ringkasan keuangan tiap proyek: nilai kontrak, RAP, dan realisasi. */
export async function keuanganPerProyek(u: Pengguna) {
  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      units: {
        select: {
          hargaJual: true, rapUpahVolume: true, rapUpahHarga: true,
          rapItems: { select: { volume: true, hargaSatuan: true } },
        },
      },
      expenses: { select: { total: true } },
    },
  });

  return proyek.map((p) => {
    const rap = p.units.reduce((s, x) => s + totalRapDari(x), 0);
    return {
      id: p.id, kode: p.kode, nama: p.nama,
      status: p.status, statusLahan: p.statusLahan,
      jumlahUnit: p.units.length,
      nilaiKontrak: p.units.reduce((s, x) => s + x.hargaJual, 0),
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

/**
 * Total RAP dari baris snapshot-nya: material ditambah upah.
 *
 * Dipakai untuk unit maupun item sarana & prasarana — keduanya menyimpan RAP
 * dengan bentuk yang sama, jadi rumusnya tidak perlu digandakan.
 */
export const totalRapDari = (x: {
  rapUpahVolume: number;
  rapUpahHarga: number;
  rapItems: { volume: number; hargaSatuan: number }[];
}) =>
  x.rapUpahVolume * x.rapUpahHarga +
  x.rapItems.reduce((a, r) => a + r.volume * r.hargaSatuan, 0);
