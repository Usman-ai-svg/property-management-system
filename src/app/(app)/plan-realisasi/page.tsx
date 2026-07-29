import { redirect } from "next/navigation";

/**
 * Plan vs Realisasi kini menjadi tab pada indeks Landbank (`/landbank?tab=pvr`).
 * Rute lama dipertahankan sebagai pengalih supaya tautan & bookmark lama tetap
 * hidup — parameter proyek dibawa, dan sub-tab lama (`tab`) dipetakan ke `pv`.
 */
export default async function PlanRealisasiRedirect({
  searchParams,
}: {
  searchParams: Promise<{ proyek?: string; tab?: string }>;
}) {
  const { proyek, tab } = await searchParams;
  const params = new URLSearchParams({ tab: "pvr" });
  if (proyek) params.set("proyek", proyek);
  if (tab) params.set("pv", tab);
  redirect(`/landbank?${params.toString()}`);
}
