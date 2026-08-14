import { redirect } from "next/navigation";

/**
 * Plan vs Realisasi kini MELEBUR ke dalam tab Business Plan pada laman DETAIL
 * proyek Landbank (`/landbank/[kode]?tab=bp`) — tiap tabel BP membawa kolom
 * realisasi & bar serapannya sendiri. Rute lama dipertahankan sebagai pengalih
 * supaya tautan & bookmark lama tetap hidup: bila membawa `proyek`, diarahkan
 * ke tab Business Plan proyek itu (sub-tab lama dipetakan ke sub-tab BP);
 * tanpa `proyek`, jatuh ke portofolio Landbank.
 */
const PETA_SUBTAB: Record<string, string> = {
  hpp: "hpp",
  penjualan: "omzet",
  operasional: "ops",
  laba: "laba",
};

export default async function PlanRealisasiRedirect({
  searchParams,
}: {
  searchParams: Promise<{ proyek?: string; tab?: string }>;
}) {
  const { proyek, tab } = await searchParams;
  if (!proyek) redirect("/landbank");
  const params = new URLSearchParams({ tab: "bp" });
  if (tab && PETA_SUBTAB[tab]) params.set("bp", PETA_SUBTAB[tab]);
  redirect(`/landbank/${proyek}?${params.toString()}`);
}
