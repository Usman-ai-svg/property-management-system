"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, teks,
} from "@/lib/actions/guard";

/**
 * Penyuntingan business plan dan data pembanding pasar.
 *
 * Business plan adalah rencana, bukan realisasi. Mengubahnya tidak menyentuh
 * satu pun transaksi yang sudah tercatat — yang bergeser hanyalah pembandingnya
 * pada halaman Plan vs Realisasi.
 *
 * Satu hal yang perlu dijaga: pos biaya operasional dicocokkan dengan
 * `OperationalCost.kategori` lewat NAMANYA. Mengganti nama pos memutus
 * kaitannya dengan biaya yang sudah dicatat, jadi biaya itu ikut dipindahkan.
 */

/** Cari businessPlanId sekaligus periksa izinnya. */
async function planProyek(businessPlanId: string) {
  const plan = await prisma.businessPlan.findUnique({
    where: { id: businessPlanId },
    select: { id: true, projectId: true, project: { select: { kode: true } } },
  });
  if (!plan) throw new GagalIzin("Business plan tidak ditemukan.");
  const pengguna = await izinkan("businessPlan", plan.projectId);
  return { plan, pengguna };
}

function segarkan(kodeProyek: string) {
  revalidatePath(`/landbank/${kodeProyek}`);
  // Mencakup pula tab Plan vs Realisasi yang kini hidup di dalam /landbank.
  revalidatePath("/landbank");
}

// ===========================================================================
// HPP — kategori (induk) & baris rincian
// ===========================================================================

/** Tambah / ubah nama kategori HPP. Nilainya turunan dari baris, tak diinput. */
export async function simpanKategoriHpp(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const nama = teks(form, "nama", true);

    if (id) {
      const lama = await prisma.bpHppItem.findUnique({
        where: { id }, select: { id: true, nama: true, businessPlanId: true },
      });
      if (!lama) throw new GagalIzin("Kategori HPP tidak ditemukan.");
      const { plan, pengguna } = await planProyek(lama.businessPlanId);

      await prisma.bpHppItem.update({ where: { id }, data: { nama } });
      const jml = await catatDiff({
        pengguna, projectId: plan.projectId,
        objek: `Business Plan · Kategori HPP ${lama.nama}`,
        sebelum: lama, sesudah: { nama },
        label: { nama: "Nama kategori" },
      });
      segarkan(plan.project.kode);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const { plan, pengguna } = await planProyek(teks(form, "businessPlanId", true));
    const urutan = await prisma.bpHppItem.count({ where: { businessPlanId: plan.id } });
    await prisma.bpHppItem.create({ data: { businessPlanId: plan.id, nama, urutan } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana HPP",
      aksi: "Tambah kategori HPP",
      ke: nama,
    });
    segarkan(plan.project.kode);
  });
}

export async function hapusKategoriHpp(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.bpHppItem.findUnique({
      where: { id },
      select: { id: true, nama: true, businessPlanId: true, _count: { select: { rows: true } } },
    });
    if (!lama) return;

    const { plan, pengguna } = await planProyek(lama.businessPlanId);
    await prisma.bpHppItem.delete({ where: { id } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana HPP",
      aksi: "Hapus kategori HPP",
      dari: `${lama.nama} — ${lama._count.rows} baris`,
      ke: "dihapus",
    });
    segarkan(plan.project.kode);
  });
}

/** Cari businessPlanId dari sebuah kategori HPP, sekaligus periksa izinnya. */
async function planKategoriHpp(hppItemId: string) {
  const kategori = await prisma.bpHppItem.findUnique({
    where: { id: hppItemId }, select: { id: true, nama: true, businessPlanId: true },
  });
  if (!kategori) throw new GagalIzin("Kategori HPP tidak ditemukan.");
  const { plan, pengguna } = await planProyek(kategori.businessPlanId);
  return { kategori, plan, pengguna };
}

