"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff } from "@/lib/audit";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import {
  SECTION_LABELS, SECTIONS, STATUS_LAHAN, STATUS_PROYEK, type Section,
} from "@/lib/domain/enums";

/**
 * Pengubahan matriks hak akses.
 *
 * Matriks ini menentukan siapa boleh melihat dan mengubah apa, jadi
 * mengubahnya sendiri harus dijaga: hanya peran yang boleh mengubah
 * "deskripsi" — dalam praktiknya BOD, Business Development, dan Head
 * Operation Office — yang diizinkan. Tanpa penjagaan itu, siapa pun yang
 * bisa membuka halaman Admin bisa menaikkan haknya sendiri.
 */
async function izinkanKelolaAkses() {
  const pengguna = await ambilPengguna();
  if (!pengguna) throw new GagalIzin("Sesi Anda sudah berakhir. Silakan masuk kembali.");
  if (!bolehUbah(pengguna, "deskripsi")) {
    throw new GagalIzin(`Peran "${pengguna.peranAktif}" tidak berhak mengubah matriks hak akses.`);
  }
  return pengguna;
}

export async function ubahIzin(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();

    const roleId = teks(form, "roleId", true);
    const section = teks(form, "section", true) as Section;
    /** tidak | lihat | ubah */
    const tingkat = teks(form, "tingkat", true);

    if (!SECTIONS.includes(section)) throw new GagalIzin("Sub-bagian tidak dikenal.");
    if (!["tidak", "lihat", "ubah"].includes(tingkat)) throw new GagalIzin("Tingkat izin tidak sah.");

    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, nama: true } });
    if (!role) throw new GagalIzin("Peran tidak ditemukan.");

    const lama = await prisma.roleSectionPermission.findUnique({
      where: { roleId_section: { roleId, section } },
      select: { bolehUbah: true },
    });
    const tingkatLama = !lama ? "tidak" : lama.bolehUbah ? "ubah" : "lihat";

    if (tingkatLama === tingkat) return "Tidak ada perubahan.";

    // Mencabut hak akses diri sendiri atas "deskripsi" akan mengunci pengguna
    // keluar dari halaman ini — dan pada demo tanpa akses database langsung,
    // itu tidak bisa dipulihkan lewat aplikasi.
    if (
      section === "deskripsi" &&
      tingkat !== "ubah" &&
      pengguna.peranAktif === role.nama
    ) {
      throw new GagalIzin(
        `Tidak bisa mencabut hak ubah "Deskripsi Proyek" dari peran Anda sendiri (${role.nama}) — Anda akan terkunci dari halaman ini.`,
      );
    }

    if (tingkat === "tidak") {
      await prisma.roleSectionPermission.deleteMany({ where: { roleId, section } });
    } else {
      await prisma.roleSectionPermission.upsert({
        where: { roleId_section: { roleId, section } },
        create: { roleId, section, bolehUbah: tingkat === "ubah" },
        update: { bolehUbah: tingkat === "ubah" },
      });
    }

    await catat({
      pengguna,
      objek: `Hak akses · ${role.nama} · ${SECTION_LABELS[section]}`,
      aksi: "Ubah hak akses",
      dari: tingkatLama, ke: tingkat,
    });

    revalidatePath("/admin");
    // Menu dan isi halaman ikut berubah begitu izin berubah.
    revalidatePath("/", "layout");
  });
}

/** Aktifkan atau nonaktifkan seorang pengguna. */
export async function ubahStatusUser(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();
    const userId = teks(form, "userId", true);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, aktif: true },
    });
    if (!target) throw new GagalIzin("Pengguna tidak ditemukan.");

    if (target.id === pengguna.id) {
      throw new GagalIzin("Tidak bisa menonaktifkan akun Anda sendiri.");
    }

    await prisma.user.update({ where: { id: userId }, data: { aktif: !target.aktif } });

    await catat({
      pengguna,
      objek: `Pengguna · ${target.nama}`,
      aksi: "Ubah status akun",
      dari: target.aktif ? "Aktif" : "Nonaktif",
      ke: target.aktif ? "Nonaktif" : "Aktif",
    });

    revalidatePath("/admin");
  });
}

