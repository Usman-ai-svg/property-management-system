"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { bolehUbah } from "@/lib/auth/rbac";
import {
  JENIS_SARPRAS, STATUS_JUAL, STATUS_PEMBANGUNAN, STATUS_SARPRAS,
} from "@/lib/domain/enums";
import { buatBoqDariTemplate, buatRapDariTemplate, hitungUpahRap, rabAcuan } from "@/lib/calc/boq";

/** Segarkan halaman proyek dan ringkasan setelah perubahan. */
function segarkan(kode: string) {
  revalidatePath(`/master/${kode}`);
  revalidatePath("/master");
  revalidatePath("/");
}

// ===========================================================================
// DESKRIPSI PROYEK
// ===========================================================================

export async function ubahDeskripsiProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", lama.id);

    const baru = {
      nama: teks(form, "nama", true),
      alamat: teks(form, "alamat", true),
      kelurahan: teks(form, "kelurahan", true),
      kecamatan: teks(form, "kecamatan", true),
      kota: teks(form, "kota", true),
      provinsi: teks(form, "provinsi", true),
      luasKavlingEfektif: angka(form, "luasKavlingEfektif", { min: 0 }),
      luasSarana: angka(form, "luasSarana", { min: 0 }),
      luasPrasarana: angka(form, "luasPrasarana", { min: 0 }),
      luasRth: angka(form, "luasRth", { min: 0 }),
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode}`,
      sebelum: lama, sesudah: baru,
      label: {
        nama: "Nama", alamat: "Alamat", kelurahan: "Kelurahan", kecamatan: "Kecamatan",
        kota: "Kota", provinsi: "Provinsi",
        luasKavlingEfektif: "Luas kavling efektif", luasSarana: "Luas sarana",
        luasPrasarana: "Luas prasarana", luasRth: "Luas RTH",
      },
    });

    segarkan(kode);
  });
}

/**
 * Biaya perolehan lahan terpisah dari deskripsi karena berada di bawah izin
 * "hargaRabRap" — peran yang boleh menyunting alamat belum tentu boleh
 * menyentuh angka pembelian tanah.
 */
export async function ubahBiayaLahan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.id);

    const baru = {
      hargaPerM2: angka(form, "hargaPerM2", { min: 0 }),
      biayaPembelian: angka(form, "biayaPembelian", { min: 0 }),
      biayaNotaris: angka(form, "biayaNotaris", { min: 0 }),
      biayaBalikNama: angka(form, "biayaBalikNama", { min: 0 }),
      biayaLegalLain: angka(form, "biayaLegalLain", { min: 0 }),
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Biaya lahan`,
      sebelum: lama, sesudah: baru,
      label: {
        hargaPerM2: "Harga per m²", biayaPembelian: "Biaya pembelian",
        biayaNotaris: "Notaris", biayaBalikNama: "Balik nama", biayaLegalLain: "Legal lain-lain",
      },
      format: {
        hargaPerM2: rpLog, biayaPembelian: rpLog, biayaNotaris: rpLog,
        biayaBalikNama: rpLog, biayaLegalLain: rpLog,
      },
    });

    segarkan(kode);
  });
}

// ===========================================================================
// LEGALITAS
// ===========================================================================

export async function simpanLegalitas(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);
    const id = teksOpsional(form, "id");

    const proyek = await prisma.project.findUnique({ where: { kode }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", proyek.id);

    const data = {
      nib: teks(form, "nib", true),
      sertifikat: teks(form, "sertifikat", true),
      luas: angka(form, "luas", { min: 0, wajib: true }),
    };

    if (id) {
      const lama = await prisma.legality.findUnique({ where: { id } });
      if (!lama || lama.projectId !== proyek.id) throw new GagalIzin("Legalitas tidak ditemukan.");

      await prisma.legality.update({ where: { id }, data });
      await catatDiff({
        pengguna, projectId: proyek.id, objek: `Legalitas ${lama.nib}`,
        sebelum: lama, sesudah: data,
        label: { nib: "NIB", sertifikat: "Sertifikat", luas: "Luas" },
      });
    } else {
      await prisma.legality.create({ data: { ...data, projectId: proyek.id } });
      await catat({
        pengguna, projectId: proyek.id, objek: `Legalitas ${data.nib}`,
        aksi: "Tambah legalitas", ke: `${data.sertifikat} — ${data.luas.toLocaleString("id-ID")} m²`,
      });
    }

    segarkan(kode);
  });
}

