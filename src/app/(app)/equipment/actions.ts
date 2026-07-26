"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { KEPEMILIKAN_ASET, SATUAN_PAKAI, STATUS_ASET } from "@/lib/domain/enums";

/**
 * Pengelolaan peralatan dan aset.
 *
 * Aset tidak menempel pada satu proyek — alat berpindah antar proyek — jadi
 * izinnya diperiksa tanpa `projectId`. Penempatan ke proyek tetap dicatat,
 * tetapi sebagai atribut yang bisa berubah, bukan sebagai pemilik.
 */

const LABEL = {
  kode: "Kode", nama: "Nama", kategori: "Kategori", merk: "Merk",
  jumlah: "Jumlah", satuan: "Satuan", kepemilikan: "Kepemilikan",
  vendorId: "Vendor penyewa", projectId: "Penempatan", penanggungJawab: "Penanggung jawab",
  status: "Status", satuanPakai: "Satuan pakai", pemakaian: "Pemakaian",
  servisTerakhir: "Servis terakhir", servisBerikut: "Servis berikut", nilai: "Nilai / tarif",
};

const FORMAT = { nilai: (v: unknown) => rpLog(Number(v)) };

/** Baca tanggal opsional dari form. String kosong berarti dikosongkan. */
function tanggalOpsional(form: FormData, nama: string): Date | null {
  const isi = String(form.get(nama) ?? "").trim();
  if (!isi) return null;
  const d = new Date(isi);
  if (Number.isNaN(d.getTime())) throw new GagalIzin(`Tanggal pada "${nama}" tidak sah.`);
  return d;
}

/**
 * Baca seluruh field aset dari form.
 *
 * Vendor hanya disimpan bila kepemilikannya Sewa — aset milik sendiri yang
 * masih menyimpan vendor akan terbaca seolah disewa dari pihak itu.
 */
async function bacaAset(form: FormData) {
  const kepemilikan = pilihan(form, "kepemilikan", KEPEMILIKAN_ASET);
  const vendorId = kepemilikan === "Sewa" ? teksOpsional(form, "vendorId") : null;
  const projectId = teksOpsional(form, "projectId");

  if (vendorId) {
    const ada = await prisma.vendor.count({ where: { id: vendorId } });
    if (!ada) throw new GagalIzin("Vendor tidak ditemukan.");
  }
  if (projectId) {
    const ada = await prisma.project.count({ where: { id: projectId } });
    if (!ada) throw new GagalIzin("Proyek tidak ditemukan.");
  }

  const servisTerakhir = tanggalOpsional(form, "servisTerakhir");
  const servisBerikut = tanggalOpsional(form, "servisBerikut");
  if (servisTerakhir && servisBerikut && servisBerikut < servisTerakhir) {
    throw new GagalIzin("Servis berikut tidak boleh lebih awal daripada servis terakhir.");
  }

  return {
    nama: teks(form, "nama", true),
    kategori: teks(form, "kategori", true),
    merk: teksOpsional(form, "merk"),
    jumlah: angka(form, "jumlah", { min: 1, wajib: true }),
    satuan: teks(form, "satuan") || "unit",
    kepemilikan,
    vendorId,
    projectId,
    penanggungJawab: teksOpsional(form, "penanggungJawab"),
    status: pilihan(form, "status", STATUS_ASET),
    satuanPakai: pilihan(form, "satuanPakai", SATUAN_PAKAI),
    pemakaian: angka(form, "pemakaian", { min: 0 }),
    servisTerakhir,
    servisBerikut,
    nilai: angka(form, "nilai", { min: 0 }),
  };
}

export async function tambahAset(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan("aset");
    const kode = teks(form, "kode", true).toUpperCase();

    const bentrok = await prisma.equipment.count({ where: { kode } });
    if (bentrok) throw new GagalIzin(`Kode "${kode}" sudah dipakai aset lain.`);

    const data = await bacaAset(form);
    await prisma.equipment.create({ data: { ...data, kode } });

    await catat({
      pengguna,
      objek: `Aset ${kode}`,
      aksi: "Tambah aset",
      ke: `${data.nama} · ${data.jumlah} ${data.satuan}`,
    });

    revalidatePath("/equipment");
  });
}

export async function ubahAset(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan("aset");

    const lama = await prisma.equipment.findUnique({ where: { id } });
    if (!lama) throw new GagalIzin("Aset tidak ditemukan.");

    const kode = teks(form, "kode", true).toUpperCase();
    if (kode !== lama.kode) {
      const bentrok = await prisma.equipment.count({ where: { kode } });
      if (bentrok) throw new GagalIzin(`Kode "${kode}" sudah dipakai aset lain.`);
    }

    const data = await bacaAset(form);
    await prisma.equipment.update({ where: { id }, data: { ...data, kode } });

    const jml = await catatDiff({
      pengguna,
      objek: `Aset ${lama.kode}`,
      sebelum: { ...lama, kode: lama.kode },
      sesudah: { ...data, kode },
      label: LABEL,
      format: FORMAT,
    });

    revalidatePath("/equipment");
    if (jml === 0) return "Tidak ada yang berubah.";
    return `${jml} perubahan tersimpan.`;
  });
}

export async function hapusAset(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true, kode: true, nama: true },
    });
    if (!lama) return;

    const pengguna = await izinkan("aset");
    await prisma.equipment.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `Aset ${lama.kode}`,
      aksi: "Hapus aset",
      dari: lama.nama,
      ke: "dihapus",
    });

    revalidatePath("/equipment");
  });
}