// ===========================================================================
// PROYEK & FASE
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
    if (!/^[A-Z0-9]{2,8}$/.test(kode)) {
      throw new GagalIzin("Kode proyek hanya boleh huruf dan angka, 2–8 karakter.");
    }

    const bentrok = await prisma.project.count({ where: { kode } });
    if (bentrok) throw new GagalIzin(`Kode proyek "${kode}" sudah dipakai.`);

    const nama = teks(form, "nama", true);
    const kodeFase = (teks(form, "kodeFase") || "F1").toUpperCase();

    const proyek = await prisma.project.create({
      data: {
        kode, nama,
        status: pilihan(form, "status", STATUS_PROYEK),
        statusLahan: pilihan(form, "statusLahan", STATUS_LAHAN),
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

    revalidatePath("/admin");
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
      select: { id: true, kode: true, nama: true, status: true, statusLahan: true },
    });
    if (!lama) throw new GagalIzin("Proyek tidak ditemukan.");

    const pengguna = await izinkan("deskripsi", id);

    const data = {
      nama: teks(form, "nama", true),
      status: pilihan(form, "status", STATUS_PROYEK),
      statusLahan: pilihan(form, "statusLahan", STATUS_LAHAN),
    };

    await prisma.project.update({ where: { id }, data });

    const jml = await catatDiff({
      pengguna, projectId: id,
      objek: `Proyek ${lama.kode}`,
      sebelum: lama, sesudah: data,
      label: { nama: "Nama proyek", status: "Status", statusLahan: "Status lahan" },
    });

    revalidatePath("/admin");
    revalidatePath("/master");
    revalidatePath(`/master/${lama.kode}`);
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

    revalidatePath("/admin");
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

      revalidatePath("/admin");
      revalidatePath(`/master/${lama.project.kode}`);
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

    revalidatePath("/admin");
    revalidatePath(`/master/${proyek.kode}`);
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

    revalidatePath("/admin");
    revalidatePath(`/master/${lama.project.kode}`);
  });
}

// ===========================================================================
// PENGGUNA
// ===========================================================================

/** Ubah nama menjadi inisial: "Andra Wijaya" → "AW". */
const inisialDari = (nama: string) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Baca peran dan akses proyek dari form, sekaligus memeriksa keabsahannya. */
async function bacaPeranAkses(form: FormData) {
  const peranIds = [...new Set(form.getAll("peranId").map((v) => String(v).trim()).filter(Boolean))];
  if (peranIds.length === 0) throw new GagalIzin("Pengguna harus punya setidaknya satu peran.");

  const peranSah = await prisma.role.count({ where: { id: { in: peranIds } } });
  if (peranSah !== peranIds.length) throw new GagalIzin("Ada peran yang tidak dikenali.");

  const semuaProyek = String(form.get("semuaProyek") ?? "") === "ya";
  const proyekIds = semuaProyek
    ? []
    : [...new Set(form.getAll("proyekId").map((v) => String(v).trim()).filter(Boolean))];

  if (!semuaProyek && proyekIds.length === 0) {
    throw new GagalIzin(
      "Pilih setidaknya satu proyek, atau centang akses ke seluruh proyek. Pengguna tanpa proyek tidak bisa melihat apa pun.",
    );
  }

  if (proyekIds.length > 0) {
    const sah = await prisma.project.count({ where: { id: { in: proyekIds } } });
    if (sah !== proyekIds.length) throw new GagalIzin("Ada proyek yang tidak dikenali.");
  }

  return { peranIds, semuaProyek, proyekIds };
}

/**
 * Tambah pengguna.
 *
 * Kata sandi awal diketik oleh pengelola dan langsung di-hash — tidak pernah
 * disimpan apa adanya, dan tidak pernah dikembalikan lagi oleh aplikasi.
 */
export async function tambahUser(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();

    const nama = teks(form, "nama", true);
    const email = teks(form, "email", true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GagalIzin("Format email tidak sah.");

    const bentrok = await prisma.user.count({ where: { email } });
    if (bentrok) throw new GagalIzin(`Email "${email}" sudah dipakai akun lain.`);

    const sandi = teks(form, "sandi", true);
    if (sandi.length < 8) throw new GagalIzin("Kata sandi minimal 8 karakter.");

    const { peranIds, semuaProyek, proyekIds } = await bacaPeranAkses(form);

    await prisma.user.create({
      data: {
        nama,
        inisial: teksOpsional(form, "inisial") || inisialDari(nama),
        email,
        passwordHash: await hashPassword(sandi),
        semuaProyek,
        roles: { create: peranIds.map((roleId) => ({ roleId })) },
        aksesProyek: { create: proyekIds.map((projectId) => ({ projectId })) },
      },
    });

    await catat({
      pengguna,
      objek: `Pengguna · ${nama}`,
      aksi: "Tambah pengguna",
      ke: `${email} · ${peranIds.length} peran · ${semuaProyek ? "semua proyek" : `${proyekIds.length} proyek`}`,
    });

    revalidatePath("/admin");
    return `Akun ${email} dibuat. Sampaikan kata sandinya lewat jalur yang aman — aplikasi tidak bisa menampilkannya lagi.`;
  });
}

/**
 * Ubah pengguna: nama, email, peran, dan akses proyeknya.
 *
 * Kata sandi hanya ikut berubah bila diisi — mengosongkannya berarti tidak
 * diubah, bukan dikosongkan.
 */