export async function hapusLegalitas(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const lama = await prisma.legality.findUnique({
    where: { id },
    select: { id: true, nib: true, sertifikat: true, projectId: true, project: { select: { kode: true } } },
  });
  if (!lama) return;

  const pengguna = await izinkan("deskripsi", lama.projectId);

  await prisma.legality.delete({ where: { id } });
  await catat({
    pengguna, projectId: lama.projectId, objek: `Legalitas ${lama.nib}`,
    aksi: "Hapus legalitas", dari: lama.sertifikat,
  });

  segarkan(lama.project.kode);
}

// ===========================================================================
// TIPE UNIT
// ===========================================================================

export async function simpanTipeUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);
    const id = teksOpsional(form, "id");

    const proyek = await prisma.project.findUnique({ where: { kode }, select: { id: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("dokumenTeknis", proyek.id);

    const data = {
      kode: teks(form, "kodeTipe", true).toUpperCase(),
      nama: teks(form, "nama", true),
      luasBangunan: angka(form, "luasBangunan", { min: 1, wajib: true }),
      luasTanah: angka(form, "luasTanah", { min: 1, wajib: true }),
    };

    if (id) {
      const lama = await prisma.unitType.findUnique({
        where: { id },
        include: { _count: { select: { units: true } } },
      });
      if (!lama || lama.projectId !== proyek.id) throw new GagalIzin("Tipe unit tidak ditemukan.");

      // Mengubah luas bangunan TIDAK menghitung ulang RAB unit yang sudah ada —
      // baris BOQ mereka adalah snapshot. Perubahan ini hanya berlaku untuk
      // unit yang dibuat sesudahnya.
      await prisma.unitType.update({ where: { id }, data });
      const jml = await catatDiff({
        pengguna, projectId: proyek.id, objek: `Tipe unit ${lama.kode}`,
        sebelum: lama, sesudah: data,
        label: { kode: "Kode", nama: "Nama", luasBangunan: "Luas bangunan", luasTanah: "Luas tanah" },
      });

      if (jml > 0 && lama.luasBangunan !== data.luasBangunan && lama._count.units > 0) {
        return `Tersimpan. Catatan: ${lama._count.units} unit yang sudah ada tetap memakai RAB lamanya — baris BOQ mereka adalah snapshot.`;
      }
    } else {
      const bentrok = await prisma.unitType.findFirst({
        where: { projectId: proyek.id, kode: data.kode },
        select: { id: true },
      });
      if (bentrok) throw new GagalIzin(`Kode tipe "${data.kode}" sudah dipakai di proyek ini.`);

      await prisma.unitType.create({ data: { ...data, projectId: proyek.id } });
      await catat({
        pengguna, projectId: proyek.id, objek: `Tipe unit ${data.kode}`,
        aksi: "Tambah tipe unit", ke: `${data.nama} — LB ${data.luasBangunan} m², LT ${data.luasTanah} m²`,
      });
    }

    segarkan(kode);
  });
}

