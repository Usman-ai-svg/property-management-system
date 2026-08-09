"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, idProyekDariKode, izinkan, jalankan, pilihan, pilihanOpsional,
  teks, teksOpsional,
} from "@/lib/actions/guard";
import { bersihkanNamaFile, periksaBerkas, simpanBerkas } from "@/lib/storage";
import { alokasiPembayaran, periksaAlokasi } from "@/lib/calc/keuangan";
import { JENIS_BIAYA, JENIS_KONTRAK, METODE_BAYAR, POS_HPP, STATUS_BAYAR, STATUS_VENDOR, STATUS_VO } from "@/lib/domain/enums";

/**
 * Tambah Variation Order pada sebuah kontrak.
 *
 * Nominal boleh negatif untuk pekerjaan kurang. VO hanya menggeser nilai
 * kontrak setelah statusnya "Disetujui" — yang masih diajukan ditampilkan
 * terpisah agar tidak dikira sudah mengikat.
 */
export async function tambahVo(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);

    const kontrak = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true, kode: true, deskripsi: true, projectId: true,
        project: { select: { kode: true } },
        vendor: { select: { id: true, nama: true } },
        _count: { select: { variationOrders: true } },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("progress", kontrak.projectId);

    const nominal = angka(form, "nominal", { wajib: true });
    if (nominal === 0) throw new GagalIzin("Nominal VO tidak boleh nol.");

    const nomor = `VO-${String(kontrak._count.variationOrders + 1).padStart(2, "0")}`;
    const status = pilihan(form, "status", STATUS_VO);
    const uraian = teks(form, "uraian", true);

    await prisma.variationOrder.create({
      data: { contractId, nomor, tanggal: new Date(), uraian, nominal, status },
    });

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `Kontrak ${kontrak.kode} · ${kontrak.vendor.nama}`,
      aksi: "Tambah Variation Order",
      ke: `${nomor} — ${uraian} · ${nominal >= 0 ? "+" : "−"}${rpLog(Math.abs(nominal))} (${status})`,
    });

    revalidatePath(`/vendor/${kontrak.vendor.id}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${kontrak.project.kode}`);
  });
}

