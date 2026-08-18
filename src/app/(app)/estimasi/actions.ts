"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import {
  JENIS_KONTRAK, KATEGORI_HARGA_DASAR, KATEGORI_PEMASOK, STATUS_PEMASOK,
} from "@/lib/domain/enums";
import { hargaSatuanDb } from "@/lib/tampilan/estimasi";
import { bacaBoqDariExcel } from "@/lib/impor-excel";
import { bersihkanNamaFile, periksaBerkas, simpanBerkas } from "@/lib/storage";

/**
 * Lapisan perubahan data modul Estimasi RAB.
 *
 * Seluruhnya di bawah izin "hargaRabRap" — harga satuan pekerjaan, harga dasar,
 * dan penawaran pemasok. Pustaka AHSP (pemasok/harga dasar/analisa) bersifat
 * terpusat, jadi izinnya diperiksa tanpa projectId. RAB Estimasi menempel pada
 * proyek, jadi projectId ikut diperiksa supaya batas akses per-proyek berlaku.
 */

const IZIN = "hargaRabRap" as const;
const IZIN_SETUJU = "setujuiRab" as const;

/** RAB hanya boleh diubah isinya saat Draft atau Ditolak (belum/berhenti diajukan). */
function pastikanEditable(status: string, nomor: string) {
  if (status !== "Draft" && status !== "Ditolak") {
    throw new GagalIzin(`RAB ${nomor} berstatus ${status} — hanya bisa diubah saat Draft atau Ditolak.`);
  }
}

function segarkanPustaka() {
  revalidatePath("/estimasi/pustaka");
  revalidatePath("/estimasi");
}

function segarkanEstimasi(id: string) {
  revalidatePath(`/estimasi/${id}`);
  revalidatePath("/estimasi");
}

// ===========================================================================
// PEMASOK
// ===========================================================================

function bacaPemasok(form: FormData) {
  return {
    nama: teks(form, "nama", true),
    kategori: pilihan(form, "kategori", KATEGORI_PEMASOK),
    kontakNama: teks(form, "kontakNama") || "",
    kontakTelepon: teks(form, "kontakTelepon") || "",
    alamat: teks(form, "alamat") || "",
    kecamatan: teks(form, "kecamatan") || "",
    provinsi: teks(form, "provinsi") || "",
    status: pilihan(form, "status", STATUS_PEMASOK),
  };
}

const LABEL_PEMASOK = {
  nama: "Nama", kategori: "Kategori", kontakNama: "Nama Kontak", kontakTelepon: "No. Telepon",
  alamat: "Alamat", kecamatan: "Kecamatan", provinsi: "Provinsi", status: "Status",
};

export async function tambahPemasok(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan(IZIN);
    const data = bacaPemasok(form);
    await prisma.pemasok.create({ data });
    await catat({ pengguna, objek: `Pemasok ${data.nama}`, aksi: "Tambah pemasok", ke: data.kategori });
    segarkanPustaka();
  });
}

export async function ubahPemasok(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan(IZIN);
    const lama = await prisma.pemasok.findUnique({ where: { id } });
    if (!lama) throw new GagalIzin("Pemasok tidak ditemukan.");

    const data = bacaPemasok(form);
    await prisma.pemasok.update({ where: { id }, data });
    const jml = await catatDiff({
      pengguna, objek: `Pemasok ${lama.nama}`, sebelum: lama, sesudah: data, label: LABEL_PEMASOK,
    });
    segarkanPustaka();
    return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
  });
}

export async function hapusPemasok(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.pemasok.findUnique({
      where: { id },
      select: { id: true, nama: true, _count: { select: { penawaran: true } } },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN);

    if (lama._count.penawaran > 0) {
      throw new GagalIzin(
        `Pemasok "${lama.nama}" masih punya ${lama._count.penawaran} penawaran harga. Hapus penawarannya lebih dulu.`,
      );
    }
    await prisma.pemasok.delete({ where: { id } });
    await catat({ pengguna, objek: `Pemasok ${lama.nama}`, aksi: "Hapus pemasok", dari: lama.nama });
    segarkanPustaka();
  });
}

// ===========================================================================
// HARGA DASAR (price book) + PENAWARAN
// ===========================================================================

export async function tambahHargaDasar(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan(IZIN);
    const kode = teks(form, "kode", true).toUpperCase();
    const bentrok = await prisma.hargaDasar.count({ where: { kode } });
    if (bentrok) throw new GagalIzin(`Kode harga dasar "${kode}" sudah dipakai.`);

    const data = {
      kode,
      kategori: pilihan(form, "kategori", KATEGORI_HARGA_DASAR),
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      hargaAcuan: angka(form, "hargaAcuan", { min: 0 }),
    };
    await prisma.hargaDasar.create({ data });
    await catat({
      pengguna, objek: `Harga dasar ${kode}`, aksi: "Tambah harga dasar",
      ke: `${data.uraian} — ${rpLog(data.hargaAcuan)}/${data.satuan}`,
    });
    segarkanPustaka();
  });
}

export async function ubahHargaDasar(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan(IZIN);
    const lama = await prisma.hargaDasar.findUnique({ where: { id } });
    if (!lama) throw new GagalIzin("Harga dasar tidak ditemukan.");

    const kode = teks(form, "kode", true).toUpperCase();
    if (kode !== lama.kode) {
      const bentrok = await prisma.hargaDasar.count({ where: { kode } });
      if (bentrok) throw new GagalIzin(`Kode harga dasar "${kode}" sudah dipakai.`);
    }

    const data = {
      kode,
      kategori: pilihan(form, "kategori", KATEGORI_HARGA_DASAR),
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      hargaAcuan: angka(form, "hargaAcuan", { min: 0 }),
    };
    await prisma.hargaDasar.update({ where: { id }, data });

    // Perubahan harga acuan MENGUBAH harga satuan analisa yang memakainya —
    // tapi TIDAK menggeser baris RAB yang sudah tersnapshot. Itu inti disainnya.
    const jml = await catatDiff({
      pengguna, objek: `Harga dasar ${lama.kode}`, sebelum: lama, sesudah: data,
      label: { kode: "Kode", kategori: "Kategori", uraian: "Uraian", satuan: "Satuan", hargaAcuan: "Harga acuan" },
      format: { hargaAcuan: rpLog },
    });
    segarkanPustaka();
    return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
  });
}

