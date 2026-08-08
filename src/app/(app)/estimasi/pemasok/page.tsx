import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { pustakaAhsp } from "@/lib/data/estimasi";
import { TabelPemasok } from "../tabel";

export default async function Pemasok() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");
  if (!bolehLihat(pengguna, "hargaRabRap")) redirect("/");

  const bolehKelola = bolehUbah(pengguna, "hargaRabRap");
  const { pemasok } = await pustakaAhsp();

  const pemasokData = pemasok.map((p) => ({
    id: p.id, nama: p.nama, kategori: p.kategori, kontak: p.kontak, alamat: p.alamat,
    status: p.status, jumlahPenawaran: p._count.penawaran,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Link
        href="/estimasi"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Kembali ke Estimasi RAB
      </Link>
      <div className="eyebrow" style={{ marginTop: 8 }}>Master Proyek · Estimasi RAB</div>
      <h2 className="disp" style={{ margin: "4px 0 12px", fontSize: 20 }}>Pemasok</h2>

      <TabelPemasok data={pemasokData} bolehKelola={bolehKelola} />
      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
        Penawaran harga tiap pemasok kini dikelola langsung di{" "}
        <Link href="/estimasi/pustaka" style={{ color: "var(--teal)", fontWeight: 600 }}>Pustaka AHSP</Link>{" "}
        — buka rincian pada baris Harga Dasar.
      </p>
    </div>
  );
}