export async function simpanBarisHpp(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const uraian = teks(form, "uraian", true);
    const satuan = teks(form, "satuan", true);
    const volume = angka(form, "volume", { min: 0, wajib: true });
    const harga = angka(form, "harga", { min: 0, wajib: true });

    if (id) {
      const lama = await prisma.bpHppRow.findUnique({
        where: { id },
        select: {
          id: true, uraian: true, satuan: true, volume: true, harga: true,
          hppItem: { select: { nama: true, businessPlanId: true } },
        },
      });
      if (!lama) throw new GagalIzin("Baris HPP tidak ditemukan.");
      const { plan, pengguna } = await planProyek(lama.hppItem.businessPlanId);

      await prisma.bpHppRow.update({ where: { id }, data: { uraian, satuan, volume, harga } });
      const jml = await catatDiff({
        pengguna, projectId: plan.projectId,
        objek: `Business Plan · HPP ${lama.hppItem.nama} · ${lama.uraian}`,
        sebelum: lama, sesudah: { uraian, satuan, volume, harga },
        label: { uraian: "Uraian", satuan: "Satuan", volume: "Volume", harga: "Harga" },
        format: { harga: (v) => rpLog(Number(v)) },
      });
      segarkan(plan.project.kode);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const { kategori, plan, pengguna } = await planKategoriHpp(teks(form, "hppItemId", true));
    const urutan = await prisma.bpHppRow.count({ where: { hppItemId: kategori.id } });
    await prisma.bpHppRow.create({
      data: { hppItemId: kategori.id, uraian, satuan, volume, harga, urutan },
    });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: `Business Plan · HPP ${kategori.nama}`,
      aksi: "Tambah baris HPP",
      ke: `${uraian} — ${volume} ${satuan} × ${rpLog(harga)}`,
    });
    segarkan(plan.project.kode);
  });
}

export async function hapusBarisHpp(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.bpHppRow.findUnique({
      where: { id },
      select: {
        id: true, uraian: true, volume: true, satuan: true, harga: true,
        hppItem: { select: { nama: true, businessPlanId: true } },
      },
    });
    if (!lama) return;

    const { plan, pengguna } = await planProyek(lama.hppItem.businessPlanId);
    await prisma.bpHppRow.delete({ where: { id } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: `Business Plan · HPP ${lama.hppItem.nama}`,
      aksi: "Hapus baris HPP",
      dari: `${lama.uraian} — ${lama.volume} ${lama.satuan} × ${rpLog(lama.harga)}`,
      ke: "dihapus",
    });
    segarkan(plan.project.kode);
  });
}

// ===========================================================================
// OMSET — harga dasar rencana per unit (BpOmzetUnit)
// ===========================================================================

/**
 * Simpan harga dasar rencana sebuah unit.
 *
 * Daftar unit tampil apa adanya dari tabel Unit; yang disunting di sini hanya
 * HARGA DASAR rencana, disimpan terpisah di BpOmzetUnit agar tak menyentuh
 * `Unit.hargaJual`. Upsert lewat unitId yang unik.
 */
export async function simpanHargaDasarUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const { plan, pengguna } = await planProyek(teks(form, "businessPlanId", true));
    const unitId = teks(form, "unitId", true);
    const hargaDasar = angka(form, "hargaDasar", { min: 0, wajib: true });

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, kode: true, projectId: true, hargaJual: true, bpOmzet: { select: { hargaDasar: true } } },
    });
    if (!unit || unit.projectId !== plan.projectId) {
      throw new GagalIzin("Unit tidak ditemukan pada proyek ini.");
    }

    const sebelum = unit.bpOmzet?.hargaDasar ?? unit.hargaJual;
    if (sebelum === hargaDasar) {
      segarkan(plan.project.kode);
      return "Tidak ada yang berubah.";
    }

    await prisma.bpOmzetUnit.upsert({
      where: { unitId },
      create: { businessPlanId: plan.id, unitId, hargaDasar },
      update: { hargaDasar },
    });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: `Business Plan · Omset unit ${unit.kode}`,
      aksi: "Ubah harga dasar rencana",
      dari: rpLog(sebelum), ke: rpLog(hargaDasar),
    });
    segarkan(plan.project.kode);
  });
}

/**
 * Kembalikan harga dasar rencana unit ke default (hargaJual) — hapus override.
 * Dipakai lewat TombolHapus yang mengirim `id` = unitId.
 */
export async function resetHargaDasarUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const unitId = String(form.get("id") ?? "");
    const ada = await prisma.bpOmzetUnit.findUnique({
      where: { unitId },
      select: { id: true, hargaDasar: true, unit: { select: { kode: true } }, businessPlan: { select: { projectId: true, project: { select: { kode: true } } } } },
    });
    if (!ada) return;

    const pengguna = await izinkan("businessPlan", ada.businessPlan.projectId);
    await prisma.bpOmzetUnit.delete({ where: { unitId } });

    await catat({
      pengguna, projectId: ada.businessPlan.projectId,
      objek: `Business Plan · Omset unit ${ada.unit.kode}`,
      aksi: "Reset harga dasar rencana",
      dari: rpLog(ada.hargaDasar), ke: "kembali ke harga jual unit",
    });
    segarkan(ada.businessPlan.project.kode);
  });
}

