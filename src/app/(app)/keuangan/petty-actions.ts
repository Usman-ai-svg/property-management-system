"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { simpanBuktiOpsional } from "@/lib/actions/bukti";
import { cariTransisi } from "@/lib/calc/petty-cash";
import {
  JENIS_BIAYA_SWAKELOLA, PERUNTUKAN_BIAYA, POS_HPP, STATUS_PETTY_CASH,
} from "@/lib/domain/enums";
import type { Pengguna } from "@/lib/auth/rbac";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const periodeSekarang = (d = new Date()) => `${BULAN[d.getMonth()]} ${d.getFullYear()}`;

/** Tolak bila peran aktif bukan salah satu yang berhak atas tahap ini. */
function wajibPeran(pengguna: Pengguna, ...peran: string[]): void {
  if (!peran.includes(pengguna.peranAktif)) {
    throw new GagalIzin(
      `Tahap ini hanya untuk peran ${peran.join(" / ")} — Anda sedang berperan "${pengguna.peranAktif}".`,
    );
  }
}

/** Muat sebuah laporan + konteks dananya, atau lempar bila tak ada. */
async function ambilLaporan(reportId: string) {
  const r = await prisma.pettyCashReport.findUnique({
    where: { id: reportId },
    select: {
      id: true, status: true,
      fund: { select: { id: true, projectId: true, pemegangId: true, project: { select: { kode: true } } } },
      _count: { select: { expenses: true } },
    },
  });
  if (!r) throw new GagalIzin("Laporan petty cash tidak ditemukan.");
  return r;
}

function revalidasi(kode: string) {
  revalidatePath("/keuangan");
  revalidatePath(`/keuangan/${kode}`);
  revalidatePath("/");
}

// ===========================================================================
// FINANCE — beri dana & reimburse
// ===========================================================================

/**
 * Beri / isi dana petty cash untuk seorang pemegang (Supervisor). Membuat dana
 * bila belum ada, lalu mencatat penambahan saldo jenis "Awal". Plafon di sini
 * hanya nilai acuan imprest — tidak membatasi pengeluaran maupun reimburse.
 */
export async function beriDanaPetty(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("keuangan", projectId);

    const proyek = await prisma.project.findUnique({ where: { id: projectId }, select: { kode: true } });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const pemegangId = teks(form, "pemegangId", true);
    const pemegang = await prisma.user.findFirst({
      where: {
        id: pemegangId, aktif: true,
        roles: { some: { role: { nama: "Supervisor" } } },
      },
      select: { id: true, nama: true },
    });
    if (!pemegang) throw new GagalIzin("Pemegang dana harus seorang Supervisor yang aktif.");

    const plafon = angka(form, "plafon", { min: 0, wajib: true });
    const nominal = angka(form, "nominal", { min: 1, wajib: true });
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    const dana = await prisma.pettyCashFund.upsert({
      where: { projectId_pemegangId: { projectId, pemegangId } },
      update: { plafon, aktif: true },
      create: { projectId, pemegangId, plafon, aktif: true },
      select: { id: true },
    });

    await prisma.pettyCashTopUp.create({
      data: { fundId: dana.id, nominal, jenis: "Awal", olehId: pengguna.id, bukti, buktiKey },
    });

    await catat({
      pengguna, projectId,
      objek: `Petty Cash · ${pemegang.nama}`,
      aksi: "Beri dana petty cash",
      ke: `${rpLog(nominal)} (plafon ${rpLog(plafon)})`,
    });

    revalidasi(proyek.kode);
    return `Dana ${rpLog(nominal)} diberikan ke ${pemegang.nama}.`;
  });
}

/**
 * Reimburse laporan yang sudah disetujui: kembalikan saldo penuh sebesar total
 * laporan (imprest) lewat penambahan saldo jenis "Reimburse", dan tandai
 * laporan Direimburse. Otoritas keuangan (Finance).
 */
export async function reimburseLaporanPetty(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const reportId = teks(form, "reportId", true);
    const r = await prisma.pettyCashReport.findUnique({
      where: { id: reportId },
      select: {
        id: true, status: true,
        fund: { select: { id: true, projectId: true, project: { select: { kode: true } }, pemegang: { select: { nama: true } } } },
        expenses: { select: { total: true } },
      },
    });
    if (!r) throw new GagalIzin("Laporan petty cash tidak ditemukan.");

    const pengguna = await izinkan("keuangan", r.fund.projectId);
    const transisi = cariTransisi(r.status as (typeof STATUS_PETTY_CASH)[number], "Direimburse");
    if (!transisi) throw new GagalIzin("Laporan ini belum disetujui, jadi belum bisa direimburse.");

    const total = r.expenses.reduce((s, e) => s + e.total, 0);
    if (total <= 0) throw new GagalIzin("Laporan kosong — tak ada yang perlu direimburse.");

    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    await prisma.$transaction(async (tx) => {
      await tx.pettyCashReport.update({
        where: { id: reportId },
        data: { status: "Direimburse", direimbursePada: new Date() },
      });
      await tx.pettyCashTopUp.create({
        data: {
          fundId: r.fund.id, nominal: total, jenis: "Reimburse", reportId,
          olehId: pengguna.id, bukti, buktiKey,
        },
      });
    });

    await catat({
      pengguna, projectId: r.fund.projectId,
      objek: `Petty Cash · ${r.fund.pemegang.nama}`,
      aksi: "Reimburse laporan petty cash",
      ke: `${rpLog(total)} dikembalikan ke dana`,
    });

    revalidasi(r.fund.project.kode);
    return `Reimburse ${rpLog(total)} tercatat.`;
  });
}