/** Catat pembayaran termin pada sebuah kontrak. */
export async function tambahPembayaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);

    const kontrak = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true, kode: true, jenis: true, jenisBiaya: true, deskripsi: true,
        nominal: true, retensiPct: true, projectId: true,
        project: { select: { kode: true } },
        vendor: { select: { id: true, nama: true } },
        expenses: { select: { total: true } },
        variationOrders: { select: { nominal: true, status: true } },
        units: { select: { unitId: true, nilaiOverride: true } },
        infrastructures: { select: { infrastructureId: true, nilaiOverride: true } },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("keuangan", kontrak.projectId);

    const nominal = angka(form, "nominal", { min: 1, wajib: true });
    const uraian = teks(form, "uraian", true);
    // Field yang bebas diisi pengguna (default aman bila terkunci/tak dikirim
    // oleh pemanggil ringkas seperti modal Pembayaran di Vendor).
    const metode = pilihanOpsional(form, "metode", METODE_BAYAR, "Transfer");
    const status = pilihanOpsional(form, "status", STATUS_BAYAR, "Lunas");
    const bukti = teksOpsional(form, "bukti") || null;

    // Pembayaran yang melampaui nilai kontrak ditolak — kelebihan bayar pada
    // kontrak borongan jauh lebih sulit ditarik kembali daripada dicegah.
    const voDisetujui = kontrak.variationOrders
      .filter((v) => v.status === "Disetujui")
      .reduce((s, v) => s + v.nominal, 0);
    const nilaiEfektif = kontrak.nominal + voDisetujui;
    const sudah = kontrak.expenses.reduce((s, e) => s + e.total, 0);

    if (sudah + nominal > nilaiEfektif) {
      throw new GagalIzin(
        `Pembayaran melebihi nilai kontrak. Sisa yang bisa dibayar: ${rpLog(nilaiEfektif - sudah)}.`,
      );
    }

    // Pembayaran vendor DISIMPAN SEBAGAI PENGELUARAN, bukan tabel tersendiri.
    // Dengan begitu satu pembayaran hanya punya satu catatan: ia muncul di
    // Keuangan sebagai baris mutasi bank sekaligus di kontrak ini sebagai
    // termin, tanpa risiko terhitung dua kali.
    //
    // Pembebanannya mengikuti cakupan kontrak — dibagi menurut porsi tiap
    // unit atau item sarpras, memakai pembagian yang sama dengan alokasi
    // kontrak di halaman Keuangan.
    const porsi =
      kontrak.jenis === "Unit"
        ? alokasiPembayaran(nominal, nilaiEfektif, kontrak.units).map((a) => ({
            unitId: a.unitId, infrastructureId: null, nominal: a.alokasi,
          }))
        : alokasiPembayaran(nominal, nilaiEfektif, kontrak.infrastructures).map((a) => ({
            unitId: null, infrastructureId: a.infrastructureId, nominal: a.alokasi,
          }));

    const galat = periksaAlokasi(nominal, porsi);
    if (galat) throw new GagalIzin(galat);

    // Peruntukan & pos HPP mengikuti enum resmi PERUNTUKAN_BIAYA supaya
    // pembayaran ini terhitung di laporan realisasi & komposisi biaya. Nilai
    // teks lama ("Unit"/"Sarana & Prasarana") tidak cocok enum → dulu bikin
    // biaya konstruksi/sarpras luput dari laporan.
    const peruntukan = kontrak.jenis === "Unit" ? "Unit (rumah dijual)" : "Prasarana & Sarana";

    await prisma.expense.create({
      data: {
        projectId: kontrak.projectId,
        contractId,
        tanggal: new Date(),
        peruntukan,
        jenis: kontrak.jenisBiaya,
        metode,
        uraian: `${uraian} — ${kontrak.kode} ${kontrak.vendor.nama}`,
        total: nominal,
        status,
        bukti,
        posHpp: POS_HPP[peruntukan],
        pic: pengguna.nama,
        alokasi: { create: porsi },
      },
    });

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `Kontrak ${kontrak.kode} · ${kontrak.vendor.nama}`,
      aksi: "Catat pembayaran",
      dari: rpLog(sudah), ke: rpLog(sudah + nominal),
    });

    revalidatePath(`/vendor/${kontrak.vendor.id}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${kontrak.project.kode}`);
  });
}

/**
 * Hapus satu pembayaran kontrak.
 *
 * Pembayaran kontrak tersimpan sebagai Expense bertaut `contractId`. Modul
 * Keuangan sengaja TIDAK lagi mengizinkan hapus baris tertaut lewat jalur
 * generiknya (bisa merusak invariant sisa kontrak), jadi inilah satu-satunya
 * pintu hapusnya — dijaga izin "keuangan", sama seperti mencatatnya.
 */
export async function hapusPembayaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true, total: true, projectId: true, contractId: true,
        contract: {
          select: {
            kode: true, vendorId: true,
            vendor: { select: { nama: true } },
            project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) return;
    if (!lama.contractId || !lama.contract) {
      throw new GagalIzin("Pengeluaran ini bukan pembayaran kontrak.");
    }

    const pengguna = await izinkan("keuangan", lama.projectId);

    await prisma.expense.delete({ where: { id } });

    await catat({
      pengguna, projectId: lama.projectId,
      objek: `Kontrak ${lama.contract.kode} · ${lama.contract.vendor.nama}`,
      aksi: "Hapus pembayaran",
      dari: rpLog(lama.total), ke: "dihapus",
    });

    revalidatePath(`/vendor/${lama.contract.vendorId}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${lama.contract.project.kode}`);
  });
}