export async function hapusHargaDasar(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.hargaDasar.findUnique({
      where: { id },
      select: { id: true, kode: true, uraian: true, _count: { select: { komponen: true } } },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN);

    if (lama._count.komponen > 0) {
      throw new GagalIzin(
        `Harga dasar ${lama.kode} masih dipakai ${lama._count.komponen} komponen analisa. Lepaskan dari analisanya lebih dulu.`,
      );
    }
    // Penawaran ikut terhapus (onDelete: Cascade).
    await prisma.hargaDasar.delete({ where: { id } });
    await catat({ pengguna, objek: `Harga dasar ${lama.kode}`, aksi: "Hapus harga dasar", dari: lama.uraian });
    segarkanPustaka();
  });
}

export async function tambahPenawaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan(IZIN);
    const hargaDasarId = teks(form, "hargaDasarId", true);
    const pemasokId = teks(form, "pemasokId", true);

    const [hd, pmk] = await Promise.all([
      prisma.hargaDasar.findUnique({ where: { id: hargaDasarId }, select: { id: true, kode: true, satuan: true } }),
      prisma.pemasok.findUnique({ where: { id: pemasokId }, select: { id: true, nama: true } }),
    ]);
    if (!hd) throw new GagalIzin("Harga dasar tidak ditemukan.");
    if (!pmk) throw new GagalIzin("Pemasok tidak ditemukan.");

    const harga = angka(form, "harga", { min: 0, wajib: true });
    const keterangan = teksOpsional(form, "keterangan");
    const jadikanAcuan = String(form.get("jadikanAcuan") ?? "") === "on";

    await prisma.penawaranPemasok.create({
      data: { hargaDasarId, pemasokId, harga, keterangan },
    });
    if (jadikanAcuan) {
      await prisma.hargaDasar.update({ where: { id: hargaDasarId }, data: { hargaAcuan: harga } });
    }

    await catat({
      pengguna, objek: `Harga dasar ${hd.kode}`, aksi: "Tambah penawaran",
      ke: `${pmk.nama}: ${rpLog(harga)}/${hd.satuan}${jadikanAcuan ? " (jadi acuan)" : ""}`,
    });
    segarkanPustaka();
  });
}

export async function jadikanAcuan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan(IZIN);
    const penawaran = await prisma.penawaranPemasok.findUnique({
      where: { id },
      select: {
        harga: true, hargaDasarId: true,
        pemasok: { select: { nama: true } },
        hargaDasar: { select: { kode: true, hargaAcuan: true, satuan: true } },
      },
    });
    if (!penawaran) throw new GagalIzin("Penawaran tidak ditemukan.");

    await prisma.hargaDasar.update({
      where: { id: penawaran.hargaDasarId },
      data: { hargaAcuan: penawaran.harga },
    });
    await catat({
      pengguna, objek: `Harga dasar ${penawaran.hargaDasar.kode}`, aksi: "Ubah harga acuan",
      dari: rpLog(penawaran.hargaDasar.hargaAcuan),
      ke: `${rpLog(penawaran.harga)} — penawaran ${penawaran.pemasok.nama}`,
    });
    segarkanPustaka();
    return `Harga acuan ${penawaran.hargaDasar.kode} kini ${rpLog(penawaran.harga)}/${penawaran.hargaDasar.satuan}.`;
  });
}

export async function hapusPenawaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.penawaranPemasok.findUnique({
      where: { id },
      select: { id: true, harga: true, hargaDasar: { select: { kode: true } }, pemasok: { select: { nama: true } } },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN);
    await prisma.penawaranPemasok.delete({ where: { id } });
    await catat({
      pengguna, objek: `Harga dasar ${lama.hargaDasar.kode}`, aksi: "Hapus penawaran",
      dari: `${lama.pemasok.nama}: ${rpLog(lama.harga)}`,
    });
    segarkanPustaka();
  });
}

// ===========================================================================
// ANALISA + KOMPONEN
// ===========================================================================

interface KomponenIsian {
  hargaDasarId: string;
  koefisien: number;
}

/** Baca & validasi daftar komponen dari kolom JSON tersembunyi. */
async function bacaKomponen(form: FormData): Promise<KomponenIsian[]> {
  let baris: { hargaDasarId?: string; koefisien?: number | string }[];
  try {
    baris = JSON.parse(teks(form, "komponen", true));
  } catch {
    throw new GagalIzin("Data komponen analisa tidak terbaca.");
  }

  const sah = baris
    .filter((b) => b.hargaDasarId?.trim())
    .map((b) => ({ hargaDasarId: String(b.hargaDasarId), koefisien: Number(b.koefisien) }));

  if (sah.length === 0) throw new GagalIzin("Analisa harus punya minimal satu komponen.");
  for (const k of sah) {
    if (!Number.isFinite(k.koefisien) || k.koefisien <= 0) {
      throw new GagalIzin("Setiap koefisien komponen harus berupa angka lebih dari nol.");
    }
  }

  // Pastikan seluruh harga dasar yang dirujuk memang ada.
  const idUnik = [...new Set(sah.map((k) => k.hargaDasarId))];
  const ada = await prisma.hargaDasar.count({ where: { id: { in: idUnik } } });
  if (ada !== idUnik.length) throw new GagalIzin("Ada komponen yang menunjuk harga dasar tak dikenal.");

  return sah;
}