// ===========================================================================
// PEMEGANG (Supervisor) — catat pengeluaran & ajukan
// ===========================================================================

/**
 * Catat satu pengeluaran petty cash. Menempel ke laporan Draft dana (batch
 * berjalan) — dibuat bila belum ada. Hanya pemegang dana yang boleh mencatat.
 */
export async function catatPengeluaranPetty(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const fundId = teks(form, "fundId", true);
    const dana = await prisma.pettyCashFund.findUnique({
      where: { id: fundId },
      select: {
        id: true, aktif: true, pemegangId: true, projectId: true,
        project: { select: { kode: true } },
      },
    });
    if (!dana) throw new GagalIzin("Dana petty cash tidak ditemukan.");
    if (!dana.aktif) throw new GagalIzin("Dana ini sudah ditutup.");

    const pengguna = await izinkan("pettyCash", dana.projectId);
    if (pengguna.id !== dana.pemegangId) {
      throw new GagalIzin("Hanya pemegang dana yang boleh mencatat pengeluaran petty cash-nya.");
    }

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const jenis = pilihan(form, "jenis", JENIS_BIAYA_SWAKELOLA);
    const uraian = teks(form, "uraian", true);
    const total = angka(form, "total", { min: 1, wajib: true });
    const { bukti, buktiKey } = await simpanBuktiOpsional(form);

    // Laporan Draft = batch berjalan. Paling banyak satu per dana; dibuat bila
    // belum ada.
    let draft = await prisma.pettyCashReport.findFirst({
      where: { fundId, status: "Draft" },
      select: { id: true },
    });
    if (!draft) {
      draft = await prisma.pettyCashReport.create({
        data: { fundId, periode: periodeSekarang(), status: "Draft" },
        select: { id: true },
      });
    }

    await prisma.expense.create({
      data: {
        projectId: dana.projectId,
        tanggal: new Date(),
        peruntukan,
        jenis,
        metode: "Petty Cash",
        uraian,
        total,
        status: "Lunas",
        pic: pengguna.nama,
        posHpp: POS_HPP[peruntukan],
        bukti,
        buktiKey,
        pettyCashReportId: draft.id,
      },
    });

    await catat({
      pengguna, projectId: dana.projectId,
      objek: "Petty Cash · Pengeluaran",
      aksi: "Catat pengeluaran petty cash",
      ke: `${uraian} — ${rpLog(total)}`,
    });

    revalidasi(dana.project.kode);
  });
}

/**
 * Ajukan laporan Draft untuk pertanggungjawaban: Draft → Diajukan. Mengunci
 * barisnya. Hanya pemegang dana, dan hanya bila ada isinya.
 */
export async function ajukanLaporanPetty(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const reportId = teks(form, "reportId", true);
    const r = await ambilLaporan(reportId);

    const pengguna = await izinkan("pettyCash", r.fund.projectId);
    if (pengguna.id !== r.fund.pemegangId) {
      throw new GagalIzin("Hanya pemegang dana yang boleh mengajukan laporannya.");
    }
    if (!cariTransisi(r.status as (typeof STATUS_PETTY_CASH)[number], "Diajukan")) {
      throw new GagalIzin("Laporan ini bukan Draft, jadi tidak bisa diajukan.");
    }
    if (r._count.expenses === 0) {
      throw new GagalIzin("Laporan masih kosong — catat pengeluaran dulu sebelum diajukan.");
    }

    await prisma.pettyCashReport.update({
      where: { id: reportId },
      data: { status: "Diajukan", diajukanPada: new Date() },
    });

    await catat({
      pengguna, projectId: r.fund.projectId,
      objek: "Petty Cash · Laporan",
      aksi: "Ajukan laporan petty cash",
      ke: `${r._count.expenses} pengeluaran diajukan`,
    });

    revalidasi(r.fund.project.kode);
  });
}

// ===========================================================================
// QS & HEAD OPS — verifikasi / kembalikan / setujui / tolak
// ===========================================================================

/**
 * Transisi persetujuan non-keuangan: QS memverifikasi/mengembalikan, Head
 * Operation Project menyetujui/menolak. Reimburse & ajukan punya jalurnya
 * sendiri karena membawa efek samping berbeda.
 */
export async function transisiLaporanPetty(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const reportId = teks(form, "reportId", true);
    const ke = pilihan(form, "ke", STATUS_PETTY_CASH);
    const catatan = teksOpsional(form, "catatan");
    const r = await ambilLaporan(reportId);

    const transisi = cariTransisi(r.status as (typeof STATUS_PETTY_CASH)[number], ke);
    if (!transisi) throw new GagalIzin(`Transisi ${r.status} → ${ke} tidak sah.`);
    if (transisi.oleh !== "Quantity Surveyor" && transisi.oleh !== "Head Operation Project") {
      throw new GagalIzin("Transisi ini bukan wewenang tahap verifikasi/persetujuan.");
    }

    const pengguna = await izinkan("pettyCash", r.fund.projectId);
    wajibPeran(pengguna, transisi.oleh);

    const stamp =
      ke === "DiverifikasiQS" ? { diverifikasiQsPada: new Date() }
      : ke === "Disetujui" ? { disetujuiOpsPada: new Date() }
      : {};

    await prisma.pettyCashReport.update({
      where: { id: reportId },
      data: { status: ke, catatan: catatan ?? null, ...stamp },
    });

    await catat({
      pengguna, projectId: r.fund.projectId,
      objek: "Petty Cash · Laporan",
      aksi: `Petty cash: ${transisi.aksi}`,
      dari: r.status,
      ke,
    });

    revalidasi(r.fund.project.kode);
  });
}
