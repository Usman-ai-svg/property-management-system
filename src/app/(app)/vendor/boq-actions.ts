"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat } from "@/lib/audit";
import { angka, GagalIzin, HasilAksi, izinkan, jalankan, teks } from "@/lib/actions/guard";
import { periksaBarisBoqSpk } from "@/lib/calc/kontrak-boq";
import { bacaBoqDariExcel } from "@/lib/impor-excel";
import { mingguBaru } from "@/lib/calc/hari-kerja";

/**
 * BOQ SPK — model TEMPLATE + OVERRIDE.
 *
 * `ContractBoqItem` kini adalah TEMPLATE di level kontrak: "satu BOQ berlaku
 * untuk tiap unit". Tiap objek (unit/sarpras) mewarisi baris template; nilainya
 * bisa di-override per objek dan opname (progress) per objek disimpan di
 * `ContractBoqUnit`. Override bersifat field-level nullable — mengedit template
 * langsung menurun ke objek yang belum menyesuaikan field itu.
 *
 * Semua aksi dijaga izin "progress". PENTING: ini Progress Vendor (lingkup satu
 * SPK), BUKAN Progress Konstruksi (BOQ Master). Aksi di sini tak menyentuh
 * `Unit.progress`.
 */

/** Muat kontrak beserta konteks yang dibutuhkan seluruh aksi di sini. */
async function ambilKontrak(contractId: string) {
  const kontrak = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true, kode: true, projectId: true, vendorId: true,
      project: { select: { kode: true } },
      units: { select: { unitId: true } },
      infrastructures: { select: { infrastructureId: true } },
    },
  });
  if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");
  return kontrak;
}

type Kontrak = Awaited<ReturnType<typeof ambilKontrak>>;

/**
 * Uraikan penanda objek "unit:<id>" | "sarpras:<id>" menjadi id yang benar,
 * sekaligus memastikan objek itu memang tercakup kontrak ini.
 */
function bacaObjek(kontrak: Kontrak, tujuan: string): { unitId: string | null; infrastructureId: string | null } {
  const pisah = tujuan.indexOf(":");
  const jenis = pisah >= 0 ? tujuan.slice(0, pisah) : "";
  const id = pisah >= 0 ? tujuan.slice(pisah + 1) : "";
  const unitId = jenis === "unit" ? id : null;
  const infrastructureId = jenis === "sarpras" ? id : null;
  if (unitId && !kontrak.units.some((u) => u.unitId === unitId)) {
    throw new GagalIzin("Unit itu tidak tercakup dalam kontrak ini.");
  }
  if (infrastructureId && !kontrak.infrastructures.some((s) => s.infrastructureId === infrastructureId)) {
    throw new GagalIzin("Item sarana & prasarana itu tidak tercakup dalam kontrak ini.");
  }
  if (!unitId && !infrastructureId) throw new GagalIzin("Objek tujuan tidak sah.");
  return { unitId, infrastructureId };
}

/** Baca angka override opsional: string kosong → null (ikut template). */
function angkaOpsional(form: FormData, nama: string): number | null {
  const isi = String(form.get(nama) ?? "").trim();
  if (isi === "") return null;
  const n = Number(isi);
  return Number.isFinite(n) ? n : null;
}

/** Baca teks override opsional: string kosong → null (ikut template). */
function teksOverride(form: FormData, nama: string): string | null {
  const isi = String(form.get(nama) ?? "").trim();
  return isi === "" ? null : isi;
}

/** Segarkan seluruh halaman yang menampilkan BOQ/progres SPK ini. */
function segarkan(kontrak: Kontrak) {
  revalidatePath(`/vendor/${kontrak.vendorId}`);
  revalidatePath(`/vendor/${kontrak.vendorId}/kontrak/${kontrak.kode}`);
  revalidatePath(`/konstruksi/${kontrak.project.kode}`);
  revalidatePath(`/master/${kontrak.project.kode}`);
  revalidatePath(`/keuangan/${kontrak.project.kode}`);
  revalidatePath("/");
}

// ===========================================================================
// TEMPLATE (level SPK) — berlaku untuk semua objek
// ===========================================================================