export async function hapusTipeUnit(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const lama = await prisma.unitType.findUnique({
    where: { id },
    select: {
      id: true, kode: true, nama: true, projectId: true,
      project: { select: { kode: true } },
      _count: { select: { units: true } },
    },
  });
  if (!lama) return;

  const pengguna = await izinkan("dokumenTeknis", lama.projectId);

  // Tipe yang masih dipakai unit tidak boleh dihapus — menghapusnya akan
  // memutus rujukan unit ke luas bangunan dan namanya.
  if (lama._count.units > 0) {
    throw new GagalIzin(
      `Tipe "${lama.nama}" masih dipakai ${lama._count.units} unit. Hapus atau pindahkan unit tersebut lebih dulu.`,
    );
  }

  await prisma.unitType.delete({ where: { id } });
  await catat({
    pengguna, projectId: lama.projectId, objek: `Tipe unit ${lama.kode}`,
    aksi: "Hapus tipe unit", dari: lama.nama,
  });

  segarkan(lama.project.kode);
}

// ===========================================================================
// UNIT
// ===========================================================================

export async function ubahUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unit.findUnique({
      where: { id },
      include: { project: { select: { kode: true } }, phase: { select: { kode: true } } },
    });
    if (!lama) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("progress", lama.projectId);

    const baru = {
      statusPembangunan: pilihan(form, "statusPembangunan", STATUS_PEMBANGUNAN),
      statusJual: pilihan(form, "statusJual", STATUS_JUAL),
      progress: angka(form, "progress", { min: 0, max: 100 }),
      luasTanah: angka(form, "luasTanah", { min: 1, wajib: true }),
    };

    await prisma.unit.update({ where: { id }, data: baru });

    // Perubahan progres dicatat sebagai titik riwayat, bukan menimpa angka
    // sebelumnya — opname mingguan membandingkan dua titik ini.
    if (baru.progress !== lama.progress) {
      await prisma.progressRecord.create({
        data: {
          unitId: id, tanggal: new Date(), progress: baru.progress,
          catatan: "Diubah lewat aplikasi", dicatatOleh: pengguna.nama,
        },
      });
    }

    await catatDiff({
      pengguna, projectId: lama.projectId,
      objek: `Unit ${lama.phase.kode}-${lama.nomor}`,
      sebelum: lama, sesudah: baru,
      label: {
        statusPembangunan: "Status bangun", statusJual: "Status jual",
        progress: "Progres", luasTanah: "Luas tanah",
      },
      format: { progress: (v) => `${v}%` },
    });

    segarkan(lama.project.kode);
  });
}

export async function tambahUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const proyek = await prisma.project.findUnique({ where: { kode }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("daftarUnit", proyek.id);

    const phaseId = teks(form, "phaseId", true);
    const unitTypeId = teks(form, "unitTypeId", true);

    const [fase, tipe] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, kode: true, projectId: true } }),
      prisma.unitType.findUnique({ where: { id: unitTypeId }, select: { id: true, luasBangunan: true, luasTanah: true, projectId: true } }),
    ]);
    if (!fase || fase.projectId !== proyek.id) throw new GagalIzin("Fase tidak sah.");
    if (!tipe || tipe.projectId !== proyek.id) throw new GagalIzin("Tipe unit tidak sah.");

    // Nomor unit berikutnya dalam fase tersebut.
    const terakhir = await prisma.unit.findFirst({
      where: { phaseId: fase.id },
      orderBy: { nomor: "desc" },
      select: { nomor: true },
    });
    const nomor = (terakhir?.nomor ?? 0) + 1;
    const kodeUnit = `${proyek.kode}-${fase.kode}-${nomor}`;

    // Snapshot BOQ & RAP dibuat SEKALI di sini, dari template yang berlaku
    // saat ini. Sesudah tersimpan, unit tidak lagi membaca template.
    await prisma.unit.create({
      data: {
        kode: kodeUnit, projectId: proyek.id, phaseId: fase.id, unitTypeId: tipe.id,
        nomor, luasTanah: tipe.luasTanah,
        statusPembangunan: "Belum terbangun", statusJual: "Tersedia", progress: 0,
        hargaJual: Math.round(rabAcuan(tipe.luasBangunan) * 1.42),
        rapUpah: hitungUpahRap(tipe.luasBangunan),
        boqItems: { create: buatBoqDariTemplate(tipe.luasBangunan) },
        rapItems: { create: buatRapDariTemplate(tipe.luasBangunan) },
      },
    });

    await catat({
      pengguna, projectId: proyek.id, objek: `Unit ${fase.kode}-${nomor}`,
      aksi: "Tambah unit", ke: `${kodeUnit} — RAB ${rpLog(rabAcuan(tipe.luasBangunan))}`,
    });

    segarkan(kode);
    return `Unit ${kodeUnit} dibuat dengan salinan BOQ dan RAP dari template saat ini.`;
  });
}

