"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat } from "@/lib/audit";
import { angka, GagalIzin, HasilAksi, izinkan, jalankan, teks } from "@/lib/actions/guard";
import { nilaiTerpasang, periksaBarisBoqSpk } from "@/lib/calc/kontrak-boq";
import { bacaBoqDariExcel } from "@/lib/impor-excel";

/**
 * BOQ SPK: rincian pekerjaan yang diperintahkan sebuah kontrak, dan progres
 * per barisnya.
 *
 * Semua aksi di berkas ini dijaga izin "progress" — sama dengan jalur opname
 * lainnya, karena inilah pengganti pengisian progres manual.
 *
 * PENTING: progres di sini adalah **Progress Vendor**, bukan Progress
 * Konstruksi. Lingkupnya hanya pekerjaan yang diperintahkan SPK ini — vendor
 * atap yang tuntas 100% tidak membuat unitnya selesai. Karena itu aksi di
 * berkas ini TIDAK menyentuh `Unit.progress`; angka itu dihitung dari BOQ
 * Master Proyek, lihat `lib/data/progres-konstruksi.ts`.
 *
 * Keduanya sengaja tidak saling mengisi karena BOQ SPK kerap tidak sebangun
 * dengan BOQ Master — pekerjaan digabung, dipecah, atau diberi uraian berbeda.
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

/**
 * Pastikan baris ditujukan ke objek yang memang tercakup kontrak ini.
 *
 * Tanpa pemeriksaan ini, sebuah SPK bisa mencatat pekerjaan atas unit yang
 * bukan lingkupnya — dan capaian vendor jadi tidak bisa ditelusuri ke objek
 * yang benar saat penagihan.
 */
function pastikanDalamLingkup(
  kontrak: Awaited<ReturnType<typeof ambilKontrak>>,
  unitId: string | null,
  sarprasId: string | null,
) {
  if (unitId && !kontrak.units.some((u) => u.unitId === unitId)) {
    throw new GagalIzin("Unit itu tidak tercakup dalam kontrak ini.");
  }
  if (sarprasId && !kontrak.infrastructures.some((s) => s.infrastructureId === sarprasId)) {
    throw new GagalIzin("Item sarana & prasarana itu tidak tercakup dalam kontrak ini.");
  }
}

/** Segarkan seluruh halaman yang menampilkan progres objek ini. */
function segarkan(kodeProyek: string, vendorId: string) {
  revalidatePath(`/vendor/${vendorId}`);
  revalidatePath(`/konstruksi/${kodeProyek}`);
  revalidatePath(`/master/${kodeProyek}`);
  revalidatePath(`/keuangan/${kodeProyek}`);
  revalidatePath("/");
}

/** Tambah satu baris pekerjaan ke BOQ sebuah SPK. */
export async function tambahBarisBoqSpk(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const tujuan = teks(form, "tujuan", true);
    const [jenis, objekId] = tujuan.split(":");
    const unitId = jenis === "unit" ? objekId : null;
    const sarprasId = jenis === "sarpras" ? objekId : null;
    pastikanDalamLingkup(kontrak, unitId, sarprasId);

    const baris = {
      unitId, infrastructureId: sarprasId,
      grup: teks(form, "grup") || "Umum",
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan") || "ls",
      volume: angka(form, "volume"),
      hargaSatuan: angka(form, "hargaSatuan"),
      progress: angka(form, "progress", { min: 0, max: 100 }),
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
      pengguna, projectId: kontrak.projectId,
      objek: `SPK ${kontrak.kode}`,
      aksi: "Tambah baris BOQ",
      ke: `${baris.uraian} — ${baris.volume} ${baris.satuan}`,
    });

    segarkan(kontrak.project.kode, kontrak.vendorId);
  });
}

