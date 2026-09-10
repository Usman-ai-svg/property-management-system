import type { Section } from "./domain/enums";
import {
  JABATAN_DIRECTOR, JABATAN_HEAD_OF_OPERATION, JABATAN_STAFF_ADMINISTRATION,
} from "./domain/jabatan";

export interface ItemNav {
  id: string;
  label: string;
  href: string;
  /** Ikon lucide-react, dipetakan di komponen sidebar. */
  ikon: "LayoutGrid" | "Building2" | "Wallet" | "Map" | "ShieldCheck" | "Calculator";
  /** Bila diisi, menu hanya muncul untuk peran yang boleh melihat sub-bagian ini. */
  butuhSection?: Section;
  /** Bila diisi, menu hanya muncul untuk peran dalam daftar. */
  butuhJabatan?: string[];
  anak?: Omit<ItemNav, "ikon" | "anak">[];
}

export const NAV: ItemNav[] = [
  { id: "ringkasan", label: "Ringkasan", href: "/", ikon: "LayoutGrid" },
  { id: "master", label: "Master Proyek", href: "/master", ikon: "Building2", butuhSection: "deskripsi" },
  // Estimasi RAB berbasis AHSP — di bawah Master Proyek. Seluruhnya gerbang
  // "hargaRabRap" karena isinya harga satuan pekerjaan & harga dasar.
  {
    id: "estimasi",
    label: "Estimasi RAB",
    href: "/estimasi",
    ikon: "Calculator",
    butuhSection: "hargaRabRap",
    anak: [
      { id: "estimasi-rab", label: "RAB Estimasi", href: "/estimasi", butuhSection: "hargaRabRap" },
      { id: "estimasi-pustaka", label: "Pustaka AHSP", href: "/estimasi/pustaka", butuhSection: "hargaRabRap" },
      { id: "estimasi-pemasok", label: "Supplier", href: "/estimasi/pemasok", butuhSection: "hargaRabRap" },
    ],
  },
  {
    id: "manpro",
    label: "Manajemen Proyek",
    href: "/konstruksi",
    ikon: "Wallet",
    anak: [
      { id: "konstruksi", label: "Konstruksi", href: "/konstruksi", butuhSection: "daftarUnit" },
      { id: "keuangan", label: "Keuangan Proyek", href: "/keuangan", butuhSection: "keuangan" },
      // Petty cash punya menunya sendiri supaya Supervisor pemegang dana bisa
      // mengelola dananya tanpa membuka angka keuangan proyek yang tertutup
      // untuk peran lapangan.
      { id: "petty", label: "Petty Cash", href: "/petty-cash", butuhSection: "pettyCash" },
      { id: "vendor", label: "Vendor Management", href: "/vendor", butuhSection: "progress" },
      { id: "equipment", label: "Equipment & Asset", href: "/equipment" },
    ],
  },
  // Landbank kini juga memuat tab Plan vs Realisasi. Gerbangnya izin
  // `businessPlan` (bukan daftar peran) supaya bisa diatur dari Admin → Kelola
  // Hak Akses; secara bawaan audiensnya tetap Administrator Sistem, Komisaris,
  // BOD, dan Business Development — sama seperti sebelum penyatuan.
  { id: "landbank", label: "Landbank", href: "/landbank", ikon: "Map", butuhSection: "businessPlan" },
  { id: "admin", label: "Admin", href: "/admin", ikon: "ShieldCheck", butuhJabatan: [JABATAN_DIRECTOR, JABATAN_HEAD_OF_OPERATION, JABATAN_STAFF_ADMINISTRATION] },
];

/** Saring menu sesuai jabatan yang dipegang dan izin yang dimiliki. */
export function navUntuk(
  jabatan: readonly string[],
  bolehLihatSection: (s: Section) => boolean,
): ItemNav[] {
  const lolos = (n: { butuhSection?: Section; butuhJabatan?: string[] }) => {
    if (n.butuhJabatan && !jabatan.some((j) => n.butuhJabatan!.includes(j))) return false;
    if (n.butuhSection && !bolehLihatSection(n.butuhSection)) return false;
    return true;
  };

  return NAV.filter(lolos).map((n) => ({
    ...n,
    anak: n.anak?.filter(lolos),
  })).filter((n) => !n.anak || n.anak.length > 0 || !NAV.find((x) => x.id === n.id)?.anak);
}
