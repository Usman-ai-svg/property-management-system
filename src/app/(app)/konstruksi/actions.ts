"use server";

import { segmen } from "@/lib/adaptor/rute";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, teks, wajibLolos,
} from "@/lib/actions/guard";
import {
  hitungUlangProgresSarpras,
  hitungUlangProgresUnit,
} from "@/lib/data/progres-konstruksi";
import { mingguBaru } from "@/lib/calc/hari-kerja";
import { bulatkanProgres, progresSah } from "@/lib/calc/opname";
import { periksaSimpanOpname, periksaUbahProgresManual } from "@/lib/kontrak/konstruksi";
import { statusBangunSarpras, statusBangunUnit } from "@/lib/calc/status-bangun";

/**
 * Pembaruan progres dari modul Konstruksi.
 *
 * Selain memperbarui angka pada entitas, tiap perubahan ditulis sebagai
 * catatan ProgressRecord baru. Catatan itulah yang menjadi pembanding
 * "minggu lalu" pada opname berikutnya — sehingga laporan mingguan
 * mencerminkan pelaporan yang benar-benar terjadi.
 */

export async function ubahProgresUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const progress = angka(form, "progress", { min: 0, max: 100 });

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, progress: true, projectId: true,
        statusJual: true, tanggalSerahTerima: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("progress", unit.projectId);

    // Unit yang BOQ Master-nya sudah tersusun diopname per baris, bukan
    // ditimpa satu angka dari sini. Tombolnya memang sudah disembunyikan di
    // halaman unit, tetapi menyembunyikan tombol bukan penegakan — aksi ini
    // bisa dipanggil langsung.
    wajibLolos(
      periksaUbahProgresManual(
        { id, progress },
        {
          punyaBoq: (await prisma.unitBoqItem.count({ where: { unitId: id } })) > 0,
          sebutan: "unit",
        },
      ),
    );

    if (progress === unit.progress) return "Progres tidak berubah.";

    // Status bangun adalah nilai turunan — disimpulkan dari progres + status
    // jual + tanggal serah terima (lihat statusBangunUnit).
    const statusPembangunan = statusBangunUnit({
      progress, statusJual: unit.statusJual, tanggalSerahTerima: unit.tanggalSerahTerima,
    });

    await prisma.$transaction([
      prisma.unit.update({ where: { id }, data: { progress, statusPembangunan } }),
      prisma.progressRecord.create({
        data: {
          unitId: id, tanggal: new Date(), progress,
          catatan: "Opname konstruksi", dicatatOleh: pengguna.nama, dicatatOlehId: pengguna.id,
        },
      }),
    ]);

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Ubah progress konstruksi",
      dari: `${unit.progress}%`, ke: `${progress}%`,
    });

    revalidatePath(`/konstruksi/${segmen(unit.project.kode)}`);
    revalidatePath(`/master/${segmen(unit.project.kode)}`);
    revalidatePath("/");
  });
}

export async function ubahProgresSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const progress = angka(form, "progress", { min: 0, max: 100 });

    const item = await prisma.infrastructure.findUnique({
      where: { id },
      select: {
        id: true, nama: true, progress: true, projectId: true,
        project: { select: { kode: true } },
      },
    });
    if (!item) throw new GagalIzin("Item sarpras tidak ditemukan.");

    const pengguna = await izinkan("progress", item.projectId);

    // Sama seperti unit: yang BOQ-nya sudah tersusun diopname per baris.
    wajibLolos(
      periksaUbahProgresManual(
        { id, progress },
        {
          punyaBoq:
            (await prisma.infrastructureBoqItem.count({ where: { infrastructureId: id } })) > 0,
          sebutan: "item",
        },
      ),
    );

    if (progress === item.progress) return "Progres tidak berubah.";

    const status = statusBangunSarpras(progress);

    await prisma.$transaction([
      prisma.infrastructure.update({ where: { id }, data: { progress, status } }),
      prisma.progressRecord.create({
        data: {
          infrastructureId: id, tanggal: new Date(), progress,
          catatan: "Opname konstruksi", dicatatOleh: pengguna.nama, dicatatOlehId: pengguna.id,
        },
      }),
    ]);

    await catat({
      pengguna, projectId: item.projectId,
      objek: `Sarpras · ${item.nama}`,
      aksi: "Ubah progress konstruksi",
      dari: `${item.progress}%`, ke: `${progress}%`,
    });

    revalidatePath(`/konstruksi/${segmen(item.project.kode)}`);
    revalidatePath(`/master/${segmen(item.project.kode)}`);
    revalidatePath("/");
  });
}

/**
 * Simpan opname konstruksi: progres tiap baris BOQ Master sekaligus.
 *
 * Inilah sumber Progress Konstruksi — lingkup penuh unit, termasuk pekerjaan
 * yang dikerjakan sendiri maupun yang dikontrakkan. Progres SPK vendor tidak
 * ikut menghitung ke sini; keduanya dicatat terpisah karena rincian
 * pekerjaannya kerap tidak sebangun.
 *
 * Nilai lama tiap baris digeser ke `progressLalu` supaya tabel opname bisa
 * menampilkan penambahan minggu ini tanpa tabel riwayat per baris tersendiri.
 */
