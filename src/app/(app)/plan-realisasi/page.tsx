import { redirect } from "next/navigation";

/**
 * Plan vs Realisasi kini menjadi tab pada laman DETAIL proyek Landbank
 * (`/landbank/[kode]?tab=pvr`). Rute lama dipertahankan sebagai pengalih supaya
 * tautan & bookmark lama tetap hidup: bila membawa `proyek`, diarahkan langsung
 * ke tab PvR proyek itu (sub-tab lama `tab` dipetakan ke `pv`); tanpa `proyek`,
 * jatuh ke portofolio Landbank.
 */
export default async function PlanRealisasiRedirect({
  searchParams,
}: {
  searchParams: Promise<{ proyek?: string; tab?: string }>;
}) {
  const { proyek, tab } = await searchParams;
  if (!proyek) redirect("/landbank");
  const params = new URLSearchParams({ tab: "pvr" });
  if (tab) params.set("pv", tab);
  redirect(`/landbank/${proyek}?${params.toString()}`);
}