export async function simpanAnalisa(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan(IZIN);
    const id = teksOpsional(form, "id");
    const kode = teks(form, "kode", true).toUpperCase();

    const data = {
      kode,
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      kelompok: teks(form, "kelompok", true),
      overheadPct: angka(form, "overheadPct", { min: 0, max: 100 }),
    };
    const komponen = await bacaKomponen(form);

    if (id) {
      const lama = await prisma.analisaHarga.findUnique({ where: { id }, select: { id: true, kode: true } });
      if (!lama) throw new GagalIzin("Analisa tidak ditemukan.");
      if (kode !== lama.kode) {
        const bentrok = await prisma.analisaHarga.count({ where: { kode } });
        if (bentrok) throw new GagalIzin(`Kode analisa "${kode}" sudah dipakai.`);
      }

      // Komponen ditulis ulang seluruhnya: lebih sederhana dan tak ada risiko
      // baris yatim. Baris RAB yang memakai analisa ini tidak terpengaruh —
      // harganya sudah tersnapshot.
      await prisma.$transaction([
        prisma.komponenAnalisa.deleteMany({ where: { analisaId: id } }),
        prisma.analisaHarga.update({
          where: { id },
          data: { ...data, komponen: { create: komponen.map((k, i) => ({ ...k, urutan: i })) } },
        }),
      ]);
      await catat({ pengguna, objek: `Analisa ${lama.kode}`, aksi: "Ubah analisa", ke: `${data.uraian} — ${komponen.length} komponen` });
      segarkanPustaka();
      return "Analisa tersimpan.";
    }

    const bentrok = await prisma.analisaHarga.count({ where: { kode } });
    if (bentrok) throw new GagalIzin(`Kode analisa "${kode}" sudah dipakai.`);

    await prisma.analisaHarga.create({
      data: { ...data, komponen: { create: komponen.map((k, i) => ({ ...k, urutan: i })) } },
    });
    await catat({ pengguna, objek: `Analisa ${kode}`, aksi: "Tambah analisa", ke: `${data.uraian} — ${komponen.length} komponen` });
    segarkanPustaka();
  });
}

export async function hapusAnalisa(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.analisaHarga.findUnique({
      where: { id },
      select: { id: true, kode: true, uraian: true, _count: { select: { rabItems: true } } },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN);

    // Baris RAB yang memakai analisa ini tidak ikut hilang — relasinya opsional,
    // jadi Prisma hanya melepas rujukannya (analisaId → null). Harga snapshot-nya
    // tetap. Komponennya sendiri terhapus berantai (onDelete: Cascade).
    await prisma.analisaHarga.delete({ where: { id } });
    await catat({
      pengguna, objek: `Analisa ${lama.kode}`, aksi: "Hapus analisa",
      dari: lama.uraian,
      ke: lama._count.rabItems > 0 ? `${lama._count.rabItems} baris RAB kehilangan telusur, harga tetap` : "dihapus",
    });
    segarkanPustaka();
  });
}

// ===========================================================================
// RAB ESTIMASI
// ===========================================================================

export async function tambahRabEstimasi(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan(IZIN, projectId);

    const proyek = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    // Nomor otomatis & read-only: RAB-<KODE>-NNN, urut per proyek. Loop menjaga
    // dari bentrok bila ada nomor lama tersisa dari penghapusan.
    let seq = (await prisma.rabEstimasi.count({ where: { projectId } })) + 1;
    let nomor = `RAB-${proyek.kode}-${String(seq).padStart(3, "0")}`;
    while (await prisma.rabEstimasi.count({ where: { projectId, nomor } })) {
      seq += 1;
      nomor = `RAB-${proyek.kode}-${String(seq).padStart(3, "0")}`;
    }

    const nama = teks(form, "nama", true);

    const dibuat = await prisma.rabEstimasi.create({
      data: { projectId, nomor, nama, status: "Draft" },
      select: { id: true },
    });
    await catat({
      pengguna, projectId, objek: `RAB Estimasi ${proyek.kode} · ${nomor}`,
      aksi: "Buat RAB estimasi", ke: nama,
    });
    revalidatePath("/estimasi");
    redirect(`/estimasi/${dibuat.id}`);
  });
}

export async function ubahRabEstimasi(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const lama = await prisma.rabEstimasi.findUnique({
      where: { id },
      select: { id: true, projectId: true, nomor: true, nama: true, status: true, project: { select: { kode: true } } },
    });
    if (!lama) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
    const pengguna = await izinkan(IZIN, lama.projectId);
    pastikanEditable(lama.status, lama.nomor);

    // Status TIDAK diubah di sini — perpindahannya lewat aksi ajukan/setujui/tolak.
    const data = { nama: teks(form, "nama", true) };
    await prisma.rabEstimasi.update({ where: { id }, data });
    const jml = await catatDiff({
      pengguna, projectId: lama.projectId, objek: `RAB Estimasi ${lama.project.kode} · ${lama.nomor}`,
      sebelum: lama, sesudah: data, label: { nama: "Nama" },
    });
    segarkanEstimasi(id);
    return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
  });
}

export async function hapusRabEstimasi(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.rabEstimasi.findUnique({
      where: { id },
      select: { id: true, projectId: true, nomor: true, nama: true, project: { select: { kode: true } } },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN, lama.projectId);

    await prisma.rabEstimasi.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId, objek: `RAB Estimasi ${lama.project.kode} · ${lama.nomor}`,
      aksi: "Hapus RAB estimasi", dari: lama.nama, ke: "dihapus",
    });
    revalidatePath("/estimasi");
    redirect("/estimasi");
  });
}

// ===========================================================================
// ALUR PERSETUJUAN RAB (Draft → Diajukan → Final / Ditolak)
// ===========================================================================

/** Muat RAB ringkas untuk aksi status. */
async function rabUntukStatus(id: string) {
  const rab = await prisma.rabEstimasi.findUnique({
    where: { id },
    select: {
      id: true, projectId: true, nomor: true, status: true,
      project: { select: { kode: true } }, _count: { select: { items: true } },
    },
  });
  if (!rab) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
  return rab;
}

