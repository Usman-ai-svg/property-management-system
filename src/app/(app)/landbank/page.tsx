import { Segera } from "@/components/segera";

export default function Landbank() {
  return (
    <Segera
      judul="Landbank"
      keterangan="Portofolio lahan, studi kelayakan, dan business plan."
      tersedia={[
        "Tabel market_comparables — pembanding pasar beserta tipe dan harganya",
        "business_plans dengan rencana HPP, omzet, biaya operasional, dan cashflow",
        "Biaya perolehan lahan per proyek sebagai dasar studi kelayakan",
      ]}
    />
  );
}