/** Ubah satu baris BOQ SPK, termasuk progresnya. */
export async function ubahBarisBoqSpk(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.contractBoqItem.findUnique({
      where: { id },
      select: {
        id: true, contractId: true, unitId: true, infrastructureId: true,
        uraian: true, volume: true, hargaSatuan: true, progress: true,
      },
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
      progress: angka(form, "progress", { min: 0, max: 100 }),
    };

    const galat = periksaBarisBoqSpk({
      ...baru, unitId: lama.unitId, infrastructureId: lama.infrastructureId,
    });
    if (galat) throw new GagalIzin(galat);

    await prisma.contractBoqItem.update({ where: { id }, data: baru });


    if (lama.progress !== baru.progress) {
      await catat({
        pengguna, projectId: kontrak.projectId,
        objek: `SPK ${kontrak.kode} · ${baru.uraian}`,
        aksi: "Ubah progres baris BOQ",
        dari: `${lama.progress}%`, ke: `${baru.progress}%`,
      });
    }

    segarkan(kontrak.project.kode, kontrak.vendorId);
  });
}

/**
 * Simpan progres beberapa baris sekaligus.
 *
 * Inilah jalur yang dipakai QS saat opname: satu tabel berisi seluruh baris
 * SPK, isi persennya, simpan sekali. Menyimpan baris per baris akan berarti
 * puluhan kali penghitungan ulang progres unit untuk satu kali opname.
 */
export async function simpanProgresBoqSpk(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const ids = form.getAll("barisId").map(String);
    const nilai = form.getAll("barisProgress").map((v) => Number(String(v)));
    if (ids.length !== nilai.length) {
      throw new GagalIzin("Data progres tidak lengkap. Muat ulang halaman lalu coba lagi.");
    }

    const sebelum = await prisma.contractBoqItem.findMany({
      where: { id: { in: ids }, contractId },
      select: { id: true, uraian: true, progress: true },
    });
    const petaLama = new Map(sebelum.map((b) => [b.id, b]));

    const ubah: { id: string; progress: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      const lama = petaLama.get(ids[i]);
      // Baris yang bukan milik kontrak ini diabaikan, bukan menggagalkan
      // seluruh penyimpanan — form bisa saja tertinggal versi lama.
      if (!lama) continue;

      const p = nilai[i];
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new GagalIzin(`Progres "${lama.uraian}" harus di antara 0 dan 100 persen.`);
      }
      const bulat = Math.round(p);
      if (bulat !== lama.progress) ubah.push({ id: ids[i], progress: bulat });
    }

    if (ubah.length === 0) return "Tidak ada progres yang berubah.";

    await prisma.$transaction(
      ubah.map((u) =>
        prisma.contractBoqItem.update({ where: { id: u.id }, data: { progress: u.progress } }),
      ),
    );


    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `SPK ${kontrak.kode}`,
      aksi: "Opname progres BOQ",
      ke: `${ubah.length} baris diperbarui`,
    });

    segarkan(kontrak.project.kode, kontrak.vendorId);
    return `${ubah.length} baris tersimpan.`;
  });
}

/** Hapus satu baris BOQ SPK. */
export async function hapusBarisBoqSpk(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const baris = await prisma.contractBoqItem.findUnique({
      where: { id },
      select: {
        id: true, contractId: true, unitId: true, infrastructureId: true, uraian: true,
      },
    });
    if (!baris) throw new GagalIzin("Baris BOQ tidak ditemukan.");

    const kontrak = await ambilKontrak(baris.contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    await prisma.contractBoqItem.delete({ where: { id } });


    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `SPK ${kontrak.kode}`,
      aksi: "Hapus baris BOQ",
      dari: baris.uraian,
    });

    segarkan(kontrak.project.kode, kontrak.vendorId);
  });
}

/**
 * Impor BOQ SPK dari berkas Excel, untuk satu objek sekaligus.
 *
 * Memakai pembaca yang sama dengan impor BOQ unit supaya bentuk berkas yang
 * dikenal staf tidak bertambah. Kolom progres tidak ikut diimpor — berkas SPK
 * berisi lingkup pekerjaan, sedangkan progres adalah hasil opname yang diisi
 * belakangan.
 */
