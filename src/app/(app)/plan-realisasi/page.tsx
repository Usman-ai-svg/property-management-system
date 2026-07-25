import { Segera } from "@/components/segera";

export default function PlanRealisasi() {
  return (
    <Segera
      judul="Plan vs Realisasi"
      keterangan="Perbandingan rencana dan realisasi: HPP, penjualan, operasional, dan laba."
      tersedia={[
        "ringkasPlanReal() — laba kotor, laba bersih, dan margin dari rencana maupun realisasi",
        "Realisasi konstruksi dari expenses, realisasi penjualan dari sales_payments",
        "Realisasi sarpras dari pembayaran kontrak, bukan dari faktor tebakan",
      ]}
    />
  );
}