/** Tambah satu baris ke TEMPLATE BOQ sebuah SPK (menurun ke semua objek). */
export async function tambahBarisBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const baris = {
      grup: teks(form, "grup") || "Umum",
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan") || "ls",
      volume: angka(form, "volume"),
      hargaSatuan: angka(form, "hargaSatuan"),
    };
    const galat = periksaBarisBoqSpk(baris);
    if (galat) throw new GagalIzin(galat);

    const terakhir = await prisma.contractBoqItem.findFirst({
      where: { contractId },
      orderBy: { urutan: "desc" },
      select: { urutan: true },
    });
    await prisma.contractBoqItem.create({
      data: { ...baris, contractId, urutan: (terakhir?.urutan ?? 0) + 1 },
    });

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode}`,
      aksi: "Tambah baris BOQ template", ke: `${baris.uraian} — ${baris.volume} ${baris.satuan}`,
    });
    segarkan(kontrak);
  });
}

/** Ubah satu baris TEMPLATE BOQ SPK (berlaku ke semua objek yang belum override). */
export async function ubahBarisBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const lama = await prisma.contractBoqItem.findUnique({
      where: { id },
      select: { id: true, contractId: true, uraian: true },
    });
    if (!lama) throw new GagalIzin("Baris BOQ tidak ditemukan.");
    const kontrak = await ambilKontrak(lama.contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const baru = {
      grup: teks(form, "grup") || "Umum",
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan") || "ls",
      volume: angka(form, "volume"),
      hargaSatuan: angka(form, "hargaSatuan"),
    };
    const galat = periksaBarisBoqSpk(baru);
    if (galat) throw new GagalIzin(galat);

    await prisma.contractBoqItem.update({ where: { id }, data: baru });

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode} · ${baru.uraian}`,
      aksi: "Ubah baris BOQ template",
    });
    segarkan(kontrak);
  });
}

/** Hapus satu baris TEMPLATE BOQ SPK (override & opname objek ikut terhapus). */
export async function hapusBarisBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const baris = await prisma.contractBoqItem.findUnique({
      where: { id },
      select: { id: true, contractId: true, uraian: true },
    });
    if (!baris) throw new GagalIzin("Baris BOQ tidak ditemukan.");
    const kontrak = await ambilKontrak(baris.contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    await prisma.contractBoqItem.delete({ where: { id } });

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode}`,
      aksi: "Hapus baris BOQ template", dari: baris.uraian,
    });
    segarkan(kontrak);
  });
}

/**
 * Impor TEMPLATE BOQ SPK dari Excel — mengganti seluruh baris template kontrak
 * (override & opname objek ikut ter-reset karena barisnya berganti).
 */
export async function imporBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) {
      throw new GagalIzin("Pilih berkas Excel lebih dulu.");
    }
    const rows = await bacaBoqDariExcel(await berkas.arrayBuffer());
    if (rows.length === 0) throw new GagalIzin("Tidak ada baris pekerjaan yang terbaca.");

    await prisma.$transaction([
      prisma.contractBoqItem.deleteMany({ where: { contractId } }),
      prisma.contractBoqItem.createMany({
        data: rows.map((r, i) => ({
          contractId, grup: r.grup ?? "Umum", uraian: r.uraian, satuan: r.satuan,
          volume: r.volume, hargaSatuan: r.hargaSatuan, urutan: i + 1,
        })),
      }),
    ]);

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode}`,
      aksi: "Impor BOQ template dari Excel", ke: `${rows.length} baris`,
    });
    segarkan(kontrak);
    return `${rows.length} baris pekerjaan diimpor sebagai template SPK.`;
  });
}

// ===========================================================================
// OVERRIDE (per objek) — hanya menyesuaikan nilai untuk satu objek
// ===========================================================================

/** Cari override sebuah baris template untuk satu objek (unit/sarpras). */
async function cariOverride(boqItemId: string, unitId: string | null, infrastructureId: string | null) {
  return prisma.contractBoqUnit.findFirst({
    where: { boqItemId, ...(unitId ? { unitId } : { infrastructureId }) },
    select: { id: true, progress: true, progressLalu: true, progressLaluPada: true },
  });
}

/** Simpan/ubah override nilai satu baris template untuk satu objek. */
export async function ubahOverrideBoq(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const boqItemId = teks(form, "boqItemId", true);
    const template = await prisma.contractBoqItem.findUnique({
      where: { id: boqItemId },
      select: { id: true, contractId: true, uraian: true },
    });
    if (!template) throw new GagalIzin("Baris BOQ tidak ditemukan.");
    const kontrak = await ambilKontrak(template.contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);
    const { unitId, infrastructureId } = bacaObjek(kontrak, teks(form, "objek", true));

    const override = {
      grup: teksOverride(form, "grup"),
      uraian: teksOverride(form, "uraian"),
      satuan: teksOverride(form, "satuan"),
      volume: angkaOpsional(form, "volume"),
      hargaSatuan: angkaOpsional(form, "hargaSatuan"),
    };
    // Validasi hanya bila nilai diisi (yang kosong = ikut template).
    const galat = periksaBarisBoqSpk({
      uraian: override.uraian ?? undefined,
      volume: override.volume ?? 0,
      hargaSatuan: override.hargaSatuan ?? 0,
    });
    if (galat) throw new GagalIzin(galat);

    const ada = await cariOverride(boqItemId, unitId, infrastructureId);
    if (ada) {
      await prisma.contractBoqUnit.update({ where: { id: ada.id }, data: override });
    } else {
      await prisma.contractBoqUnit.create({
        data: { ...override, contractId: kontrak.id, boqItemId, unitId, infrastructureId },
      });
    }

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode} · ${override.uraian ?? template.uraian}`,
      aksi: "Sesuaikan BOQ per objek",
    });
    segarkan(kontrak);
  });
}

/** Kembalikan sebuah baris objek ke template (buang override nilainya). */
export async function resetOverrideBoq(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const boqItemId = teks(form, "boqItemId", true);
    const template = await prisma.contractBoqItem.findUnique({
      where: { id: boqItemId },
      select: { id: true, contractId: true },
    });
    if (!template) throw new GagalIzin("Baris BOQ tidak ditemukan.");
    const kontrak = await ambilKontrak(template.contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);
    const { unitId, infrastructureId } = bacaObjek(kontrak, teks(form, "objek", true));

    const ada = await cariOverride(boqItemId, unitId, infrastructureId);
    if (!ada) return;
    // Bila objek ini belum diopname, buang recordnya sekalian; kalau sudah,
    // hanya nolkan override definisinya supaya progresnya tetap.
    if (ada.progress === 0) {
      await prisma.contractBoqUnit.delete({ where: { id: ada.id } });
    } else {
      await prisma.contractBoqUnit.update({
        where: { id: ada.id },
        data: { grup: null, uraian: null, satuan: null, volume: null, hargaSatuan: null },
      });
    }

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode}`,
      aksi: "Samakan baris BOQ ke template",
    });
    segarkan(kontrak);
  });
}

