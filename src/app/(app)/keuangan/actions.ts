"use server";

import { segmen } from "@/lib/adaptor/rute";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, pilihanOpsional, teks, teksOpsional,
  wajibLolos,
} from "@/lib/actions/guard";
import { bagiRata, periksaAlokasi, terbayarCicilan } from "@/lib/calc/keuangan";
import { simpanBuktiOpsional } from "@/lib/actions/bukti";
import { hapusBerkas } from "@/lib/storage";
import {
  JENIS_BIAYA_SWAKELOLA, METODE_TUNAI, PERUNTUKAN_BIAYA, POS_HPP, STATUS_PEMBELIAN,
  type PeruntukanBiaya,
} from "@/lib/domain/enums";
import { totalPembelian, terbayarPembelian } from "@/lib/calc/pembelian";
import { barisSejajar } from "@/lib/adaptor/formulir";
import {
  periksaBayarHutang, periksaBayarPembelian, periksaBuatPembelian,
  periksaCatatPengeluaran, periksaHapusPembelian, periksaHapusPengeluaran,
  periksaBagikanBiayaUnitRata, periksaHapusCicilanHutang, periksaHapusPembayaranPembelian,
  periksaTerimaPembelian, periksaUbahPengeluaran,
  type MasukanBuatPembelian,
  type BarisPembebanan,
  periksaPembebanan, type MasukanCatatPengeluaran, type MasukanUbahPengeluaran,
} from "@/lib/kontrak/keuangan";

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
function bacaBarisPembebanan(form: FormData): BarisPembebanan[] {
  const unitIds = form.getAll("alokasiUnitId").map((v) => String(v).trim());
  const sarprasIds = form.getAll("alokasiSarprasId").map((v) => String(v).trim());
  const nominals = form.getAll("alokasiNominal").map((v) => Number(String(v).trim()));

  return barisSejajar(
    [unitIds.length, sarprasIds.length, nominals.length],
    (i) => ({
      unitId: unitIds[i] || null,
      infrastructureId: sarprasIds[i] || null,
      nominal: nominals[i] ?? 0,
    }),
  ).filter((b) => b.unitId || b.infrastructureId || b.nominal > 0);
}

/**
 * Pemeriksaan yang TIDAK bisa dilakukan `periksaPembebanan` karena butuh
 * database: apakah tiap unit dan sarpras yang dibebani memang milik proyek ini.
 *
 * Tanpa ini, permintaan yang dikirim langsung (bukan lewat form) bisa
 * membebankan biaya proyek A ke unit proyek B. Di ERP, pemeriksaan inilah yang
 * jadi baris SELECT di dalam RPC sebelum menulis.
 */
async function pastikanObjekMilikProyek(
  baris: BarisPembebanan[],
  projectId: string,
): Promise<void> {
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
}

