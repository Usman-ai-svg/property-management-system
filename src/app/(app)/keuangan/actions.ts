"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, pilihanOpsional, teks, teksOpsional,
} from "@/lib/actions/guard";
import { periksaAlokasi } from "@/lib/calc/keuangan";
import { JENIS_BIAYA_SWAKELOLA, METODE_BAYAR, PERUNTUKAN_BIAYA, POS_HPP, SASARAN_PERUNTUKAN, STATUS_PEMBELIAN } from "@/lib/domain/enums";

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
 * Penegakan sisi-server dari aturan "Dibebankan ke" pada Catat/Ubah Pengeluaran:
 * sasaran alokasi harus cocok dengan peruntukan yang dipilih (peta
 * SASARAN_PERUNTUKAN). Penyaringan di form hanya kenyamanan; inilah pengamannya.
 *
 * Baris level proyek (unit & sarpras sama-sama null) selalu boleh — itu bukan
 * pembebanan ke objek. Peruntukan non-standar (mis. data lama) dilewati.
 */
function periksaSasaranPeruntukan(
  peruntukan: string,
  alokasi: { unitId: string | null; infrastructureId: string | null }[],
): void {
  const sasaran = SASARAN_PERUNTUKAN[peruntukan as keyof typeof SASARAN_PERUNTUKAN];
  if (!sasaran) return;
  for (const a of alokasi) {
    if (a.unitId && !sasaran.unit) {
      throw new GagalIzin(`Peruntukan "${peruntukan}" tidak bisa dibebankan ke unit.`);
    }
    if (a.infrastructureId && !sasaran.sarpras) {
      throw new GagalIzin(`Peruntukan "${peruntukan}" tidak bisa dibebankan ke sarana & prasarana.`);
    }
  }
}

/**
 * Pengaman sisi-server: baris pengeluaran yang tertaut ke kontrak atau PO tidak
 * boleh diubah/dihapus lewat jalur generik Keuangan. Keduanya punya invariant
 * sendiri (sisa kontrak, sisa PO) yang hanya dijaga di modulnya — kontrak lewat
 * Vendor, PO lewat kartu Pembelian Material. UI sudah menyembunyikan tombolnya;
 * ini pagar terakhir bila permintaan datang langsung.
 */
