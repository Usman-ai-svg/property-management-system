"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";

const POS_HPP: Record<string, string> = {
  "Unit (rumah dijual)": "E — Konstruksi",
  "Prasarana & Sarana": "D — Prasarana",
  "Perijinan & Ormas": "C — Perijinan",
  "Pengolahan Lahan": "B — Pengolahan Lahan",
};

/**
 * Baca dan sahkan pembebanan sebuah pengeluaran: ke unit, ke item sarana &
 * prasarana, atau ke tidak keduanya (biaya level proyek).
 *
 * Keduanya saling meniadakan. Membebankan satu pengeluaran ke unit sekaligus
 * ke sarpras akan membuatnya terhitung dua kali pada laporan realisasi.
 */
async function bebanan(
  form: FormData,
  projectId: string,
): Promise<{ unitId: string | null; infrastructureId: string | null }> {
  const unitId = teksOpsional(form, "unitId");
  const infrastructureId = teksOpsional(form, "infrastructureId");

  if (unitId && infrastructureId) {
    throw new GagalIzin(
      "Satu pengeluaran hanya boleh dibebankan ke unit ATAU ke sarana & prasarana, tidak keduanya.",
    );
  }

  if (unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { projectId: true },
    });
    if (!unit || unit.projectId !== projectId) throw new GagalIzin("Unit tidak sah untuk proyek ini.");
  }

  if (infrastructureId) {
    const s = await prisma.infrastructure.findUnique({
      where: { id: infrastructureId },
      select: { projectId: true },
    });
    if (!s || s.projectId !== projectId) {
      throw new GagalIzin("Item sarana & prasarana tidak sah untuk proyek ini.");
    }
  }

  return { unitId: unitId || null, infrastructureId: infrastructureId || null };
}

/**
 * Catat pengeluaran baru.
 *
 * Pos HPP tidak diminta ke pengguna melainkan diturunkan dari peruntukannya,
 * supaya perbandingan dengan business plan pada Plan vs Realisasi tidak
 * bergantung pada ketelitian pengisian.
 */
