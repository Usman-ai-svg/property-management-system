import { Segera } from "@/components/segera";

export default function Equipment() {
  return (
    <Segera
      judul="Equipment & Asset"
      keterangan="Peralatan proyek, kepemilikan, penempatan, dan jadwal servis."
      tersedia={[
        "Tabel equipments — 15 aset tersemai, milik sendiri maupun sewa",
        "Tautan ke vendor penyewa dan proyek tempat aset ditempatkan",
        "Tanggal servis terakhir dan berikutnya untuk pengingat pemeliharaan",
      ]}
    />
  );
}
