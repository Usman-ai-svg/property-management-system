"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional, wajibLolos,
} from "@/lib/actions/guard";
import {
  JENIS_ASET, JENIS_PENYESUAIAN_ASET, KEPEMILIKAN_ASET, STATUS_PENGGUNAAN,
} from "@/lib/domain/enums";
import { terapkanPenyesuaian, unitTersedia } from "@/lib/calc/aset";
import { periksaAset, periksaCatatServis, periksaTambahPenggunaan } from "@/lib/kontrak/equipment";

/**
 * Pengelolaan peralatan & aset.
 *
 * Daftar induk (Equipment) adalah inventaris perusahaan yang stabil: formulir
 * Tambah/Ubah hanya menyentuh identitas barang. Penempatan ke proyek, tarif,
 * penanggung jawab, dan lama pakai dicatat sebagai penggunaan (EquipmentUsage)
 * lewat aksi tersendiri di bawah — bukan sebagai atribut yang menempel di induk.
 * Jumlah stok pun hanya bergerak lewat penyesuaian.
 */

const LABEL = {
  kode: "Kode", jenis: "Jenis", nama: "Nama", kategori: "Kategori", merk: "Merk",
  jumlah: "Jumlah", satuan: "Satuan", kepemilikan: "Kepemilikan",
  vendorId: "Vendor penyewa",
  servisTerakhir: "Servis terakhir", servisBerikut: "Servis berikut", nilai: "Nilai perolehan",
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
 * Baca field identitas aset dari form.
 *
 * Hanya identitas & stok — tak ada lagi proyek, PIC, tarif, atau status di sini.
 * Vendor hanya disimpan bila kepemilikannya Sewa; aset milik sendiri yang masih
 * menyimpan vendor akan terbaca seolah disewa dari pihak itu. Nilai perolehan
 * hanya untuk aset milik sendiri — aset sewa tak punya nilai perolehan.
 */
async function bacaAset(form: FormData) {
  const kepemilikan = pilihan(form, "kepemilikan", KEPEMILIKAN_ASET);
  const vendorId = kepemilikan === "Sewa" ? teksOpsional(form, "vendorId") : null;

  if (vendorId) {
    const ada = await prisma.vendor.count({ where: { id: vendorId } });
    if (!ada) throw new GagalIzin("Vendor tidak ditemukan.");
  }

  const servisTerakhir = tanggalOpsional(form, "servisTerakhir");
  const servisBerikut = tanggalOpsional(form, "servisBerikut");
  if (servisTerakhir && servisBerikut && servisBerikut < servisTerakhir) {
    throw new GagalIzin("Servis berikut tidak boleh lebih awal daripada servis terakhir.");
  }

  return {
    jenis: pilihan(form, "jenis", JENIS_ASET),
    nama: teks(form, "nama", true),
    kategori: teks(form, "kategori", true),
    merk: teksOpsional(form, "merk"),
    jumlah: angka(form, "jumlah", { min: 1, wajib: true }),
    satuan: teks(form, "satuan") || "unit",
    kepemilikan,
    vendorId,
    servisTerakhir,
    servisBerikut,
    nilai: kepemilikan === "Sewa" ? 0 : angka(form, "nilai", { min: 0 }),
  };
}

export async function tambahAset(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan("aset");
    const kode = teks(form, "kode", true).toUpperCase();

    const bentrok = await prisma.equipment.count({ where: { kode } });
    const data = await bacaAset(form);
    wajibLolos(
      periksaAset(
        {
          id: null, kode, nama: data.nama, jenis: data.jenis, kategori: data.kategori,
          kepemilikan: data.kepemilikan, jumlah: data.jumlah, vendorId: data.vendorId ?? null,
        },
        { kodeBentrok: bentrok > 0 },
      ),
    );
    await prisma.equipment.create({ data: { ...data, kode } });

    await catat({
      pengguna,
      objek: `${data.jenis} ${kode}`,
      aksi: `Tambah ${data.jenis.toLowerCase()}`,
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
    // Ubah pun tidak lagi menampilkan isiannya.
    const { jumlah: _abaikan, ...data } = await bacaAset(form);
    await prisma.equipment.update({ where: { id }, data: { ...data, kode } });

    const jml = await catatDiff({
      pengguna,
      objek: `${data.jenis} ${lama.kode}`,
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
      select: { id: true, kode: true, nama: true, jenis: true },
    });
    if (!lama) return;

    const pengguna = await izinkan("aset");
    await prisma.equipment.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `${lama.jenis} ${lama.kode}`,
      aksi: `Hapus ${lama.jenis.toLowerCase()}`,
      dari: lama.nama,
      ke: "dihapus",
    });

    revalidatePath("/equipment");
  });
}

