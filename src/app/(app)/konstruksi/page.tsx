import { Segera } from "@/components/segera";

export default function Konstruksi() {
  return (
    <Segera
      judul="Konstruksi"
      keterangan="Progres pembangunan unit dan laporan opname mingguan."
      tersedia={[
        "Tabel progress_records — riwayat progres per unit, bukan angka tunggal",
        "susunOpname() di src/lib/calc/opname.ts — bobot minggu lalu, penambahan, dan kumulatif",
        "Baris BOQ hasil snapshot per unit sebagai dasar perhitungan bobot",
      ]}
    />
  );
}
