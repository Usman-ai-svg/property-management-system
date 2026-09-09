"use server";

import { segmen } from "@/lib/adaptor/rute";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional, wajibLolos,
} from "@/lib/actions/guard";

/**
 * Hanya Administrator Sistem yang boleh menghapus paksa. Diperiksa lewat PERAN
 * AKTIF — konsisten dengan model "Lihat sebagai" aplikasi: seseorang yang
 * merangkap peran ini harus benar-benar sedang berperan Administrator Sistem
 * untuk memakainya, bukan sekadar memilikinya.
 */
const PERAN_HAPUS_PAKSA = "Administrator Sistem";
import { bersihkanNamaFile, periksaBerkas, periksaBerkasKategori, simpanBerkas } from "@/lib/storage";
import {
  JENIS_HAK_ATAS_TANAH, JENIS_SARPRAS, STATUS_JUAL, STATUS_PROYEK,
} from "@/lib/domain/enums";
import {
  periksaAturJumlahFase, periksaKodeProyek, periksaUbahLegalitas, uraikanPin,
} from "@/lib/kontrak/master";
import {
  buatBoqDariTemplate, buatRapDariTemplate, hargaJualAcuan, hitungUpahRap,
  perluPeringatanLuasBangunan, rabAcuan, totalBaris,
} from "@/lib/calc/boq";
import { statusBangunSarpras, statusBangunUnit } from "@/lib/calc/status-bangun";

/** Segarkan halaman proyek dan ringkasan setelah perubahan. */
function segarkan(kode: string) {
  revalidatePath(`/master/${segmen(kode)}`);
  revalidatePath("/master");
  revalidatePath("/");
}

// ===========================================================================
// PENGELOLAAN PROYEK & FASE
//
// Dipindahkan dari Admin → "Pengelolaan Proyek" ke Master Proyek: lokasi,
// legalitas, luas, unit, dan sarpras sudah disunting dari sini, jadi
// pembuatan/penyuntingan proyek dan fase juga lebih wajar di sini.
// ===========================================================================

/**
 * Buat proyek baru.
 *
 * Proyek dibuat sekaligus dengan business plan kosong dan fase pertamanya:
 * tanpa business plan, halaman Landbank dan Plan vs Realisasi tidak punya
 * apa pun untuk dibandingkan; tanpa fase, unit tidak bisa ditambahkan sama
 * sekali. Keduanya bisa disunting setelahnya.
 */
export async function tambahProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkan("deskripsi");

    const kode = teks(form, "kode", true).toUpperCase();
    const bentrok = await prisma.project.count({ where: { kode } });
    wajibLolos(periksaKodeProyek(kode, bentrok > 0));

    const nama = teks(form, "nama", true);
    const kodeFase = (teks(form, "kodeFase") || "F1").toUpperCase();

    const proyek = await prisma.project.create({
      data: {
        kode, nama,
        status: pilihan(form, "status", STATUS_PROYEK),
        alamat: teks(form, "alamat", true),
        kelurahan: teks(form, "kelurahan", true),
        kecamatan: teks(form, "kecamatan", true),
        kota: teks(form, "kota", true),
        provinsi: teks(form, "provinsi", true),
        luasKavlingEfektif: angka(form, "luasKavlingEfektif", { min: 0 }),
        luasSarana: angka(form, "luasSarana", { min: 0 }),
        luasPrasarana: angka(form, "luasPrasarana", { min: 0 }),
        luasRth: angka(form, "luasRth", { min: 0 }),
        fases: { create: [{ kode: kodeFase, urutan: 0 }] },
        businessPlan: { create: {} },
      },
      select: { id: true, kode: true },
    });

    await catat({
      pengguna, projectId: proyek.id,
      objek: `Proyek ${kode}`,
      aksi: "Buat proyek",
      ke: `${nama} · fase awal ${kodeFase}`,
    });

    revalidatePath("/master");
    revalidatePath("/");
    return `Proyek ${kode} dibuat beserta fase ${kodeFase} dan business plan kosong.`;
  });
}

export async function ubahProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.project.findUnique({
      where: { id },
      select: { id: true, kode: true, nama: true, status: true },
    });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", id);

    const data = {
      nama: teks(form, "nama", true),
      status: pilihan(form, "status", STATUS_PROYEK),
    };

    await prisma.project.update({ where: { id }, data });

    const jml = await catatDiff({
      pengguna, projectId: id,
      objek: `Proyek ${lama.kode}`,
      sebelum: lama, sesudah: data,
      label: { nama: "Nama proyek", status: "Status" },
    });

    segarkan(lama.kode);
    return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
  });
}

/**
 * Hapus proyek.
 *
 * Hanya proyek yang benar-benar masih kosong. Prisma akan menghapus unit,
 * kontrak, dan seluruh transaksinya secara berantai — itu terlalu banyak yang
 * hilang dari satu klik.
 */
export async function hapusProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true, kode: true, nama: true,
        _count: { select: { units: true, infrastructures: true, contracts: true, expenses: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("deskripsi", id);

    const { units, infrastructures, contracts, expenses } = lama._count;
    if (units + infrastructures + contracts + expenses > 0) {
      throw new GagalIzin(
        `Proyek ${lama.kode} masih berisi ${units} unit, ${infrastructures} sarpras, ` +
          `${contracts} kontrak, dan ${expenses} transaksi. Hanya proyek kosong yang boleh dihapus.`,
      );
    }

    await prisma.project.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `Proyek ${lama.kode}`,
      aksi: "Hapus proyek",
      dari: lama.nama,
      ke: "dihapus",
    });

    revalidatePath("/master");
    revalidatePath("/");
  });
}