export async function hapusUnit(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const lama = await prisma.unit.findUnique({
    where: { id },
    select: {
      id: true, kode: true, nomor: true, projectId: true, progress: true,
      phase: { select: { kode: true } }, project: { select: { kode: true } },
    },
  });
  if (!lama) return;

  const pengguna = await izinkan("daftarUnit", lama.projectId);

  if (lama.progress > 0) {
    throw new GagalIzin(
      `Unit ${lama.kode} sudah berjalan ${lama.progress}%. Unit yang sudah dibangun tidak boleh dihapus — ubah statusnya bila perlu.`,
    );
  }

  await prisma.unit.delete({ where: { id } });
  await catat({
    pengguna, projectId: lama.projectId, objek: `Unit ${lama.phase.kode}-${lama.nomor}`,
    aksi: "Hapus unit", dari: lama.kode,
  });

  segarkan(lama.project.kode);
}

// ===========================================================================
// BARIS BOQ — inti penyesuaian harga
// ===========================================================================

export async function ubahBarisBoq(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unitBoqItem.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true, nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) throw new GagalIzin("Baris BOQ tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.unit.projectId);

    const baru = {
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      volume: angka(form, "volume", { min: 0, wajib: true }),
      hargaSatuan: angka(form, "hargaSatuan", { min: 0, wajib: true }),
      spesifikasi: teksOpsional(form, "spesifikasi"),
    };

    await prisma.unitBoqItem.update({ where: { id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.unit.projectId,
      objek: `Unit ${lama.unit.phase.kode}-${lama.unit.nomor} · RAB · ${lama.uraian}`,
      sebelum: lama, sesudah: baru,
      label: {
        uraian: "Uraian", satuan: "Satuan", volume: "Volume",
        hargaSatuan: "Harga satuan", spesifikasi: "Spesifikasi",
      },
      format: { hargaSatuan: rpLog },
    });

    segarkan(lama.unit.project.kode);
  });
}

export async function ubahBarisRap(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unitRapItem.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) throw new GagalIzin("Baris RAP tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.unit.projectId);

    const baru = {
      nama: teks(form, "nama", true),
      satuan: teks(form, "satuan", true),
      volume: angka(form, "volume", { min: 0, wajib: true }),
      hargaSatuan: angka(form, "hargaSatuan", { min: 0, wajib: true }),
      keterangan: teksOpsional(form, "keterangan"),
    };

    await prisma.unitRapItem.update({ where: { id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.unit.projectId,
      objek: `Unit ${lama.unit.phase.kode}-${lama.unit.nomor} · RAP · ${lama.nama}`,
      sebelum: lama, sesudah: baru,
      label: {
        nama: "Nama", satuan: "Satuan", volume: "Volume",
        hargaSatuan: "Harga satuan", keterangan: "Keterangan",
      },
      format: { hargaSatuan: rpLog },
    });

    segarkan(lama.unit.project.kode);
  });
}

