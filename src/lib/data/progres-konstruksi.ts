import { prisma } from "@/lib/db";
import { progresTertimbang } from "@/lib/calc/kontrak-boq";
import { statusBangunSarpras, statusBangunUnit } from "@/lib/calc/status-bangun";

/**
 * Progress Konstruksi — capaian seluruh lingkup pekerjaan sebuah unit.
 *
 * DUA PROGRES YANG BERBEDA, jangan dipertukarkan:
 *
 *   - **Progress Konstruksi** (di sini) mencakup SELURUH pekerjaan unit —
 *     struktur, arsitektur, MEP, hingga subkon. Sumbernya `UnitBoqItem`, yaitu
 *     BOQ Master Proyek yang disusun QS. Inilah angka resmi kemajuan unit.
 *   - **Progress Vendor** (`ContractBoqItem`, lihat `boq-actions.ts`) hanya
 *     mencakup lingkup satu SPK. Vendor atap yang tuntas 100% tidak membuat
 *     unitnya selesai — ia hanya menuntaskan satu item dari lingkup penuh.
 *
 * Keduanya sengaja TIDAK saling mengisi. BOQ SPK kerap tidak sebangun dengan
 * BOQ Master — pekerjaan digabung, dipecah, atau diberi uraian berbeda — jadi
 * memaksa yang satu menghitung yang lain akan menghasilkan angka yang tampak
 * rapi tetapi tidak bisa dipertanggungjawabkan. QS mengisi keduanya: BOQ
 * Master sebagai catatan konstruksi, BOQ SPK sebagai dasar penagihan vendor.
 *
 * Seperti sebelumnya, `Unit.progress` diperlakukan sebagai CACHE dari baris
 * BOQ Master — ditulis ulang setiap kali baris berubah supaya puluhan halaman
 * yang membacanya tidak perlu menghitung sendiri, dan supaya
 * `statusPembangunan` bisa dipakai menyaring di tingkat database.
 */

export interface PerubahanProgres {
  label: string;
  dari: number;
  ke: number;
}

/**
 * Hitung ulang lalu simpan progres sebuah unit dari baris BOQ Master-nya.
 *
 * Wajib dipanggil setiap kali `UnitBoqItem.progress` berubah. Cache yang tidak
 * diperbarui tidak menimbulkan galat apa pun — hanya angka kemajuan yang
 * diam-diam keliru.
 */
export async function hitungUlangProgresUnit(
  unitId: string,
  dicatatOleh: string,
  dicatatOlehId: string,
): Promise<PerubahanProgres | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true, nomor: true, progress: true,
      statusJual: true, tanggalSerahTerima: true,
      phase: { select: { kode: true } },
      boqItems: { select: { volume: true, hargaSatuan: true, progress: true } },
    },
  });
  if (!unit || unit.boqItems.length === 0) return null;

  const baru = progresTertimbang(unit.boqItems);
  if (baru === unit.progress) return null;

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      progress: baru,
      statusPembangunan: statusBangunUnit({
        progress: baru, statusJual: unit.statusJual, tanggalSerahTerima: unit.tanggalSerahTerima,
      }),
    },
  });
  await prisma.progressRecord.create({
    data: {
      unitId, tanggal: new Date(), progress: baru,
      catatan: "Opname BOQ konstruksi", dicatatOleh, dicatatOlehId,
    },
  });

  return { label: `Unit ${unit.phase.kode}-${unit.nomor}`, dari: unit.progress, ke: baru };
}

/** Versi sarana & prasarana, dengan aturan yang sama persis. */
export async function hitungUlangProgresSarpras(
  sarprasId: string,
  dicatatOleh: string,
  dicatatOlehId: string,
): Promise<PerubahanProgres | null> {
  const item = await prisma.infrastructure.findUnique({
    where: { id: sarprasId },
    select: {
      id: true, nama: true, progress: true,
      boqItems: { select: { volume: true, hargaSatuan: true, progress: true } },
    },
  });
  if (!item || item.boqItems.length === 0) return null;

  const baru = progresTertimbang(item.boqItems);
  if (baru === item.progress) return null;

  await prisma.infrastructure.update({
    where: { id: sarprasId },
    data: { progress: baru, status: statusBangunSarpras(baru) },
  });
  await prisma.progressRecord.create({
    data: {
      infrastructureId: sarprasId, tanggal: new Date(), progress: baru,
      catatan: "Opname BOQ konstruksi", dicatatOleh, dicatatOlehId,
    },
  });

  return { label: item.nama, dari: item.progress, ke: baru };
}

/**
 * Apakah progres objek ini sudah dikendalikan opname per baris BOQ Master?
 *
 * Objek yang punya baris BOQ tidak boleh lagi diisi satu angka manual —
 * angkanya akan tertimpa pada opname berikutnya. Objek tanpa baris BOQ
 * (mis. unit yang BOQ-nya belum disusun) tetap memakai jalur manual.
 */
export async function progresDariBoq(unitId: string): Promise<boolean> {
  return (await prisma.unitBoqItem.count({ where: { unitId } })) > 0;
}

/** Versi sarpras dari `progresDariBoq`. */
export async function progresSarprasDariBoq(sarprasId: string): Promise<boolean> {
  return (await prisma.infrastructureBoqItem.count({ where: { infrastructureId: sarprasId } })) > 0;
}
