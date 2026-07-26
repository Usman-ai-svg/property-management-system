"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { bersihkanNamaFile, periksaBerkas, simpanBerkas } from "@/lib/storage";
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

export async function ubahLokasiProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", lama.id);

    // Pin ditulis sebagai satu kolom "lintang, bujur" seperti pada artifact,
    // lalu dipecah ke dua kolom saat disimpan.
    const pin = teksOpsional(form, "pin");
    let pinLat = lama.pinLat;
    let pinLng = lama.pinLng;
    if (pin !== null) {
      const bagian = pin.split(",").map((x) => Number(x.trim()));
      if (bagian.length !== 2 || bagian.some((n) => !Number.isFinite(n))) {
        throw new GagalIzin('Pin lokasi harus berupa "lintang, bujur", mis. -6.4021, 106.7532');
      }
      [pinLat, pinLng] = bagian;
    }

    const baru = {
      alamat: teks(form, "alamat", true),
      kelurahan: teks(form, "kelurahan", true),
      kecamatan: teks(form, "kecamatan", true),
      kota: teks(form, "kota", true),
      provinsi: teks(form, "provinsi", true),
      pinLat,
      pinLng,
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Lokasi`,
      sebelum: lama, sesudah: baru,
      label: {
        alamat: "Alamat", kelurahan: "Kelurahan", kecamatan: "Kecamatan",
        kota: "Kota / Kabupaten", provinsi: "Provinsi",
        pinLat: "Pin lintang", pinLng: "Pin bujur",
      },
    });

    segarkan(kode);
  });
}

export async function ubahLuasLahan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", lama.id);

    const baru = {
      luasKavlingEfektif: angka(form, "luasKavlingEfektif", { min: 0 }),
      luasSarana: angka(form, "luasSarana", { min: 0 }),
      luasPrasarana: angka(form, "luasPrasarana", { min: 0 }),
      luasRth: angka(form, "luasRth", { min: 0 }),
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    const total = (x: typeof baru | typeof lama) =>
      x.luasKavlingEfektif + x.luasSarana + x.luasPrasarana + x.luasRth;

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Luas Lahan`,
      sebelum: { ...lama, total: total(lama) },
      sesudah: { ...baru, total: total(baru) },
      label: {
        luasKavlingEfektif: "Kavling efektif", luasSarana: "Sarana",
        luasPrasarana: "Prasarana", luasRth: "RTH", total: "Luas total",
      },
      format: {
        luasKavlingEfektif: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasSarana: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasPrasarana: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasRth: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        total: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
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

/**
 * Simpan seluruh baris legalitas sekaligus.
 *
 * Mengikuti artifact: satu proyek dapat memiliki lebih dari satu NIB, dan
 * seluruhnya disunting dalam satu modal — bukan satu per satu. Baris yang
 * hilang dari kiriman berarti dihapus.
 *
 * Baris yang sudah punya dokumen tidak dihapus begitu saja: dokumennya
 * dilepas lebih dulu agar riwayat revisinya tidak ikut hilang.
 */
export async function ubahLegalitas(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const proyek = await prisma.project.findUnique({
      where: { kode },
      select: { id: true, kode: true, legalitas: { select: { id: true, nib: true } } },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", proyek.id);

    let baris: { id?: string; nib: string; sertifikat: string; luas: number }[];
    try {
      baris = JSON.parse(teks(form, "baris", true));
    } catch {
      throw new GagalIzin("Data legalitas tidak terbaca.");
    }

    const sah = baris.filter((b) => b.nib?.trim());
    if (sah.length === 0) throw new GagalIzin("Isi minimal satu NIB.");

    const idDikirim = new Set(sah.map((b) => b.id).filter(Boolean));
    const dihapus = proyek.legalitas.filter((l) => !idDikirim.has(l.id));

    for (const l of dihapus) {
      await prisma.legality.delete({ where: { id: l.id } });
    }

    for (const b of sah) {
      const data = {
        nib: b.nib.trim(),
        sertifikat: (b.sertifikat ?? "").trim(),
        luas: Number(b.luas) || 0,
      };
      if (b.id) {
        await prisma.legality.update({ where: { id: b.id }, data });
      } else {
        await prisma.legality.create({ data: { ...data, projectId: proyek.id } });
      }
    }

    await catat({
      pengguna, projectId: proyek.id, objek: "Legalitas",
      aksi: "Ubah data legalitas",
      dari: `${proyek.legalitas.length} NIB`,
      ke: `${sah.length} NIB`,
    });

    segarkan(kode);
  });
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

export async function hapusTipeUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
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
  });
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

    const baru: {
      statusPembangunan: string; statusJual: string; progress: number; luasTanah: number;
      nomor?: number; phaseId?: string; unitTypeId?: string; kode?: string;
    } = {
      statusPembangunan: pilihan(form, "statusPembangunan", STATUS_PEMBANGUNAN),
      statusJual: pilihan(form, "statusJual", STATUS_JUAL),
      progress: angka(form, "progress", { min: 0, max: 100 }),
      luasTanah: angka(form, "luasTanah", { min: 1, wajib: true }),
    };

    // Nomor, fase, dan tipe hanya ikut bila formulir mengirimnya — daftar unit
    // hanya menyunting status, sedangkan halaman detail menyunting semuanya.
    const phaseId = teksOpsional(form, "phaseId");
    const unitTypeId = teksOpsional(form, "unitTypeId");
    const nomorIsian = String(form.get("nomor") ?? "").trim();

    if (phaseId || unitTypeId || nomorIsian) {
      // Mengubah tipe TIDAK menghitung ulang baris BOQ/RAP unit ini. Baris
      // tersebut adalah snapshot; yang berubah hanya rujukan tipenya.
      const [fase, tipe] = await Promise.all([
        phaseId
          ? prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, kode: true, projectId: true } })
          : null,
        unitTypeId
          ? prisma.unitType.findUnique({ where: { id: unitTypeId }, select: { id: true, projectId: true } })
          : null,
      ]);
      if (phaseId && (!fase || fase.projectId !== lama.projectId)) throw new GagalIzin("Fase tidak sah.");
      if (unitTypeId && (!tipe || tipe.projectId !== lama.projectId)) throw new GagalIzin("Tipe unit tidak sah.");

      const nomor = nomorIsian ? angka(form, "nomor", { min: 1 }) : lama.nomor;
      const kodeFase = fase?.kode ?? lama.phase.kode;
      const kodeBaru = `${lama.project.kode}-${kodeFase}-${nomor}`;

      if (kodeBaru !== lama.kode) {
        const bentrok = await prisma.unit.findUnique({ where: { kode: kodeBaru }, select: { id: true } });
        if (bentrok) throw new GagalIzin(`Unit ${kodeBaru} sudah ada. Pakai nomor atau fase lain.`);
        baru.kode = kodeBaru;
      }

      baru.nomor = nomor;
      if (fase) baru.phaseId = fase.id;
      if (tipe) baru.unitTypeId = tipe.id;
    }

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
        nomor: "Nomor unit", kode: "Kode unit",
        phaseId: "Fase", unitTypeId: "Tipe unit",
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

    const nomor = angka(form, "nomor", { min: 1, wajib: true });
    const statusPembangunan = pilihan(form, "statusPembangunan", STATUS_PEMBANGUNAN);
    const statusJual = pilihan(form, "statusJual", STATUS_JUAL);

    // Luas tanah diisi per unit; bila dikosongkan, ikut luas tanah tipenya.
    const luasTanahIsian = angka(form, "luasTanah", { min: 0 });
    const luasTanah = luasTanahIsian > 0 ? luasTanahIsian : tipe.luasTanah;

    const kodeUnit = `${proyek.kode}-${fase.kode}-${nomor}`;
    const bentrok = await prisma.unit.findUnique({ where: { kode: kodeUnit }, select: { id: true } });
    if (bentrok) throw new GagalIzin(`Unit ${kodeUnit} sudah ada. Pakai nomor lain.`);

    // Progres awal mengikuti status bangunnya, sama seperti makeUnit pada artifact.
    const progress = ["Selesai", "Serah Terima", "Habis Masa Garansi"].includes(statusPembangunan)
      ? 100
      : statusPembangunan === "Progress"
        ? 10
        : 0;

    // Snapshot BOQ & RAP dibuat SEKALI di sini, dari template yang berlaku
    // saat ini. Sesudah tersimpan, unit tidak lagi membaca template.
    await prisma.unit.create({
      data: {
        kode: kodeUnit, projectId: proyek.id, phaseId: fase.id, unitTypeId: tipe.id,
        nomor, luasTanah, statusPembangunan, statusJual, progress,
        hargaJual: Math.round(rabAcuan(tipe.luasBangunan) * 1.42),
        rapUpah: hitungUpahRap(tipe.luasBangunan),
        boqItems: { create: buatBoqDariTemplate(tipe.luasBangunan) },
        rapItems: { create: buatRapDariTemplate(tipe.luasBangunan) },
      },
    });

    if (progress > 0) {
      await prisma.progressRecord.create({
        data: {
          unitId: (await prisma.unit.findUniqueOrThrow({ where: { kode: kodeUnit }, select: { id: true } })).id,
          tanggal: new Date(), progress, catatan: "Progres awal saat unit dibuat",
          dicatatOleh: pengguna.nama,
        },
      });
    }

    await catat({
      pengguna, projectId: proyek.id, objek: `Unit ${fase.kode}-${nomor}`,
      aksi: "Tambah unit", ke: `${statusPembangunan} · ${statusJual}`,
    });

    segarkan(kode);
    return `Unit ${kodeUnit} dibuat dengan salinan BOQ dan RAP dari template saat ini.`;
  });
}