export async function simpanFase(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const kode = teks(form, "kode", true).toUpperCase();
    const nama = teksOpsional(form, "nama");

    if (id) {
      const lama = await prisma.phase.findUnique({
        where: { id },
        select: {
          id: true, kode: true, nama: true, urutan: true, projectId: true,
          project: { select: { kode: true } },
        },
      });
      if (!lama) throw new GagalIzin("Fase tidak ditemukan.");
      const pengguna = await izinkan("deskripsi", lama.projectId);

      if (kode !== lama.kode) {
        const bentrok = await prisma.phase.count({ where: { projectId: lama.projectId, kode } });
        if (bentrok) throw new GagalIzin(`Fase "${kode}" sudah ada pada proyek ini.`);
      }

      const urutan = angka(form, "urutan", { min: 0 });
      await prisma.phase.update({ where: { id }, data: { kode, nama, urutan } });

      const jml = await catatDiff({
        pengguna, projectId: lama.projectId,
        objek: `Proyek ${lama.project.kode} · Fase ${lama.kode}`,
        sebelum: lama, sesudah: { kode, nama, urutan },
        label: { kode: "Kode fase", nama: "Nama fase", urutan: "Urutan" },
      });

      revalidatePath(`/master/${segmen(lama.project.kode)}`);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("deskripsi", projectId);

    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: { kode: true },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const bentrok = await prisma.phase.count({ where: { projectId, kode } });
    if (bentrok) throw new GagalIzin(`Fase "${kode}" sudah ada pada proyek ini.`);

    const urutan = await prisma.phase.count({ where: { projectId } });
    await prisma.phase.create({ data: { projectId, kode, nama, urutan } });

    await catat({
      pengguna, projectId,
      objek: `Proyek ${proyek.kode}`,
      aksi: "Tambah fase",
      ke: kode,
    });

    revalidatePath(`/master/${segmen(proyek.kode)}`);
  });
}

/** Fase yang masih dipakai unit tidak boleh dihapus — unitnya akan yatim. */
export async function hapusFase(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.phase.findUnique({
      where: { id },
      select: {
        id: true, kode: true, projectId: true,
        project: { select: { kode: true } },
        _count: { select: { units: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("deskripsi", lama.projectId);

    if (lama._count.units > 0) {
      throw new GagalIzin(
        `Fase ${lama.kode} masih dipakai ${lama._count.units} unit. Pindahkan unit itu lebih dulu.`,
      );
    }

    await prisma.phase.delete({ where: { id } });

    await catat({
      pengguna, projectId: lama.projectId,
      objek: `Proyek ${lama.project.kode}`,
      aksi: "Hapus fase",
      dari: lama.kode,
      ke: "dihapus",
    });

    revalidatePath(`/master/${segmen(lama.project.kode)}`);
  });
}

/**
 * Atur JUMLAH fase sebuah proyek. Fase digenerate otomatis F1..Fn menurut
 * urutan; menaikkan jumlah menambah fase di belakang, menurunkan menghapus fase
 * paling belakang — tetapi hanya bila fase itu kosong (tanpa unit), supaya
 * penomoran tetap rapi dan tak ada unit yang yatim.
 */
export async function aturJumlahFase(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const jumlah = angka(form, "jumlah", { wajib: true });
    wajibLolos(periksaAturJumlahFase({ projectId, jumlah }));

    const pengguna = await izinkan("deskripsi", projectId);
    const proyek = await prisma.project.findUnique({ where: { id: projectId }, select: { kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const fases = await prisma.phase.findMany({
      where: { projectId },
      orderBy: { urutan: "asc" },
      select: { id: true, kode: true, _count: { select: { units: true } } },
    });
    const kini = fases.length;
    if (jumlah === kini) return "Jumlah fase tidak berubah.";

    if (jumlah > kini) {
      const baru = [];
      for (let i = kini; i < jumlah; i++) baru.push({ projectId, kode: `F${i + 1}`, urutan: i });
      await prisma.phase.createMany({ data: baru });
    } else {
      // Kurangi dari belakang; fase yang masih dipakai unit tidak boleh dihapus.
      const dihapus = fases.slice(jumlah);
      const berisi = dihapus.find((f) => f._count.units > 0);
      if (berisi) {
        throw new GagalIzin(
          `Fase ${berisi.kode} masih dipakai ${berisi._count.units} unit. Pindahkan/hapus unitnya lebih dulu sebelum menurunkan jumlah fase.`,
        );
      }
      await prisma.phase.deleteMany({ where: { id: { in: dihapus.map((f) => f.id) } } });
    }

    await catat({
      pengguna, projectId, objek: `Proyek ${proyek.kode}`,
      aksi: "Atur jumlah fase", dari: `${kini} fase`, ke: `${jumlah} fase`,
    });

    revalidatePath(`/master/${segmen(proyek.kode)}`);
    return `Jumlah fase kini ${jumlah} (F1–F${jumlah}).`;
  });
}

// ===========================================================================
// DESKRIPSI PROYEK
// ===========================================================================

export async function ubahLokasiProyek(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", lama.id);

    // Pin ditulis sebagai satu kolom "lintang, bujur" seperti pada artifact,
    // lalu dipecah ke dua kolom saat disimpan.
    const pin = teksOpsional(form, "pin");
    let pinLat = lama.pinLat;
    let pinLng = lama.pinLng;
    if (pin !== null) {
      const hasil = uraikanPin(pin);
      if (typeof hasil === "string") throw new GagalIzin(hasil);
      pinLat = hasil.lat;
      pinLng = hasil.lng;
    }

    const baru = {
      alamat: teks(form, "alamat", true),
      kelurahan: teks(form, "kelurahan", true),
      kecamatan: teks(form, "kecamatan", true),
      kota: teks(form, "kota", true),
      provinsi: teks(form, "provinsi", true),
      pinLat,
      pinLng,
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Lokasi`,
      sebelum: lama, sesudah: baru,
      label: {
        alamat: "Alamat", kelurahan: "Kelurahan", kecamatan: "Kecamatan",
        kota: "Kota / Kabupaten", provinsi: "Provinsi",
        pinLat: "Pin lintang", pinLng: "Pin bujur",
      },
    });

    segarkan(kode);
  });
}

export async function ubahLuasLahan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", lama.id);

    const baru = {
      luasKavlingEfektif: angka(form, "luasKavlingEfektif", { min: 0 }),
      luasSarana: angka(form, "luasSarana", { min: 0 }),
      luasPrasarana: angka(form, "luasPrasarana", { min: 0 }),
      luasRth: angka(form, "luasRth", { min: 0 }),
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    const total = (x: typeof baru | typeof lama) =>
      x.luasKavlingEfektif + x.luasSarana + x.luasPrasarana + x.luasRth;

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Luas Lahan`,
      sebelum: { ...lama, total: total(lama) },
      sesudah: { ...baru, total: total(baru) },
      label: {
        luasKavlingEfektif: "Kavling efektif", luasSarana: "Sarana",
        luasPrasarana: "Prasarana", luasRth: "RTH", total: "Luas total",
      },
      format: {
        luasKavlingEfektif: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasSarana: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasPrasarana: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        luasRth: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
        total: (v) => `${Number(v).toLocaleString("id-ID")} m²`,
      },
    });

    segarkan(kode);
  });
}

/**
 * Biaya perolehan lahan terpisah dari deskripsi karena berada di bawah izin
 * "hargaRabRap" — peran yang boleh menyunting alamat belum tentu boleh
 * menyentuh angka pembelian tanah.
 */
export async function ubahBiayaLahan(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const lama = await prisma.project.findUnique({ where: { kode } });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.id);

    const baru = {
      hargaPerM2: angka(form, "hargaPerM2", { min: 0 }),
      biayaPembelian: angka(form, "biayaPembelian", { min: 0 }),
      biayaNotaris: angka(form, "biayaNotaris", { min: 0 }),
      biayaBalikNama: angka(form, "biayaBalikNama", { min: 0 }),
      biayaLegalLain: angka(form, "biayaLegalLain", { min: 0 }),
    };

    await prisma.project.update({ where: { id: lama.id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.id, objek: `Proyek ${lama.kode} · Biaya lahan`,
      sebelum: lama, sesudah: baru,
      label: {
        hargaPerM2: "Harga per m²", biayaPembelian: "Biaya pembelian",
        biayaNotaris: "Notaris", biayaBalikNama: "Balik nama", biayaLegalLain: "Legal lain-lain",
      },
      format: {
        hargaPerM2: rpLog, biayaPembelian: rpLog, biayaNotaris: rpLog,
        biayaBalikNama: rpLog, biayaLegalLain: rpLog,
      },
    });

    segarkan(kode);
  });
}

