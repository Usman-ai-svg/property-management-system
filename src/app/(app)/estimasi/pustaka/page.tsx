import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { pustakaAhsp } from "@/lib/data/estimasi";
import { rekapAnalisaDb } from "@/lib/tampilan/estimasi";
import type { HargaDasarOpsi } from "../editors";
import { TabelAnalisa, TabelHargaDasar } from "../tabel";

export default async function Pustaka() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");
  if (!bolehLihat(pengguna, "hargaRabRap")) redirect("/");

  const bolehKelola = bolehUbah(pengguna, "hargaRabRap");
  const { analisa, hargaDasar, pemasok } = await pustakaAhsp();

  const hargaDasarOpsi: HargaDasarOpsi[] = hargaDasar.map((h) => ({
    id: h.id, kode: h.kode, kategori: h.kategori, uraian: h.uraian, satuan: h.satuan, hargaAcuan: h.hargaAcuan,
  }));
  const pemasokOpsi = pemasok.map((p) => ({ id: p.id, nama: p.nama }));

  const analisaData = analisa.map((a) => ({
    id: a.id, kode: a.kode, uraian: a.uraian, satuan: a.satuan, kelompok: a.kelompok,
    overheadPct: a.overheadPct, hargaSatuan: rekapAnalisaDb(a).hargaSatuan,
    komponen: a.komponen.map((k) => ({ hargaDasarId: k.hargaDasar.id, koefisien: k.koefisien })),
  }));
  const hargaDasarData = hargaDasar.map((h) => ({
    id: h.id, kode: h.kode, kategori: h.kategori, uraian: h.uraian, satuan: h.satuan,
    hargaAcuan: h.hargaAcuan,
    penawaran: h.penawaran.map((t) => ({
      id: t.id, pemasokNama: t.pemasok.nama, harga: t.harga, keterangan: t.keterangan,
      acuan: t.harga === h.hargaAcuan,
    })),
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
      <h2 className="disp" style={{ margin: "4px 0 12px", fontSize: 20 }}>Pustaka AHSP</h2>

      <TabelAnalisa data={analisaData} bolehKelola={bolehKelola} hargaDasarOpsi={hargaDasarOpsi} />
      <TabelHargaDasar data={hargaDasarData} bolehKelola={bolehKelola} pemasokOpsi={pemasokOpsi} />
    </div>
  );
}