/**
 * Catat satu penyesuaian stok aset: kehilangan, kerusakan, atau koreksi opname.
 *
 * Jumlah aset TIDAK BOLEH diketik langsung dari formulir Ubah — ia hanya
 * berubah lewat sini, supaya tiap pergerakan stok punya alasan dan penanggung
 * jawab. Riwayatnya hanya-tambah: pencatatan yang telanjur salah diperbaiki
 * dengan baris "Koreksi Stok" baru, bukan dengan menghapus baris lama.
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

/* ========================= SERVIS ALAT ========================= */

/**
 * Catat servis/perawatan alat.
 *
 * Menandai alat sudah diservis: memperbarui tanggal servis terakhir dan jadwal
 * berikutnya di daftar induk, sekaligus menambah satu baris riwayat servis —
 * jadi terlihat kapan, oleh siapa, dan berapa biayanya. Bukan lewat "Ubah",
 * supaya servis punya jejak tersendiri seperti penyesuaian stok.
 */
export async function catatServis(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const equipmentId = teks(form, "equipmentId", true);
    const pengguna = await izinkan("aset");

    const aset = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, kode: true, nama: true },
    });
    if (!aset) throw new GagalIzin("Aset tidak ditemukan.");

    const tanggal = tanggalOpsional(form, "tanggal") ?? new Date();
    const servisBerikut = tanggalOpsional(form, "servisBerikut");
    const biaya = angka(form, "biaya", { min: 0 });
    wajibLolos(
      periksaCatatServis({
        assetId: equipmentId,
        tanggal: tanggal.toISOString(),
        berikutnya: servisBerikut ? servisBerikut.toISOString() : null,
        biaya,
        catatan: null,
      }),
    );
    const catatan = teksOpsional(form, "catatan");

    await prisma.$transaction([
      prisma.equipment.update({
        where: { id: equipmentId },
        data: { servisTerakhir: tanggal, servisBerikut },
      }),
      prisma.equipmentService.create({
        data: { equipmentId, tanggal, servisBerikut, biaya, catatan, dicatatOleh: pengguna.nama },
      }),
    ]);

    await catat({
      pengguna,
      objek: `Aset ${aset.kode} · ${aset.nama}`,
      aksi: "Catat servis",
      ke:
        `servis ${tanggal.toLocaleDateString("id-ID")}` +
        (servisBerikut ? ` · berikut ${servisBerikut.toLocaleDateString("id-ID")}` : "") +
        (biaya > 0 ? ` · ${rpLog(biaya)}` : ""),
    });

    revalidatePath("/equipment");
    return `Servis ${aset.kode} tercatat.`;
  });
}

/* ========================= PENGGUNAAN ALAT ========================= */

/**
 * Catat penggunaan alat pada sebuah proyek.
 *
 * Inilah cara alat "keluar" ke proyek — bukan dengan menyunting induknya. Satu
 * alat bisa dipakai beberapa proyek sekaligus; tiap catatan menahan sejumlah
 * unit selama berstatus Aktif. Penambahan yang melebihi stok tersedia ditolak
 * supaya tak ada alat yang teralokasi ganda.
 */
