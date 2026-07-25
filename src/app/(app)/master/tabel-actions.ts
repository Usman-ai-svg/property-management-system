"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, rpLog } from "@/lib/audit";
import { GagalIzin, HasilAksi, izinkan, jalankan, teks } from "@/lib/actions/guard";
import { rapGenerik } from "@/lib/calc/boq";

/**
 * Penyimpanan tabel BOQ dan RAP secara utuh.
 *
 * Tabel dikirim sekaligus, bukan per baris, mengikuti cara kerja artifact:
 * pengguna menekan "Ubah", menyunting seluruh tabel, lalu "Simpan".
 *
 * Baris lama dihapus dan diganti seluruhnya dalam satu transaksi. Ini aman
 * karena baris BOQ tidak dirujuk oleh tabel lain — yang dirujuk adalah unitnya.
 * Jejak audit mencatat pergeseran nilai totalnya, bukan tiap sel, supaya log
 * tetap terbaca saat satu penyimpanan mengubah puluhan baris sekaligus.
 */

interface BarisBoqMasuk {
  grup?: string | null;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi?: string | null;
}

interface KelompokRapMasuk {
  nama: string;
  items: {
    nama: string;
    satuan: string;
    volume: number;
    hargaSatuan: number;
    keterangan?: string | null;
  }[];
}

const jumlah = (rows: { volume: number; hargaSatuan: number }[]) =>
  rows.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

function bacaBoq(json: string): BarisBoqMasuk[] {
  let baris: BarisBoqMasuk[];
  try {
    baris = JSON.parse(json);
  } catch {
    throw new GagalIzin("Data BOQ tidak terbaca.");
  }
  if (!Array.isArray(baris) || baris.length === 0) {
    throw new GagalIzin("Tabel BOQ tidak boleh kosong.");
  }
  return baris.map((b) => {
    if (!b.uraian?.trim()) throw new GagalIzin("Setiap baris BOQ harus punya uraian pekerjaan.");
    if (!Number.isFinite(b.volume) || b.volume < 0) throw new GagalIzin(`Volume tidak sah pada "${b.uraian}".`);
    if (!Number.isFinite(b.hargaSatuan) || b.hargaSatuan < 0) throw new GagalIzin(`Harga satuan tidak sah pada "${b.uraian}".`);
    return {
      grup: b.grup?.trim() || null,
      uraian: b.uraian.trim(),
      satuan: b.satuan?.trim() || "ls",
      volume: b.volume,
      hargaSatuan: b.hargaSatuan,
      spesifikasi: b.spesifikasi?.trim() || null,
    };
  });
}

function bacaRap(json: string): { kelompok: KelompokRapMasuk[]; upah: number } {
  let data: { kelompok: KelompokRapMasuk[]; upah: number };
  try {
    data = JSON.parse(json);
  } catch {
    throw new GagalIzin("Data RAP tidak terbaca.");
  }
  if (!Array.isArray(data.kelompok)) throw new GagalIzin("Data RAP tidak terbaca.");
  if (!Number.isFinite(data.upah) || data.upah < 0) throw new GagalIzin("Nilai upah tidak sah.");

  for (const g of data.kelompok) {
    if (!g.nama?.trim()) throw new GagalIzin("Setiap kelompok RAP harus punya nama.");
    for (const it of g.items) {
      if (!it.nama?.trim()) throw new GagalIzin(`Ada material tanpa nama pada kelompok "${g.nama}".`);
      if (!Number.isFinite(it.volume) || it.volume < 0) throw new GagalIzin(`Volume tidak sah pada "${it.nama}".`);
      if (!Number.isFinite(it.hargaSatuan) || it.hargaSatuan < 0) throw new GagalIzin(`Harga tidak sah pada "${it.nama}".`);
    }
  }
  return data;
}

/** Ratakan kelompok jadi baris siap simpan. */
const ratakan = (kelompok: KelompokRapMasuk[]) =>
  kelompok.flatMap((g, gi) =>
    g.items.map((it, ii) => ({
      grup: g.nama.trim(),
      nama: it.nama.trim(),
      satuan: it.satuan?.trim() || "ls",
      volume: it.volume,
      hargaSatuan: it.hargaSatuan,
      keterangan: it.keterangan?.trim() || null,
      urutan: gi * 1000 + ii,
    })),
  );

// ===========================================================================
// BOQ
// ===========================================================================