// ===========================================================================
// VENDOR
// ===========================================================================

/**
 * Vendor tidak menempel pada satu proyek — satu vendor mengerjakan beberapa
 * proyek — jadi izinnya diperiksa tanpa `projectId`.
 */
const LABEL_VENDOR = {
  nama: "Nama", bidang: "Bidang", kontak: "Kontak",
  alamat: "Alamat", sejak: "Vendor sejak", status: "Status",
};

function bacaVendor(form: FormData) {
  const tahunIni = new Date().getFullYear();
  return {
    nama: teks(form, "nama", true),
    bidang: teks(form, "bidang", true),
    kontak: teks(form, "kontak", true),
    alamat: teks(form, "alamat", true),
    sejak: angka(form, "sejak", { min: 1900, max: tahunIni, wajib: true }),
    status: pilihan(form, "status", STATUS_VENDOR),
  };
}

export async function tambahVendor(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan("progress");
    const data = bacaVendor(form);

    const bentrok = await prisma.vendor.count({ where: { nama: data.nama } });
    if (bentrok) throw new GagalIzin(`Vendor bernama "${data.nama}" sudah terdaftar.`);

    await prisma.vendor.create({ data });

    await catat({
      pengguna,
      objek: `Vendor ${data.nama}`,
      aksi: "Tambah vendor",
      ke: `${data.bidang} · sejak ${data.sejak}`,
    });

    revalidatePath("/vendor");
  });
}