// ===========================================================================
// OPNAME (progress per objek) — diisi di modul Konstruksi
// ===========================================================================

/**
 * Simpan progres beberapa baris sekaligus untuk SATU objek. Progres disimpan di
 * `ContractBoqUnit` (dibuat bila belum ada). Aturan minggu berjalan sama dengan
 * opname konstruksi: koreksi dalam minggu yang sama tak menggeser `progressLalu`.
 */
export async function simpanProgresBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);
    const { unitId, infrastructureId } = bacaObjek(kontrak, teks(form, "objek", true));

    const ids = form.getAll("barisId").map(String);
    const nilai = form.getAll("barisProgress").map((v) => Number(String(v)));
    if (ids.length !== nilai.length) {
      throw new GagalIzin("Data progres tidak lengkap. Muat ulang halaman lalu coba lagi.");
    }

    // Baris template yang sah untuk kontrak ini + override objek yang sudah ada.
    const [template, override] = await Promise.all([
      prisma.contractBoqItem.findMany({ where: { contractId }, select: { id: true, uraian: true } }),
      prisma.contractBoqUnit.findMany({
        where: { contractId, ...(unitId ? { unitId } : { infrastructureId }) },
        select: { id: true, boqItemId: true, progress: true, progressLalu: true, progressLaluPada: true },
      }),
    ]);
    const sahId = new Set(template.map((t) => t.id));
    const petaOverride = new Map(override.map((o) => [o.boqItemId, o]));
    const petaUraian = new Map(template.map((t) => [t.id, t.uraian]));

    const sekarang = new Date();
    const buat: {
      boqItemId: string; progress: number; progressLalu: number; progressLaluPada: Date;
    }[] = [];
    const ubah: {
      id: string; progress: number; progressLalu: number; progressLaluPada: Date;
    }[] = [];

    for (let i = 0; i < ids.length; i++) {
      const boqItemId = ids[i];
      if (!sahId.has(boqItemId)) continue; // form tertinggal versi lama → abaikan
      const p = nilai[i];
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new GagalIzin(`Progres "${petaUraian.get(boqItemId) ?? "baris"}" harus di antara 0 dan 100 persen.`);
      }
      const bulat = Math.round(p);
      const lama = petaOverride.get(boqItemId);
      const progresLama = lama?.progress ?? 0;
      if (bulat === progresLama) continue;

      const baru = mingguBaru(lama?.progressLaluPada ?? null, sekarang);
      const progressLalu = baru ? progresLama : (lama?.progressLalu ?? 0);
      const progressLaluPada = baru ? sekarang : (lama?.progressLaluPada ?? sekarang);
      if (lama) ubah.push({ id: lama.id, progress: bulat, progressLalu, progressLaluPada });
      else buat.push({ boqItemId, progress: bulat, progressLalu, progressLaluPada });
    }

    if (buat.length === 0 && ubah.length === 0) return "Tidak ada progres yang berubah.";

    await prisma.$transaction([
      ...ubah.map((u) =>
        prisma.contractBoqUnit.update({
          where: { id: u.id },
          data: { progress: u.progress, progressLalu: u.progressLalu, progressLaluPada: u.progressLaluPada },
        }),
      ),
      ...buat.map((b) =>
        prisma.contractBoqUnit.create({
          data: {
            contractId, boqItemId: b.boqItemId, unitId, infrastructureId,
            progress: b.progress, progressLalu: b.progressLalu, progressLaluPada: b.progressLaluPada,
          },
        }),
      ),
    ]);

    await catat({
      pengguna, projectId: kontrak.projectId, objek: `SPK ${kontrak.kode}`,
      aksi: "Opname progres BOQ", ke: `${buat.length + ubah.length} baris diperbarui`,
    });
    segarkan(kontrak);
    return `${buat.length + ubah.length} baris tersimpan.`;
  });
}