/** Tanggal untuk jejak audit (YYYY-MM-DD), atau "—" bila kosong. */
const tglLog = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "—");

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

    // Masukan dirakit dulu jadi objek biasa, lalu diperiksa sekali oleh
    // kontraknya. Bentuk objek inilah yang nanti diterima RPC sebagai JSONB,
    // dan `periksaCatatPengeluaran` ikut pindah apa adanya.
    //
    // Pembebanan boleh kosong: peruntukan level-proyek (Perijinan/Pengolahan)
    // memang tidak mengirim alokasi sama sekali.
    const masukan: MasukanCatatPengeluaran = {
      projectId,
      peruntukan: teks(form, "peruntukan", true),
      jenis: teks(form, "jenis", true),
      metode: teks(form, "metode", true),
      uraian: teks(form, "uraian", true),
      total: angka(form, "total", { wajib: true }),
      pembebanan: bacaBarisPembebanan(form),
      kreditur: teksOpsional(form, "kreditur"),
      tenggat: teksOpsional(form, "tenggat"),
    };
    wajibLolos(periksaCatatPengeluaran(masukan));
    await pastikanObjekMilikProyek(masukan.pembebanan, projectId);

    const { peruntukan, jenis, metode, uraian, total } = masukan;
    const alokasi = masukan.pembebanan;
    const kreditur = metode === "Hutang" ? masukan.kreditur : null;
    const tenggat = metode === "Hutang" ? new Date(masukan.tenggat as string) : null;
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    await prisma.expense.create({
      data: {
        projectId,
        tanggal: new Date(),
        peruntukan,
        jenis,
        metode,
        kreditur,
        tenggat,
        uraian,
        total,
        pic: pengguna.nama,
        picId: pengguna.id,
        bukti,
        buktiKey,
        posHpp: POS_HPP[peruntukan as PeruntukanBiaya],
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
    revalidatePath(`/keuangan/${segmen(proyek.kode)}`);
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
        total: true, status: true, bukti: true, buktiKey: true,
        kreditur: true, tenggat: true,
        cicilan: { select: { nominal: true } },
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

    // Pengeluaran-hutang tak bisa berganti kelas, dan totalnya tak boleh turun
    // di bawah yang sudah dicicil — keduanya butuh baris lamanya, jadi dikirim
    // sebagai konteks. Daftar field konteks inilah yang harus dibaca RPC
    // sebelum memvalidasi.
    const isHutang = lama.metode === "Hutang";
    const masukan: MasukanUbahPengeluaran = {
      id,
      peruntukan: teks(form, "peruntukan", true),
      jenis: teks(form, "jenis", true),
      metode: isHutang ? "Hutang" : teks(form, "metode", true),
      uraian: teks(form, "uraian", true),
      total: angka(form, "total", { wajib: true }),
      pembebanan: bacaBarisPembebanan(form),
      kreditur: teksOpsional(form, "kreditur"),
      tenggat: teksOpsional(form, "tenggat"),
    };
    wajibLolos(
      periksaUbahPengeluaran(masukan, {
        metodeLama: lama.metode,
        terbayarCicilan: terbayarCicilan(lama.cicilan),
        contractId: lama.contractId,
        pembelianId: lama.pembelianId,
      }),
    );
    await pastikanObjekMilikProyek(masukan.pembebanan, lama.projectId);

    const { peruntukan, metode } = masukan;
    const totalBaru = masukan.total;
    const alokasiBaru = masukan.pembebanan;
    const kreditur = metode === "Hutang" ? masukan.kreditur : null;
    const tenggat = metode === "Hutang" ? new Date(masukan.tenggat as string) : null;

    // Berkas bukti hanya diganti bila pengguna mengunggah yang baru; bila kolom
    // dikosongkan, berkas lama dipertahankan (berikut namanya). Yang lama baru
    // dihapus dari penyimpanan setelah baris berhasil diperbarui.
    const berkasBaru = await simpanBuktiOpsional(form);
    const gantiBerkas = berkasBaru.buktiKey != null;

    const baru = {
      peruntukan,
      jenis: masukan.jenis,
      metode,
      kreditur,
      tenggat,
      uraian: masukan.uraian,
      total: totalBaru,
      bukti: gantiBerkas ? berkasBaru.bukti : lama.bukti,
      buktiKey: gantiBerkas ? berkasBaru.buktiKey : lama.buktiKey,
      posHpp: POS_HPP[peruntukan as PeruntukanBiaya],
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

    // Berkas lama dibuang hanya setelah baris tersimpan menunjuk berkas baru —
    // supaya kegagalan di tengah tidak menghapus bukti yang masih dirujuk.
    if (gantiBerkas && lama.buktiKey && lama.buktiKey !== baru.buktiKey) {
      await hapusBerkas(lama.buktiKey);
    }

    const namaAlokasiBaru = await ringkasAlokasi(alokasiBaru);

    const jml = await catatDiff({
      pengguna,
      projectId: lama.projectId,
      objek: `Pengeluaran · ${lama.uraian}`,
      sebelum: {
        peruntukan: lama.peruntukan, jenis: lama.jenis, metode: lama.metode,
        uraian: lama.uraian, total: lama.total,
        kreditur: lama.kreditur ?? "—", tenggat: tglLog(lama.tenggat),
        bukti: lama.bukti, dibebankanKe: labelAlokasiTersimpan(lama.alokasi),
      },
      sesudah: {
        peruntukan: baru.peruntukan, jenis: baru.jenis, metode: baru.metode,
        uraian: baru.uraian, total: baru.total,
        kreditur: baru.kreditur ?? "—", tenggat: tglLog(baru.tenggat),
        bukti: baru.bukti, dibebankanKe: namaAlokasiBaru,
      },
      label: {
        uraian: "Keterangan", total: "Total",
        bukti: "Berkas bukti", dibebankanKe: "Dibebankan ke",
        peruntukan: "Peruntukan", jenis: "Jenis biaya", metode: "Metode",
        kreditur: "Kreditur", tenggat: "Tenggat",
      },
      format: { total: (v) => rpLog(Number(v)) },
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${segmen(lama.project.kode)}`);
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
    const id = teks(form, "id", true);

    const lama = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true, projectId: true, uraian: true, total: true, peruntukan: true,
        contractId: true, pembelianId: true, buktiKey: true,
        _count: { select: { cicilan: true } },
        project: { select: { kode: true } },
      },
    });
    if (!lama) return;

    const pengguna = await izinkan("keuangan", lama.projectId);

    wajibLolos(
      periksaHapusPengeluaran(
        { id },
        {
          contractId: lama.contractId,
          pembelianId: lama.pembelianId,
          jumlahCicilan: lama._count.cicilan,
        },
      ),
    );

    await prisma.expense.delete({ where: { id } });
    if (lama.buktiKey) await hapusBerkas(lama.buktiKey);

    await catat({
      pengguna, projectId: lama.projectId,
      objek: `Pengeluaran · ${lama.peruntukan}`,
      aksi: "Hapus pengeluaran",
      dari: `${lama.uraian} — ${rpLog(lama.total)}`,
      ke: "dihapus",
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${segmen(lama.project.kode)}`);
    revalidatePath("/");
  });
}

/**
 * Bagikan biaya level-proyek berperuntukan Unit ke SEMUA unit proyek, rata sama
 * besar. Dipanggil dari kartu Pengeluaran per Unit.
 *
 * Aksi satu arah: begitu tiap biaya menempel ke unit lewat ExpenseAllocation,
 * bucket "biaya level proyek (unit)" ikut kosong dengan sendirinya — tak ada
 * flag atau penanda yang perlu disimpan. Hanya menyentuh alokasi yang MASIH
 * level-proyek (unit & sarpras sama-sama null); alokasi ke unit/sarpras tertentu
 * pada pengeluaran yang sama dibiarkan. Total tiap pengeluaran tetap utuh —
 * yang dibagi hanya porsi level-proyeknya — jadi Σ alokasi tetap sama dengan
 * totalnya.
 */
export async function bagikanBiayaUnitRata(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("keuangan", projectId);

    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, kode: true, units: { select: { id: true } } },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const expenses = await prisma.expense.findMany({
      where: {
        projectId,
        peruntukan: "Unit (rumah dijual)",
        alokasi: { some: { unitId: null, infrastructureId: null } },
      },
      select: {
        id: true,
        alokasi: { select: { id: true, unitId: true, infrastructureId: true, nominal: true } },
      },
    });

    wajibLolos(
      periksaBagikanBiayaUnitRata(
        { projectId },
        { jumlahUnit: proyek.units.length, jumlahBiayaLevelProyek: expenses.length },
      ),
    );

    const unitIds = proyek.units.map((u) => u.id);
    let jumlahBiaya = 0;
    let totalDibagi = 0;

    await prisma.$transaction(async (tx) => {
      for (const e of expenses) {
        const level = e.alokasi.filter((a) => !a.unitId && !a.infrastructureId);
        const nilai = level.reduce((s, a) => s + a.nominal, 0);
        if (nilai <= 0) continue;
        await tx.expenseAllocation.deleteMany({ where: { id: { in: level.map((a) => a.id) } } });
        const bagian = bagiRata(nilai, unitIds.length);
        await tx.expenseAllocation.createMany({
          data: unitIds.map((unitId, i) => ({ expenseId: e.id, unitId, nominal: bagian[i] ?? 0 })),
        });
        jumlahBiaya += 1;
        totalDibagi += nilai;
      }
    });

    if (jumlahBiaya === 0) {
      // Barisnya ada, tapi seluruhnya bernilai nol — tak ada yang bisa dibagi.
      throw new GagalIzin("Tidak ada biaya level-proyek (unit) yang bisa dibagikan.");
    }

    await catat({
      pengguna, projectId,
      objek: "Keuangan Proyek · Biaya level proyek (unit)",
      aksi: "Bagikan biaya ke unit (rata)",
      ke: `${jumlahBiaya} biaya · ${rpLog(totalDibagi)} dibagi rata ke ${unitIds.length} unit`,
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${segmen(proyek.kode)}`);
    revalidatePath("/");

    return `${rpLog(totalDibagi)} dibagikan rata ke ${unitIds.length} unit.`;
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
  revalidatePath(`/keuangan/${segmen(kodeProyek)}`);
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
  peruntukan: string,
): Promise<BarisPembebanan[]> {

  const baris = bacaBarisPembebanan(form);

  // Tak ada baris → biaya level proyek (perilaku lama). Sah.
  if (baris.length === 0) return [];

  wajibLolos(periksaPembebanan(total, peruntukan, baris));
  await pastikanObjekMilikProyek(baris, projectId);
  return baris;
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

    const masukan: MasukanBuatPembelian = {
      projectId,
      pemasokId,
      nomor: teks(form, "nomor", true),
      tanggal: teksOpsional(form, "tanggal"),
      keterangan: teksOpsional(form, "keterangan"),
      items: await bacaItemPembelian(form),
    };
    wajibLolos(periksaBuatPembelian(masukan));

    const { nomor, keterangan, items } = masukan;
    const tanggal = masukan.tanggal ? new Date(masukan.tanggal) : new Date();
    const total = totalPembelian(items);

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

    const masukan = {
      id,
      penerima: teks(form, "penerima", true),
      tanggalTerima: teksOpsional(form, "tanggalTerima") ?? new Date().toISOString(),
    };
    wajibLolos(periksaTerimaPembelian(masukan));
    const penerima = masukan.penerima;
    const tanggalTerima = new Date(masukan.tanggalTerima);

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
    const id = teks(form, "id", true);
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

    wajibLolos(
      periksaHapusPembelian({ id }, {
        jumlahPembayaran: lama._count.pembayaran,
        nomor: lama.nomor,
      }),
    );
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
    // Sengaja TANPA gerbang status: pembayaran boleh dicatat sebelum barang datang.
    const total = totalPembelian(beli.items);
    const terbayar = terbayarPembelian(beli.pembayaran);
    const sisa = total - terbayar;

    // Peruntukan dipilih di form (bukan diturunkan) — sama seperti Catat
    // Pengeluaran. Peruntukan berobjek (Unit/Prasarana) dibebankan ke unit atau
    // sarpras; peruntukan level proyek (Perijinan/Pengolahan) tanpa alokasi.
    const peruntukan = teks(form, "peruntukan", true);
    const bayar = angka(form, "total", { wajib: true });
    const pembebanan = bacaBarisPembebanan(form);
    wajibLolos(
      periksaBayarPembelian(
        {
          pembelianId,
          total: bayar,
          peruntukan,
          metode: teks(form, "metode", true),
          unitId: pembebanan[0]?.unitId ?? null,
          infrastructureId: pembebanan[0]?.infrastructureId ?? null,
        },
        { sisa, nomor: beli.nomor },
      ),
    );
    const alokasi = await bacaAlokasiOpsional(form, beli.projectId, bayar, peruntukan);

    const isiTanggal = teksOpsional(form, "tanggal");
    const tanggal = isiTanggal ? new Date(isiTanggal) : new Date();
    const metode = pilihan(form, "metode", METODE_TUNAI);
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);
    const uraianBawaan = `Pembayaran PO ${beli.nomor} — ${beli.pemasok.nama}`;
    const uraian = teksOpsional(form, "uraian") ?? uraianBawaan;

    await prisma.expense.create({
      data: {
        projectId: beli.projectId, pembelianId, tanggal,
        peruntukan, jenis: "Material", metode, uraian,
        total: bayar, bukti, buktiKey, pic: pengguna.nama, picId: pengguna.id,
        posHpp: POS_HPP[peruntukan as PeruntukanBiaya],
        alokasi: { create: alokasi },
      },
    });
    await catat({
      pengguna, projectId: beli.projectId, objek: `Pembelian ${beli.pemasok.nama} · ${beli.nomor}`,
      aksi: "Bayar PO",
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
    const id = teks(form, "id", true);
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
    wajibLolos(periksaHapusPembayaranPembelian({ id }, { pembelianId: lama.pembelianId }));
    if (!lama.pembelian) throw new GagalIzin("Pengeluaran ini bukan pembayaran pembelian.");
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

// ===========================================================================
// PELUNASAN HUTANG (cicilan)
// ===========================================================================
//
// Pengeluaran-hutang (metode "Hutang") dicatat AKRUAL — biayanya sudah masuk
// realisasi saat timbul. Melunasinya berarti KAS keluar, bukan biaya baru; jadi
// tiap cicilan disimpan sebagai HutangCicilan, BUKAN Expense, agar tak terhitung
// dua kali. Sisa = Expense.total − Σ cicilan; pelunasan berlebih ditolak.

export async function bayarHutang(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const expenseId = teks(form, "expenseId", true);
    const hutang = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true, projectId: true, metode: true, total: true, uraian: true, kreditur: true,
        cicilan: { select: { nominal: true } },
        project: { select: { kode: true } },
      },
    });
    if (!hutang) throw new GagalIzin("Hutang tidak ditemukan.");
    const pengguna = await izinkan("keuangan", hutang.projectId);

    const terbayar = terbayarCicilan(hutang.cicilan);
    const sisa = hutang.total - terbayar;
    const isiTanggal = teksOpsional(form, "tanggal");
    const masukan = {
      expenseId,
      nominal: angka(form, "nominal", { wajib: true }),
      metode: teks(form, "metode", true),
      tanggal: isiTanggal ?? new Date().toISOString(),
    };
    wajibLolos(periksaBayarHutang(masukan, { metodeInduk: hutang.metode, sisa }));

    const bayar = masukan.nominal;
    const metode = masukan.metode;
    const tanggal = new Date(masukan.tanggal);
    if (Number.isNaN(tanggal.getTime())) throw new GagalIzin("Tanggal pembayaran tidak sah.");
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    await prisma.hutangCicilan.create({
      data: {
        expenseId, tanggal, nominal: bayar, metode, bukti, buktiKey,
        pic: pengguna.nama, picId: pengguna.id,
      },
    });
    await catat({
      pengguna, projectId: hutang.projectId,
      objek: `Hutang · ${hutang.kreditur ?? hutang.uraian}`,
      aksi: "Bayar cicilan hutang",
      ke: `${rpLog(bayar)} (sisa ${rpLog(sisa - bayar)})`,
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${segmen(hutang.project.kode)}`);
    revalidatePath("/");
    return sisa - bayar <= 0
      ? "Cicilan tercatat — hutang lunas."
      : `Cicilan tercatat. Sisa ${rpLog(sisa - bayar)}.`;
  });
}

export async function hapusCicilanHutang(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    wajibLolos(periksaHapusCicilanHutang({ id }));
    const lama = await prisma.hutangCicilan.findUnique({
      where: { id },
      select: {
        id: true, nominal: true, buktiKey: true,
        expense: {
          select: {
            projectId: true, kreditur: true, uraian: true,
            project: { select: { kode: true } },
          },
        },
      },
    });
    if (!lama) return;
    const pengguna = await izinkan("keuangan", lama.expense.projectId);

    await prisma.hutangCicilan.delete({ where: { id } });
    if (lama.buktiKey) await hapusBerkas(lama.buktiKey);
    await catat({
      pengguna, projectId: lama.expense.projectId,
      objek: `Hutang · ${lama.expense.kreditur ?? lama.expense.uraian}`,
      aksi: "Hapus cicilan hutang", dari: rpLog(lama.nominal),
    });
    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${segmen(lama.expense.project.kode)}`);
    revalidatePath("/");
  });
}