export async function catatPengeluaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("keuangan", projectId);

    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, kode: true },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const { unitId, infrastructureId } = await bebanan(form, projectId);
    const total = angka(form, "total", { min: 1, wajib: true });

    await prisma.expense.create({
      data: {
        projectId,
        unitId,
        infrastructureId,
        tanggal: new Date(),
        peruntukan,
        jenis: pilihan(form, "jenis", JENIS_BIAYA),
        metode: pilihan(form, "metode", METODE_BAYAR),
        uraian: teks(form, "uraian", true),
        total,
        status: pilihan(form, "status", STATUS_BAYAR),
        pic: pengguna.nama,
        bukti: teksOpsional(form, "bukti"),
        posHpp: POS_HPP[peruntukan],
      },
    });

    await catat({
      pengguna, projectId,
      objek: `Pengeluaran · ${peruntukan}`,
      aksi: "Catat pengeluaran",
      ke: `${teks(form, "uraian")} — ${rpLog(total)}`,
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${proyek.kode}`);
    revalidatePath("/");
  });
}

/**
 * Sunting pengeluaran yang sudah tercatat.
 *
 * Baris lama diperbarui di tempat, bukan dihapus lalu dibuat ulang, supaya
 * pengeluaran yang sudah tertaut ke kontrak vendor tidak kehilangan tautannya.
 * Tiap field yang berubah dicatat sendiri-sendiri di jejak audit — pada catatan
 * keuangan, yang penting justru "angkanya diubah dari berapa jadi berapa",
 * bukan sekadar "pernah disunting".
 */
export async function ubahPengeluaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true, projectId: true, unitId: true, infrastructureId: true,
        peruntukan: true, jenis: true, metode: true, uraian: true,
        total: true, status: true, bukti: true,
        project: { select: { kode: true } },
      },
    });
    if (!lama) throw new GagalIzin("Pengeluaran tidak ditemukan.");

    const pengguna = await izinkan("keuangan", lama.projectId);

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const { unitId, infrastructureId } = await bebanan(form, lama.projectId);

    const baru = {
      peruntukan,
      jenis: pilihan(form, "jenis", JENIS_BIAYA),
      metode: pilihan(form, "metode", METODE_BAYAR),
      uraian: teks(form, "uraian", true),
      total: angka(form, "total", { min: 1, wajib: true }),
      status: pilihan(form, "status", STATUS_BAYAR),
      bukti: teksOpsional(form, "bukti") || null,
      unitId,
      infrastructureId,
      posHpp: POS_HPP[peruntukan],
    };

    await prisma.expense.update({ where: { id }, data: baru });

    // Pembebanan dicatat memakai nama yang terbaca manusia, bukan id acak.
    const [namaUnitLama, namaUnitBaru, namaSarprasLama, namaSarprasBaru] = await Promise.all([
      labelUnit(lama.unitId),
      labelUnit(unitId),
      labelSarpras(lama.infrastructureId),
      labelSarpras(infrastructureId),
    ]);

    const jml = await catatDiff({
      pengguna,
      projectId: lama.projectId,
      objek: `Pengeluaran · ${lama.uraian}`,
      sebelum: {
        peruntukan: lama.peruntukan, jenis: lama.jenis, metode: lama.metode,
        uraian: lama.uraian, total: lama.total, status: lama.status,
        bukti: lama.bukti, dibebankanKe: namaUnitLama ?? namaSarprasLama ?? "level proyek",
      },
      sesudah: {
        peruntukan: baru.peruntukan, jenis: baru.jenis, metode: baru.metode,
        uraian: baru.uraian, total: baru.total, status: baru.status,
        bukti: baru.bukti, dibebankanKe: namaUnitBaru ?? namaSarprasBaru ?? "level proyek",
      },
      label: {
        uraian: "Keterangan", total: "Total", status: "Status bayar",
        bukti: "Berkas bukti", dibebankanKe: "Dibebankan ke",
        peruntukan: "Peruntukan", jenis: "Jenis biaya", metode: "Metode",
      },
      format: { total: (v) => rpLog(Number(v)) },
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${lama.project.kode}`);
    revalidatePath("/");

    if (jml === 0) return "Tidak ada yang berubah.";
    return `${jml} perubahan tersimpan.`;
  });
}

/** Nama unit yang enak dibaca, mis. "Unit F1-3". */
async function labelUnit(id: string | null): Promise<string | null> {
  if (!id) return null;
  const u = await prisma.unit.findUnique({
    where: { id },
    select: { nomor: true, phase: { select: { kode: true } } },
  });
  return u ? `Unit ${u.phase.kode}-${u.nomor}` : null;
}

async function labelSarpras(id: string | null): Promise<string | null> {
  if (!id) return null;
  const s = await prisma.infrastructure.findUnique({ where: { id }, select: { nama: true } });
  return s ? `Sarpras · ${s.nama}` : null;
}

/**
 * Hapus pengeluaran.
 *
 * Barisnya benar-benar dihapus, tetapi jejak auditnya menyimpan uraian dan
 * nominalnya — jadi penghapusan tetap bisa ditelusuri walau datanya tidak ada
 * lagi. Jejak audit bersifat append-only dan tidak ikut terhapus.
 */
export async function hapusPengeluaran(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");

  const lama = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true, projectId: true, uraian: true, total: true, peruntukan: true,
      project: { select: { kode: true } },
    },
  });
  if (!lama) return;

  const pengguna = await izinkan("keuangan", lama.projectId);

  await prisma.expense.delete({ where: { id } });

  await catat({
    pengguna, projectId: lama.projectId,
    objek: `Pengeluaran · ${lama.peruntukan}`,
    aksi: "Hapus pengeluaran",
    dari: `${lama.uraian} — ${rpLog(lama.total)}`,
    ke: "dihapus",
  });

  revalidatePath("/keuangan");
  revalidatePath(`/keuangan/${lama.project.kode}`);
  revalidatePath("/");
}