// ===========================================================================
// LEGALITAS
// ===========================================================================

/**
 * Simpan seluruh baris legalitas sekaligus.
 *
 * Mengikuti artifact: satu proyek dapat memiliki lebih dari satu NIB, dan
 * seluruhnya disunting dalam satu modal — bukan satu per satu. Baris yang
 * hilang dari kiriman berarti dihapus.
 *
 * Baris yang sudah punya dokumen tidak dihapus begitu saja: dokumennya
 * dilepas lebih dulu agar riwayat revisinya tidak ikut hilang.
 */
export async function ubahLegalitas(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const proyek = await prisma.project.findUnique({
      where: { kode },
      select: { id: true, kode: true, legalitas: { select: { id: true, nib: true } } },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", proyek.id);

    let baris: {
      id?: string; nib: string; jenisHak: string; nomorHak: string; sertifikat: string; luas: number;
    }[];
    try {
      baris = JSON.parse(teks(form, "baris", true));
    } catch {
      throw new GagalIzin("Data legalitas tidak terbaca.");
    }

    const sah = baris.filter((b) => b.nib?.trim());
    wajibLolos(
      periksaUbahLegalitas({
        projectId: proyek.id,
        baris: sah.map((b) => ({
          nib: String(b.nib ?? ""),
          jenisHak: String(b.jenisHak ?? ""),
          nomorHak: String(b.nomorHak ?? ""),
          luas: Number(b.luas ?? 0),
        })),
      }),
    );

    const idDikirim = new Set(sah.map((b) => b.id).filter(Boolean));
    const dihapus = proyek.legalitas.filter((l) => !idDikirim.has(l.id));

    for (const l of dihapus) {
      await prisma.legality.delete({ where: { id: l.id } });
    }

    for (const b of sah) {
      const data = {
        nib: b.nib.trim(),
        jenisHak: b.jenisHak,
        nomorHak: b.nomorHak.trim(),
        sertifikat: (b.sertifikat ?? "").trim(),
        luas: Number(b.luas) || 0,
      };
      if (b.id) {
        await prisma.legality.update({ where: { id: b.id }, data });
      } else {
        await prisma.legality.create({ data: { ...data, projectId: proyek.id } });
      }
    }

    await catat({
      pengguna, projectId: proyek.id, objek: "Legalitas",
      aksi: "Ubah data legalitas",
      dari: `${proyek.legalitas.length} NIB`,
      ke: `${sah.length} NIB`,
    });

    segarkan(kode);
  });
}

// ===========================================================================
// TIPE UNIT
// ===========================================================================

export async function simpanTipeUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);
    const id = teksOpsional(form, "id");

    const proyek = await prisma.project.findUnique({ where: { kode }, select: { id: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("dokumenTeknis", proyek.id);

    const data = {
      kode: teks(form, "kodeTipe", true).toUpperCase(),
      nama: teks(form, "nama", true),
      luasBangunan: angka(form, "luasBangunan", { min: 1, wajib: true }),
      luasTanah: angka(form, "luasTanah", { min: 1, wajib: true }),
    };

    if (id) {
      const lama = await prisma.unitType.findUnique({
        where: { id },
        include: { _count: { select: { units: true } } },
      });
      if (!lama || lama.projectId !== proyek.id) throw new GagalIzin("Tipe unit tidak ditemukan.");

      // Mengubah luas bangunan TIDAK menghitung ulang RAB unit yang sudah ada —
      // baris BOQ mereka adalah snapshot. Perubahan ini hanya berlaku untuk
      // unit yang dibuat sesudahnya.
      await prisma.unitType.update({ where: { id }, data });
      const jml = await catatDiff({
        pengguna, projectId: proyek.id, objek: `Tipe unit ${lama.kode}`,
        sebelum: lama, sesudah: data,
        label: { kode: "Kode", nama: "Nama", luasBangunan: "Luas bangunan", luasTanah: "Luas tanah" },
      });

      if (jml > 0 && perluPeringatanLuasBangunan(lama.luasBangunan, data.luasBangunan, lama._count.units)) {
        return `Tersimpan. Catatan: ${lama._count.units} unit yang sudah ada tetap memakai RAB lamanya — baris BOQ mereka adalah snapshot.`;
      }
    } else {
      const bentrok = await prisma.unitType.findFirst({
        where: { projectId: proyek.id, kode: data.kode },
        select: { id: true },
      });
      if (bentrok) throw new GagalIzin(`Kode tipe "${data.kode}" sudah dipakai di proyek ini.`);

      // Tipe baru langsung dibekali draft RAB & RAP dari formula lama (berbasis
      // luas bangunan), supaya tabelnya bisa langsung disunting alih-alih
      // kosong sama sekali — ini yang lalu jadi acuan disalin ke unit baru
      // bertipe ini (lihat tambahUnit).
      const boq = buatBoqDariTemplate(data.luasBangunan);
      const rap = buatRapDariTemplate(data.luasBangunan);

      await prisma.unitType.create({
        data: {
          ...data, projectId: proyek.id,
          rapUpahVolume: 1, rapUpahHarga: hitungUpahRap(data.luasBangunan),
          boqItems: { create: boq },
          rapItems: { create: rap },
        },
      });
      await catat({
        pengguna, projectId: proyek.id, objek: `Tipe unit ${data.kode}`,
        aksi: "Tambah tipe unit", ke: `${data.nama} — LB ${data.luasBangunan} m², LT ${data.luasTanah} m²`,
      });
    }

    segarkan(kode);
  });
}