function tolakBilaTertaut(e: { contractId: string | null; pembelianId: string | null }): void {
  if (e.contractId) {
    throw new GagalIzin("Ini pembayaran kontrak — ubah atau hapus lewat modul Vendor.");
  }
  if (e.pembelianId) {
    throw new GagalIzin("Ini pembayaran PO — ubah atau hapus lewat kartu Pembelian Material.");
  }
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
    // Opsional: peruntukan level-proyek (Perijinan/Pengolahan) tak mengirim
    // alokasi sama sekali → biaya level proyek.
    const alokasi = await bacaAlokasiOpsional(form, projectId, total);
    periksaSasaranPeruntukan(peruntukan, alokasi);
    const uraian = teks(form, "uraian", true);

    await prisma.expense.create({
      data: {
        projectId,
        tanggal: new Date(),
        peruntukan,
        jenis: pilihan(form, "jenis", JENIS_BIAYA_SWAKELOLA),
        metode: pilihan(form, "metode", METODE_BAYAR),
        uraian,
        total,
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
        id: true, projectId: true, contractId: true, pembelianId: true,
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
    tolakBilaTertaut(lama);

    const pengguna = await izinkan("keuangan", lama.projectId);

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const totalBaru = angka(form, "total", { min: 1, wajib: true });
    const alokasiBaru = await bacaAlokasiOpsional(form, lama.projectId, totalBaru);
    periksaSasaranPeruntukan(peruntukan, alokasiBaru);

    const baru = {
      peruntukan,
      jenis: pilihan(form, "jenis", JENIS_BIAYA_SWAKELOLA),
      metode: pilihan(form, "metode", METODE_BAYAR),
      uraian: teks(form, "uraian", true),
      total: totalBaru,
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
        uraian: lama.uraian, total: lama.total,
        bukti: lama.bukti, dibebankanKe: labelAlokasiTersimpan(lama.alokasi),
      },
      sesudah: {
        peruntukan: baru.peruntukan, jenis: baru.jenis, metode: baru.metode,
        uraian: baru.uraian, total: baru.total,
        bukti: baru.bukti, dibebankanKe: namaAlokasiBaru,
      },
      label: {
        uraian: "Keterangan", total: "Total",
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
        contractId: true, pembelianId: true,
        project: { select: { kode: true } },
      },
    });
    if (!lama) return;
    tolakBilaTertaut(lama);

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

// ===========================================================================
// PEMBELIAN MATERIAL (PO) + PEMBAYARAN TERMIN
// ===========================================================================
//
// Satu-satunya tempat belanja material dicatat. Dulu tersebar di modul Estimasi
// (halaman Pemasok); kini dipusatkan di Keuangan Proyek supaya uang keluar hanya
// punya satu pintu masuk. Alurnya mengikuti logika PO:
//
//   1. PO dibuat (status Draft) — komitmen belanja, satu nota bisa banyak
//      material (PembelianItem).
//   2. Barang diterima (status Diterima) — penanda barang fisik sudah datang.
//   3. Pembayaran bertermin: tiap termin = satu Expense (peruntukan Material).
//      Pembebanan ke unit/sarpras diisi saat membayar, sama seperti Catat
//      Pengeluaran; bila dikosongkan, biaya tercatat di level proyek.
//
// "Bayar" LEPAS dari "terima": pembayaran boleh dicatat kapan saja — DP/uang
// muka atau pelunasan di depan sebelum barang datang, maupun termin biasa
// setelah diterima. Yang dijaga hanya total: Σ pembayaran tak boleh melebihi
// nilai nota. `Diterima` tinggal penanda fisik, bukan syarat membayar.
//
// Sisa bayar = total nota − Σ Expense terbayar. Seluruhnya di bawah izin
// "keuangan", diperiksa dengan projectId supaya batas akses per-proyek ikut.

const [PO_DRAFT, PO_DITERIMA] = STATUS_PEMBELIAN;

function segarkanPembelian(kodeProyek: string, pemasokId: string) {
  revalidatePath("/keuangan");
  revalidatePath(`/keuangan/${kodeProyek}`);
  // Halaman Pemasok (Estimasi) menampilkan riwayat pembelian secara read-only.
  revalidatePath(`/estimasi/pemasok/${pemasokId}`);
  revalidatePath("/estimasi/pemasok");
  revalidatePath("/");
}

interface ItemPembelianIsian {
  uraian: string;
  satuan: string;
  qty: number;
  harga: number;
  hargaDasarId: string | null;
}

/** Baca & validasi baris barang PO dari kolom JSON tersembunyi. */
async function bacaItemPembelian(form: FormData): Promise<ItemPembelianIsian[]> {
  let baris: { uraian?: string; satuan?: string; qty?: number | string; harga?: number | string; hargaDasarId?: string }[];
  try {
    baris = JSON.parse(teks(form, "items", true));
  } catch {
    throw new GagalIzin("Data barang pembelian tidak terbaca.");
  }

  const sah = baris
    .filter((b) => b.uraian?.trim())
    .map((b) => ({
      uraian: String(b.uraian).trim(),
      satuan: String(b.satuan ?? "").trim() || "unit",
      qty: Number(b.qty),
      harga: Number(b.harga),
      hargaDasarId: b.hargaDasarId?.trim() ? String(b.hargaDasarId) : null,
    }));

  if (sah.length === 0) throw new GagalIzin("Pembelian harus punya minimal satu barang.");
  for (const b of sah) {
    if (!Number.isFinite(b.qty) || b.qty <= 0) throw new GagalIzin(`Qty "${b.uraian}" harus lebih dari nol.`);
    if (!Number.isFinite(b.harga) || b.harga < 0) throw new GagalIzin(`Harga "${b.uraian}" tidak sah.`);
  }

  const idHd = [...new Set(sah.map((b) => b.hargaDasarId).filter((x): x is string => x != null))];
  if (idHd.length > 0) {
    const ada = await prisma.hargaDasar.count({ where: { id: { in: idHd } } });
    if (ada !== idHd.length) throw new GagalIzin("Ada barang yang menaut harga dasar tak dikenal.");
  }
  return sah;
}

/**
 * Baca pembebanan OPSIONAL sebuah pembayaran material.
 *
 * Beda dari `bacaAlokasi` (yang mewajibkan pembebanan seimbang): belanja
 * material boleh tetap di level proyek. Bila pengguna tidak mengisi satu pun
 * baris, kembalikan array kosong → Expense tanpa alokasi. Bila mengisi, aturan
 * seimbangnya sama persis (jumlah = total, satu tujuan tak ganda).
 */
async function bacaAlokasiOpsional(
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
  })).filter((b) => b.unitId || b.infrastructureId || b.nominal > 0);

  // Tak ada baris → biaya level proyek (perilaku lama). Sah.
  if (baris.length === 0) return [];

  return bacaAlokasi(form, projectId, total);
}

