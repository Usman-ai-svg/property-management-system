import { prisma } from "@/lib/db";
import {
  progresTertimbang,
  statusDariProgres,
  type BarisBoqSpk,
} from "@/lib/calc/kontrak-boq";

/**
 * Menghitung ulang progres unit dan sarpras dari baris BOQ SPK-nya.
 *
 * Progres unit sebenarnya adalah nilai TURUNAN — bisa saja dihitung setiap
 * kali halaman dibuka. Yang dilakukan di sini justru menuliskannya kembali ke
 * `Unit.progress`, dengan alasan yang disengaja:
 *
 *   1. Ada 48 tempat di aplikasi yang membaca `Unit.progress` atau
 *      `Infrastructure.progress` — dashboard, konstruksi, keuangan, vendor.
 *      Mengubah semuanya jadi menghitung sendiri berarti menyentuh puluhan
 *      query demi angka yang sama.
 *   2. Progres ikut menentukan `statusPembangunan`, yang dipakai menyaring
 *      dan mengurutkan di tingkat database. Nilai turunan yang hanya hidup di
 *      memori tidak bisa dipakai untuk itu.
 *
 * Konsekuensinya kolom itu menjadi CACHE, dan cache bisa basi. Karena itu
 * fungsi ini wajib dipanggil di dalam transaksi yang sama dengan setiap
 * perubahan baris BOQ SPK — jangan dipanggil belakangan, dan jangan sampai
 * ada jalur ubah BOQ SPK yang melewatinya.
 */

/** Unit atau sarpras yang perlu dihitung ulang setelah sebuah SPK berubah. */
export interface SasaranHitungUlang {
  unitIds: string[];
  sarprasIds: string[];
}

/** Kumpulkan unit dan sarpras yang tersentuh sebuah kontrak. */
export async function sasaranDariKontrak(contractId: string): Promise<SasaranHitungUlang> {
  const baris = await prisma.contractBoqItem.findMany({
    where: { contractId },
    select: { unitId: true, infrastructureId: true },
  });
  return {
    unitIds: [...new Set(baris.map((b) => b.unitId).filter((x): x is string => !!x))],
    sarprasIds: [
      ...new Set(baris.map((b) => b.infrastructureId).filter((x): x is string => !!x)),
    ],
  };
}

/**
 * Hitung ulang lalu simpan progres untuk sasaran yang diberikan.
 *
 * Mengembalikan daftar perubahan supaya pemanggil bisa mencatatnya ke jejak
 * audit — perubahan progres unit adalah akibat yang tidak terlihat dari
 * layar QS, jadi harus tetap terekam.
 */
export async function hitungUlangProgres(
  sasaran: SasaranHitungUlang,
  dicatatOleh: string,
): Promise<{ label: string; dari: number; ke: number }[]> {
  const perubahan: { label: string; dari: number; ke: number }[] = [];

  for (const unitId of sasaran.unitIds) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true, nomor: true, progress: true,
        phase: { select: { kode: true } },
        boqSpk: { select: { volume: true, hargaSatuan: true, progress: true } },
      },
    });
    if (!unit) continue;

    // Unit yang seluruh baris SPK-nya sudah dihapus kembali ke jalur manual;
    // progres terakhirnya dibiarkan, bukan dinolkan begitu saja.
    if (unit.boqSpk.length === 0) continue;

    const baru = progresTertimbang(unit.boqSpk as BarisBoqSpk[]);
    if (baru === unit.progress) continue;

    await prisma.unit.update({
      where: { id: unitId },
      data: { progress: baru, statusPembangunan: statusDariProgres(baru) },
    });
    await prisma.progressRecord.create({
      data: {
        unitId, tanggal: new Date(), progress: baru,
        catatan: "Opname BOQ SPK", dicatatOleh,
      },
    });
    perubahan.push({
      label: `Unit ${unit.phase.kode}-${unit.nomor}`,
      dari: unit.progress,
      ke: baru,
    });
  }

  for (const sarprasId of sasaran.sarprasIds) {
    const item = await prisma.infrastructure.findUnique({
      where: { id: sarprasId },
      select: {
        id: true, nama: true, progress: true,
        boqSpk: { select: { volume: true, hargaSatuan: true, progress: true } },
      },
    });
    if (!item || item.boqSpk.length === 0) continue;

    const baru = progresTertimbang(item.boqSpk as BarisBoqSpk[]);
    if (baru === item.progress) continue;

    await prisma.infrastructure.update({
      where: { id: sarprasId },
      data: { progress: baru, status: statusDariProgres(baru) },
    });
    await prisma.progressRecord.create({
      data: {
        infrastructureId: sarprasId, tanggal: new Date(), progress: baru,
        catatan: "Opname BOQ SPK", dicatatOleh,
      },
    });
    perubahan.push({ label: item.nama, dari: item.progress, ke: baru });
  }

  return perubahan;
}

/**
 * Apakah progres sebuah unit sudah dikendalikan BOQ SPK?
 *
 * Dipakai halaman detail unit untuk memutuskan menampilkan tombol "Ubah
 * Progress" manual atau tidak. Unit yang progresnya turunan tidak boleh bisa
 * ditimpa manual — angkanya akan langsung tertulis ulang pada penyimpanan
 * BOQ berikutnya, dan pengguna berhak tahu itu sebelum mengetik.
 */
export async function progresDikendalikanSpk(unitId: string): Promise<boolean> {
  const n = await prisma.contractBoqItem.count({ where: { unitId } });
  return n > 0;
}

/** Versi sarpras dari `progresDikendalikanSpk`. */
export async function progresSarprasDikendalikanSpk(sarprasId: string): Promise<boolean> {
  const n = await prisma.contractBoqItem.count({ where: { infrastructureId: sarprasId } });
  return n > 0;
}
