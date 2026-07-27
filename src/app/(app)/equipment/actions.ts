"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import {
  JENIS_PENYESUAIAN_ASET, KEPEMILIKAN_ASET, SATUAN_PAKAI, STATUS_ASET,
} from "@/lib/domain/enums";
import { terapkanPenyesuaian } from "@/lib/calc/aset";

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

    // Jumlah sengaja DIBUANG di sini: stok hanya berubah lewat penyesuaian,
    // supaya setiap pergerakannya punya alasan dan penanggung jawab. Formulir
    // Ubah Aset pun tidak lagi menampilkan isiannya.
    const { jumlah: _abaikan, ...data } = await bacaAset(form);
    await prisma.equipment.update({ where: { id }, data: { ...data, kode } });

    const jml = await catatDiff({
      pengguna,
      objek: `Aset ${lama.kode}`,
      sebelum: { ...lama, kode: lama.kode, jumlah: lama.jumlah },
      sesudah: { ...data, kode, jumlah: lama.jumlah },
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

/**
 * Catat satu penyesuaian stok aset: kehilangan, kerusakan, atau koreksi opname.
 *
 * Jumlah aset TIDAK BOLEH diketik langsung dari formulir Ubah Aset — ia hanya
 * berubah lewat sini, supaya tiap pergerakan stok punya alasan dan penanggung
 * jawab. Riwayatnya hanya-tambah: pencatatan yang telanjur salah diperbaiki
 * dengan baris "Koreksi Stok" baru, bukan dengan menghapus baris lama.
 *
 * Nilai rupiah aset sengaja tidak disentuh. Penyusutan dan pembukuan kerugian
 * dikerjakan Finance di luar modul ini.
 */
export async function catatPenyesuaianAset(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const equipmentId = teks(form, "equipmentId", true);
    const pengguna = await izinkan("penyesuaianAset");

    const aset = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, kode: true, nama: true, satuan: true, jumlah: true, jumlahRusak: true },
    });
    if (!aset) throw new GagalIzin("Aset tidak ditemukan.");

    const jenis = pilihan(form, "jenis", JENIS_PENYESUAIAN_ASET);
    const banyak = Math.trunc(angka(form, "banyak", { wajib: true }));
    const keterangan = teks(form, "keterangan", true);
    const penanggungJawab = teksOpsional(form, "penanggungJawab");

    const { stok, galat } = terapkanPenyesuaian(
      { jumlah: aset.jumlah, jumlahRusak: aset.jumlahRusak },
      jenis,
      banyak,
    );
    if (galat) throw new GagalIzin(galat);

    await prisma.$transaction([
      prisma.equipment.update({
        where: { id: equipmentId },
        data: { jumlah: stok.jumlah, jumlahRusak: stok.jumlahRusak },
      }),
      prisma.equipmentAdjustment.create({
        data: {
          equipmentId,
          jenis,
          banyak,
          jumlahSebelum: aset.jumlah,
          jumlahSesudah: stok.jumlah,
          rusakSebelum: aset.jumlahRusak,
          rusakSesudah: stok.jumlahRusak,
          keterangan,
          penanggungJawab,
          dicatatOleh: pengguna.nama,
        },
      }),
    ]);

    await catat({
      pengguna,
      objek: `Aset ${aset.kode} · ${aset.nama}`,
      aksi: `Penyesuaian stok — ${jenis}`,
      dari: `${aset.jumlah} ${aset.satuan} (${aset.jumlahRusak} rusak)`,
      ke: `${stok.jumlah} ${aset.satuan} (${stok.jumlahRusak} rusak) — ${keterangan}`,
    });

    revalidatePath("/equipment");
    return `Penyesuaian tersimpan. Stok ${aset.kode} kini ${stok.jumlah} ${aset.satuan}` +
      (stok.jumlahRusak > 0 ? `, ${stok.jumlahRusak} di antaranya rusak.` : ".");
  });
}