export async function hapusTipeUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.unitType.findUnique({
      where: { id },
      select: {
        id: true, kode: true, nama: true, projectId: true,
        project: { select: { kode: true } },
        _count: { select: { units: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("dokumenTeknis", lama.projectId);

    // Tipe yang masih dipakai unit tidak boleh dihapus — menghapusnya akan
    // memutus rujukan unit ke luas bangunan dan namanya.
    if (lama._count.units > 0) {
      throw new GagalIzin(
        `Tipe "${lama.nama}" masih dipakai ${lama._count.units} unit. Hapus atau pindahkan unit tersebut lebih dulu.`,
      );
    }

    await prisma.unitType.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId, objek: `Tipe unit ${lama.kode}`,
      aksi: "Hapus tipe unit", dari: lama.nama,
    });

    segarkan(lama.project.kode);
  });
}

// ===========================================================================
// UNIT
// ===========================================================================

export async function ubahUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unit.findUnique({
      where: { id },
      include: { project: { select: { kode: true } }, phase: { select: { kode: true } } },
    });
    if (!lama) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("progress", lama.projectId);

    // Progres unit hanya punya SATU sumber: BOQ Master Proyek. Bila baris
    // BOQ-nya sudah tersusun, angkanya turunan dari opname per baris —
    // mengetiknya di sini hanya bertahan sampai opname berikutnya
    // menuliskannya ulang. Isian dari formulir diabaikan, bukan ditolak,
    // supaya kolom lain (luas tanah, tipe, nomor) tetap bisa disunting.
    const dikendalikanBoq =
      (await prisma.unitBoqItem.count({ where: { unitId: id } })) > 0;

    // Progres hanya diperbarui bila formulir benar-benar mengirimnya. Modal
    // "Ubah Deskripsi Unit" di tabel Daftar Unit tidak lagi memuat Progres, jadi
    // absennya field itu berarti "pertahankan", bukan "jadikan 0".
    const progresIsian = teksOpsional(form, "progress");
    const progresDiminta = progresIsian === null ? lama.progress : angka(form, "progress", { min: 0, max: 100 });
    const progress = dikendalikanBoq ? lama.progress : progresDiminta;

    // Status jual & tanggal serah terima ikut bila formulir mengirimnya. Status
    // bangun TIDAK lagi diinput — ia nilai turunan (statusBangunUnit) dari
    // progres + status jual + tanggal serah terima.
    const statusJualDiminta = teksOpsional(form, "statusJual");
    if (statusJualDiminta !== null && !STATUS_JUAL.includes(statusJualDiminta as (typeof STATUS_JUAL)[number])) {
      throw new GagalIzin(`Nilai "${statusJualDiminta}" tidak sah untuk kolom "statusJual".`);
    }
    const statusJual = statusJualDiminta ?? lama.statusJual;

    // Tanggal serah terima hanya bermakna saat status jual sudah "Serah Terima".
    // Bila baru mencapainya tanpa tanggal, dipakai hari ini; bila mundur dari
    // "Serah Terima", tanggalnya dikosongkan.
    const tglStr = teksOpsional(form, "tanggalSerahTerima");
    const tglDiminta = tglStr ? new Date(tglStr) : null;
    const tanggalSerahTerima =
      statusJual === "Serah Terima"
        ? (tglDiminta ?? lama.tanggalSerahTerima ?? new Date())
        : null;

    const baru: {
      statusPembangunan: string; statusJual: string; tanggalSerahTerima: Date | null;
      progress: number; luasTanah: number;
      nomor?: number; phaseId?: string; unitTypeId?: string; kode?: string;
    } = {
      statusPembangunan: statusBangunUnit({ progress, statusJual, tanggalSerahTerima }),
      statusJual,
      tanggalSerahTerima,
      progress,
      luasTanah: angka(form, "luasTanah", { min: 1, wajib: true }),
    };

    // Nomor, fase, dan tipe hanya ikut bila formulir mengirimnya — daftar unit
    // hanya menyunting status, sedangkan halaman detail menyunting semuanya.
    const phaseId = teksOpsional(form, "phaseId");
    const unitTypeId = teksOpsional(form, "unitTypeId");
    const nomorIsian = String(form.get("nomor") ?? "").trim();

    if (phaseId || unitTypeId || nomorIsian) {
      // Mengubah tipe TIDAK menghitung ulang baris BOQ/RAP unit ini. Baris
      // tersebut adalah snapshot; yang berubah hanya rujukan tipenya.
      const [fase, tipe] = await Promise.all([
        phaseId
          ? prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, kode: true, projectId: true } })
          : null,
        unitTypeId
          ? prisma.unitType.findUnique({ where: { id: unitTypeId }, select: { id: true, projectId: true } })
          : null,
      ]);
      if (phaseId && (!fase || fase.projectId !== lama.projectId)) throw new GagalIzin("Fase tidak sah.");
      if (unitTypeId && (!tipe || tipe.projectId !== lama.projectId)) throw new GagalIzin("Tipe unit tidak sah.");

      const nomor = nomorIsian ? angka(form, "nomor", { min: 1 }) : lama.nomor;

      // Nomor unit tidak boleh dobel dalam satu proyek — fase tidak
      // membebaskan nomor yang sama dipakai lagi.
      if (nomor !== lama.nomor) {
        const nomorBentrok = await prisma.unit.findFirst({
          where: { projectId: lama.projectId, nomor, NOT: { id } }, select: { kode: true },
        });
        if (nomorBentrok) {
          throw new GagalIzin(
            `Nomor unit ${nomor} sudah dipakai di proyek ini (unit ${nomorBentrok.kode}). Fase tidak membebaskan nomor yang sama.`,
          );
        }
      }

      const kodeFase = fase?.kode ?? lama.phase.kode;
      const kodeBaru = `${lama.project.kode}-${kodeFase}-${nomor}`;

      if (kodeBaru !== lama.kode) {
        const bentrok = await prisma.unit.findUnique({ where: { kode: kodeBaru }, select: { id: true } });
        if (bentrok) throw new GagalIzin(`Unit ${kodeBaru} sudah ada. Pakai nomor atau fase lain.`);
        baru.kode = kodeBaru;
      }

      baru.nomor = nomor;
      if (fase) baru.phaseId = fase.id;
      if (tipe) baru.unitTypeId = tipe.id;
    }

    await prisma.unit.update({ where: { id }, data: baru });

    // Perubahan progres dicatat sebagai titik riwayat, bukan menimpa angka
    // sebelumnya — opname mingguan membandingkan dua titik ini.
    if (baru.progress !== lama.progress) {
      await prisma.progressRecord.create({
        data: {
          unitId: id, tanggal: new Date(), progress: baru.progress,
          catatan: "Diubah lewat aplikasi", dicatatOleh: pengguna.nama, dicatatOlehId: pengguna.id,
        },
      });
    }

    await catatDiff({
      pengguna, projectId: lama.projectId,
      objek: `Unit ${lama.phase.kode}-${lama.nomor}`,
      sebelum: lama, sesudah: baru,
      label: {
        statusPembangunan: "Status bangun", statusJual: "Status jual",
        progress: "Progres", luasTanah: "Luas tanah",
        nomor: "Nomor unit", kode: "Kode unit",
        phaseId: "Fase", unitTypeId: "Tipe unit",
      },
      format: { progress: (v) => `${v}%` },
    });

    segarkan(lama.project.kode);

    // Beri tahu bila isian progres diabaikan, supaya pengguna tidak mengira
    // angkanya tersimpan lalu bingung saat halaman menampilkan angka lama.
    if (dikendalikanBoq && progresDiminta !== lama.progress) {
      return (
        `Progres unit ini dihitung dari BOQ Master Proyek, jadi isian ${progresDiminta}% ` +
        `tidak disimpan. Isi lewat tabel opname di halaman Konstruksi. Kolom lain tersimpan.`
      );
    }
  });
}

