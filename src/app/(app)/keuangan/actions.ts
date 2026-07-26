"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { periksaAlokasi } from "@/lib/calc/keuangan";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";

const POS_HPP: Record<string, string> = {
  "Unit (rumah dijual)": "E — Konstruksi",
  "Prasarana & Sarana": "D — Prasarana",
  "Perijinan & Ormas": "C — Perijinan",
  "Pengolahan Lahan": "B — Pengolahan Lahan",
};

/**
 * Baca pembebanan sebuah pembayaran dari formulir.
 *
 * Formulir mengirim satu baris per tujuan lewat tiga larik sejajar:
 * `alokasiUnitId`, `alokasiSarprasId`, dan `alokasiNominal`. Satu pembayaran
 * boleh menanggung beberapa unit sekaligus — upah borongan untuk lima rumah
 * dibayar sekali — dan tetap tersimpan sebagai satu baris yang cocok dengan
 * satu baris mutasi bank.
 *
 * Jumlah seluruh alokasi wajib sama persis dengan totalnya. Itu diperiksa oleh
 * `periksaAlokasi`, yang juga menolak baris yang membebani unit sekaligus
 * sarpras karena akan terhitung dua kali di laporan realisasi.
 */
async function bacaAlokasi(
  form: FormData,
  projectId: string,
  total: number,
): Promise<{ unitId: string | null; infrastructureId: string | null; nominal: number }[]> {
  const unitIds = form.getAll("alokasiUnitId").map((v) => String(v).trim());
  const sarprasIds = form.getAll("alokasiSarprasId").map((v) => String(v).trim());
  const nominals = form.getAll("alokasiNominal").map((v) => Number(String(v).trim()));

  const panjang = Math.max(unitIds.length, sarprasIds.length, nominals.length);
  const baris = Array.from({ length: panjang }, (_, i) => ({
    unitId: unitIds[i] || null,
    infrastructureId: sarprasIds[i] || null,
    nominal: nominals[i] ?? 0,
  }));

  const galat = periksaAlokasi(total, baris);
  if (galat) throw new GagalIzin(galat);

  // Satu tujuan tidak boleh muncul dua kali — itu selalu salah ketik, dan
  // membuat angka per unit ganda tanpa terlihat.
  const kunci = baris.map((b) => b.unitId ?? b.infrastructureId ?? "proyek");
  if (new Set(kunci).size !== kunci.length) {
    throw new GagalIzin("Ada tujuan pembebanan yang tercantum lebih dari sekali.");
  }

  const daftarUnit = baris.map((b) => b.unitId).filter((x): x is string => !!x);
  if (daftarUnit.length > 0) {
    const sah = await prisma.unit.count({ where: { id: { in: daftarUnit }, projectId } });
    if (sah !== daftarUnit.length) throw new GagalIzin("Ada unit yang tidak sah untuk proyek ini.");
  }

  const daftarSarpras = baris.map((b) => b.infrastructureId).filter((x): x is string => !!x);
  if (daftarSarpras.length > 0) {
    const sah = await prisma.infrastructure.count({
      where: { id: { in: daftarSarpras }, projectId },
    });
    if (sah !== daftarSarpras.length) {
      throw new GagalIzin("Ada item sarana & prasarana yang tidak sah untuk proyek ini.");
    }
  }

  return baris;
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
    const total = angka(form, "total", { min: 1, wajib: true });
    const alokasi = await bacaAlokasi(form, projectId, total);
    const uraian = teks(form, "uraian", true);

    await prisma.expense.create({
      data: {
        projectId,
        tanggal: new Date(),
        peruntukan,
        jenis: pilihan(form, "jenis", JENIS_BIAYA),
        metode: pilihan(form, "metode", METODE_BAYAR),
        uraian,
        total,
        status: pilihan(form, "status", STATUS_BAYAR),
        pic: pengguna.nama,
        bukti: teksOpsional(form, "bukti"),
        posHpp: POS_HPP[peruntukan],
        alokasi: { create: alokasi },
      },
    });

    await catat({
      pengguna, projectId,
      objek: `Pengeluaran · ${peruntukan}`,
      aksi: "Catat pengeluaran",
      ke:
        `${uraian} — ${rpLog(total)}` +
        (alokasi.length > 1 ? ` dibebankan ke ${alokasi.length} tujuan` : ""),
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${proyek.kode}`);
    revalidatePath("/");

    if (alokasi.length > 1) {
      return `Tersimpan sebagai satu transaksi ${rpLog(total)}, dibebankan ke ${alokasi.length} tujuan.`;
    }
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
        id: true, projectId: true,
        peruntukan: true, jenis: true, metode: true, uraian: true,
        total: true, status: true, bukti: true,
        alokasi: {
          select: {
            nominal: true,
            unit: { select: { nomor: true, phase: { select: { kode: true } } } },
            infrastructure: { select: { nama: true } },
          },
        },
        project: { select: { kode: true } },
      },
    });
    if (!lama) throw new GagalIzin("Pengeluaran tidak ditemukan.");

    const pengguna = await izinkan("keuangan", lama.projectId);

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const totalBaru = angka(form, "total", { min: 1, wajib: true });
    const alokasiBaru = await bacaAlokasi(form, lama.projectId, totalBaru);

    const baru = {
      peruntukan,
      jenis: pilihan(form, "jenis", JENIS_BIAYA),
      metode: pilihan(form, "metode", METODE_BAYAR),
      uraian: teks(form, "uraian", true),
      total: totalBaru,
      status: pilihan(form, "status", STATUS_BAYAR),
      bukti: teksOpsional(form, "bukti") || null,
      posHpp: POS_HPP[peruntukan],
    };

    // Alokasi diganti seluruhnya, bukan disunting per baris: pembebanan hanya
    // sah sebagai satu kesatuan yang jumlahnya pas, jadi menggantinya utuh
    // lebih aman daripada mencocokkan baris lama dengan baris baru.
    await prisma.$transaction([
      prisma.expenseAllocation.deleteMany({ where: { expenseId: id } }),
      prisma.expense.update({
        where: { id },
        data: { ...baru, alokasi: { create: alokasiBaru } },
      }),
    ]);

    const namaAlokasiBaru = await ringkasAlokasi(alokasiBaru);

    const jml = await catatDiff({
      pengguna,
      projectId: lama.projectId,
      objek: `Pengeluaran · ${lama.uraian}`,
      sebelum: {
        peruntukan: lama.peruntukan, jenis: lama.jenis, metode: lama.metode,
        uraian: lama.uraian, total: lama.total, status: lama.status,
        bukti: lama.bukti, dibebankanKe: labelAlokasiTersimpan(lama.alokasi),
      },
      sesudah: {
        peruntukan: baru.peruntukan, jenis: baru.jenis, metode: baru.metode,
        uraian: baru.uraian, total: baru.total, status: baru.status,
        bukti: baru.bukti, dibebankanKe: namaAlokasiBaru,
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

/**
 * Ringkasan pembebanan untuk jejak audit, memakai nama yang terbaca manusia
 * beserta nominalnya — "Unit F1-1 Rp 14.000.000 · Unit F1-2 Rp 14.000.000".
 * Id acak tidak berguna bagi orang yang membaca log setahun kemudian.
 */
async function ringkasAlokasi(
  baris: { unitId: string | null; infrastructureId: string | null; nominal: number }[],
): Promise<string> {
  const unitIds = baris.map((b) => b.unitId).filter((x): x is string => !!x);
  const sarprasIds = baris.map((b) => b.infrastructureId).filter((x): x is string => !!x);

  const [units, sarpras] = await Promise.all([
    unitIds.length
      ? prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, nomor: true, phase: { select: { kode: true } } },
        })
      : [],
    sarprasIds.length
      ? prisma.infrastructure.findMany({
          where: { id: { in: sarprasIds } },
          select: { id: true, nama: true },
        })
      : [],
  ]);

  const namaUnit = new Map(units.map((u) => [u.id, `Unit ${u.phase.kode}-${u.nomor}`]));
  const namaSarpras = new Map(sarpras.map((s) => [s.id, `Sarpras ${s.nama}`]));

  return baris
    .map((b) => {
      const nama = b.unitId
        ? namaUnit.get(b.unitId) ?? "unit"
        : b.infrastructureId
          ? namaSarpras.get(b.infrastructureId) ?? "sarpras"
          : "level proyek";
      return `${nama} ${rpLog(b.nominal)}`;
    })
    .join(" · ");
}

/** Bentuk yang sama, tetapi dari alokasi yang sudah tersimpan beserta relasinya. */
function labelAlokasiTersimpan(
  baris: {
    nominal: number;
    unit: { nomor: number; phase: { kode: string } } | null;
    infrastructure: { nama: string } | null;
  }[],
): string {
  return baris
    .map((b) => {
      const nama = b.unit
        ? `Unit ${b.unit.phase.kode}-${b.unit.nomor}`
        : b.infrastructure
          ? `Sarpras ${b.infrastructure.nama}`
          : "level proyek";
      return `${nama} ${rpLog(b.nominal)}`;
    })
    .join(" · ");
}

/**
 * Hapus pengeluaran.
 *
 * Barisnya benar-benar dihapus, tetapi jejak auditnya menyimpan uraian dan
 * nominalnya — jadi penghapusan tetap bisa ditelusuri walau datanya tidak ada
 * lagi. Jejak audit bersifat append-only dan tidak ikut terhapus.
 */
export async function hapusPengeluaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
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
  });
}