/** Buat PO baru (Draft). Satu nota, banyak material. */
export async function buatPembelian(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pemasokId = teks(form, "pemasokId", true);
    const pengguna = await izinkan("keuangan", projectId);

    const [pmk, proyek] = await Promise.all([
      prisma.pemasok.findUnique({ where: { id: pemasokId }, select: { id: true, nama: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true, kode: true } }),
    ]);
    if (!pmk) throw new GagalIzin("Pemasok tidak ditemukan.");
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const nomor = teks(form, "nomor", true);
    const isiTanggal = teksOpsional(form, "tanggal");
    const tanggal = isiTanggal ? new Date(isiTanggal) : new Date();
    const keterangan = teksOpsional(form, "keterangan");
    const items = await bacaItemPembelian(form);
    const total = items.reduce((s, b) => s + b.qty * b.harga, 0);

    await prisma.pembelian.create({
      data: {
        pemasokId, projectId, nomor, status: PO_DRAFT, tanggal, keterangan,
        items: { create: items.map((b, i) => ({ ...b, urutan: i })) },
      },
    });
    await catat({
      pengguna, projectId, objek: `Pembelian ${pmk.nama} · ${nomor}`,
      aksi: "Buat PO material", ke: `${proyek.kode} — ${items.length} barang, ${rpLog(total)}`,
    });
    segarkanPembelian(proyek.kode, pemasokId);
    return `PO ${nomor} dibuat (Draft). Tandai "Terima" saat barang datang agar bisa dibayar.`;
  });
}

/**
 * Tandai barang PO diterima (Draft → Diterima).
 *
 * Penerimaan wajib disertai KAPAN barang datang (tanggal + jam) dan SIAPA yang
 * menerimanya — bukti serah-terima fisik yang lepas dari tanggal PO diterbitkan.
 * Bukan syarat membayar (DP boleh sebelum ini); murni penanda barang fisik ada.
 */
export async function terimaPembelian(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const beli = await prisma.pembelian.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, status: true, pemasokId: true, projectId: true,
        pemasok: { select: { nama: true } }, project: { select: { kode: true } },
      },
    });
    if (!beli) throw new GagalIzin("Pembelian tidak ditemukan.");
    const pengguna = await izinkan("keuangan", beli.projectId);
    if (beli.status === PO_DITERIMA) return `PO ${beli.nomor} sudah berstatus Diterima.`;

    const penerima = teks(form, "penerima", true);
    const isiWaktu = teksOpsional(form, "tanggalTerima");
    const tanggalTerima = isiWaktu ? new Date(isiWaktu) : new Date();
    if (Number.isNaN(tanggalTerima.getTime())) throw new GagalIzin("Tanggal penerimaan tidak sah.");

    await prisma.pembelian.update({
      where: { id },
      data: { status: PO_DITERIMA, tanggalTerima, penerima },
    });
    await catat({
      pengguna, projectId: beli.projectId, objek: `Pembelian ${beli.pemasok.nama} · ${beli.nomor}`,
      aksi: "Terima barang PO", dari: PO_DRAFT,
      ke: `${PO_DITERIMA} — ${tanggalTerima.toLocaleString("id-ID")} oleh ${penerima}`,
    });
    segarkanPembelian(beli.project.kode, beli.pemasokId);
    return `PO ${beli.nomor} ditandai diterima oleh ${penerima}.`;
  });
}

export async function hapusPembelian(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.pembelian.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, pemasokId: true, projectId: true,
        pemasok: { select: { nama: true } }, project: { select: { kode: true } },
        _count: { select: { pembayaran: true } },
      },
    });
    if (!lama) return;
    const pengguna = await izinkan("keuangan", lama.projectId);

    if (lama._count.pembayaran > 0) {
      throw new GagalIzin(
        `Pembelian ${lama.nomor} masih punya ${lama._count.pembayaran} pembayaran tercatat. Hapus pembayarannya lebih dulu.`,
      );
    }
    // Item ikut terhapus (onDelete: Cascade).
    await prisma.pembelian.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId, objek: `Pembelian ${lama.pemasok.nama} · ${lama.nomor}`,
      aksi: "Hapus PO material", dari: lama.nomor,
    });
    segarkanPembelian(lama.project.kode, lama.pemasokId);
  });
}

/**
 * Catat satu termin pembayaran atas sebuah PO → satu Expense. Boleh sebelum
 * maupun sesudah barang diterima — DP/uang muka, pelunasan di depan, atau termin
 * biasa. Yang dijaga: total tak boleh melebihi sisa.
 *
 * Peruntukan DIPILIH eksplisit di form (bukan lagi diturunkan dari sasaran),
 * konsisten dengan Catat Pengeluaran — keempat peruntukan tersedia. Peruntukan
 * berobjek (Unit/Prasarana) dibebankan ke unit atau sarpras sesuai sasarannya
 * (`periksaSasaranPeruntukan`); peruntukan level proyek (Perijinan/Pengolahan)
 * tanpa pembebanan objek. Pos HPP diturunkan dari peruntukan; jenis biaya tetap
 * "Material".
 */