export async function ubahVendor(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan("progress");

    const lama = await prisma.vendor.findUnique({ where: { id } });
    if (!lama) throw new GagalIzin("Vendor tidak ditemukan.");

    const data = bacaVendor(form);
    if (data.nama !== lama.nama) {
      const bentrok = await prisma.vendor.count({ where: { nama: data.nama } });
      if (bentrok) throw new GagalIzin(`Vendor bernama "${data.nama}" sudah terdaftar.`);
    }

    await prisma.vendor.update({ where: { id }, data });

    const jml = await catatDiff({
      pengguna,
      objek: `Vendor ${lama.nama}`,
      sebelum: lama,
      sesudah: data,
      label: LABEL_VENDOR,
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${id}`);
    if (jml === 0) return "Tidak ada yang berubah.";
    return `${jml} perubahan tersimpan.`;
  });
}

/**
 * Hapus vendor.
 *
 * Vendor yang masih punya kontrak, tender, atau alat sewa tidak boleh dihapus:
 * riwayat kontrak akan kehilangan pemiliknya. Untuk berhenti memakai vendor,
 * ubah statusnya menjadi Nonaktif.
 */
export async function hapusVendor(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true, nama: true,
        _count: { select: { contracts: true, rabPembanding: true, equipmentSewa: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("progress");

    const { contracts, rabPembanding, equipmentSewa } = lama._count;
    if (contracts + rabPembanding + equipmentSewa > 0) {
      throw new GagalIzin(
        `Vendor "${lama.nama}" masih terkait ${contracts} kontrak, ${rabPembanding} perbandingan RAB, ` +
          `dan ${equipmentSewa} alat sewa. Ubah statusnya menjadi Nonaktif alih-alih menghapusnya.`,
      );
    }

    await prisma.vendor.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `Vendor ${lama.nama}`,
      aksi: "Hapus vendor",
      dari: lama.nama,
      ke: "dihapus",
    });

    revalidatePath("/vendor");
  });
}

// ===========================================================================
// KONTRAK
// ===========================================================================

/**
 * Buat kontrak vendor.
 *
 * Unit atau item sarpras yang tercakup dipilih saat pembuatan, karena itulah
 * yang menentukan ke mana pembayarannya dialokasikan pada laporan realisasi.
 * Kontrak tanpa cakupan tetap sah — nilainya lalu tidak dialokasikan ke mana
 * pun dan hanya muncul sebagai biaya level proyek.
 */
async function bacaKontrak(form: FormData, projectId: string) {
  const jenis = pilihan(form, "jenis", JENIS_KONTRAK);
  const mulai = String(form.get("mulai") ?? "").trim();
  const tgl = mulai ? new Date(mulai) : new Date();
  if (Number.isNaN(tgl.getTime())) throw new GagalIzin("Tanggal mulai tidak sah.");

  const cakupan = [
    ...new Set(form.getAll("cakupanId").map((v) => String(v).trim()).filter(Boolean)),
  ];

  if (cakupan.length > 0) {
    const sah =
      jenis === "Unit"
        ? await prisma.unit.count({ where: { id: { in: cakupan }, projectId } })
        : await prisma.infrastructure.count({ where: { id: { in: cakupan }, projectId } });
    if (sah !== cakupan.length) {
      throw new GagalIzin("Ada item cakupan yang bukan milik proyek ini.");
    }
  }

  return {
    jenis,
    cakupan,
    data: {
      jenis,
      jenisBiaya: pilihan(form, "jenisBiaya", JENIS_BIAYA),
      deskripsi: teks(form, "deskripsi", true),
      nominal: angka(form, "nominal", { min: 1, wajib: true }),
      retensiPct: angka(form, "retensiPct", { min: 0, max: 100 }),
      jatuhTempoBln: angka(form, "jatuhTempoBln", { min: 0 }),
      mulai: tgl,
    },
  };
}

export async function tambahKontrak(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const vendorId = teks(form, "vendorId", true);
    const kodeProyek = teks(form, "kodeProyek", true);
    const projectId = await idProyekDariKode(kodeProyek);
    const pengguna = await izinkan("progress", projectId);

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, nama: true, status: true },
    });
    if (!vendor) throw new GagalIzin("Vendor tidak ditemukan.");
    if (vendor.status !== "Aktif") {
      throw new GagalIzin(`Vendor "${vendor.nama}" berstatus Nonaktif — aktifkan dulu sebelum membuat kontrak.`);
    }

    const kode = teks(form, "kode", true).toUpperCase();
    const bentrok = await prisma.contract.count({ where: { kode } });
    if (bentrok) throw new GagalIzin(`Kode kontrak "${kode}" sudah dipakai.`);

    const { jenis, cakupan, data } = await bacaKontrak(form, projectId);

    // Kontrak tidak sah tanpa SPK, jadi berkasnya diminta di formulir yang
    // sama — bukan diunggah belakangan, yang membuka celah kontrak berjalan
    // tanpa dasar tertulis.
    const spk = form.get("spk");
    if (!(spk instanceof File) || spk.size === 0) {
      throw new GagalIzin("Dokumen SPK wajib diunggah saat membuat kontrak.");
    }
    const namaFile = bersihkanNamaFile(spk.name);
    periksaBerkas(namaFile, spk.type, spk.size);
    const tersimpan = await simpanBerkas(await spk.arrayBuffer(), namaFile);

    // Dokumen dibuat lebih dulu lalu ditunjuk lewat kolom id: Prisma tidak
    // mengizinkan relasi bersarang dicampur dengan skalar `projectId` /
    // `vendorId` dalam satu create.
    const dokumen = await prisma.document.create({
      data: {
        kategori: "spk",
        judul: `SPK ${kode} · ${vendor.nama}`,
        versions: {
          create: {
            revisi: "R1",
            namaFile,
            ukuranByte: tersimpan.ukuranByte,
            objectKey: tersimpan.objectKey,
            diunggahOlehId: pengguna.id,
          },
        },
      },
    });

    await prisma.contract.create({
      data: {
        ...data, kode, projectId, vendorId, docSpkId: dokumen.id,
        ...(jenis === "Unit"
          ? { units: { create: cakupan.map((unitId) => ({ unitId })) } }
          : { infrastructures: { create: cakupan.map((infrastructureId) => ({ infrastructureId })) } }),
      },
    });

    await catat({
      pengguna, projectId,
      objek: `Kontrak ${kode} · ${vendor.nama}`,
      aksi: "Buat kontrak",
      ke:
        `${data.deskripsi} — ${rpLog(data.nominal)} · ${cakupan.length} ` +
        `${jenis === "Unit" ? "unit" : "item sarpras"} · SPK ${namaFile}`,
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${vendorId}`);
    revalidatePath(`/keuangan/${kodeProyek.toUpperCase()}`);
  });
}