export async function tambahPenggunaan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const equipmentId = teks(form, "equipmentId", true);
    const pengguna = await izinkan("aset");

    const aset = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, kode: true, nama: true, satuan: true, jumlah: true, jumlahRusak: true },
    });
    if (!aset) throw new GagalIzin("Aset tidak ditemukan.");

    const projectId = teks(form, "projectId", true);
    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: { kode: true },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const jumlah = Math.trunc(angka(form, "jumlah", { min: 1, wajib: true }));
    const tanggalMulai = tanggalOpsional(form, "tanggalMulai") ?? new Date();
    const tanggalSelesai = tanggalOpsional(form, "tanggalSelesai");

    const tarif = angka(form, "tarif", { min: 0 });
    const penanggungJawab = teksOpsional(form, "penanggungJawab");
    const catatan = teksOpsional(form, "catatan");
    const status = pilihan(form, "status", STATUS_PENGGUNAAN);

    // Hanya penggunaan Aktif yang menahan stok; validasi ketersediaan untuk itu.
    if (status === "Aktif") {
      const dipakai = await prisma.equipmentUsage.aggregate({
        where: { equipmentId, status: "Aktif" },
        _sum: { jumlah: true },
      });
      const tersedia = unitTersedia(aset, dipakai._sum.jumlah ?? 0);
      wajibLolos(
        periksaTambahPenggunaan(
          {
            assetId: equipmentId, projectId, jumlah,
            mulai: tanggalMulai.toISOString(),
            selesai: tanggalSelesai ? tanggalSelesai.toISOString() : null,
            penanggungJawab, catatan,
          },
          { tersedia, kode: aset.kode },
        ),
      );
      if (jumlah > tersedia) {
        throw new GagalIzin(
          `Hanya ${tersedia} ${aset.satuan} ${aset.kode} yang tersedia; ` +
            `tidak bisa mengalokasikan ${jumlah}.`,
        );
      }
    }

    await prisma.equipmentUsage.create({
      data: {
        equipmentId, projectId, jumlah, tanggalMulai, tanggalSelesai, tarif,
        penanggungJawab, catatan, status, dicatatOleh: pengguna.nama,
      },
    });

    await catat({
      pengguna,
      objek: `Aset ${aset.kode} · ${aset.nama}`,
      aksi: `Penggunaan — ${proyek.kode}`,
      ke: `${jumlah} ${aset.satuan}${penanggungJawab ? ` · PJ ${penanggungJawab}` : ""} (${status})`,
    });

    revalidatePath("/equipment");
    return `Penggunaan tercatat: ${jumlah} ${aset.satuan} ${aset.kode} untuk ${proyek.kode}.`;
  });
}

/**
 * Tutup sebuah penggunaan: alatnya dikembalikan, unitnya kembali tersedia.
 * Tanggal selesai diisi hari ini bila belum ada.
 */
export async function selesaikanPenggunaan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const pengguna = await izinkan("aset");

    const pakai = await prisma.equipmentUsage.findUnique({
      where: { id },
      select: {
        id: true, status: true, jumlah: true, tanggalSelesai: true,
        equipment: { select: { kode: true, satuan: true } },
        project: { select: { kode: true } },
      },
    });
    if (!pakai) throw new GagalIzin("Penggunaan tidak ditemukan.");
    if (pakai.status === "Selesai") return "Penggunaan ini sudah selesai.";

    await prisma.equipmentUsage.update({
      where: { id },
      data: { status: "Selesai", tanggalSelesai: pakai.tanggalSelesai ?? new Date() },
    });

    await catat({
      pengguna,
      objek: `Aset ${pakai.equipment.kode}`,
      aksi: `Penggunaan selesai — ${pakai.project.kode}`,
      ke: `${pakai.jumlah} ${pakai.equipment.satuan} dikembalikan`,
    });

    revalidatePath("/equipment");
    return `${pakai.jumlah} ${pakai.equipment.satuan} ${pakai.equipment.kode} kembali tersedia.`;
  });
}

/** Hapus catatan penggunaan (mis. salah input). */
export async function hapusPenggunaan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const pakai = await prisma.equipmentUsage.findUnique({
      where: { id },
      select: { id: true, jumlah: true, equipment: { select: { kode: true, satuan: true } }, project: { select: { kode: true } } },
    });
    if (!pakai) return;

    const pengguna = await izinkan("aset");
    await prisma.equipmentUsage.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `Aset ${pakai.equipment.kode}`,
      aksi: `Hapus penggunaan — ${pakai.project.kode}`,
      dari: `${pakai.jumlah} ${pakai.equipment.satuan}`,
      ke: "dihapus",
    });

    revalidatePath("/equipment");
  });
}