export async function bayarPembelian(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pembelianId = teks(form, "pembelianId", true);
    const beli = await prisma.pembelian.findUnique({
      where: { id: pembelianId },
      select: {
        id: true, nomor: true, status: true, projectId: true, pemasokId: true,
        pemasok: { select: { nama: true } }, project: { select: { kode: true } },
        items: { select: { qty: true, harga: true } },
        pembayaran: { select: { total: true } },
      },
    });
    if (!beli) throw new GagalIzin("Pembelian tidak ditemukan.");
    const pengguna = await izinkan("keuangan", beli.projectId);
    // Sengaja TANPA gerbang status: DP/uang muka boleh sebelum barang datang.
    const diterima = beli.status === PO_DITERIMA;

    const total = beli.items.reduce((s, b) => s + b.qty * b.harga, 0);
    const terbayar = beli.pembayaran.reduce((s, e) => s + e.total, 0);
    const sisa = total - terbayar;
    if (sisa <= 0) throw new GagalIzin(`Pembelian ${beli.nomor} sudah lunas.`);

    const bayar = angka(form, "total", { min: 1, wajib: true });
    if (bayar > sisa) throw new GagalIzin(`Pembayaran ${rpLog(bayar)} melebihi sisa ${rpLog(sisa)}.`);

    // Peruntukan dipilih di form (bukan diturunkan) — sama seperti Catat
    // Pengeluaran. Peruntukan berobjek (Unit/Prasarana) dibebankan ke unit atau
    // sarpras; peruntukan level proyek (Perijinan/Pengolahan) tanpa alokasi.
    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const alokasi = await bacaAlokasiOpsional(form, beli.projectId, bayar);
    periksaSasaranPeruntukan(peruntukan, alokasi);

    const isiTanggal = teksOpsional(form, "tanggal");
    const tanggal = isiTanggal ? new Date(isiTanggal) : new Date();
    const metode = pilihan(form, "metode", METODE_BAYAR);
    const bukti = teksOpsional(form, "bukti") || null;
    // Uang muka bila barang belum diterima — terbaca jelas di daftar Transaksi.
    const uraianBawaan = diterima
      ? `Pembayaran PO ${beli.nomor} — ${beli.pemasok.nama}`
      : `Uang muka PO ${beli.nomor} — ${beli.pemasok.nama}`;
    const uraian = teksOpsional(form, "uraian") ?? uraianBawaan;

    await prisma.expense.create({
      data: {
        projectId: beli.projectId, pembelianId, tanggal,
        peruntukan, jenis: "Material", metode, uraian,
        total: bayar, bukti, pic: pengguna.nama,
        posHpp: POS_HPP[peruntukan],
        alokasi: { create: alokasi },
      },
    });
    await catat({
      pengguna, projectId: beli.projectId, objek: `Pembelian ${beli.pemasok.nama} · ${beli.nomor}`,
      aksi: diterima ? "Bayar termin PO" : "Bayar uang muka PO",
      ke:
        `${rpLog(bayar)} (sisa ${rpLog(sisa - bayar)})` +
        (alokasi.length > 0 ? ` dibebankan ke ${alokasi.length} tujuan` : ""),
    });
    segarkanPembelian(beli.project.kode, beli.pemasokId);
    return sisa - bayar <= 0 ? "Pembayaran tercatat — PO lunas." : `Pembayaran tercatat. Sisa ${rpLog(sisa - bayar)}.`;
  });
}

export async function hapusPembayaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true, total: true, projectId: true, pembelianId: true,
        pembelian: {
          select: { nomor: true, pemasokId: true, pemasok: { select: { nama: true } }, project: { select: { kode: true } } },
        },
      },
    });
    if (!lama) return;
    if (!lama.pembelianId || !lama.pembelian) throw new GagalIzin("Pengeluaran ini bukan pembayaran pembelian.");
    const pengguna = await izinkan("keuangan", lama.projectId);

    await prisma.expense.delete({ where: { id } });
    await catat({
      pengguna, projectId: lama.projectId,
      objek: `Pembelian ${lama.pembelian.pemasok.nama} · ${lama.pembelian.nomor}`,
      aksi: "Hapus pembayaran termin", dari: rpLog(lama.total),
    });
    segarkanPembelian(lama.pembelian.project.kode, lama.pembelian.pemasokId);
  });
}