/** Ajukan RAB untuk persetujuan. Pengaju cukup punya izin ubah hargaRabRap. */
export async function ajukanRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rab = await rabUntukStatus(teks(form, "id", true));
    const pengguna = await izinkan(IZIN, rab.projectId);
    if (rab.status !== "Draft" && rab.status !== "Ditolak") {
      throw new GagalIzin(`RAB ${rab.nomor} berstatus ${rab.status} — tak bisa diajukan.`);
    }
    if (rab._count.items === 0) throw new GagalIzin("RAB belum punya baris pekerjaan.");

    await prisma.rabEstimasi.update({
      where: { id: rab.id },
      data: { status: "Diajukan", diajukanPada: new Date(), diajukanOleh: pengguna.nama, catatanTolak: null },
    });
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Ajukan RAB", ke: "Diajukan",
    });
    segarkanEstimasi(rab.id);
    return "RAB diajukan untuk persetujuan.";
  });
}

/** Setujui RAB (→ Final). Butuh izin ubah `setujuiRab`. */
export async function setujuiRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rab = await rabUntukStatus(teks(form, "id", true));
    const pengguna = await izinkan(IZIN_SETUJU, rab.projectId);
    if (rab.status !== "Diajukan") {
      throw new GagalIzin(`RAB ${rab.nomor} berstatus ${rab.status} — hanya yang Diajukan bisa disetujui.`);
    }
    await prisma.rabEstimasi.update({
      where: { id: rab.id },
      data: { status: "Final", diputusPada: new Date(), diputusOleh: pengguna.nama, catatanTolak: null },
    });
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Setujui RAB", dari: "Diajukan", ke: "Final",
    });
    segarkanEstimasi(rab.id);
    return `RAB ${rab.nomor} disetujui — kini Final dan siap ditenderkan.`;
  });
}

/** Tolak RAB (→ Ditolak, dengan catatan). Butuh izin ubah `setujuiRab`. */
export async function tolakRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rab = await rabUntukStatus(teks(form, "id", true));
    const pengguna = await izinkan(IZIN_SETUJU, rab.projectId);
    if (rab.status !== "Diajukan") {
      throw new GagalIzin(`RAB ${rab.nomor} berstatus ${rab.status} — hanya yang Diajukan bisa ditolak.`);
    }
    const catatan = teks(form, "catatan", true);
    await prisma.rabEstimasi.update({
      where: { id: rab.id },
      data: { status: "Ditolak", diputusPada: new Date(), diputusOleh: pengguna.nama, catatanTolak: catatan },
    });
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Tolak RAB", dari: "Diajukan", ke: `Ditolak — ${catatan}`,
    });
    segarkanEstimasi(rab.id);
    return "RAB dikembalikan (Ditolak) dengan catatan.";
  });
}

// ===========================================================================
// BARIS RAB ESTIMASI
// ===========================================================================

/** Muat estimasi induk sekaligus memeriksa izin & akses proyeknya. */
async function estimasiInduk(rabEstimasiId: string) {
  const est = await prisma.rabEstimasi.findUnique({
    where: { id: rabEstimasiId },
    select: { id: true, projectId: true, nomor: true, status: true, project: { select: { kode: true } } },
  });
  if (!est) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
  const pengguna = await izinkan(IZIN, est.projectId);
  pastikanEditable(est.status, est.nomor);
  return { est, pengguna };
}

export async function tambahBarisRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const { est, pengguna } = await estimasiInduk(rabEstimasiId);

    const volume = angka(form, "volume", { min: 0, wajib: true });
    const analisaId = teksOpsional(form, "analisaId");
    const spesifikasi = teksOpsional(form, "spesifikasi");

    let grup: string, uraian: string, satuan: string, hargaSatuan: number;

    if (analisaId) {
      // Pilih dari katalog: uraian/satuan/harga di-SNAPSHOT dari AHSP saat ini.
      const a = await prisma.analisaHarga.findUnique({
        where: { id: analisaId },
        select: {
          kode: true, uraian: true, satuan: true, kelompok: true, overheadPct: true,
          komponen: { select: { koefisien: true, hargaDasar: { select: { kategori: true, hargaAcuan: true } } } },
        },
      });
      if (!a) throw new GagalIzin("Analisa tidak ditemukan.");
      grup = a.kelompok;
      uraian = a.uraian;
      satuan = a.satuan;
      hargaSatuan = hargaSatuanDb(a);
    } else {
      // Baris manual: seluruhnya diketik.
      grup = teks(form, "grup", true);
      uraian = teks(form, "uraian", true);
      satuan = teks(form, "satuan", true);
      hargaSatuan = angka(form, "hargaSatuan", { min: 0, wajib: true });
    }

    const urutan = await prisma.rabEstimasiItem.count({ where: { rabEstimasiId } });
    await prisma.rabEstimasiItem.create({
      data: { rabEstimasiId, analisaId: analisaId || null, grup, uraian, satuan, spesifikasi, volume, hargaSatuan, urutan },
    });
    await catat({
      pengguna, projectId: est.projectId, objek: `RAB Estimasi ${est.project.kode} · ${est.nomor}`,
      aksi: "Tambah baris RAB", ke: `${uraian} — ${volume} ${satuan} × ${rpLog(hargaSatuan)}`,
    });
    segarkanEstimasi(rabEstimasiId);
  });
}

export async function ubahBarisRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const lama = await prisma.rabEstimasiItem.findUnique({
      where: { id },
      select: {
        id: true, uraian: true, satuan: true, grup: true, spesifikasi: true, volume: true, hargaSatuan: true, rabEstimasiId: true,
        rabEstimasi: { select: { projectId: true, nomor: true, status: true, project: { select: { kode: true } } } },
      },
    });
    if (!lama) throw new GagalIzin("Baris RAB tidak ditemukan.");
    const pengguna = await izinkan(IZIN, lama.rabEstimasi.projectId);
    pastikanEditable(lama.rabEstimasi.status, lama.rabEstimasi.nomor);

    const baru = {
      grup: teks(form, "grup", true),
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      spesifikasi: teksOpsional(form, "spesifikasi"),
      volume: angka(form, "volume", { min: 0, wajib: true }),
      hargaSatuan: angka(form, "hargaSatuan", { min: 0, wajib: true }),
    };
    await prisma.rabEstimasiItem.update({ where: { id }, data: baru });
    await catatDiff({
      pengguna, projectId: lama.rabEstimasi.projectId,
      objek: `RAB Estimasi ${lama.rabEstimasi.project.kode} · ${lama.rabEstimasi.nomor} · ${lama.uraian}`,
      sebelum: lama, sesudah: baru,
      label: { grup: "Grup", uraian: "Uraian", satuan: "Satuan", spesifikasi: "Spesifikasi", volume: "Volume", hargaSatuan: "Harga satuan" },
      format: { hargaSatuan: rpLog },
    });
    segarkanEstimasi(lama.rabEstimasiId);
  });
}

