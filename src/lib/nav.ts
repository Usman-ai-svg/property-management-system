import type { Section } from "./domain/enums";

export interface ItemNav {
  id: string;
  label: string;
  href: string;
  /** Ikon lucide-react, dipetakan di komponen sidebar. */
  ikon: "LayoutGrid" | "Building2" | "Wallet" | "Map" | "GaugeCircle" | "ShieldCheck";
  /** Bila diisi, menu hanya muncul untuk peran yang boleh melihat sub-bagian ini. */
  butuhSection?: Section;
  /** Bila diisi, menu hanya muncul untuk peran dalam daftar. */
  butuhPeran?: string[];
  anak?: Omit<ItemNav, "ikon" | "anak">[];
}

const PIMPINAN = ["Komisaris", "BOD", "Business Development"];

export const NAV: ItemNav[] = [
  { id: "ringkasan", label: "Ringkasan", href: "/", ikon: "LayoutGrid" },
  { id: "master", label: "Master Proyek", href: "/master", ikon: "Building2", butuhSection: "deskripsi" },
  {
    id: "manpro",
    label: "Manajemen Proyek",
    href: "/konstruksi",
    ikon: "Wallet",
    anak: [
      { id: "konstruksi", label: "Konstruksi", href: "/konstruksi", butuhSection: "daftarUnit" },
      { id: "keuangan", label: "Keuangan Proyek", href: "/keuangan", butuhSection: "keuangan" },
      { id: "vendor", label: "Vendor Management", href: "/vendor", butuhSection: "progress" },
      { id: "equipment", label: "Equipment & Asset", href: "/equipment" },
    ],
  },
  { id: "landbank", label: "Landbank", href: "/landbank", ikon: "Map", butuhPeran: PIMPINAN },
  { id: "planreal", label: "Plan vs Realisasi", href: "/plan-realisasi", ikon: "GaugeCircle", butuhSection: "businessPlan" },
  { id: "admin", label: "Admin", href: "/admin", ikon: "ShieldCheck", butuhPeran: ["BOD", "Business Development", "Head Operation Office", "Admin"] },
];

/** Saring menu sesuai peran aktif dan izin yang dimiliki. */
export function navUntuk(
  peranAktif: string,
  bolehLihatSection: (s: Section) => boolean,
): ItemNav[] {
  const lolos = (n: { butuhSection?: Section; butuhPeran?: string[] }) => {
    if (n.butuhPeran && !n.butuhPeran.includes(peranAktif)) return false;
    if (n.butuhSection && !bolehLihatSection(n.butuhSection)) return false;
    return true;
  };

  return NAV.filter(lolos).map((n) => ({
    ...n,
    anak: n.anak?.filter(lolos),
  })).filter((n) => !n.anak || n.anak.length > 0 || !NAV.find((x) => x.id === n.id)?.anak);
}