// ===========================================================================
// OPERASIONAL — kategori (induk) & baris rincian
// ===========================================================================

/**
 * Tambah / ubah nama kategori operasional (induk).
 *
 * Biaya operasional yang sudah dicatat dicocokkan lewat `OperationalCost.kategori`
 * = nama induk ini. Mengganti namanya memindahkan biaya yang sudah ada supaya
 * realisasinya tidak putus.
 */
export async function simpanKategoriOperasional(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const nama = teks(form, "nama", true);

    if (id) {
      const lama = await prisma.bpOperasionalItem.findUnique({
        where: { id }, select: { id: true, nama: true, businessPlanId: true },
      });
      if (!lama) throw new GagalIzin("Kategori operasional tidak ditemukan.");
      const { plan, pengguna } = await planProyek(lama.businessPlanId);

      await prisma.bpOperasionalItem.update({ where: { id }, data: { nama } });

      let dipindah = 0;
      if (nama !== lama.nama) {
        const hasil = await prisma.operationalCost.updateMany({
          where: { projectId: plan.projectId, kategori: lama.nama },
          data: { kategori: nama },
        });
        dipindah = hasil.count;
      }

      const jml = await catatDiff({
        pengguna, projectId: plan.projectId,
        objek: `Business Plan · Operasional ${lama.nama}`,
        sebelum: lama, sesudah: { nama },
        label: { nama: "Nama kategori" },
      });

      segarkan(plan.project.kode);
      if (jml === 0) return "Tidak ada yang berubah.";
      return dipindah > 0
        ? `${jml} perubahan tersimpan · ${dipindah} biaya operasional ikut dipindahkan ke nama kategori yang baru.`
        : `${jml} perubahan tersimpan.`;
    }

    const { plan, pengguna } = await planProyek(teks(form, "businessPlanId", true));
    const urutan = await prisma.bpOperasionalItem.count({ where: { businessPlanId: plan.id } });
    await prisma.bpOperasionalItem.create({ data: { businessPlanId: plan.id, nama, urutan } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana Biaya Operasional",
      aksi: "Tambah kategori operasional",
      ke: nama,
    });
    segarkan(plan.project.kode);
  });
}

/**
 * Hapus kategori operasional.
 *
 * Kategori yang sudah punya biaya tercatat tidak boleh dihapus — biayanya akan
 * menggantung tanpa pembanding rencana dan hilang dari laporan.
 */
export async function hapusKategoriOperasional(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.bpOperasionalItem.findUnique({
      where: { id },
      select: { id: true, nama: true, businessPlanId: true },
    });
    if (!lama) return;

    const { plan, pengguna } = await planProyek(lama.businessPlanId);

    const terpakai = await prisma.operationalCost.count({
      where: { projectId: plan.projectId, kategori: lama.nama },
    });
    if (terpakai > 0) {
      throw new GagalIzin(
        `Kategori "${lama.nama}" sudah punya ${terpakai} biaya tercatat. Hapus atau pindahkan biaya itu lebih dulu.`,
      );
    }

    await prisma.bpOperasionalItem.delete({ where: { id } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana Biaya Operasional",
      aksi: "Hapus kategori operasional",
      dari: lama.nama,
      ke: "dihapus",
    });
    segarkan(plan.project.kode);
  });
}

/** Cari businessPlanId dari sebuah kategori operasional, periksa izinnya. */
async function planKategoriOps(operasionalItemId: string) {
  const kategori = await prisma.bpOperasionalItem.findUnique({
    where: { id: operasionalItemId }, select: { id: true, nama: true, businessPlanId: true },
  });
  if (!kategori) throw new GagalIzin("Kategori operasional tidak ditemukan.");
  const { plan, pengguna } = await planProyek(kategori.businessPlanId);
  return { kategori, plan, pengguna };
}

