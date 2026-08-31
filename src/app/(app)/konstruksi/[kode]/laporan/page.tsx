import { kodeProyekDari, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { isiKonstruksiProyek, proyekKonstruksi } from "@/lib/data/konstruksi";
import { grupBerjalan } from "@/lib/calc/opname";
import { tanggal } from "@/lib/format";
import { IsiLaporan, type DataLaporanKonstruksi } from "@/components/laporan-konstruksi";
import { TombolCetak } from "@/components/tombol-cetak";

/**
 * Halaman laporan progres konstruksi yang siap dicetak / disimpan PDF.
 *
 * Saat dicetak, hanya blok laporannya yang tampil — kerangka aplikasi (sidebar,
 * tombol) disembunyikan lewat aturan @media print, tanpa menyentuh CSS global.
 */
export default async function LaporanKonstruksi({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const kodeProyek = kodeProyekDari(kode);

  const proyek = await proyekKonstruksi(kodeProyek);
  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  const bolehUnit = bolehLihat(pengguna, "daftarUnit");
  const bolehSarpras = bolehLihat(pengguna, "daftarSarpras");

  const { unit, sarpras } = await isiKonstruksiProyek(proyek.id, {
    fase: "Semua", bolehUnit, bolehSarpras,
  });

  const data: DataLaporanKonstruksi = {
    proyek: { kode: kodeProyek, nama: proyek.nama },
    dicetak: tanggal(new Date()),
    unit: unit.map((u) => ({
      nomor: u.nomor, fase: u.phase.kode, tipe: u.unitType.nama,
      progress: u.progress, grup: grupBerjalan(u.boqItems), status: u.statusPembangunan,
      updateTerakhir: u.progressRecords[0] ? tanggal(u.progressRecords[0].tanggal) : null,
    })),
    sarpras: sarpras.map((s) => ({
      nama: s.nama, jenis: s.jenis, volume: s.volume, progress: s.progress, status: s.status,
    })),
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Isolasi cetak: sembunyikan segalanya kecuali #laporan-cetak. */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print{body *{visibility:hidden}#laporan-cetak,#laporan-cetak *{visibility:visible}" +
            "#laporan-cetak{position:absolute;left:0;top:0;width:100%;padding:0}.tanpa-cetak{display:none}}",
        }}
      />

      <div
        className="tanpa-cetak"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}
      >
        <Link
          href={`/konstruksi/${segmen(kodeProyek)}`}
          style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}
        >
          ← Kembali ke {proyek.nama}
        </Link>
        <TombolCetak />
      </div>

      <div id="laporan-cetak" className="card" style={{ padding: "20px 24px" }}>
        <IsiLaporan data={data} />
      </div>
    </div>
  );
}