/**
 * Simpan SELURUH tabel rincian RAB sekaligus — model sunting inline seperti
 * tabel RAB di Master Proyek: pengguna menekan "Ubah", menyunting semua sel,
 * lalu "Simpan". Baris lama diganti seluruhnya dalam satu transaksi.
 *
 * Aman melakukan ganti-total karena penyuntingan hanya diizinkan saat
 * Draft/Ditolak — sebelum ada penawaran/pemenang vendor (itu tahap Final).
 * Tautan AHSP (`analisaId`) dipertahankan untuk baris yang identitasnya (id)
 * masih ada, supaya harga dari pustaka tidak putus saat baris cuma digeser.
 */
export async function simpanBarisRabEstimasi(rabEstimasiId: string, dataJson: string): Promise<HasilAksi> {
  return jalankan(async () => {
    const rab = await prisma.rabEstimasi.findUnique({
      where: { id: rabEstimasiId },
      select: {
        id: true, nomor: true, projectId: true, status: true,
        project: { select: { kode: true } },
        items: { select: { id: true, analisaId: true, volume: true, hargaSatuan: true } },
      },
    });
    if (!rab) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
    const pengguna = await izinkan(IZIN, rab.projectId);
    pastikanEditable(rab.status, rab.nomor);

    const analisaLama = new Map(rab.items.map((it) => [it.id, it.analisaId]));
    const baris = bacaBarisRabEstimasi(dataJson, analisaLama);
    const sebelum = rab.items.reduce((s, it) => s + it.volume * it.hargaSatuan, 0);
    const sesudah = baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);

    await prisma.$transaction([
      prisma.rabEstimasiItem.deleteMany({ where: { rabEstimasiId } }),
      prisma.rabEstimasiItem.createMany({
        data: baris.map((b, i) => ({
          rabEstimasiId, analisaId: b.analisaId, grup: b.grup, uraian: b.uraian,
          satuan: b.satuan, spesifikasi: b.spesifikasi, volume: b.volume, hargaSatuan: b.hargaSatuan, urutan: i,
        })),
      }),
    ]);

    await catat({
      pengguna, projectId: rab.projectId,
      objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor} · Rincian`,
      aksi: "Ubah baris RAB", dari: rpLog(sebelum), ke: rpLog(sesudah),
    });
    segarkanEstimasi(rabEstimasiId);
  });
}

interface BarisRabMasuk {
  grup: string;
  uraian: string;
  satuan: string;
  spesifikasi: string | null;
  volume: number;
  hargaSatuan: number;
  analisaId: string | null;
}

/** Ratakan kelompok jadi baris siap simpan; pertahankan analisaId lewat id lama. */
function bacaBarisRabEstimasi(json: string, analisaLama: Map<string, string | null>): BarisRabMasuk[] {
  let data: {
    kelompok: { nama: string; items: { id?: string; uraian: string; satuan: string; volume: number; hargaSatuan: number; spesifikasi?: string | null }[] }[];
  };
  try {
    data = JSON.parse(json);
  } catch {
    throw new GagalIzin("Data RAB tidak terbaca.");
  }
  if (!Array.isArray(data.kelompok) || data.kelompok.length === 0) {
    throw new GagalIzin("Tabel RAB tidak boleh kosong.");
  }

  const baris: BarisRabMasuk[] = [];
  for (const g of data.kelompok) {
    if (!g.nama?.trim()) throw new GagalIzin("Setiap kelompok pekerjaan harus punya nama.");
    for (const it of g.items) {
      if (!it.uraian?.trim()) throw new GagalIzin(`Ada baris tanpa uraian pekerjaan pada kelompok "${g.nama}".`);
      if (!Number.isFinite(it.volume) || it.volume < 0) throw new GagalIzin(`Volume tidak sah pada "${it.uraian}".`);
      if (!Number.isFinite(it.hargaSatuan) || it.hargaSatuan < 0) throw new GagalIzin(`Harga satuan tidak sah pada "${it.uraian}".`);
      baris.push({
        grup: g.nama.trim(),
        uraian: it.uraian.trim(),
        satuan: it.satuan?.trim() || "ls",
        spesifikasi: it.spesifikasi?.trim() || null,
        volume: it.volume,
        hargaSatuan: it.hargaSatuan,
        analisaId: it.id ? analisaLama.get(it.id) ?? null : null,
      });
    }
  }
  if (baris.length === 0) throw new GagalIzin("Tabel RAB tidak boleh kosong.");
  return baris;
}

/**
 * Tarik ulang harga satuan sebuah baris dari analisa sumbernya (harga AHSP
 * terkini). Dipakai bila harga dasar sudah diperbarui dan QS ingin baris ini
 * ikut memakai harga baru — snapshot memang tidak berubah sendiri.
 */
export async function segarkanHargaBaris(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const lama = await prisma.rabEstimasiItem.findUnique({
      where: { id },
      select: {
        id: true, uraian: true, hargaSatuan: true, analisaId: true, rabEstimasiId: true,
        rabEstimasi: { select: { projectId: true, nomor: true, status: true, project: { select: { kode: true } } } },
        analisa: {
          select: {
            overheadPct: true,
            komponen: { select: { koefisien: true, hargaDasar: { select: { kategori: true, hargaAcuan: true } } } },
          },
        },
      },
    });
    if (!lama) throw new GagalIzin("Baris RAB tidak ditemukan.");
    const pengguna = await izinkan(IZIN, lama.rabEstimasi.projectId);
    pastikanEditable(lama.rabEstimasi.status, lama.rabEstimasi.nomor);
    if (!lama.analisa) throw new GagalIzin("Baris ini manual (tanpa analisa), jadi tak ada harga AHSP untuk ditarik.");

    const hargaBaru = hargaSatuanDb(lama.analisa);
    if (hargaBaru === lama.hargaSatuan) return "Harga sudah sama dengan AHSP terkini.";

    await prisma.rabEstimasiItem.update({ where: { id }, data: { hargaSatuan: hargaBaru } });
    await catat({
      pengguna, projectId: lama.rabEstimasi.projectId,
      objek: `RAB Estimasi ${lama.rabEstimasi.project.kode} · ${lama.rabEstimasi.nomor} · ${lama.uraian}`,
      aksi: "Segarkan harga dari AHSP", dari: rpLog(lama.hargaSatuan), ke: rpLog(hargaBaru),
    });
    segarkanEstimasi(lama.rabEstimasiId);
    return `Harga satuan diperbarui menjadi ${rpLog(hargaBaru)}.`;
  });
}

export async function hapusBarisRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.rabEstimasiItem.findUnique({
      where: { id },
      select: {
        id: true, uraian: true, rabEstimasiId: true,
        rabEstimasi: { select: { projectId: true, nomor: true, status: true, project: { select: { kode: true } } } },
      },
    });
    if (!lama) return;
    const pengguna = await izinkan(IZIN, lama.rabEstimasi.projectId);
    pastikanEditable(lama.rabEstimasi.status, lama.rabEstimasi.nomor);
    await prisma.rabEstimasiItem.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.rabEstimasi.projectId,
      objek: `RAB Estimasi ${lama.rabEstimasi.project.kode} · ${lama.rabEstimasi.nomor}`,
      aksi: "Hapus baris RAB", dari: lama.uraian,
    });
    segarkanEstimasi(lama.rabEstimasiId);
  });
}

/**
 * Impor baris RAB dari Excel — MENGGANTI seluruh isi (hanya saat Draft/Ditolak).
 * Baris masuk sebagai baris manual (analisaId null), memakai kolom yang sama
 * dengan template BOQ (Grup·Uraian·Satuan·Volume·Harga Satuan·Spesifikasi).
 */
export async function imporBarisRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const { est, pengguna } = await estimasiInduk(rabEstimasiId); // memeriksa izin + editable

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) throw new GagalIzin("Pilih berkas Excel lebih dulu.");

    const rows = await bacaBoqDariExcel(await berkas.arrayBuffer());
    if (rows.length === 0) throw new GagalIzin("Tidak ada baris pekerjaan yang terbaca dari berkas.");

    // Mengganti, bukan menambah: impor ulang berkas yang sama tak menggandakan.
    await prisma.$transaction([
      prisma.rabEstimasiItem.deleteMany({ where: { rabEstimasiId } }),
      prisma.rabEstimasiItem.createMany({
        data: rows.map((r, i) => ({
          rabEstimasiId, analisaId: null,
          grup: r.grup ?? "Umum", uraian: r.uraian, satuan: r.satuan, spesifikasi: r.spesifikasi,
          volume: r.volume, hargaSatuan: r.hargaSatuan, urutan: i,
        })),
      }),
    ]);

    await catat({
      pengguna, projectId: est.projectId,
      objek: `RAB Estimasi ${est.project.kode} · ${est.nomor}`,
      aksi: "Impor baris RAB dari Excel", ke: `${rows.length} baris (mengganti isi lama)`,
    });
    segarkanEstimasi(rabEstimasiId);
    return `${rows.length} baris pekerjaan diimpor (menggantikan isi lama).`;
  });
}

// ===========================================================================
// PERBANDINGAN PENAWARAN VENDOR (di detail RAB, hanya saat Final)
// ===========================================================================
//
// Menggantikan modul Tender lama: perbandingan penawaran melebur ke detail RAB.
// HPS = harga satuan RAB (rahasia dari vendor). QS menambah vendor pembanding,
// memasukkan penawaran tiap vendor, lalu menetapkan pemenang PER GRUP (disimpan
// per baris di RabEstimasiItem.pemenangVendorId). Semuanya di bawah izin
// "hargaRabRap"; hanya boleh saat RAB berstatus Final.

/** Muat RAB ringkas untuk aksi perbandingan + periksa izin & status Final. */
async function rabPembandingInduk(rabEstimasiId: string) {
  const rab = await prisma.rabEstimasi.findUnique({
    where: { id: rabEstimasiId },
    select: { id: true, nomor: true, projectId: true, status: true, project: { select: { kode: true } } },
  });
  if (!rab) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
  const pengguna = await izinkan(IZIN, rab.projectId);
  if (rab.status !== "Final") {
    throw new GagalIzin(`RAB ${rab.nomor} belum Final — perbandingan penawaran baru bisa dilakukan setelah disetujui.`);
  }
  return { rab, pengguna };
}

export async function tambahVendorPembanding(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const vendorId = teks(form, "vendorId", true);
    const { rab, pengguna } = await rabPembandingInduk(rabEstimasiId);

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { nama: true, status: true } });
    if (!vendor) throw new GagalIzin("Vendor tidak ditemukan.");
    if (vendor.status !== "Aktif") throw new GagalIzin(`Vendor "${vendor.nama}" berstatus Nonaktif.`);

    const sudah = await prisma.rabPembanding.count({ where: { rabEstimasiId, vendorId } });
    if (sudah) throw new GagalIzin(`${vendor.nama} sudah menjadi pembanding pada RAB ini.`);

    await prisma.rabPembanding.create({ data: { rabEstimasiId, vendorId } });
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Tambah vendor pembanding", ke: vendor.nama,
    });
    segarkanEstimasi(rabEstimasiId);
  });
}

export async function hapusVendorPembanding(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const vendorId = teks(form, "vendorId", true);
    const { rab, pengguna } = await rabPembandingInduk(rabEstimasiId);

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { nama: true } });

    // Lepas penetapan pemenang di baris mana pun yang menunjuk vendor ini,
    // hapus seluruh penawarannya, lalu keluarkan dari daftar pembanding.
    await prisma.$transaction([
      prisma.rabEstimasiItem.updateMany({
        where: { rabEstimasiId, pemenangVendorId: vendorId }, data: { pemenangVendorId: null },
      }),
      prisma.rabPenawaran.deleteMany({ where: { vendorId, item: { rabEstimasiId } } }),
      prisma.rabPembanding.deleteMany({ where: { rabEstimasiId, vendorId } }),
    ]);
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Hapus vendor pembanding", dari: vendor?.nama ?? vendorId,
    });
    segarkanEstimasi(rabEstimasiId);
  });
}

/**
 * Simpan seluruh penawaran satu vendor sekaligus (satu kolom). JSON
 * `[{ rabEstimasiItemId, hargaSatuan }]`. Harga ≤ 0 → penawaran dihapus &
 * penetapan pemenang baris itu dilepas bila menunjuk vendor ini.
 */
export async function simpanPenawaranVendor(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const vendorId = teks(form, "vendorId", true);
    const { rab, pengguna } = await rabPembandingInduk(rabEstimasiId);

    const pembanding = await prisma.rabPembanding.findFirst({
      where: { rabEstimasiId, vendorId }, select: { id: true, vendor: { select: { nama: true } } },
    });
    if (!pembanding) throw new GagalIzin("Vendor ini belum jadi pembanding. Tambahkan dulu.");

    let baris: { rabEstimasiItemId?: string; hargaSatuan?: number | string }[];
    try {
      baris = JSON.parse(teks(form, "penawaran", true));
    } catch {
      throw new GagalIzin("Data penawaran tidak terbaca.");
    }

    const idSah = new Set(
      (await prisma.rabEstimasiItem.findMany({ where: { rabEstimasiId }, select: { id: true } })).map((i) => i.id),
    );

    let ditulis = 0;
    let dihapus = 0;
    for (const b of baris) {
      const itemId = String(b.rabEstimasiItemId ?? "");
      if (!idSah.has(itemId)) continue;
      const harga = Number(b.hargaSatuan);

      if (!Number.isFinite(harga) || harga <= 0) {
        const adaHapus = await prisma.rabPenawaran.deleteMany({ where: { rabEstimasiItemId: itemId, vendorId } });
        dihapus += adaHapus.count;
        await prisma.rabEstimasiItem.updateMany({
          where: { id: itemId, pemenangVendorId: vendorId }, data: { pemenangVendorId: null },
        });
        continue;
      }
      await prisma.rabPenawaran.upsert({
        where: { rabEstimasiItemId_vendorId: { rabEstimasiItemId: itemId, vendorId } },
        create: { rabEstimasiItemId: itemId, vendorId, hargaSatuan: harga },
        update: { hargaSatuan: harga },
      });
      ditulis += 1;
    }

    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Input penawaran vendor",
      ke: `${pembanding.vendor.nama}: ${ditulis} baris diisi${dihapus ? `, ${dihapus} dikosongkan` : ""}`,
    });
    segarkanEstimasi(rabEstimasiId);
    return `Penawaran ${pembanding.vendor.nama} tersimpan (${ditulis} baris).`;
  });
}

/**
 * Simpan penetapan pemenang seluruh RAB sekaligus. JSON
 * `[{ rabEstimasiItemId, vendorId }]` — vendorId kosong melepas pemenang.
 * Tiap penetapan wajib punya penawaran vendor yang cocok.
 */
export async function simpanPemenang(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const { rab, pengguna } = await rabPembandingInduk(rabEstimasiId);

    let baris: { rabEstimasiItemId?: string; vendorId?: string }[];
    try {
      baris = JSON.parse(teks(form, "pemenang", true));
    } catch {
      throw new GagalIzin("Data pemenang tidak terbaca.");
    }

    const items = await prisma.rabEstimasiItem.findMany({
      where: { rabEstimasiId },
      select: { id: true, penawaran: { select: { vendorId: true } } },
    });
    const peta = new Map(items.map((i) => [i.id, i]));

    const rencana: { id: string; vendorId: string | null }[] = [];
    for (const b of baris) {
      const item = peta.get(String(b.rabEstimasiItemId ?? ""));
      if (!item) continue;
      const vendorId = String(b.vendorId ?? "");
      if (vendorId && !item.penawaran.some((x) => x.vendorId === vendorId)) {
        throw new GagalIzin("Ada pemenang yang belum menawar barisnya. Periksa kembali.");
      }
      rencana.push({ id: item.id, vendorId: vendorId || null });
    }

    await prisma.$transaction(
      rencana.map((r) => prisma.rabEstimasiItem.update({ where: { id: r.id }, data: { pemenangVendorId: r.vendorId } })),
    );

    const diputus = rencana.filter((r) => r.vendorId).length;
    await catat({
      pengguna, projectId: rab.projectId, objek: `RAB Estimasi ${rab.project.kode} · ${rab.nomor}`,
      aksi: "Simpan pemenang", ke: `${diputus} baris ditetapkan, ${rencana.length - diputus} dilepas`,
    });
    segarkanEstimasi(rabEstimasiId);
    return `Pemenang tersimpan: ${diputus} baris ditetapkan.`;
  });
}

/**
 * Buat draft Kontrak (SPK) dari baris yang dimenangkan seorang vendor pada RAB.
 * Baris + harga tawarannya disalin menjadi BOQ SPK. Dijaga izin "progress"
 * (pembuatan kontrak = domain Vendor), sama seperti dulu dari tender.
 */
export async function buatKontrakDariRab(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const rabEstimasiId = teks(form, "rabEstimasiId", true);
    const vendorId = teks(form, "vendorId", true);

    const rab = await prisma.rabEstimasi.findUnique({
      where: { id: rabEstimasiId },
      select: { id: true, nomor: true, projectId: true, status: true, project: { select: { kode: true } } },
    });
    if (!rab) throw new GagalIzin("RAB Estimasi tidak ditemukan.");
    const pengguna = await izinkan("progress", rab.projectId);
    if (rab.status !== "Final") throw new GagalIzin(`RAB ${rab.nomor} belum Final.`);

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, nama: true, status: true } });
    if (!vendor) throw new GagalIzin("Vendor tidak ditemukan.");
    if (vendor.status !== "Aktif") throw new GagalIzin(`Vendor "${vendor.nama}" berstatus Nonaktif.`);

    const menang = await prisma.rabEstimasiItem.findMany({
      where: { rabEstimasiId, pemenangVendorId: vendorId },
      orderBy: { urutan: "asc" },
      select: { grup: true, uraian: true, satuan: true, volume: true, penawaran: { where: { vendorId }, select: { hargaSatuan: true } } },
    });
    if (menang.length === 0) throw new GagalIzin(`${vendor.nama} belum memenangkan baris apa pun pada RAB ini.`);

    const jenis = pilihan(form, "jenis", JENIS_KONTRAK);
    const cakupan = [...new Set(form.getAll("cakupanId").map((v) => String(v).trim()).filter(Boolean))];
    if (cakupan.length === 0) throw new GagalIzin("Pilih minimal satu unit/sarpras cakupan agar baris BOQ punya objek.");
    const sah =
      jenis === "Unit"
        ? await prisma.unit.count({ where: { id: { in: cakupan }, projectId: rab.projectId } })
        : await prisma.infrastructure.count({ where: { id: { in: cakupan }, projectId: rab.projectId } });
    if (sah !== cakupan.length) throw new GagalIzin("Ada item cakupan yang bukan milik proyek ini.");

    const mulai = teksOpsional(form, "mulai");
    const tglMulai = mulai ? new Date(mulai) : new Date();
    if (Number.isNaN(tglMulai.getTime())) throw new GagalIzin("Tanggal mulai tidak sah.");

    // Kode kontrak digenerate otomatis: {KODEPROYEK}/{K|S}/{TAHUN}/{urut 3 digit},
    // bernomor urut per proyek per tahun. K = jenis Unit, S = Sarpras.
    const awalanKode = `${rab.project.kode}/${jenis === "Unit" ? "K" : "S"}/${tglMulai.getFullYear()}/`;
    const kodeAda = await prisma.contract.findMany({
      where: { kode: { startsWith: awalanKode } }, select: { kode: true },
    });
    let urut = kodeAda.reduce((m, c) => {
      const n = parseInt(c.kode.slice(awalanKode.length), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    let kode = "";
    do {
      urut += 1;
      kode = `${awalanKode}${String(urut).padStart(3, "0")}`;
    } while (await prisma.contract.count({ where: { kode } }));

    const totalMenang = menang.reduce((s, m) => s + (m.penawaran[0]?.hargaSatuan ?? 0) * m.volume, 0);
    // Nilai kontrak = total baris menang × jumlah objek cakupan. Model "satu BOQ
    // berlaku untuk tiap unit": template BOQ digandakan ke SETIAP objek, jadi nilai
    // SPK ikut jumlah objek agar "Nilai BOQ Terinci" = "Nilai SPK". Ditetapkan di
    // server (bukan dari form) supaya konsistensinya terjamin.
    const nominal = Math.round(totalMenang * cakupan.length);
    if (nominal <= 0) throw new GagalIzin("Nilai kontrak nol — pastikan baris menang punya harga penawaran.");
    const deskripsi = teksOpsional(form, "deskripsi")?.trim() || `Pemenang RAB ${rab.nomor}`;

    // Dokumen SPK opsional: hanya diproses bila berkas benar-benar diunggah.
    const spk = form.get("spk");
    let docSpkId: string | null = null;
    let namaFileSpk: string | null = null;
    if (spk instanceof File && spk.size > 0) {
      const namaFile = bersihkanNamaFile(spk.name);
      periksaBerkas(namaFile, spk.type, spk.size);
      const tersimpan = await simpanBerkas(await spk.arrayBuffer(), namaFile);
      const dokumen = await prisma.document.create({
        data: {
          kategori: "spk", judul: `SPK ${kode} · ${vendor.nama}`,
          versions: { create: { revisi: "R1", namaFile, ukuranByte: tersimpan.ukuranByte, objectKey: tersimpan.objectKey, diunggahOlehId: pengguna.id } },
        },
      });
      docSpkId = dokumen.id;
      namaFileSpk = namaFile;
    }

    await prisma.contract.create({
      data: {
        kode, projectId: rab.projectId, vendorId, jenis, deskripsi, nominal,
        retensiPct: angka(form, "retensiPct", { min: 0, max: 100 }),
        jatuhTempoBln: angka(form, "jatuhTempoBln", { min: 0 }),
        mulai: tglMulai, docSpkId,
        ...(jenis === "Unit"
          ? { units: { create: cakupan.map((unitId) => ({ unitId })) } }
          : { infrastructures: { create: cakupan.map((infrastructureId) => ({ infrastructureId })) } }),
        // Template BOQ level-SPK: satu definisi berlaku untuk semua objek yang
        // dicakup (units/infrastructures di atas). Override & opname per objek
        // ditambahkan belakangan lewat ContractBoqUnit, bukan di sini.
        boqItems: {
          create: menang.map((m, i) => ({
            grup: m.grup, uraian: m.uraian, satuan: m.satuan, volume: m.volume,
            hargaSatuan: m.penawaran[0]?.hargaSatuan ?? 0, urutan: i + 1,
          })),
        },
      },
    });

    await catat({
      pengguna, projectId: rab.projectId, objek: `Kontrak ${kode} · ${vendor.nama}`,
      aksi: "Buat kontrak dari RAB",
      ke: `${menang.length} baris dari RAB ${rab.nomor} — ${rpLog(nominal)} (tawaran ${rpLog(totalMenang)})${namaFileSpk ? ` · SPK ${namaFileSpk}` : " · tanpa SPK"}`,
    });

    revalidatePath("/vendor");
    revalidatePath(`/vendor/${vendorId}`);
    revalidatePath(`/estimasi/${rabEstimasiId}`);
    redirect(`/vendor/${vendorId}`);
  });
}