export async function simpanBarisOperasional(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const nama = teks(form, "nama", true);
    const nilai = angka(form, "nilai", { min: 0, wajib: true });

    if (id) {
      const lama = await prisma.bpOperasionalRow.findUnique({
        where: { id },
        select: {
          id: true, nama: true, nilai: true,
          operasionalItem: { select: { nama: true, businessPlanId: true } },
        },
      });
      if (!lama) throw new GagalIzin("Baris operasional tidak ditemukan.");
      const { plan, pengguna } = await planProyek(lama.operasionalItem.businessPlanId);

      await prisma.bpOperasionalRow.update({ where: { id }, data: { nama, nilai } });
      const jml = await catatDiff({
        pengguna, projectId: plan.projectId,
        objek: `Business Plan · Operasional ${lama.operasionalItem.nama} · ${lama.nama}`,
        sebelum: lama, sesudah: { nama, nilai },
        label: { nama: "Uraian", nilai: "Anggaran" },
        format: { nilai: (v) => rpLog(Number(v)) },
      });
      segarkan(plan.project.kode);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const { kategori, plan, pengguna } = await planKategoriOps(teks(form, "operasionalItemId", true));
    const urutan = await prisma.bpOperasionalRow.count({ where: { operasionalItemId: kategori.id } });
    await prisma.bpOperasionalRow.create({
      data: { operasionalItemId: kategori.id, nama, nilai, urutan },
    });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: `Business Plan · Operasional ${kategori.nama}`,
      aksi: "Tambah baris operasional",
      ke: `${nama} — ${rpLog(nilai)}`,
    });
    segarkan(plan.project.kode);
  });
}

export async function hapusBarisOperasional(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.bpOperasionalRow.findUnique({
      where: { id },
      select: {
        id: true, nama: true, nilai: true,
        operasionalItem: { select: { nama: true, businessPlanId: true } },
      },
    });
    if (!lama) return;

    const { plan, pengguna } = await planProyek(lama.operasionalItem.businessPlanId);
    await prisma.bpOperasionalRow.delete({ where: { id } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: `Business Plan · Operasional ${lama.operasionalItem.nama}`,
      aksi: "Hapus baris operasional",
      dari: `${lama.nama} — ${rpLog(lama.nilai)}`,
      ke: "dihapus",
    });
    segarkan(plan.project.kode);
  });
}

// ===========================================================================
// CASHFLOW
// ===========================================================================

export async function simpanCashflow(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const periode = teks(form, "periode", true);
    const masuk = angka(form, "masuk", { min: 0 });
    const keluar = angka(form, "keluar", { min: 0 });

    if (id) {
      const lama = await prisma.bpCashflowItem.findUnique({
        where: { id },
        select: { id: true, periode: true, masuk: true, keluar: true, businessPlanId: true },
      });
      if (!lama) throw new GagalIzin("Baris cashflow tidak ditemukan.");
      const { plan, pengguna } = await planProyek(lama.businessPlanId);

      await prisma.bpCashflowItem.update({ where: { id }, data: { periode, masuk, keluar } });
      const jml = await catatDiff({
        pengguna, projectId: plan.projectId,
        objek: `Business Plan · Cashflow ${lama.periode}`,
        sebelum: lama, sesudah: { periode, masuk, keluar },
        label: { periode: "Periode", masuk: "Kas masuk", keluar: "Kas keluar" },
        format: { masuk: (v) => rpLog(Number(v)), keluar: (v) => rpLog(Number(v)) },
      });
      segarkan(plan.project.kode);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const { plan, pengguna } = await planProyek(teks(form, "businessPlanId", true));
    const urutan = await prisma.bpCashflowItem.count({ where: { businessPlanId: plan.id } });
    await prisma.bpCashflowItem.create({
      data: { businessPlanId: plan.id, periode, masuk, keluar, urutan },
    });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana Cashflow",
      aksi: "Tambah periode cashflow",
      ke: `${periode} — masuk ${rpLog(masuk)} · keluar ${rpLog(keluar)}`,
    });
    segarkan(plan.project.kode);
  });
}

export async function hapusCashflow(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.bpCashflowItem.findUnique({
      where: { id },
      select: { id: true, periode: true, businessPlanId: true },
    });
    if (!lama) return;

    const { plan, pengguna } = await planProyek(lama.businessPlanId);
    await prisma.bpCashflowItem.delete({ where: { id } });

    await catat({
      pengguna, projectId: plan.projectId,
      objek: "Business Plan · Rencana Cashflow",
      aksi: "Hapus periode cashflow",
      dari: lama.periode,
      ke: "dihapus",
    });
    segarkan(plan.project.kode);
  });
}

// ===========================================================================
// PEMBANDING PASAR
// ===========================================================================

/**
 * Simpan satu tipe pembanding pasar.
 *
 * Proyek pembandingnya dibuat otomatis bila belum ada, dicocokkan lewat nama —
 * memisahkan "tambah proyek pembanding" dan "tambah tipe" menjadi dua langkah
 * membuat orang harus mengisi form dua kali untuk satu data.
 */