export async function ubahUser(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();
    const id = teks(form, "id", true);

    const lama = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, nama: true, email: true, inisial: true, semuaProyek: true,
        roles: { select: { role: { select: { id: true, nama: true } } } },
        aksesProyek: { select: { project: { select: { id: true, kode: true } } } },
      },
    });
    if (!lama) throw new GagalIzin("Pengguna tidak ditemukan.");

    const nama = teks(form, "nama", true);
    const email = teks(form, "email", true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GagalIzin("Format email tidak sah.");

    if (email !== lama.email) {
      const bentrok = await prisma.user.count({ where: { email } });
      if (bentrok) throw new GagalIzin(`Email "${email}" sudah dipakai akun lain.`);
    }

    const { peranIds, semuaProyek, proyekIds } = await bacaPeranAkses(form);

    // Pengelola tidak boleh mencabut hak kelolanya sendiri lewat halaman ini —
    // itu mengunci seluruh sistem bila dia satu-satunya yang memegangnya.
    if (id === pengguna.id) {
      const masihKelola = await prisma.roleSectionPermission.count({
        where: { roleId: { in: peranIds }, section: "deskripsi", bolehUbah: true },
      });
      if (!masihKelola) {
        throw new GagalIzin(
          "Peran yang dipilih membuat Anda kehilangan hak mengelola hak akses. Minta pengelola lain yang mengubahnya.",
        );
      }
    }

    const sandi = String(form.get("sandi") ?? "").trim();
    if (sandi && sandi.length < 8) throw new GagalIzin("Kata sandi minimal 8 karakter.");

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userProjectAccess.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: {
          nama,
          email,
          inisial: teksOpsional(form, "inisial") || inisialDari(nama),
          semuaProyek,
          ...(sandi ? { passwordHash: await hashPassword(sandi) } : {}),
          roles: { create: peranIds.map((roleId) => ({ roleId })) },
          aksesProyek: { create: proyekIds.map((projectId) => ({ projectId })) },
        },
      }),
    ]);

    const peranBaru = await prisma.role.findMany({
      where: { id: { in: peranIds } },
      select: { nama: true },
      orderBy: { nama: "asc" },
    });
    const proyekBaru = await prisma.project.findMany({
      where: { id: { in: proyekIds } },
      select: { kode: true },
      orderBy: { kode: "asc" },
    });

    const jml = await catatDiff({
      pengguna,
      objek: `Pengguna · ${lama.nama}`,
      sebelum: {
        nama: lama.nama, email: lama.email, inisial: lama.inisial,
        peran: lama.roles.map((r) => r.role.nama).sort().join(", "),
        akses: lama.semuaProyek
          ? "semua proyek"
          : lama.aksesProyek.map((a) => a.project.kode).sort().join(", "),
      },
      sesudah: {
        nama, email, inisial: teksOpsional(form, "inisial") || inisialDari(nama),
        peran: peranBaru.map((r) => r.nama).join(", "),
        akses: semuaProyek ? "semua proyek" : proyekBaru.map((p) => p.kode).join(", "),
      },
      label: { nama: "Nama", email: "Email", inisial: "Inisial", peran: "Peran", akses: "Akses proyek" },
    });

    if (sandi) {
      await catat({
        pengguna,
        objek: `Pengguna · ${lama.nama}`,
        aksi: "Setel ulang kata sandi",
        ke: "kata sandi diganti",
      });
    }

    revalidatePath("/admin");
    revalidatePath("/", "layout");

    if (jml === 0 && !sandi) return "Tidak ada yang berubah.";
    return sandi ? `${jml} perubahan tersimpan · kata sandi diganti.` : `${jml} perubahan tersimpan.`;
  });
}

/**
 * Hapus pengguna.
 *
 * Akun yang sudah punya jejak audit tidak boleh dihapus — log perubahan akan
 * kehilangan pelakunya, dan itulah justru yang membuat log berguna. Untuk
 * menghentikan akses, nonaktifkan akunnya.
 */
export async function hapusUser(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const pengguna = await izinkanKelolaAkses();

    const lama = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nama: true, email: true, _count: { select: { auditLogs: true } } },
    });
    if (!lama) return;

    if (lama.id === pengguna.id) throw new GagalIzin("Tidak bisa menghapus akun Anda sendiri.");

    if (lama._count.auditLogs > 0) {
      throw new GagalIzin(
        `${lama.nama} punya ${lama._count.auditLogs} entri di Log Perubahan. Nonaktifkan akunnya alih-alih menghapusnya, supaya jejak auditnya tetap bisa ditelusuri.`,
      );
    }

    await prisma.user.delete({ where: { id } });

    await catat({
      pengguna,
      objek: `Pengguna · ${lama.nama}`,
      aksi: "Hapus pengguna",
      dari: lama.email,
      ke: "dihapus",
    });

    revalidatePath("/admin");
  });
}
