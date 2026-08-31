import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bolehAksesProyek, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Pengambilan data modul Estimasi RAB.
 *
 * SELURUH modul ini berada di bawah izin "hargaRabRap" — isinya harga satuan
 * pekerjaan, harga dasar, dan penawaran pemasok. Karena itu penjagaannya di
 * tingkat HALAMAN: tiap halaman memanggil `wajibLihat(u, "hargaRabRap")` sebelum
 * memanggil fungsi di sini, dan tidak ada blok `...(bolehHarga ? …)` per kolom.
 * Konsekuensinya dicatat di `src/lib/auth/kolom-terbatas.ts` (DIJAGA_DI_HALAMAN)
 * supaya sifat itu terlacak, persis seperti `keuangan.ts` dan `plan-real.ts`.
 *
 * Pustaka AHSP (analisa, harga dasar, pemasok) bersifat terpusat — milik
 * perusahaan, bukan milik satu proyek — jadi tidak disaring per proyek. RAB
 * Estimasi menempel pada proyek, jadi disaring dengan `filterProjectId`.
 */

const pilihKomponen = {
  orderBy: { urutan: "asc" as const },
  select: {
    id: true,
    koefisien: true,
    urutan: true,
    hargaDasar: {
      select: { id: true, kode: true, kategori: true, uraian: true, satuan: true, hargaAcuan: true },
    },
  },
};

/** Proyek yang boleh dipilih saat membuat RAB Estimasi baru. */
export async function proyekUntukEstimasi(u: Pengguna) {
  return prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: { id: true, kode: true, nama: true },
  });
}

/** Daftar seluruh RAB Estimasi pada proyek yang boleh diakses. */
export async function daftarRabEstimasi(u: Pengguna) {
  const rows = await prisma.rabEstimasi.findMany({
    where: { project: filterProyek(u) },
    orderBy: [{ project: { kode: "asc" } }, { nomor: "asc" }],
    select: {
      id: true, nomor: true, nama: true, status: true, tanggal: true,
      project: { select: { kode: true, nama: true } },
      items: { select: { volume: true, hargaSatuan: true } },
    },
  });

  // Total = SUM(volume × hargaSatuan) atas baris snapshot — tidak dihitung
  // ulang dari AHSP, supaya angka RAB yang sudah tersusun tidak bergeser.
  return rows.map((r) => ({
    id: r.id, nomor: r.nomor, nama: r.nama, status: r.status, tanggal: r.tanggal,
    project: r.project,
    jumlahBaris: r.items.length,
    total: r.items.reduce((s, i) => s + i.volume * i.hargaSatuan, 0),
  }));
}

/** KPI di kepala halaman daftar Estimasi. */
export async function kpiEstimasi(u: Pengguna) {
  const [rab, analisa, hargaDasar, pemasok] = await Promise.all([
    daftarRabEstimasi(u),
    prisma.analisaHarga.count(),
    prisma.hargaDasar.count(),
    prisma.pemasok.count({ where: { status: "Aktif" } }),
  ]);
  return {
    jumlahRab: rab.length,
    totalNilai: rab.reduce((s, r) => s + r.total, 0),
    jumlahAnalisa: analisa,
    jumlahHargaDasar: hargaDasar,
    pemasokAktif: pemasok,
  };
}

/**
 * Detail satu RAB Estimasi beserta katalog analisa untuk menambah baris.
 *
 * Katalog dibawa serta supaya QS bisa memilih pekerjaan dari pustaka AHSP tanpa
 * halaman kedua; harga satuannya dihitung di lapisan tampilan dari komponen di
 * sini. Baris RAB sendiri memakai harga SNAPSHOT, bukan katalog.
 */
