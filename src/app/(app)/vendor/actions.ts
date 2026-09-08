"use server";

import { segmen } from "@/lib/adaptor/rute";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, idProyekDariKode, izinkan, jalankan, pilihan, pilihanOpsional,
  teks, wajibLolos,
} from "@/lib/actions/guard";
import { bersihkanNamaFile, periksaBerkas, simpanBerkas } from "@/lib/storage";
import { simpanBuktiOpsional } from "@/lib/actions/bukti";
import { alokasiPembayaran, periksaAlokasi, totalTerbayar, totalVoDisetujui } from "@/lib/calc/keuangan";
import { nominalVo, progresSpk } from "@/lib/calc/kontrak-boq";
import {
  periksaHapusPembayaranKontrak, periksaHapusVendor, periksaNilaiVo,
  periksaPembayaranKontrak, periksaTambahVo, periksaTandaiSelesai, periksaUbahStatusVo,
  periksaIsiKontrak, periksaTambahKontrak, periksaVendor, type MasukanKontrak,
} from "@/lib/kontrak/vendor";
import { nomorKontrakBaru } from "@/lib/data/vendor";
import {
  JENIS_BIAYA_KONTRAK, JENIS_KONTRAK, METODE_TUNAI, peruntukanDariJenisKontrak, POS_HPP, STATUS_VENDOR,
  STATUS_VO, type JenisKontrak,
} from "@/lib/domain/enums";

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
        units: { select: { unitId: true } },
        infrastructures: { select: { infrastructureId: true } },
        _count: { select: { variationOrders: true } },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("progress", kontrak.projectId);

    const uraianVo = teks(form, "uraian", true);
    const status = pilihan(form, "status", STATUS_VO);

    // Baris pekerjaan VO — array sejajar per indeks. Objek "unit:<id>"/"sarpras:<id>".
    // Berbeda dari BOQ template: tiap baris VO melekat ke SATU objek, jadi VO ikut
    // masuk Nilai BOQ Terinci objek itu (dan nilai kontrak tetap sama dgn BOQ).
    const objek = form.getAll("itemObjek").map(String);
    const grup = form.getAll("itemGrup").map(String);
    const uraian = form.getAll("itemUraian").map(String);
    const satuan = form.getAll("itemSatuan").map(String);
    const volume = form.getAll("itemVolume").map((v) => Number(String(v)));
    const harga = form.getAll("itemHarga").map((v) => Number(String(v)));

    const unitSet = new Set(kontrak.units.map((u) => u.unitId));
    const infraSet = new Set(kontrak.infrastructures.map((s) => s.infrastructureId));

    const items: {
      unitId: string | null; infrastructureId: string | null;
      grup: string; uraian: string; satuan: string; volume: number; hargaSatuan: number; urutan: number;
    }[] = [];
    for (let i = 0; i < objek.length; i++) {
      const ob = (objek[i] ?? "").trim();
      const ur = (uraian[i] ?? "").trim();
      if (!ob && !ur) continue; // baris kosong diabaikan
      const pisah = ob.indexOf(":");
      const jenisOb = pisah >= 0 ? ob.slice(0, pisah) : "";
      const objId = pisah >= 0 ? ob.slice(pisah + 1) : "";
      const unitId = jenisOb === "unit" ? objId : null;
      const infrastructureId = jenisOb === "sarpras" ? objId : null;
      const vol = volume[i];
      const hrg = harga[i];
      items.push({
        unitId, infrastructureId,
        grup: (grup[i] ?? "").trim() || "VO",
        uraian: ur, satuan: (satuan[i] ?? "").trim() || "ls",
        volume: vol, hargaSatuan: hrg, urutan: i + 1,
      });
    }

    wajibLolos(
      periksaTambahVo(
        { contractId, uraian: uraianVo, status, items },
        {
          unitCakupan: [...unitSet].filter((x): x is string => Boolean(x)),
          sarprasCakupan: [...infraSet].filter((x): x is string => Boolean(x)),
        },
      ),
    );

    // Nominal VO = TURUNAN dari baris-barisnya (bisa negatif untuk pekerjaan kurang).
    const nominal = nominalVo(items);
    wajibLolos(periksaNilaiVo(nominal));

    const nomor = `VO-${String(kontrak._count.variationOrders + 1).padStart(2, "0")}`;

    await prisma.variationOrder.create({
      data: {
        contractId, nomor, tanggal: new Date(), uraian: uraianVo, nominal, status,
        items: { create: items },
      },
    });

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `Kontrak ${kontrak.kode} · ${kontrak.vendor.nama}`,
      aksi: "Tambah Variation Order",
      ke: `${nomor} — ${uraianVo} · ${items.length} baris · ${nominal >= 0 ? "+" : "−"}${rpLog(Math.abs(nominal))} (${status})`,
    });

    revalidatePath(`/vendor/${kontrak.vendor.id}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${segmen(kontrak.project.kode)}`);
    return `${nomor} dibuat — ${items.length} baris (${nominal >= 0 ? "+" : "−"}Rp ${Math.abs(nominal).toLocaleString("id-ID")}).`;
  });
}