/**
 * Ubah kontrak. Cakupan unit/sarpras tidak ikut disunting di sini — mengubah
 * cakupan menggeser alokasi biaya yang sudah tercatat, jadi itu keputusan
 * tersendiri yang lebih baik dilakukan lewat pembuatan kontrak baru.
 */
export async function ubahKontrak(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true, kode: true, projectId: true, vendorId: true, jenis: true,
        jenisBiaya: true, deskripsi: true, nominal: true, retensiPct: true,
        jatuhTempoBln: true, mulai: true,
        project: { select: { kode: true } },
      },
    });
    if (!lama) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("progress", lama.projectId);

    const mulai = String(form.get("mulai") ?? "").trim();
    const tgl = mulai ? new Date(mulai) : lama.mulai;
    if (Number.isNaN(tgl.getTime())) throw new GagalIzin("Tanggal mulai tidak sah.");

    const data = {
      jenisBiaya: pilihan(form, "jenisBiaya", JENIS_BIAYA),
      deskripsi: teks(form, "deskripsi", true),
      nominal: angka(form, "nominal", { min: 1, wajib: true }),
      retensiPct: angka(form, "retensiPct", { min: 0, max: 100 }),
      jatuhTempoBln: angka(form, "jatuhTempoBln", { min: 0 }),
      mulai: tgl,
    };

    await prisma.contract.update({ where: { id }, data });

    const jml = await catatDiff({
      pengguna, projectId: lama.projectId,
      objek: `Kontrak ${lama.kode}`,
      sebelum: lama,
      sesudah: data,
      label: {
        jenisBiaya: "Jenis biaya", deskripsi: "Deskripsi", nominal: "Nilai kontrak",
        retensiPct: "Retensi", jatuhTempoBln: "Masa pemeliharaan", mulai: "Mulai",
      },
      format: { nominal: (v) => rpLog(Number(v)) },
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${lama.vendorId}`);
    revalidatePath(`/keuangan/${lama.project.kode}`);
    if (jml === 0) return "Tidak ada yang berubah.";
    return `${jml} perubahan tersimpan.`;
  });
}

/**
 * Hapus kontrak.
 *
 * Kontrak yang sudah punya pembayaran tidak boleh dihapus — uang yang sudah
 * keluar akan hilang jejaknya. Kontrak batal yang belum dibayar boleh dihapus.
 */
export async function hapusKontrak(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true, kode: true, projectId: true, vendorId: true, deskripsi: true, nominal: true,
        project: { select: { kode: true } },
        _count: { select: { expenses: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("progress", lama.projectId);

    if (lama._count.expenses > 0) {
      throw new GagalIzin(
        `Kontrak ${lama.kode} sudah punya ${lama._count.expenses} pembayaran tercatat. ` +
          `Hapus pembayaran itu lebih dulu bila kontrak ini memang batal.`,
      );
    }

    await prisma.contract.delete({ where: { id } });

    await catat({
      pengguna, projectId: lama.projectId,
      objek: `Kontrak ${lama.kode}`,
      aksi: "Hapus kontrak",
      dari: `${lama.deskripsi} — ${rpLog(lama.nominal)}`,
      ke: "dihapus",
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${lama.vendorId}`);
    revalidatePath(`/keuangan/${lama.project.kode}`);
  });
}
