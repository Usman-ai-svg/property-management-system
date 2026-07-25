import { Segera } from "@/components/segera";

export default function Vendor() {
  return (
    <Segera
      judul="Vendor Management"
      keterangan="Kontrak, tender, progres pekerjaan, dan pembayaran vendor."
      tersedia={[
        "Tabel contracts dengan variation_orders dan contract_payments",
        "ringkasKontrak() — nilai efektif setelah VO, retensi, dan sisa tagihan",
        "alokasiKontrak() — pembagian nilai kontrak per unit, termasuk override unit sudut",
      ]}
    />
  );
}