export async function simpanOpnameUnit(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const unitId = teks(form, "unitId", true);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true, nomor: true, projectId: true,
        phase: { select: { kode: true } },
        project: { select: { kode: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("progress", unit.projectId);
    const jml = await simpanBarisOpname(form, "unit", unitId);
    if (jml === 0) return "Tidak ada progres yang berubah.";

    const berubah = await hitungUlangProgresUnit(unitId, pengguna.nama, pengguna.id);

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Opname konstruksi per baris BOQ",
      dari: berubah ? `${berubah.dari}%` : undefined,
      ke: berubah ? `${berubah.ke}%` : `${jml} baris diperbarui`,
    });

    revalidatePath(`/konstruksi/${segmen(unit.project.kode)}`);
    revalidatePath(`/master/${segmen(unit.project.kode)}`);
    revalidatePath("/");

    return berubah
      ? `${jml} baris tersimpan. Progres unit kini ${berubah.ke}% (sebelumnya ${berubah.dari}%).`
      : `${jml} baris tersimpan.`;
  });
}

/** Versi sarana & prasarana dari `simpanOpnameUnit`. */
export async function simpanOpnameSarpras(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const sarprasId = teks(form, "sarprasId", true);

    const item = await prisma.infrastructure.findUnique({
      where: { id: sarprasId },
      select: {
        id: true, nama: true, projectId: true,
        project: { select: { kode: true } },
      },
    });
    if (!item) throw new GagalIzin("Item sarpras tidak ditemukan.");

    const pengguna = await izinkan("progress", item.projectId);
    const jml = await simpanBarisOpname(form, "sarpras", sarprasId);
    if (jml === 0) return "Tidak ada progres yang berubah.";

    const berubah = await hitungUlangProgresSarpras(sarprasId, pengguna.nama, pengguna.id);

    await catat({
      pengguna, projectId: item.projectId,
      objek: item.nama,
      aksi: "Opname konstruksi per baris BOQ",
      dari: berubah ? `${berubah.dari}%` : undefined,
      ke: berubah ? `${berubah.ke}%` : `${jml} baris diperbarui`,
    });

    revalidatePath(`/konstruksi/${segmen(item.project.kode)}`);
    revalidatePath(`/master/${segmen(item.project.kode)}`);
    revalidatePath("/");

    return berubah
      ? `${jml} baris tersimpan. Progres item kini ${berubah.ke}% (sebelumnya ${berubah.dari}%).`
      : `${jml} baris tersimpan.`;
  });
}

/**
 * Baca dan simpan progres baris opname dari form. Mengembalikan jumlah baris
 * yang benar-benar berubah.
 *
 * Baris yang bukan milik objek ini diabaikan alih-alih menggagalkan seluruh
 * penyimpanan — formulir bisa saja tertinggal versi lama setelah BOQ disunting.
 */
async function simpanBarisOpname(
  form: FormData,
  jenis: "unit" | "sarpras",
  objekId: string,
): Promise<number> {
  const ids = form.getAll("barisId").map(String);
  const nilai = form.getAll("barisProgress").map((v) => Number(String(v)));
  wajibLolos(
    periksaSimpanOpname(
      { objekId, baris: ids.map((id, i) => ({ id, persen: nilai[i] })) },
      { kirimanLengkap: ids.length === nilai.length },
      () => "baris",
    ),
  );

  const sebelum =
    jenis === "unit"
      ? await prisma.unitBoqItem.findMany({
          where: { id: { in: ids }, unitId: objekId },
          select: { id: true, uraian: true, progress: true, progressLalu: true, progressLaluPada: true },
        })
      : await prisma.infrastructureBoqItem.findMany({
          where: { id: { in: ids }, infrastructureId: objekId },
          select: { id: true, uraian: true, progress: true, progressLalu: true, progressLaluPada: true },
        });
  const petaLama = new Map(sebelum.map((b) => [b.id, b]));

  // Aturan minggu berjalan: `progressLalu` hanya digeser bila opname ini masuk
  // minggu baru (≥5 hari kerja sejak awal minggu berjalan baris itu). Koreksi
  // dalam minggu yang sama hanya memperbarui `progress` tanpa merusak rekap
  // minggu lalu.
  const sekarang = new Date();

  const ubah: { id: string; progress: number; progressLalu: number; progressLaluPada: Date }[] = [];
  for (let i = 0; i < ids.length; i++) {
    const lama = petaLama.get(ids[i]);
    if (!lama) continue;

    const p = nilai[i];
    if (!progresSah(p)) {
      throw new GagalIzin(`Progres "${lama.uraian}" harus di antara 0 dan 100 persen.`);
    }
    const bulat = bulatkanProgres(p);
    if (bulat === lama.progress) continue;

    const baru = mingguBaru(lama.progressLaluPada, sekarang);
    ubah.push({
      id: ids[i],
      progress: bulat,
      progressLalu: baru ? lama.progress : lama.progressLalu,
      progressLaluPada: baru ? sekarang : (lama.progressLaluPada ?? sekarang),
    });
  }

  if (ubah.length === 0) return 0;

  await prisma.$transaction(
    ubah.map((u) =>
      jenis === "unit"
        ? prisma.unitBoqItem.update({
            where: { id: u.id },
            data: { progress: u.progress, progressLalu: u.progressLalu, progressLaluPada: u.progressLaluPada },
          })
        : prisma.infrastructureBoqItem.update({
            where: { id: u.id },
            data: { progress: u.progress, progressLalu: u.progressLalu, progressLaluPada: u.progressLaluPada },
          }),
    ),
  );
  return ubah.length;
}