/** Upah tenaga kerja pada RAP unit — pasangan dari rincian materialnya. */
export async function ubahUpahRap(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, rapUpah: true, hargaJual: true, projectId: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!lama) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.projectId);

    const baru = {
      rapUpah: angka(form, "rapUpah", { min: 0 }),
      hargaJual: angka(form, "hargaJual", { min: 0 }),
    };

    await prisma.unit.update({ where: { id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.projectId,
      objek: `Unit ${lama.phase.kode}-${lama.nomor}`,
      sebelum: lama, sesudah: baru,
      label: { rapUpah: "Upah RAP", hargaJual: "Harga jual" },
      format: { rapUpah: rpLog, hargaJual: rpLog },
    });

    segarkan(lama.project.kode);
  });
}

// ===========================================================================
// SARANA & PRASARANA
// ===========================================================================

export async function simpanSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kodeProyek = teks(form, "kode", true);
    const id = teksOpsional(form, "id");

    const proyek = await prisma.project.findUnique({ where: { kode: kodeProyek }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("daftarSarpras", proyek.id);

    // RAB berada di bawah izin terpisah. Peran yang boleh mengelola daftar
    // sarpras belum tentu boleh menyentuh angkanya — bila tidak berhak, kolom
    // rab tidak ikut diubah sama sekali (bukan ditimpa nol).
    const bolehHarga = bolehUbah(pengguna, "hargaRabRap");

    const data = {
      nama: teks(form, "nama", true),
      jenis: pilihan(form, "jenis", JENIS_SARPRAS),
      volume: teks(form, "volume", true),
      status: pilihan(form, "status", STATUS_SARPRAS),
      progress: angka(form, "progress", { min: 0, max: 100 }),
      ...(bolehHarga ? { rab: angka(form, "rab", { min: 0 }) } : {}),
    };

    if (id) {
      const lama = await prisma.infrastructure.findUnique({ where: { id } });
      if (!lama || lama.projectId !== proyek.id) throw new GagalIzin("Item sarpras tidak ditemukan.");

      await prisma.infrastructure.update({ where: { id }, data });

      if (data.progress !== lama.progress) {
        await prisma.progressRecord.create({
          data: {
            infrastructureId: id, tanggal: new Date(), progress: data.progress,
            catatan: "Diubah lewat aplikasi", dicatatOleh: pengguna.nama,
          },
        });
      }

      await catatDiff({
        pengguna, projectId: proyek.id, objek: `Sarpras · ${lama.nama}`,
        sebelum: lama, sesudah: data,
        label: {
          nama: "Nama", jenis: "Jenis", volume: "Volume",
          status: "Status", progress: "Progres", rab: "RAB",
        },
        format: { rab: rpLog, progress: (v) => `${v}%` },
      });
    } else {
      const urut = await prisma.infrastructure.count({ where: { projectId: proyek.id } });
      await prisma.infrastructure.create({
        data: { ...data, rab: data.rab ?? 0, projectId: proyek.id, kode: `${proyek.kode}-S${urut + 1}` },
      });
      await catat({
        pengguna, projectId: proyek.id, objek: `Sarpras · ${data.nama}`,
        aksi: "Tambah sarpras",
        ke: `${data.jenis} — ${data.volume}` + (bolehHarga ? `, RAB ${rpLog(data.rab)}` : ""),
      });
    }

    segarkan(kodeProyek);
  });
}

export async function hapusSarpras(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const lama = await prisma.infrastructure.findUnique({
    where: { id },
    select: {
      id: true, nama: true, progress: true, projectId: true,
      project: { select: { kode: true } },
      _count: { select: { contractItems: true } },
    },
  });
  if (!lama) return;

  const pengguna = await izinkan("daftarSarpras", lama.projectId);

  if (lama._count.contractItems > 0) {
    throw new GagalIzin(
      `"${lama.nama}" masih tercakup dalam ${lama._count.contractItems} kontrak. Lepaskan dari kontrak lebih dulu.`,
    );
  }

  await prisma.infrastructure.delete({ where: { id } });
  await catat({
    pengguna, projectId: lama.projectId, objek: `Sarpras · ${lama.nama}`,
    aksi: "Hapus sarpras", dari: `progres ${lama.progress}%`,
  });

  segarkan(lama.project.kode);
}