export async function hapusUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
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
  });
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
// DOKUMEN — unggah revisi
// ===========================================================================

/**
 * Catat revisi baru sebuah dokumen beserta berkasnya.
 *
 * Berkas ditulis ke penyimpanan lebih dulu, baru metadatanya dicatat — bila
 * penulisan gagal, tidak ada baris revisi yang menunjuk ke berkas yang tak ada.
 */
export async function unggahRevisi(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const dokumenId = teksOpsional(form, "dokumenId");
    const pemilikJenis = teks(form, "pemilikJenis", true);
    const pemilikId = teks(form, "pemilikId", true);
    const kategori = teks(form, "kategori", true);
    const label = teks(form, "label", true);

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) {
      throw new GagalIzin("Pilih berkas yang akan diunggah.");
    }

    const namaFile = bersihkanNamaFile(berkas.name);
    periksaBerkas(namaFile, berkas.type, berkas.size);

    // Cari proyek pemilik dokumen, sekaligus memastikan pengguna berhak.
    let projectId: string;
    let kodeProyek: string;

    if (pemilikJenis === "legalitas") {
      const l = await prisma.legality.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!l) throw new GagalIzin("Legalitas tidak ditemukan.");
      projectId = l.projectId;
      kodeProyek = l.project.kode;
    } else if (pemilikJenis === "proyek") {
      const p = await prisma.project.findUnique({
        where: { id: pemilikId },
        select: { id: true, kode: true },
      });
      if (!p) throw new GagalIzin("Proyek tidak ditemukan.");
      projectId = p.id;
      kodeProyek = p.kode;
    } else if (pemilikJenis === "tipeUnit") {
      const t = await prisma.unitType.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!t) throw new GagalIzin("Tipe unit tidak ditemukan.");
      projectId = t.projectId;
      kodeProyek = t.project.kode;
    } else if (pemilikJenis === "kerjaTambah") {
      const k = await prisma.customWork.findUnique({
        where: { id: pemilikId },
        select: { id: true, unit: { select: { projectId: true, project: { select: { kode: true } } } } },
      });
      if (!k) throw new GagalIzin("Kerja tambah tidak ditemukan.");
      projectId = k.unit.projectId;
      kodeProyek = k.unit.project.kode;
    } else if (pemilikJenis === "sarpras") {
      const s = await prisma.infrastructure.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!s) throw new GagalIzin("Item sarpras tidak ditemukan.");
      projectId = s.projectId;
      kodeProyek = s.project.kode;
    } else {
      throw new GagalIzin(`Jenis pemilik dokumen "${pemilikJenis}" belum didukung.`);
    }

    const pengguna = await izinkan("dokumenTeknis", projectId);

    let dokId = dokumenId;
    let revisiBerikutnya = 1;

    if (dokId) {
      const jumlah = await prisma.documentVersion.count({ where: { documentId: dokId } });
      revisiBerikutnya = jumlah + 1;
    } else {
      const dok = await prisma.document.create({ data: { kategori, judul: label } });
      dokId = dok.id;

      // Tautkan dokumen baru ke pemiliknya. Nama kolomnya berbeda-beda, jadi
      // dipetakan secara eksplisit alih-alih dibangun dari string.
      const kolomTipe: Record<string, "docModel3dId" | "docGambarKerjaId" | "docRenderId" | "docSpekId"> = {
        model3d: "docModel3dId", gambarKerja: "docGambarKerjaId",
        render: "docRenderId", spek: "docSpekId",
      };
      const kolomKt: Record<string, "docDesainId" | "docModel3dId" | "docGambarKerjaId"> = {
        desain: "docDesainId", model3d: "docModel3dId", gambarKerja: "docGambarKerjaId",
      };

      if (pemilikJenis === "legalitas") {
        await prisma.legality.update({ where: { id: pemilikId }, data: { dokumenId: dokId } });
      } else if (pemilikJenis === "proyek") {
        await prisma.project.update({ where: { id: pemilikId }, data: { analisaDocId: dokId } });
      } else if (pemilikJenis === "tipeUnit") {
        const kolom = kolomTipe[kategori];
        if (!kolom) throw new GagalIzin(`Kategori dokumen "${kategori}" tidak dikenal untuk tipe unit.`);
        await prisma.unitType.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      } else if (pemilikJenis === "kerjaTambah") {
        const kolom = kolomKt[kategori];
        if (!kolom) throw new GagalIzin(`Kategori dokumen "${kategori}" tidak dikenal untuk kerja tambah.`);
        await prisma.customWork.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      } else if (pemilikJenis === "sarpras") {
        const kolom = kategori === "model3d" ? "docModel3dId" : "docGambarKerjaId";
        await prisma.infrastructure.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      }
    }

    const tersimpan = await simpanBerkas(await berkas.arrayBuffer(), namaFile);

    await prisma.documentVersion.create({
      data: {
        documentId: dokId,
        revisi: `R${revisiBerikutnya}`,
        namaFile,
        ukuranByte: tersimpan.ukuranByte,
        objectKey: tersimpan.objectKey,
        diunggahOlehId: pengguna.id,
      },
    });

    await catat({
      pengguna, projectId, objek: label,
      aksi: "Unggah revisi",
      dari: revisiBerikutnya > 1 ? `R${revisiBerikutnya - 1}` : null,
      ke: `R${revisiBerikutnya} — ${namaFile} (${(tersimpan.ukuranByte / 1024 / 1024).toFixed(1)} MB)`,
    });

    segarkan(kodeProyek);
    return `Revisi R${revisiBerikutnya} tersimpan.`;
  });
}

/**
 * Impor tabel dari Excel.
 *
 * PERAGAAN: berkas belum dibaca. Percobaan impor dicatat ke jejak audit
 * supaya alurnya bisa dinilai lebih dulu sebelum pembacaan berkas dibangun.
 */
export async function imporPeragaan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const jenis = teks(form, "jenis", true);
    const konteks = teks(form, "konteks", true);

    const pengguna = await ambilPengguna();
    if (!pengguna) throw new GagalIzin("Sesi Anda sudah berakhir. Silakan masuk kembali.");

    await catat({
      pengguna, objek: `${konteks} · ${jenis}`,
      aksi: "Impor dari Excel",
      ke: "percobaan impor — berkas belum diproses",
    });

    return "Alur impor tercatat. Pembacaan berkas Excel belum aktif pada demo ini.";
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

export async function hapusSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
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
  });
}
