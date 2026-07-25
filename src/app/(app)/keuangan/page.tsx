import { Segera } from "@/components/segera";

export default function Keuangan() {
  return (
    <Segera
      judul="Keuangan Proyek"
      keterangan="Realisasi biaya operasional per proyek, unit, dan jenis pengeluaran."
      tersedia={[
        "Tabel expenses — 554 transaksi tersemai, tertaut ke proyek dan unit",
        "Pos HPP pada tiap transaksi, siap dibandingkan dengan business plan",
        "statusSerapan() untuk menandai pengeluaran yang mendahului progres fisik",
      ]}
    />
  );
}
