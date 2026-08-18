import { redirect } from "next/navigation";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { daftarRabEstimasi, kpiEstimasi, proyekUntukEstimasi } from "@/lib/data/estimasi";
import { rpRingkas } from "@/lib/format";
import { BarisKpi } from "@/components/ui";
import { TabelDaftarRab } from "./tabel";

export default async function EstimasiRab() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");
  if (!bolehLihat(pengguna, "hargaRabRap")) redirect("/");

  const bolehKelola = bolehUbah(pengguna, "hargaRabRap");
  const [daftar, kpi, proyek] = await Promise.all([
    daftarRabEstimasi(pengguna),
    kpiEstimasi(pengguna),
    proyekUntukEstimasi(pengguna),
  ]);

  const barisKpi: [string, string][] = [
    ["RAB Estimasi", `${kpi.jumlahRab} dokumen`],
    ["Total Nilai", rpRingkas(kpi.totalNilai)],
    ["Pustaka AHSP", `${kpi.jumlahAnalisa} analisa · ${kpi.jumlahHargaDasar} harga dasar`],
    ["Supplier Aktif", String(kpi.pemasokAktif)],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Master Proyek · Estimasi RAB</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Estimasi RAB (AHSP)</h2>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 0", maxWidth: 720, lineHeight: 1.6 }}>
        Susun anggaran biaya proyek/tender dari pustaka Analisa Harga Satuan Pekerjaan. Pilih pekerjaan,
        isi volume, harga satuan terisi otomatis dari AHSP dan di-snapshot ke RAB.
      </p>

      <BarisKpi kpi={barisKpi} />

      <TabelDaftarRab
        bolehKelola={bolehKelola}
        proyek={proyek}
        data={daftar.map((r) => ({
          id: r.id, nomor: r.nomor, nama: r.nama, status: r.status, tanggal: r.tanggal,
          projectKode: r.project.kode, projectNama: r.project.nama,
          jumlahBaris: r.jumlahBaris, total: r.total,
        }))}
      />
    </div>
  );
}