export async function tambahUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kode = teks(form, "kode", true);

    const proyek = await prisma.project.findUnique({ where: { kode }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("daftarUnit", proyek.id);

    const phaseId = teks(form, "phaseId", true);
    const unitTypeId = teks(form, "unitTypeId", true);

    const [fase, tipe] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, kode: true, projectId: true } }),
      prisma.unitType.findUnique({
        where: { id: unitTypeId },
        select: {
          id: true, luasBangunan: true, luasTanah: true, projectId: true,
          rapUpahVolume: true, rapUpahHarga: true,
          boqItems: {
            orderBy: { urutan: "asc" as const },
            select: { grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, spesifikasi: true },
          },
          rapItems: {
            orderBy: { urutan: "asc" as const },
            select: { grup: true, kategori: true, nama: true, satuan: true, volume: true, hargaSatuan: true, keterangan: true },
          },
        },
      }),
    ]);
    if (!fase || fase.projectId !== proyek.id) throw new GagalIzin("Fase tidak sah.");
    if (!tipe || tipe.projectId !== proyek.id) throw new GagalIzin("Tipe unit tidak sah.");

    const nomor = angka(form, "nomor", { min: 1, wajib: true });
    const statusJual = pilihan(form, "statusJual", STATUS_JUAL);

    // Luas tanah diisi per unit; bila dikosongkan, ikut luas tanah tipenya.
    const luasTanahIsian = angka(form, "luasTanah", { min: 0 });
    const luasTanah = luasTanahIsian > 0 ? luasTanahIsian : tipe.luasTanah;

    // Nomor unit tidak boleh dobel dalam SATU PROYEK — fase tidak membebaskan
    // nomor yang sama dipakai lagi.
    const nomorBentrok = await prisma.unit.findFirst({
      where: { projectId: proyek.id, nomor }, select: { kode: true },
    });
    if (nomorBentrok) {
      throw new GagalIzin(
        `Nomor unit ${nomor} sudah dipakai di proyek ini (unit ${nomorBentrok.kode}). Fase tidak membebaskan nomor yang sama.`,
      );
    }

    const kodeUnit = `${proyek.kode}-${fase.kode}-${nomor}`;
    const bentrok = await prisma.unit.findUnique({ where: { kode: kodeUnit }, select: { id: true } });
    if (bentrok) throw new GagalIzin(`Unit ${kodeUnit} sudah ada. Pakai nomor lain.`);

    // Unit baru selalu mulai dari nol — status bangun ("Belum Terbangun") adalah
    // nilai turunan; kemajuan diisi lewat opname konstruksi setelahnya.
    const progress = 0;
    const statusPembangunan = statusBangunUnit({ progress, statusJual, tanggalSerahTerima: null });

    // Snapshot BOQ & RAP dibuat SEKALI di sini. Sumber utamanya adalah RAB/RAP
    // master milik Tipe Unit ini (disunting dari halaman Detail Tipe Unit) —
    // formula lama berbasis luas bangunan hanya dipakai sebagai fallback bila
    // tipe ini belum punya rincian sendiri sama sekali. Sesudah tersimpan,
    // unit tidak lagi membaca tipe maupun formula.
    const dariTipe = tipe.boqItems.length > 0;
    const boq = dariTipe ? tipe.boqItems : buatBoqDariTemplate(tipe.luasBangunan);
    const rap = dariTipe && tipe.rapItems.length > 0 ? tipe.rapItems : buatRapDariTemplate(tipe.luasBangunan);
    const rapUpahVolume = dariTipe ? tipe.rapUpahVolume : 1;
    const rapUpahHarga = dariTipe ? tipe.rapUpahHarga : hitungUpahRap(tipe.luasBangunan);

    await prisma.unit.create({
      data: {
        kode: kodeUnit, projectId: proyek.id, phaseId: fase.id, unitTypeId: tipe.id,
        nomor, luasTanah, statusPembangunan, statusJual, progress,
        hargaJual: hargaJualAcuan(dariTipe ? totalBaris(boq) : rabAcuan(tipe.luasBangunan)),
        rapUpahVolume, rapUpahHarga,
        // Urutan diberi ulang secara eksplisit (bukan diwariskan) supaya baris
        // tetap tampil sesuai urutan sumbernya walau field `urutan` tidak ikut
        // terbaca dari tipe (defaultnya 0 untuk semua baris bila tidak diisi).
        boqItems: { create: boq.map((b, i) => ({ ...b, urutan: i })) },
        rapItems: { create: rap.map((r, i) => ({ ...r, urutan: i })) },
      },
    });

    if (progress > 0) {
      await prisma.progressRecord.create({
        data: {
          unitId: (await prisma.unit.findUniqueOrThrow({ where: { kode: kodeUnit }, select: { id: true } })).id,
          tanggal: new Date(), progress, catatan: "Progres awal saat unit dibuat",
          dicatatOleh: pengguna.nama,
          dicatatOlehId: pengguna.id,
        },
      });
    }

    await catat({
      pengguna, projectId: proyek.id, objek: `Unit ${fase.kode}-${nomor}`,
      aksi: "Tambah unit", ke: `${statusPembangunan} · ${statusJual}`,
    });

    segarkan(kode);
    return `Unit ${kodeUnit} dibuat dengan salinan BOQ dan RAP dari template saat ini.`;
  });
}