export async function simpanPembanding(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();

    const nama = teks(form, "nama", true);
    const jarak = angka(form, "jarak", { min: 0 });
    const tipe = teks(form, "tipe", true);
    const jumlah = angka(form, "jumlah", { min: 0, wajib: true });
    const luasUnit = angka(form, "luasUnit", { min: 0, wajib: true });
    const luasLahan = angka(form, "luasLahan", { min: 0, wajib: true });
    const harga = angka(form, "harga", { min: 0, wajib: true });

    if (id) {
      const lama = await prisma.marketComparableType.findUnique({
        where: { id },
        select: {
          id: true, tipe: true, jumlah: true, luasUnit: true, luasLahan: true, harga: true,
          marketComparable: {
            select: { id: true, nama: true, jarak: true, projectId: true, project: { select: { kode: true } } },
          },
        },
      });
      if (!lama) throw new GagalIzin("Data pembanding tidak ditemukan.");

      const pengguna = await izinkan("businessPlan", lama.marketComparable.projectId);

      await prisma.$transaction([
        prisma.marketComparable.update({
          where: { id: lama.marketComparable.id },
          data: { nama, jarak },
        }),
        prisma.marketComparableType.update({
          where: { id },
          data: { tipe, jumlah, luasUnit, luasLahan, harga },
        }),
      ]);

      const jml = await catatDiff({
        pengguna, projectId: lama.marketComparable.projectId,
        objek: `Pembanding pasar · ${lama.marketComparable.nama} ${lama.tipe}`,
        sebelum: {
          nama: lama.marketComparable.nama, jarak: lama.marketComparable.jarak,
          tipe: lama.tipe, jumlah: lama.jumlah, luasUnit: lama.luasUnit,
          luasLahan: lama.luasLahan, harga: lama.harga,
        },
        sesudah: { nama, jarak, tipe, jumlah, luasUnit, luasLahan, harga },
        label: {
          nama: "Nama proyek", jarak: "Jarak", tipe: "Tipe",
          jumlah: "Jumlah unit", luasUnit: "Luas bangunan",
          luasLahan: "Luas lahan", harga: "Harga",
        },
        format: { harga: (v) => rpLog(Number(v)) },
      });

      segarkan(lama.marketComparable.project.kode);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const kodeProyek = teks(form, "kodeProyek", true).toUpperCase();
    const proyek = await prisma.project.findUnique({
      where: { kode: kodeProyek },
      select: { id: true, kode: true },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("businessPlan", proyek.id);

    const adaProyekPembanding = await prisma.marketComparable.findFirst({
      where: { projectId: proyek.id, nama },
      select: { id: true },
    });

    const mcId =
      adaProyekPembanding?.id ??
      (
        await prisma.marketComparable.create({
          data: { projectId: proyek.id, nama, jarak },
          select: { id: true },
        })
      ).id;

    await prisma.marketComparableType.create({
      data: { marketComparableId: mcId, tipe, jumlah, luasUnit, luasLahan, harga },
    });

    await catat({
      pengguna, projectId: proyek.id,
      objek: "Feasibility · pembanding pasar",
      aksi: "Tambah pembanding pasar",
      ke: `${nama} · ${tipe} — ${jumlah} unit @ ${rpLog(harga)}`,
    });

    segarkan(proyek.kode);
  });
}

/**
 * Hapus satu tipe pembanding. Bila itu tipe terakhir, proyek pembandingnya
 * ikut dihapus supaya tidak menyisakan baris kosong tanpa isi.
 */
export async function hapusPembanding(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");

    const lama = await prisma.marketComparableType.findUnique({
      where: { id },
      select: {
        id: true, tipe: true,
        marketComparable: {
          select: {
            id: true, nama: true, projectId: true,
            project: { select: { kode: true } },
            _count: { select: { tipe: true } },
          },
        },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("businessPlan", lama.marketComparable.projectId);

    if (lama.marketComparable._count.tipe <= 1) {
      await prisma.marketComparable.delete({ where: { id: lama.marketComparable.id } });
    } else {
      await prisma.marketComparableType.delete({ where: { id } });
    }

    await catat({
      pengguna, projectId: lama.marketComparable.projectId,
      objek: "Feasibility · pembanding pasar",
      aksi: "Hapus pembanding pasar",
      dari: `${lama.marketComparable.nama} · ${lama.tipe}`,
      ke: "dihapus",
    });

    segarkan(lama.marketComparable.project.kode);
  });
}