/** Hapus sebuah Variation Order beserta seluruh baris pekerjaannya. */
export async function hapusVo(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const vo = await prisma.variationOrder.findUnique({
      where: { id },
      select: {
        id: true, nomor: true,
        contract: { select: { projectId: true, vendorId: true, kode: true, project: { select: { kode: true } } } },
      },
    });
    if (!vo) return;
    const pengguna = await izinkan("progress", vo.contract.projectId);

    await prisma.variationOrder.delete({ where: { id } });
    await catat({
      pengguna, projectId: vo.contract.projectId,
      objek: `Kontrak ${vo.contract.kode}`, aksi: "Hapus Variation Order", dari: vo.nomor, ke: "dihapus",
    });
    revalidatePath(`/vendor/${vo.contract.vendorId}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${segmen(vo.contract.project.kode)}`);
  });
}

/**
 * Ubah status VO (Diajukan/Disetujui/Ditolak). Hanya VO "Disetujui" yang baris
 * pekerjaannya ikut menghitung Nilai BOQ Terinci & opname — jadi menyetujui VO =
 * memasukkan baris-barisnya ke nilai kontrak.
 */
export async function ubahStatusVo(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const status = teks(form, "status", true);
    wajibLolos(periksaUbahStatusVo({ id, status }));
    const vo = await prisma.variationOrder.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, status: true,
        contract: { select: { projectId: true, vendorId: true, kode: true, project: { select: { kode: true } } } },
      },
    });
    if (!vo) throw new GagalIzin("VO tidak ditemukan.");
    const pengguna = await izinkan("progress", vo.contract.projectId);
    if (vo.status === status) return "Status tidak berubah.";

    await prisma.variationOrder.update({ where: { id }, data: { status } });
    await catat({
      pengguna, projectId: vo.contract.projectId,
      objek: `Kontrak ${vo.contract.kode} · ${vo.nomor}`, aksi: "Ubah status VO", dari: vo.status, ke: status,
    });
    revalidatePath(`/vendor/${vo.contract.vendorId}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${segmen(vo.contract.project.kode)}`);
    return `${vo.nomor} → ${status}.`;
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
    const metode = pilihanOpsional(form, "metode", METODE_TUNAI, "Transfer");
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    // Pembayaran yang melampaui nilai kontrak ditolak — kelebihan bayar pada
    // kontrak borongan jauh lebih sulit ditarik kembali daripada dicegah.
    const nilaiEfektif = kontrak.nominal + totalVoDisetujui(kontrak.variationOrders);
    const sudah = totalTerbayar(kontrak);
    wajibLolos(
      periksaPembayaranKontrak(
        { contractId, nominal, uraian, metode, tanggal: null },
        { nilaiEfektif, sudahTerbayar: sudah },
      ),
    );

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
    const peruntukan = peruntukanDariJenisKontrak(kontrak.jenis as JenisKontrak);

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
        bukti,
        buktiKey,
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
    revalidatePath(`/keuangan/${segmen(kontrak.project.kode)}`);
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
    wajibLolos(periksaHapusPembayaranKontrak({ id }, { contractId: lama.contractId }));
    if (!lama.contract) {
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
    revalidatePath(`/keuangan/${segmen(lama.contract.project.kode)}`);
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
    wajibLolos(periksaVendor(data, { namaBentrok: bentrok > 0 }, new Date().getFullYear()));

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
    wajibLolos(
      periksaHapusVendor({ id }, {
        jumlahKontrak: contracts + rabPembanding + equipmentSewa,
        nama: lama.nama,
      }),
    );

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

  const isi: MasukanKontrak = {
    jenis,
    deskripsi: teks(form, "deskripsi", true),
    jenisBiaya: teks(form, "jenisBiaya", true),
    mulai: mulai || null,
    retensiPct: angka(form, "retensiPct", { min: 0, max: 100 }),
    jatuhTempoBln: angka(form, "jatuhTempoBln", { min: 0 }),
    cakupan,
  };
  wajibLolos(periksaIsiKontrak(isi));

  return {
    jenis,
    cakupan,
    isi,
    data: {
      jenis,
      jenisBiaya: isi.jenisBiaya,
      deskripsi: isi.deskripsi,
      nominal: angka(form, "nominal", { min: 1, wajib: true }),
      retensiPct: isi.retensiPct,
      jatuhTempoBln: isi.jatuhTempoBln,
      mulai: mulai ? new Date(mulai) : new Date(),
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

    const { jenis, cakupan, data, isi } = await bacaKontrak(form, projectId);

    // Kode SPK dibuat otomatis sesuai standar {PROYEK}/{K|S}/{TAHUN}/{urut} —
    // tidak lagi diketik bebas, supaya seluruh kontrak seragam penomorannya.
    const kode = await nomorKontrakBaru(kodeProyek.toUpperCase(), jenis, data.mulai.getFullYear());

    // Kontrak tidak sah tanpa SPK, jadi berkasnya diminta di formulir yang
    // sama — bukan diunggah belakangan, yang membuka celah kontrak berjalan
    // tanpa dasar tertulis.
    const spk = form.get("spk");
    wajibLolos(
      periksaTambahKontrak(isi, {
        statusVendor: vendor.status,
        namaVendor: vendor.nama,
        adaDokumen: spk instanceof File && spk.size > 0,
      }),
    );
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
    revalidatePath(`/keuangan/${segmen(kodeProyek.toUpperCase())}`);
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
        jatuhTempoBln: true, mulai: true, tanggalSelesai: true,
        project: { select: { kode: true } },
      },
    });
    if (!lama) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("progress", lama.projectId);

    const mulai = String(form.get("mulai") ?? "").trim();
    const tgl = mulai ? new Date(mulai) : lama.mulai;
    if (Number.isNaN(tgl.getTime())) throw new GagalIzin("Tanggal mulai tidak sah.");

    // Tanggal selesai boleh dikosongkan (= belum ditandai selesai → null).
    const selesaiStr = String(form.get("tanggalSelesai") ?? "").trim();
    let tglSelesai: Date | null = null;
    if (selesaiStr) {
      tglSelesai = new Date(selesaiStr);
      if (Number.isNaN(tglSelesai.getTime())) throw new GagalIzin("Tanggal selesai tidak sah.");
    }

    const data = {
      jenisBiaya: pilihan(form, "jenisBiaya", JENIS_BIAYA_KONTRAK),
      deskripsi: teks(form, "deskripsi", true),
      nominal: angka(form, "nominal", { min: 1, wajib: true }),
      retensiPct: angka(form, "retensiPct", { min: 0, max: 100 }),
      jatuhTempoBln: angka(form, "jatuhTempoBln", { min: 0 }),
      mulai: tgl,
      tanggalSelesai: tglSelesai,
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
        tanggalSelesai: "Tanggal selesai",
      },
      format: { nominal: (v) => rpLog(Number(v)) },
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${lama.vendorId}`);
    revalidatePath(`/keuangan/${segmen(lama.project.kode)}`);
    if (jml === 0) return "Tidak ada yang berubah.";
    return `${jml} perubahan tersimpan.`;
  });
}

/**
 * Tandai kontrak selesai — menyetel `tanggalSelesai` (anchor jatuh tempo retensi).
 *
 * Hanya boleh saat Progress Vendor SPK sudah 100%, sesuai aturan bahwa penandaan
 * selesai baru "tergenerate" ketika pekerjaan benar-benar rampung. Tanggalnya
 * boleh dipilih (default hari ini) untuk mencatat tanggal serah terima riil.
 */
export async function tandaiSelesai(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const kontrak = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true, kode: true, projectId: true, vendorId: true, tanggalSelesai: true,
        boqItems: { select: { id: true, volume: true, hargaSatuan: true } },
        boqUnit: {
          select: {
            boqItemId: true, unitId: true, infrastructureId: true,
            volume: true, hargaSatuan: true, progress: true,
          },
        },
        units: { select: { unitId: true } },
        infrastructures: { select: { infrastructureId: true } },
        variationOrders: {
          where: { status: "Disetujui" },
          select: { items: { select: { unitId: true, infrastructureId: true, volume: true, hargaSatuan: true, progress: true } } },
        },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");
    const pengguna = await izinkan("progress", kontrak.projectId);

    const objekIds = [
      ...kontrak.units.map((u) => u.unitId),
      ...kontrak.infrastructures.map((s) => s.infrastructureId),
    ];
    const voItems = kontrak.variationOrders.flatMap((v) => v.items);
    const progres = progresSpk(kontrak.boqItems, kontrak.boqUnit, objekIds, voItems);
    const tglStr = String(form.get("tanggalSelesai") ?? "").trim();
    wajibLolos(
      periksaTandaiSelesai(
        { id, tanggalSelesai: tglStr || null },
        { progres, sudahSelesai: Boolean(kontrak.tanggalSelesai) },
      ),
    );
    const tgl = tglStr ? new Date(tglStr) : new Date();

    await prisma.contract.update({ where: { id }, data: { tanggalSelesai: tgl } });
    await catat({
      pengguna, projectId: kontrak.projectId, objek: `Kontrak ${kontrak.kode}`,
      aksi: "Tandai selesai", ke: tgl.toISOString().slice(0, 10),
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${kontrak.vendorId}`);
    return `Kontrak ${kontrak.kode} ditandai selesai ${tgl.toISOString().slice(0, 10)}.`;
  });
}

/** Batalkan tanda selesai — mengosongkan `tanggalSelesai`. */
export async function batalSelesai(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const kontrak = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, kode: true, projectId: true, vendorId: true },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");
    const pengguna = await izinkan("progress", kontrak.projectId);

    await prisma.contract.update({ where: { id }, data: { tanggalSelesai: null } });
    await catat({
      pengguna, projectId: kontrak.projectId, objek: `Kontrak ${kontrak.kode}`,
      aksi: "Batalkan tanda selesai",
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${kontrak.vendorId}`);
    return "Tanda selesai dibatalkan.";
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
    revalidatePath(`/keuangan/${segmen(lama.project.kode)}`);
  });
}
