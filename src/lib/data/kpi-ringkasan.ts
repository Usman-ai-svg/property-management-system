import { prisma } from "@/lib/db";
import { bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { komposisi, keuanganPerProyek } from "@/lib/data/keuangan";
import { luasTotal } from "@/lib/data/proyek";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { unitTerpakai } from "@/lib/calc/aset";
import { m2, pct, rpRingkas } from "@/lib/format";
import type { RingkasProyek } from "@/lib/data/ringkasan";

/**
 * KPI seluruh modul untuk halaman Ringkasan.
 *
 * Halaman Ringkasan adalah layar pertama yang dibuka setiap pagi, jadi isinya
 * harus menjawab "ada apa hari ini" tanpa perlu membuka lima modul satu per
 * satu. Angka di sini sengaja memakai rumus yang sama persis dengan halaman
 * asalnya — bila Ringkasan dan Konstruksi menyebut angka berbeda untuk hal
 * yang sama, yang rusak adalah kepercayaan pada keduanya.
 *
 * Dua aturan yang menentukan bentuk modul ini:
 *
 *   1. Grup yang tidak boleh dibuka pengganya TIDAK dihitung sama sekali —
 *      query-nya tidak dijalankan, bukan dijalankan lalu angkanya
 *      disembunyikan. Penyaringnya sengaja disamakan dengan penyaring menu di
 *      `lib/nav.ts`, supaya Ringkasan tidak pernah memamerkan angka dari modul
 *      yang menunya sendiri tidak muncul.
 *   2. Di dalam grup yang boleh dibuka, kolom rupiah masih bisa tertutup
 *      sendiri lewat izin "hargaRabRap" — itulah sebabnya sebagian KPI
 *      berganti isi, bukan berganti nilai jadi nol.
 */

export interface AngkaKpi {
  label: string;
  nilai: string;
  catatan?: string;
}

export interface GrupKpi {
  id: string;
  judul: string;
  /** Tautan ke modul asal angka-angka ini. */
  href: string;
  angka: AngkaKpi[];
}

/**
 * Susun KPI tiap modul.
 *
 * `proyek` adalah hasil `ringkasanProyek()` yang sudah dipakai halaman
 * Ringkasan untuk tabelnya — dioper ke sini supaya unit tidak di-query dua
 * kali dalam satu permintaan.
 */
export async function kpiSeluruhFitur(u: Pengguna, proyek: RingkasProyek[]): Promise<GrupKpi[]> {
  const [konstruksi, keuangan, vendor, aset, landbank] = await Promise.all([
    bolehLihat(u, "daftarUnit") ? grupKonstruksi(u, proyek) : null,
    bolehLihat(u, "keuangan") ? grupKeuangan(u) : null,
    bolehLihat(u, "progress") ? grupVendor(u) : null,
    grupAset(u),
    bolehLihat(u, "businessPlan") ? grupLandbank(u) : null,
  ]);

  const portofolio = bolehLihat(u, "deskripsi") ? grupPortofolio(u, proyek) : null;

  return [portofolio, konstruksi, keuangan, vendor, aset, landbank].filter(
    (g): g is GrupKpi => g !== null,
  );
}

// ---------------------------------------------------------------------------

/**
 * Portofolio proyek — angka lintas modul.
 *
 * `nilaiJual` sudah bernilai null bila peran tidak berhak atas "hargaRabRap";
 * penyaringnya terjadi di `ringkasanProyek()`, bukan di sini.
 */
function grupPortofolio(u: Pengguna, proyek: RingkasProyek[]): GrupKpi {
  const totalUnit = proyek.reduce((s, p) => s + p.jumlahUnit, 0);
  const selesai = proyek.reduce((s, p) => s + p.unitSelesai, 0);
  const aktif = proyek.filter((p) => p.status === "Dalam Pembangunan").length;
  const bolehHarga = bolehLihat(u, "hargaRabRap");
  const nilaiJual = proyek.reduce((s, p) => s + (p.nilaiJual ?? 0), 0);

  return {
    id: "portofolio",
    judul: "Portofolio Proyek",
    href: "/master",
    angka: [
      { label: "Proyek", nilai: String(proyek.length), catatan: `${aktif} dalam pembangunan` },
      { label: "Total Unit", nilai: String(totalUnit), catatan: `di ${proyek.length} proyek` },
      {
        label: "Unit Selesai",
        nilai: String(selesai),
        catatan: totalUnit ? `${pct(selesai / totalUnit, 0)} dari seluruh unit` : undefined,
      },
      {
        label: "Nilai Jual Unit",
        nilai: bolehHarga ? rpRingkas(nilaiJual) : "—",
        catatan: bolehHarga ? "harga jual seluruh unit" : "tidak tersedia untuk peran ini",
      },
    ],
  };
}

// ---------------------------------------------------------------------------

/**
 * Konstruksi — progres fisik.
 *
 * Rata-rata ditimbang jumlah unit, sama seperti dashboard Konstruksi: proyek
 * berisi 51 unit tidak boleh sebobot proyek berisi 12 unit.
 */
async function grupKonstruksi(u: Pengguna, proyek: RingkasProyek[]): Promise<GrupKpi> {
  const sarpras = await prisma.infrastructure.findMany({
    where: { project: filterProyek(u) },
    select: { progress: true },
  });

  const totalUnit = proyek.reduce((s, p) => s + p.jumlahUnit, 0);
  const rataUnit = totalUnit
    ? Math.round(proyek.reduce((s, p) => s + p.rataProgress * p.jumlahUnit, 0) / totalUnit)
    : 0;
  const rataSarpras = sarpras.length
    ? Math.round(sarpras.reduce((s, x) => s + x.progress, 0) / sarpras.length)
    : 0;

  const dikerjakan = proyek.reduce((s, p) => s + p.unitProgress, 0);
  const tertinggi = [...proyek]
    .filter((p) => p.status === "Dalam Pembangunan")
    .sort((a, b) => b.rataProgress - a.rataProgress)[0];

  return {
    id: "konstruksi",
    judul: "Konstruksi",
    href: "/konstruksi",
    angka: [
      { label: "Unit Sedang Dikerjakan", nilai: String(dikerjakan), catatan: `dari ${totalUnit} unit` },
      { label: "Rata Progres Unit", nilai: `${rataUnit}%`, catatan: "ditimbang jumlah unit" },
      { label: "Rata Progres Sarpras", nilai: `${rataSarpras}%`, catatan: `${sarpras.length} item sarpras` },
      {
        label: "Proyek Terdepan",
        nilai: tertinggi ? `${tertinggi.rataProgress}%` : "—",
        catatan: tertinggi?.nama ?? "belum ada proyek dalam pembangunan",
      },
    ],
  };
}

/** Keuangan Proyek — uang yang sudah keluar dan seberapa jauh dari RAP. */
async function grupKeuangan(u: Pengguna): Promise<GrupKpi> {
  const [perProyek, expenses] = await Promise.all([
    keuanganPerProyek(u),
    prisma.expense.findMany({
      where: { project: filterProyek(u) },
      select: { tanggal: true, jenis: true, peruntukan: true, total: true },
    }),
  ]);

  const batas = new Date(Date.now() - 30 * 864e5);
  const terbaru = expenses.filter((e) => e.tanggal >= batas);
  const total30 = terbaru.reduce((s, e) => s + e.total, 0);
  const realisasi = expenses.reduce((s, e) => s + e.total, 0);
  const rap = perProyek.reduce((s, p) => s + p.rap, 0);
  const over = perProyek.filter((p) => p.rap && p.realisasi / p.rap > 1).length;
  const terbesar = komposisi(expenses, "jenis")[0];

  return {
    id: "keuangan",
    judul: "Keuangan Proyek",
    href: "/keuangan",
    angka: [
      { label: "Pengeluaran 30 Hari", nilai: rpRingkas(total30), catatan: `${terbaru.length} transaksi` },
      {
        label: "Serapan RAP",
        nilai: rap ? pct(realisasi / rap, 1) : "—",
        catatan: `${rpRingkas(realisasi)} dari ${rpRingkas(rap)}`,
      },
      { label: "Proyek Melebihi RAP", nilai: String(over), catatan: `dari ${perProyek.length} proyek` },
      {
        label: "Kategori Terbesar",
        nilai: terbesar?.label ?? "—",
        catatan: terbesar ? rpRingkas(terbesar.nilai) : undefined,
      },
    ],
  };
}

/**
 * Vendor Management — posisi kontrak dan sisa kewajiban bayar.
 *
 * Hanya kontrak pada proyek yang boleh diakses pengguna yang ikut dihitung;
 * satu vendor bisa mengerjakan proyek di luar jangkauannya.
 */
async function grupVendor(u: Pengguna): Promise<GrupKpi> {
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  const vendor = await prisma.vendor.findMany({
    select: {
      status: true,
      contracts: {
        where: { project: filterProyek(u) },
        select: {
          nominal: true,
          retensiPct: true,
          expenses: { select: { total: true } },
          variationOrders: { select: { nominal: true, status: true } },
        },
      },
    },
  });

  const kontrak = vendor.flatMap((v) => v.contracts).map(ringkasKontrak);
  const berjalan = kontrak.filter((r) => r.terbayar < r.nilaiEfektif).length;
  const nilai = kontrak.reduce((s, r) => s + r.nilaiEfektif, 0);
  const terbayar = kontrak.reduce((s, r) => s + r.terbayar, 0);
  const aktif = vendor.filter((v) => v.status === "Aktif").length;

  return {
    id: "vendor",
    judul: "Vendor Management",
    href: "/vendor",
    angka: [
      { label: "Vendor Aktif", nilai: String(aktif), catatan: `dari ${vendor.length} vendor terdaftar` },
      { label: "Kontrak Berjalan", nilai: `${berjalan} / ${kontrak.length}`, catatan: "belum lunas" },
      {
        label: "Nilai Kontrak",
        nilai: bolehHarga ? rpRingkas(nilai) : "—",
        catatan: bolehHarga ? "termasuk VO disetujui" : "tidak tersedia untuk peran ini",
      },
      {
        label: "Belum Terbayar",
        nilai: bolehHarga ? rpRingkas(nilai - terbayar) : "—",
        catatan: !bolehHarga
          ? "tidak tersedia untuk peran ini"
          : nilai
            ? `${pct(1 - terbayar / nilai, 0)} dari nilai kontrak`
            : undefined,
      },
    ],
  };
}

/**
 * Equipment & Asset — kesiapan alat.
 *
 * Menu Equipment tidak disaring izin apa pun, jadi grup ini selalu muncul.
 * Yang tetap disaring hanya nilai perolehan lewat "hargaRabRap".
 */
async function grupAset(u: Pengguna): Promise<GrupKpi> {
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  const aset = await prisma.equipment.findMany({
    select: {
      kepemilikan: true, status: true, servisBerikut: true,
      jumlah: true, jumlahRusak: true,
      ...(bolehHarga ? { nilai: true } : {}),
    },
  });

  const milikSendiri = aset.filter((a) => a.kepemilikan === "Milik Sendiri");
  const perluPerhatian = aset.filter((a) => a.status === "Rusak" || a.status === "Pemeliharaan").length;
  const rusak = aset.reduce((s, a) => s + a.jumlahRusak, 0);
  const terpakai = aset.reduce((s, a) => s + unitTerpakai(a), 0);

  // Servis yang jatuh tempo dalam 30 hari ke depan, atau sudah terlewat.
  const ambang = new Date(Date.now() + 30 * 864e5);
  const servisDekat = aset.filter((a) => a.servisBerikut && a.servisBerikut <= ambang).length;

  return {
    id: "equipment",
    judul: "Equipment & Asset",
    href: "/equipment",
    angka: [
      { label: "Total Aset", nilai: `${aset.length} jenis`, catatan: `${terpakai} unit sedang dipakai` },
      {
        label: "Milik Sendiri / Sewa",
        nilai: `${milikSendiri.length} / ${aset.length - milikSendiri.length}`,
        catatan: "jenis alat",
      },
      { label: "Perlu Perhatian", nilai: String(perluPerhatian), catatan: `${rusak} unit tercatat rusak` },
      bolehHarga
        ? {
            label: "Nilai Aset Sendiri",
            nilai: rpRingkas(
              milikSendiri.reduce((s, a) => s + ((a as { nilai?: number }).nilai ?? 0), 0),
            ),
            catatan: `servis ≤ 30 hari: ${servisDekat}`,
          }
        : { label: "Servis ≤ 30 Hari", nilai: String(servisDekat), catatan: "jatuh tempo atau terlewat" },
    ],
  };
}

/** Landbank — luas lahan dan biaya perolehannya. */
async function grupLandbank(u: Pengguna): Promise<GrupKpi> {
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    select: {
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      ...(bolehHarga
        ? {
            biayaPembelian: true, biayaNotaris: true,
            biayaBalikNama: true, biayaLegalLain: true,
          }
        : {}),
    },
  });

  const total = proyek.reduce((s, p) => s + luasTotal(p), 0);
  const efektif = proyek.reduce((s, p) => s + p.luasKavlingEfektif, 0);
  const rataRasio = proyek.length
    ? proyek.reduce((s, p) => {
        const t = luasTotal(p);
        return s + (t ? p.luasKavlingEfektif / t : 0);
      }, 0) / proyek.length
    : 0;

  const perolehan = proyek.reduce((s, p) => {
    const b = p as Partial<{
      biayaPembelian: number; biayaNotaris: number; biayaBalikNama: number; biayaLegalLain: number;
    }>;
    return s + (b.biayaPembelian ?? 0) + (b.biayaNotaris ?? 0) + (b.biayaBalikNama ?? 0) + (b.biayaLegalLain ?? 0);
  }, 0);

  return {
    id: "landbank",
    judul: "Landbank",
    href: "/landbank",
    angka: [
      { label: "Total Luas Lahan", nilai: m2(total), catatan: `${proyek.length} proyek` },
      { label: "Kavling Efektif", nilai: m2(efektif), catatan: "siap dijual" },
      { label: "Rata Rasio Efektif", nilai: pct(rataRasio, 1), catatan: "kavling terhadap luas total" },
      {
        label: "Biaya Perolehan",
        nilai: bolehHarga ? rpRingkas(perolehan) : "—",
        catatan: bolehHarga ? "pembelian + legal" : "tidak tersedia untuk peran ini",
      },
    ],
  };
}