export async function hapusUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true, kode: true, nomor: true, projectId: true, progress: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("daftarUnit", lama.projectId);

    if (lama.progress > 0) {
      throw new GagalIzin(
        `Unit ${lama.kode} sudah berjalan ${lama.progress}%. Unit yang sudah dibangun tidak boleh dihapus — ubah statusnya bila perlu.`,
      );
    }

    await prisma.unit.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId, objek: `Unit ${lama.phase.kode}-${lama.nomor}`,
      aksi: "Hapus unit", dari: lama.kode,
    });

    segarkan(lama.project.kode);
  });
}

/**
 * Hapus paksa unit — melewati kunci "progres harus 0".
 *
 * Untuk perubahan besar: mengganti data lama yang sudah terlanjur berjalan.
 * Dikunci ke peran Administrator Sistem dan meminta pengetikan kode proyek,
 * karena penghapusan ini permanen dan ikut menghapus seluruh riwayat
 * progress/opname, baris BOQ/RAP, serta kerja tambah unit (onDelete: Cascade).
 * Pagar kontrak tetap berlaku: unit yang tercakup kontrak tidak boleh lenyap
 * diam-diam dari kontraknya.
 */
export async function hapusUnitPaksa(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const konfirmasi = teks(form, "konfirmasi", true);

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true, kode: true, nomor: true, projectId: true, progress: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
        _count: { select: { contractUnits: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    // Izin ubah daftar unit + akses proyek diperiksa sekaligus di sini.
    const pengguna = await izinkan("daftarUnit", unit.projectId);

    // Di atas izin operasional itu, hapus paksa masih dikunci ke satu peran.
    if (pengguna.peranAktif !== PERAN_HAPUS_PAKSA) {
      throw new GagalIzin(`Hanya peran ${PERAN_HAPUS_PAKSA} yang boleh menghapus paksa.`);
    }

    if (unit._count.contractUnits > 0) {
      throw new GagalIzin(
        `Unit ${unit.kode} masih tercakup ${unit._count.contractUnits} kontrak. Lepaskan dari kontrak lebih dulu.`,
      );
    }
    if (konfirmasi.trim().toUpperCase() !== unit.project.kode.toUpperCase()) {
      throw new GagalIzin(`Ketik kode proyek "${unit.project.kode}" persis untuk mengonfirmasi.`);
    }

    await prisma.unit.delete({ where: { id } });

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Hapus paksa unit",
      dari: `${unit.kode} · progres ${unit.progress}%`, ke: "dihapus permanen",
    });

    revalidatePath(`/master/${segmen(unit.project.kode)}`);
    revalidatePath("/");
    redirect(`/master/${segmen(unit.project.kode)}`);
  });
}

// ===========================================================================
// BARIS BOQ — inti penyesuaian harga
// ===========================================================================

export async function ubahBarisBoq(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unitBoqItem.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true, nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) throw new GagalIzin("Baris BOQ tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.unit.projectId);

    const baru = {
      uraian: teks(form, "uraian", true),
      satuan: teks(form, "satuan", true),
      volume: angka(form, "volume", { min: 0, wajib: true }),
      hargaSatuan: angka(form, "hargaSatuan", { min: 0, wajib: true }),
      spesifikasi: teksOpsional(form, "spesifikasi"),
    };

    await prisma.unitBoqItem.update({ where: { id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.unit.projectId,
      objek: `Unit ${lama.unit.phase.kode}-${lama.unit.nomor} · RAB · ${lama.uraian}`,
      sebelum: lama, sesudah: baru,
      label: {
        uraian: "Uraian", satuan: "Satuan", volume: "Volume",
        hargaSatuan: "Harga satuan", spesifikasi: "Spesifikasi",
      },
      format: { hargaSatuan: rpLog },
    });

    segarkan(lama.unit.project.kode);
  });
}

export async function ubahBarisRap(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);

    const lama = await prisma.unitRapItem.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            nomor: true, projectId: true,
            phase: { select: { kode: true } }, project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) throw new GagalIzin("Baris RAP tidak ditemukan.");

    const pengguna = await izinkan("hargaRabRap", lama.unit.projectId);

    const baru = {
      nama: teks(form, "nama", true),
      satuan: teks(form, "satuan", true),
      volume: angka(form, "volume", { min: 0, wajib: true }),
      hargaSatuan: angka(form, "hargaSatuan", { min: 0, wajib: true }),
      keterangan: teksOpsional(form, "keterangan"),
    };

    await prisma.unitRapItem.update({ where: { id }, data: baru });

    await catatDiff({
      pengguna, projectId: lama.unit.projectId,
      objek: `Unit ${lama.unit.phase.kode}-${lama.unit.nomor} · RAP · ${lama.nama}`,
      sebelum: lama, sesudah: baru,
      label: {
        nama: "Nama", satuan: "Satuan", volume: "Volume",
        hargaSatuan: "Harga satuan", keterangan: "Keterangan",
      },
      format: { hargaSatuan: rpLog },
    });

    segarkan(lama.unit.project.kode);
  });
}

// ===========================================================================
// DOKUMEN — unggah revisi
// ===========================================================================