export async function simpanBoqUnit(unitId: string, barisJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true, nomor: true, projectId: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
        boqItems: { select: { volume: true, hargaSatuan: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", unit.projectId);
    const baris = bacaBoq(barisJson);
    const sebelum = jumlah(unit.boqItems);

    await prisma.$transaction([
      prisma.unitBoqItem.deleteMany({ where: { unitId } }),
      prisma.unitBoqItem.createMany({
        // Grup wajib terisi pada baris BOQ unit; baris baru yang dibuat lewat
        // "+ Tambah Baris" belum tentu punya grup.
        data: baris.map((b, i) => ({ ...b, grup: b.grup ?? "Tambahan", unitId, urutan: i })),
      }),
    ]);

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor} · BOQ/RAB`,
      aksi: "Ubah baris BOQ",
      dari: rpLog(sebelum), ke: rpLog(jumlah(baris)),
    });

    revalidatePath(`/master/${unit.project.kode}`);
    revalidatePath("/");
  });
}

export async function simpanBoqKerjaTambah(customWorkId: string, barisJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const kt = await prisma.customWork.findUnique({
      where: { id: customWorkId },
      select: {
        id: true, judul: true,
        boqItems: { select: { volume: true, hargaSatuan: true } },
        unit: {
          select: {
            nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!kt) throw new GagalIzin("Kerja tambah tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", kt.unit.projectId);
    const baris = bacaBoq(barisJson);
    const sebelum = jumlah(kt.boqItems);

    await prisma.$transaction([
      prisma.customWorkBoqItem.deleteMany({ where: { customWorkId } }),
      prisma.customWorkBoqItem.createMany({
        data: baris.map((b, i) => ({
          customWorkId, uraian: b.uraian, satuan: b.satuan,
          volume: b.volume, hargaSatuan: b.hargaSatuan,
          spesifikasi: b.spesifikasi, urutan: i,
        })),
      }),
    ]);

    await catat({
      pengguna, projectId: kt.unit.projectId,
      objek: `Unit ${kt.unit.phase.kode}-${kt.unit.nomor} · ${kt.judul}`,
      aksi: "Ubah baris BOQ",
      dari: rpLog(sebelum), ke: rpLog(jumlah(baris)),
    });

    revalidatePath(`/master/${kt.unit.project.kode}`);
    revalidatePath("/");
  });
}

export async function simpanBoqSarpras(infrastructureId: string, barisJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const s = await prisma.infrastructure.findUnique({
      where: { id: infrastructureId },
      select: {
        id: true, nama: true, projectId: true,
        project: { select: { kode: true } },
        boqItems: { select: { volume: true, hargaSatuan: true } },
      },
    });
    if (!s) throw new GagalIzin("Item sarpras tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", s.projectId);
    const baris = bacaBoq(barisJson);
    const sebelum = jumlah(s.boqItems);
    const sesudah = jumlah(baris);

    await prisma.$transaction([
      prisma.infrastructureBoqItem.deleteMany({ where: { infrastructureId } }),
      prisma.infrastructureBoqItem.createMany({
        data: baris.map((b, i) => ({
          infrastructureId, grup: b.grup ?? s.nama, uraian: b.uraian, satuan: b.satuan,
          volume: b.volume, hargaSatuan: b.hargaSatuan, spesifikasi: b.spesifikasi, urutan: i,
        })),
      }),
      // Kolom rab pada item disamakan dengan jumlah baris BOQ-nya, supaya
      // angka yang tampil di daftar sarpras tidak berbeda dari rinciannya.
      prisma.infrastructure.update({ where: { id: infrastructureId }, data: { rab: sesudah } }),
    ]);

    await catat({
      pengguna, projectId: s.projectId,
      objek: `Sarpras · ${s.nama} · BOQ/RAB`,
      aksi: "Ubah baris BOQ",
      dari: rpLog(sebelum), ke: rpLog(sesudah),
    });

    revalidatePath(`/master/${s.project.kode}`);
    revalidatePath("/");
  });
}

// ===========================================================================
// RAP
// ===========================================================================

export async function simpanRapUnit(unitId: string, dataJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true, nomor: true, projectId: true, rapUpah: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", unit.projectId);
    const { kelompok, upah } = bacaRap(dataJson);

    await prisma.$transaction([
      prisma.unitRapItem.deleteMany({ where: { unitId } }),
      prisma.unitRapItem.createMany({
        data: ratakan(kelompok).map((r) => ({ ...r, unitId })),
      }),
      prisma.unit.update({ where: { id: unitId }, data: { rapUpah: upah } }),
    ]);

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor} · RAP`,
      aksi: "Ubah rincian RAP",
      dari: `upah ${rpLog(unit.rapUpah)}`, ke: `upah ${rpLog(upah)}`,
    });

    revalidatePath(`/master/${unit.project.kode}`);
    revalidatePath("/");
  });
}