export async function detailRabEstimasi(u: Pengguna, id: string) {
  const estimasi = await prisma.rabEstimasi.findUnique({
    where: { id },
    select: {
      id: true, nomor: true, nama: true, status: true, tanggal: true, projectId: true,
      diajukanPada: true, diajukanOleh: true, diputusPada: true, diputusOleh: true, catatanTolak: true,
      project: { select: { kode: true, nama: true } },
      items: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, analisaId: true, grup: true, uraian: true, satuan: true, spesifikasi: true,
          volume: true, hargaSatuan: true, urutan: true, pemenangVendorId: true,
          penawaran: { select: { vendorId: true, hargaSatuan: true } },
        },
      },
      // Vendor pembanding — kolom pada tabel perbandingan penawaran (aktif saat Final).
      pembanding: {
        orderBy: { vendor: { nama: "asc" } },
        select: { vendorId: true, vendor: { select: { nama: true, bidang: true } } },
      },
    },
  });

  if (!estimasi) notFound();
  if (!bolehAksesProyek(u, estimasi.projectId)) notFound();

  const katalog = await prisma.analisaHarga.findMany({
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, uraian: true, satuan: true, kelompok: true, overheadPct: true,
      komponen: pilihKomponen,
    },
  });

  return { estimasi, katalog };
}

/** Satu analisa beserta komponennya — untuk halaman/edit pustaka. */
export async function detailAnalisa(id: string) {
  return prisma.analisaHarga.findUnique({
    where: { id },
    select: {
      id: true, kode: true, uraian: true, satuan: true, kelompok: true, overheadPct: true,
      komponen: pilihKomponen,
    },
  });
}

/**
 * Seluruh pustaka: analisa, harga dasar (price book) beserta penawaran tiap
 * pemasok, dan daftar pemasok. Company-wide — tidak disaring per proyek.
 */
export async function pustakaAhsp() {
  const [analisa, hargaDasar, pemasok] = await Promise.all([
    prisma.analisaHarga.findMany({
      orderBy: { kode: "asc" },
      select: {
        id: true, kode: true, uraian: true, satuan: true, kelompok: true, overheadPct: true,
        komponen: pilihKomponen,
      },
    }),
    prisma.hargaDasar.findMany({
      orderBy: { kode: "asc" },
      select: {
        id: true, kode: true, kategori: true, uraian: true, satuan: true, hargaAcuan: true,
        _count: { select: { komponen: true } },
        penawaran: {
          orderBy: { harga: "asc" },
          select: {
            id: true, harga: true, tanggal: true, keterangan: true,
            pemasok: { select: { id: true, nama: true } },
          },
        },
      },
    }),
    prisma.pemasok.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true, nama: true, kategori: true, kontakNama: true, kontakTelepon: true,
        alamat: true, kecamatan: true, provinsi: true, status: true,
        _count: { select: { penawaran: true } },
      },
    }),
  ]);

  return { analisa, hargaDasar, pemasok };
}

/** Harga dasar ringkas untuk pemilih komponen di editor analisa. */
export async function daftarHargaDasar() {
  return prisma.hargaDasar.findMany({
    orderBy: { kode: "asc" },
    select: { id: true, kode: true, kategori: true, uraian: true, satuan: true, hargaAcuan: true },
  });
}

/** Pemasok ringkas untuk pemilih di editor penawaran. */
export async function daftarPemasok() {
  return prisma.pemasok.findMany({
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, kategori: true },
  });
}

/**
 * Detail satu pemasok: profil, penawaran harga yang pernah diberikan (lintas
 * harga dasar), dan RIWAYAT PEMBELIAN beserta termin pembayarannya.
 *
 * Company-wide seperti pustaka lainnya — pemasok tidak menempel pada satu
 * proyek. Nilai/terbayar/hutang dihitung di lapisan tampilan dari data mentah
 * di sini (Σ item qty×harga vs Σ Expense pembayaran).
 */