/**
 * Catat revisi baru sebuah dokumen beserta berkasnya.
 *
 * Berkas ditulis ke penyimpanan lebih dulu, baru metadatanya dicatat — bila
 * penulisan gagal, tidak ada baris revisi yang menunjuk ke berkas yang tak ada.
 */
export async function unggahRevisi(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const dokumenId = teksOpsional(form, "dokumenId");
    const pemilikJenis = teks(form, "pemilikJenis", true);
    const pemilikId = teks(form, "pemilikId", true);
    const kategori = teks(form, "kategori", true);
    const label = teks(form, "label", true);

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) {
      throw new GagalIzin("Pilih berkas yang akan diunggah.");
    }

    const namaFile = bersihkanNamaFile(berkas.name);
    periksaBerkas(namaFile, berkas.type, berkas.size);
    periksaBerkasKategori(namaFile, kategori, berkas.size);

    // Cari proyek pemilik dokumen, sekaligus memastikan pengguna berhak.
    let projectId: string;
    let kodeProyek: string;

    if (pemilikJenis === "legalitas") {
      const l = await prisma.legality.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!l) throw new GagalIzin("Legalitas tidak ditemukan.");
      projectId = l.projectId;
      kodeProyek = l.project.kode;
    } else if (pemilikJenis === "kontrak") {
      // SPK menempel pada kontrak, bukan pada proyek atau unit — revisinya
      // dilacak sama seperti gambar kerja karena SPK kerap direvisi setelah
      // negosiasi, dan versi mana yang berlaku harus bisa ditelusuri.
      const k = await prisma.contract.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!k) throw new GagalIzin("Kontrak tidak ditemukan.");
      projectId = k.projectId;
      kodeProyek = k.project.kode;
    } else if (pemilikJenis === "proyek") {
      const p = await prisma.project.findUnique({
        where: { id: pemilikId },
        select: { id: true, kode: true },
      });
      if (!p) throw new GagalIzin("Proyek tidak ditemukan.");
      projectId = p.id;
      kodeProyek = p.kode;
    } else if (pemilikJenis === "tipeUnit") {
      const t = await prisma.unitType.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!t) throw new GagalIzin("Tipe unit tidak ditemukan.");
      projectId = t.projectId;
      kodeProyek = t.project.kode;
    } else if (pemilikJenis === "kerjaTambah") {
      const k = await prisma.customWork.findUnique({
        where: { id: pemilikId },
        select: { id: true, unit: { select: { projectId: true, project: { select: { kode: true } } } } },
      });
      if (!k) throw new GagalIzin("Kerja tambah tidak ditemukan.");
      projectId = k.unit.projectId;
      kodeProyek = k.unit.project.kode;
    } else if (pemilikJenis === "sarpras") {
      const s = await prisma.infrastructure.findUnique({
        where: { id: pemilikId },
        select: { id: true, projectId: true, project: { select: { kode: true } } },
      });
      if (!s) throw new GagalIzin("Item sarpras tidak ditemukan.");
      projectId = s.projectId;
      kodeProyek = s.project.kode;
    } else {
      throw new GagalIzin(`Jenis pemilik dokumen "${pemilikJenis}" belum didukung.`);
    }

    const pengguna = await izinkan("dokumenTeknis", projectId);

    let dokId = dokumenId;
    let revisiBerikutnya = 1;

    if (dokId) {
      const jumlah = await prisma.documentVersion.count({ where: { documentId: dokId } });
      revisiBerikutnya = jumlah + 1;
    } else {
      const dok = await prisma.document.create({ data: { kategori, judul: label } });
      dokId = dok.id;

      // Tautkan dokumen baru ke pemiliknya. Nama kolomnya berbeda-beda, jadi
      // dipetakan secara eksplisit alih-alih dibangun dari string.
      const kolomTipe: Record<string, "docModel3dId" | "docGambarKerjaPdfId" | "docGambarKerjaDwgId" | "docRenderId" | "docSpekId"> = {
        model3d: "docModel3dId", gambarKerjaPdf: "docGambarKerjaPdfId", gambarKerjaDwg: "docGambarKerjaDwgId",
        render: "docRenderId", spek: "docSpekId",
      };
      const kolomKt: Record<string, "docDesainId" | "docModel3dId" | "docGambarKerjaPdfId" | "docGambarKerjaDwgId" | "docRabId"> = {
        desain: "docDesainId", model3d: "docModel3dId",
        gambarKerjaPdf: "docGambarKerjaPdfId", gambarKerjaDwg: "docGambarKerjaDwgId", rab: "docRabId",
      };
      const kolomSarpras: Record<string, "docModel3dId" | "docGambarKerjaPdfId" | "docGambarKerjaDwgId"> = {
        model3d: "docModel3dId", gambarKerjaPdf: "docGambarKerjaPdfId", gambarKerjaDwg: "docGambarKerjaDwgId",
      };

      if (pemilikJenis === "legalitas") {
        await prisma.legality.update({ where: { id: pemilikId }, data: { dokumenId: dokId } });
      } else if (pemilikJenis === "proyek") {
        await prisma.project.update({ where: { id: pemilikId }, data: { analisaDocId: dokId } });
      } else if (pemilikJenis === "tipeUnit") {
        const kolom = kolomTipe[kategori];
        if (!kolom) throw new GagalIzin(`Kategori dokumen "${kategori}" tidak dikenal untuk tipe unit.`);
        await prisma.unitType.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      } else if (pemilikJenis === "kerjaTambah") {
        const kolom = kolomKt[kategori];
        if (!kolom) throw new GagalIzin(`Kategori dokumen "${kategori}" tidak dikenal untuk kerja tambah.`);
        await prisma.customWork.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      } else if (pemilikJenis === "kontrak") {
        await prisma.contract.update({ where: { id: pemilikId }, data: { docSpkId: dokId } });
      } else if (pemilikJenis === "sarpras") {
        const kolom = kolomSarpras[kategori];
        if (!kolom) throw new GagalIzin(`Kategori dokumen "${kategori}" tidak dikenal untuk sarana & prasarana.`);
        await prisma.infrastructure.update({ where: { id: pemilikId }, data: { [kolom]: dokId } });
      }
    }

    const tersimpan = await simpanBerkas(await berkas.arrayBuffer(), namaFile);

    await prisma.documentVersion.create({
      data: {
        documentId: dokId,
        revisi: `R${revisiBerikutnya}`,
        namaFile,
        ukuranByte: tersimpan.ukuranByte,
        objectKey: tersimpan.objectKey,
        diunggahOlehId: pengguna.id,
      },
    });

    await catat({
      pengguna, projectId, objek: label,
      aksi: "Unggah revisi",
      dari: revisiBerikutnya > 1 ? `R${revisiBerikutnya - 1}` : null,
      ke: `R${revisiBerikutnya} — ${namaFile} (${(tersimpan.ukuranByte / 1024 / 1024).toFixed(1)} MB)`,
    });

    segarkan(kodeProyek);
    return `Revisi R${revisiBerikutnya} tersimpan.`;
  });
}