export async function simpanRapKerjaTambah(customWorkId: string, dataJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const kt = await prisma.customWork.findUnique({
      where: { id: customWorkId },
      select: {
        id: true, judul: true, rapUpah: true,
        unit: {
          select: {
            nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!kt) throw new GagalIzin("Kerja tambah tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", kt.unit.projectId);
    const { kelompok, upah } = bacaRap(dataJson);

    await prisma.$transaction([
      prisma.customWorkRapItem.deleteMany({ where: { customWorkId } }),
      prisma.customWorkRapItem.createMany({
        data: ratakan(kelompok).map((r) => ({ ...r, customWorkId })),
      }),
      prisma.customWork.update({ where: { id: customWorkId }, data: { rapUpah: upah } }),
    ]);

    await catat({
      pengguna, projectId: kt.unit.projectId,
      objek: `Unit ${kt.unit.phase.kode}-${kt.unit.nomor} · ${kt.judul} · RAP`,
      aksi: "Ubah rincian RAP",
      dari: `upah ${rpLog(kt.rapUpah)}`, ke: `upah ${rpLog(upah)}`,
    });

    revalidatePath(`/master/${kt.unit.project.kode}`);
    revalidatePath("/");
  });
}

export async function simpanRapSarpras(infrastructureId: string, dataJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const s = await prisma.infrastructure.findUnique({
      where: { id: infrastructureId },
      select: {
        id: true, nama: true, projectId: true, rapUpah: true,
        project: { select: { kode: true } },
      },
    });
    if (!s) throw new GagalIzin("Item sarpras tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", s.projectId);
    const { kelompok, upah } = bacaRap(dataJson);

    await prisma.$transaction([
      prisma.infrastructureRapItem.deleteMany({ where: { infrastructureId } }),
      prisma.infrastructureRapItem.createMany({
        data: ratakan(kelompok).map((r) => ({ ...r, infrastructureId })),
      }),
      prisma.infrastructure.update({ where: { id: infrastructureId }, data: { rapUpah: upah } }),
    ]);

    await catat({
      pengguna, projectId: s.projectId,
      objek: `Sarpras · ${s.nama} · RAP`,
      aksi: "Ubah rincian RAP",
      dari: `upah ${rpLog(s.rapUpah)}`, ke: `upah ${rpLog(upah)}`,
    });

    revalidatePath(`/master/${s.project.kode}`);
    revalidatePath("/");
  });
}

// ===========================================================================
// KERJA TAMBAH
// ===========================================================================

export async function tambahKerjaTambah(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const unitId = teks(form, "unitId", true);
    const judul = teks(form, "judul", true);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true, nomor: true, projectId: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("daftarUnit", unit.projectId);

    // Kerja tambah baru dimulai dengan satu baris BOQ kosong dan RAP kasar,
    // supaya tabelnya langsung bisa disunting alih-alih kosong sama sekali.
    const rap = rapGenerik(0);

    await prisma.customWork.create({
      data: {
        unitId, judul, rapUpah: rap.upah,
        boqItems: {
          create: [{ uraian: "Pekerjaan tambahan", satuan: "ls", volume: 1, hargaSatuan: 0, urutan: 0 }],
        },
        rapItems: { create: rap.items },
      },
    });

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Tambah kerja tambah", ke: judul,
    });

    revalidatePath(`/master/${unit.project.kode}`);
  });
}

export async function hapusKerjaTambah(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const kt = await prisma.customWork.findUnique({
    where: { id },
    select: {
      id: true, judul: true,
      unit: {
        select: {
          nomor: true, projectId: true,
          phase: { select: { kode: true } }, project: { select: { kode: true } },
        },
      },
    },
  });
  if (!kt) return;

  const pengguna = await izinkan("daftarUnit", kt.unit.projectId);

  await prisma.customWork.delete({ where: { id } });
  await catat({
    pengguna, projectId: kt.unit.projectId,
    objek: `Unit ${kt.unit.phase.kode}-${kt.unit.nomor}`,
    aksi: "Hapus kerja tambah", dari: kt.judul, ke: "dihapus",
  });

  revalidatePath(`/master/${kt.unit.project.kode}`);
}