export async function imporBoqSpk(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const tujuan = teks(form, "tujuan", true);
    const [jenis, objekId] = tujuan.split(":");
    const unitId = jenis === "unit" ? objekId : null;
    const sarprasId = jenis === "sarpras" ? objekId : null;
    pastikanDalamLingkup(kontrak, unitId, sarprasId);

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) {
      throw new GagalIzin("Pilih berkas Excel lebih dulu.");
    }

    const rows = await bacaBoqDariExcel(await berkas.arrayBuffer());
    if (rows.length === 0) throw new GagalIzin("Tidak ada baris pekerjaan yang terbaca.");

    // Impor menggantikan seluruh baris objek ini pada SPK, bukan menambahi —
    // mengimpor ulang berkas yang sama seharusnya tidak menggandakan BOQ.
    await prisma.$transaction([
      prisma.contractBoqItem.deleteMany({
        where: { contractId, ...(unitId ? { unitId } : { infrastructureId: sarprasId }) },
      }),
      prisma.contractBoqItem.createMany({
        data: rows.map((r, i) => ({
          contractId, unitId, infrastructureId: sarprasId,
          grup: r.grup ?? "Umum", uraian: r.uraian, satuan: r.satuan,
          volume: r.volume, hargaSatuan: r.hargaSatuan,
          progress: 0, urutan: i + 1,
        })),
      }),
    ]);


    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `SPK ${kontrak.kode}`,
      aksi: "Impor BOQ dari Excel",
      ke: `${rows.length} baris`,
    });

    segarkan(kontrak.project.kode, kontrak.vendorId);
    return `${rows.length} baris pekerjaan diimpor.`;
  });
}

/**
 * Salin BOQ satu objek ke seluruh objek lain dalam kontrak.
 *
 * SPK borongan untuk 10 unit tipe sama berisi rincian pekerjaan yang sama
 * sepuluh kali. Tanpa ini, QS harus mengetik atau mengimpor sepuluh kali
 * untuk isi yang identik.
 */
export async function salinBoqKeSemua(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);
    const kontrak = await ambilKontrak(contractId);
    const pengguna = await izinkan("progress", kontrak.projectId);

    const tujuan = teks(form, "sumber", true);
    const [jenis, sumberId] = tujuan.split(":");
    if (jenis !== "unit") {
      throw new GagalIzin("Penyalinan hanya tersedia antar unit dalam satu kontrak.");
    }

    const sumber = await prisma.contractBoqItem.findMany({
      where: { contractId, unitId: sumberId },
      orderBy: { urutan: "asc" },
      select: {
        grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, urutan: true,
      },
    });
    if (sumber.length === 0) throw new GagalIzin("Unit sumber belum punya baris BOQ.");

    const lain = kontrak.units.map((u) => u.unitId).filter((id) => id !== sumberId);
    if (lain.length === 0) throw new GagalIzin("Kontrak ini hanya mencakup satu unit.");

    // Progres sengaja TIDAK ikut disalin — yang disalin lingkup pekerjaan,
    // bukan capaian lapangan. Menyalin progres akan mengarang opname.
    await prisma.$transaction([
      prisma.contractBoqItem.deleteMany({ where: { contractId, unitId: { in: lain } } }),
      prisma.contractBoqItem.createMany({
        data: lain.flatMap((unitId) =>
          sumber.map((s) => ({ ...s, contractId, unitId, progress: 0 })),
        ),
      }),
    ]);

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `SPK ${kontrak.kode}`,
      aksi: "Salin BOQ ke seluruh unit",
      ke: `${sumber.length} baris × ${lain.length} unit`,
    });

    segarkan(kontrak.project.kode, kontrak.vendorId);
    return `BOQ disalin ke ${lain.length} unit.`;
  });
}