export async function simpanSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const kodeProyek = teks(form, "kode", true);
    const id = teksOpsional(form, "id");

    const proyek = await prisma.project.findUnique({ where: { kode: kodeProyek }, select: { id: true, kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("daftarSarpras", proyek.id);

    // Deskripsi dasar selalu ikut disunting. RAB, Progres, dan Status TIDAK —
    // RAB = jumlah baris BOQ, Progres = opname per baris BOQ, dan Status bangun
    // adalah nilai turunan dari progres (statusBangunSarpras). Mengisinya manual
    // di sini akan tertimpa oleh nilai turunan itu pada kesempatan berikutnya.
    const data = {
      nama: teks(form, "nama", true),
      jenis: pilihan(form, "jenis", JENIS_SARPRAS),
      volume: teks(form, "volume", true),
    };

    if (id) {
      const lama = await prisma.infrastructure.findUnique({
        where: { id },
        include: { _count: { select: { boqItems: true } } },
      });
      if (!lama || lama.projectId !== proyek.id) throw new GagalIzin("Item sarpras tidak ditemukan.");

      // Progres hanya bisa diketik manual selama item ini belum punya baris
      // BOQ sama sekali — begitu ada, satu-satunya sumber adalah opname per
      // baris di halaman Konstruksi (sama seperti aturan pada `ubahUnit`).
      const dikendalikanBoq = lama._count.boqItems > 0;
      const progresDiminta = teksOpsional(form, "progress");
      const progress = dikendalikanBoq || progresDiminta === null
        ? lama.progress
        : angka(form, "progress", { min: 0, max: 100 });

      const sesudah = { ...data, progress, status: statusBangunSarpras(progress) };

      await prisma.infrastructure.update({ where: { id }, data: sesudah });

      if (progress !== lama.progress) {
        await prisma.progressRecord.create({
          data: {
            infrastructureId: id, tanggal: new Date(), progress,
            catatan: "Diubah lewat aplikasi", dicatatOleh: pengguna.nama, dicatatOlehId: pengguna.id,
          },
        });
      }

      await catatDiff({
        pengguna, projectId: proyek.id, objek: `Sarpras · ${lama.nama}`,
        sebelum: lama, sesudah,
        label: { nama: "Nama", jenis: "Jenis", volume: "Volume", status: "Status", progress: "Progres" },
        format: { progress: (v) => `${v}%` },
      });
    } else {
      const urut = await prisma.infrastructure.count({ where: { projectId: proyek.id } });
      await prisma.infrastructure.create({
        data: { ...data, rab: 0, progress: 0, projectId: proyek.id, kode: `${proyek.kode}-S${urut + 1}` },
      });
      await catat({
        pengguna, projectId: proyek.id, objek: `Sarpras · ${data.nama}`,
        aksi: "Tambah sarpras",
        ke: `${data.jenis} — ${data.volume}`,
      });
    }

    segarkan(kodeProyek);
  });
}

export async function hapusSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.infrastructure.findUnique({
      where: { id },
      select: {
        id: true, nama: true, progress: true, projectId: true,
        project: { select: { kode: true } },
        _count: { select: { contractItems: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("daftarSarpras", lama.projectId);

    if (lama._count.contractItems > 0) {
      throw new GagalIzin(
        `"${lama.nama}" masih tercakup dalam ${lama._count.contractItems} kontrak. Lepaskan dari kontrak lebih dulu.`,
      );
    }

    await prisma.infrastructure.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId, objek: `Sarpras · ${lama.nama}`,
      aksi: "Hapus sarpras", dari: `progres ${lama.progress}%`,
    });

    segarkan(lama.project.kode);
  });
}

/**
 * Hapus paksa item sarpras — pasangan dari `hapusUnitPaksa`, dengan penjagaan
 * yang sama: peran Administrator Sistem, konfirmasi kode proyek, dan pagar
 * kontrak yang tetap berlaku.
 */
export async function hapusSarprasPaksa(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const konfirmasi = teks(form, "konfirmasi", true);

    const s = await prisma.infrastructure.findUnique({
      where: { id },
      select: {
        id: true, kode: true, nama: true, projectId: true, progress: true,
        project: { select: { kode: true } },
        _count: { select: { contractItems: true } },
      },
    });
    if (!s) throw new GagalIzin("Item sarpras tidak ditemukan.");

    // Izin ubah daftar sarpras + akses proyek diperiksa sekaligus di sini.
    const pengguna = await izinkan("daftarSarpras", s.projectId);

    // Di atas izin operasional itu, hapus paksa masih dikunci ke satu peran.
    if (pengguna.peranAktif !== PERAN_HAPUS_PAKSA) {
      throw new GagalIzin(`Hanya peran ${PERAN_HAPUS_PAKSA} yang boleh menghapus paksa.`);
    }

    if (s._count.contractItems > 0) {
      throw new GagalIzin(
        `"${s.nama}" masih tercakup ${s._count.contractItems} kontrak. Lepaskan dari kontrak lebih dulu.`,
      );
    }
    if (konfirmasi.trim().toUpperCase() !== s.project.kode.toUpperCase()) {
      throw new GagalIzin(`Ketik kode proyek "${s.project.kode}" persis untuk mengonfirmasi.`);
    }

    await prisma.infrastructure.delete({ where: { id } });

    await catat({
      pengguna, projectId: s.projectId, objek: `Sarpras · ${s.nama}`,
      aksi: "Hapus paksa sarpras",
      dari: `${s.kode} · progres ${s.progress}%`, ke: "dihapus permanen",
    });

    revalidatePath(`/master/${segmen(s.project.kode)}`);
    revalidatePath("/");
    redirect(`/master/${segmen(s.project.kode)}`);
  });
}