export async function detailPemasok(id: string) {
  const pemasok = await prisma.pemasok.findUnique({
    where: { id },
    select: {
      id: true, nama: true, kategori: true, kontakNama: true, kontakTelepon: true,
      alamat: true, kecamatan: true, provinsi: true, status: true,
      penawaran: {
        orderBy: { tanggal: "desc" },
        select: {
          id: true, harga: true, tanggal: true, keterangan: true,
          hargaDasar: { select: { id: true, kode: true, uraian: true, satuan: true, kategori: true, hargaAcuan: true } },
        },
      },
      pembelian: {
        orderBy: { tanggal: "desc" },
        select: {
          id: true, nomor: true, status: true, tanggal: true, keterangan: true,
          project: { select: { id: true, kode: true, nama: true } },
          items: {
            orderBy: { urutan: "asc" },
            select: { id: true, uraian: true, satuan: true, qty: true, harga: true, hargaDasarId: true },
          },
          pembayaran: {
            orderBy: { tanggal: "asc" },
            select: { id: true, tanggal: true, uraian: true, total: true, metode: true, status: true },
          },
        },
      },
    },
  });
  if (!pemasok) notFound();
  return pemasok;
}

/** Vendor aktif untuk ditambahkan sebagai kolom pembanding penawaran RAB. */
export async function vendorUntukPembanding() {
  return prisma.vendor.findMany({
    where: { status: "Aktif" },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, bidang: true },
  });
}

/** Unit & sarpras satu proyek — cakupan saat membuat SPK dari baris yang menang. */
export async function objekProyek(projectId: string) {
  const [units, sarpras] = await Promise.all([
    prisma.unit.findMany({
      where: { projectId },
      orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
      select: { id: true, nomor: true, phase: { select: { kode: true } }, unitType: { select: { nama: true } } },
    }),
    prisma.infrastructure.findMany({
      where: { projectId },
      orderBy: { kode: "asc" },
      select: { id: true, nama: true, jenis: true },
    }),
  ]);
  return {
    units: units.map((u) => ({ id: u.id, nama: `${u.phase.kode}-${u.nomor} · ${u.unitType.nama}` })),
    sarpras: sarpras.map((s) => ({ id: s.id, nama: `${s.nama} (${s.jenis})` })),
  };
}

/**
 * Nomor urut SPK berikutnya (3 digit) untuk kode kontrak {KODE}/{K|S}/{TAHUN}/{urut}.
 * Dihitung terpisah untuk jenis Unit (K) dan Sarpras (S) — sesuai penomoran di
 * `buatKontrakDariRab`. Dipakai hanya untuk PRATINJAU di form Buat SPK; nomor
 * final tetap dikunci ulang saat aksi berjalan agar tak bentrok.
 */
export async function nomorSpkBerikutnya(projectKode: string, tahun = new Date().getFullYear()) {
  const hitung = async (huruf: "K" | "S") => {
    const awalan = `${projectKode}/${huruf}/${tahun}/`;
    const ada = await prisma.contract.findMany({
      where: { kode: { startsWith: awalan } },
      select: { kode: true },
    });
    const urut = ada.reduce((m, c) => {
      const n = parseInt(c.kode.slice(awalan.length), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return String(urut + 1).padStart(3, "0");
  };
  const [K, S] = await Promise.all([hitung("K"), hitung("S")]);
  return { K, S, tahun };
}

/**
 * Isi sebuah RAB estimasi untuk membentuk template BOQ penawaran vendor.
 *
 * Hanya volume yang ikut, tanpa harga satuan: templatenya dikirim ke vendor
 * pembanding, jadi HPS memang tidak boleh ada di dalamnya. `projectId` ikut
 * untuk pemeriksaan akses proyek di pemanggil.
 */
export async function rabUntukTemplatePenawaran(id: string) {
  return prisma.rabEstimasi.findUnique({
    where: { id },
    select: {
      nomor: true, nama: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      items: {
        orderBy: { urutan: "asc" },
        select: { grup: true, uraian: true, satuan: true, volume: true },
      },
    },
  });
}
