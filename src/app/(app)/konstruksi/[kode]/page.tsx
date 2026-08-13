import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { isiKonstruksiProyek, proyekKonstruksi, vendorKonstruksiProyek } from "@/lib/data/konstruksi";
import { grupBerjalan } from "@/lib/calc/opname";
import { tanggal } from "@/lib/format";
import { Badge, Terbatas, WARNA_STATUS } from "@/components/ui";
import { RingkasProgress } from "@/components/ringkas-progress";
import { TombolLaporan } from "@/components/laporan-tombol";
import { IsiLaporan, type DataLaporanKonstruksi } from "@/components/laporan-konstruksi";
import { TabelUnitKonstruksi, TabelSarprasKonstruksi, TabelVendorKonstruksi } from "./tabel-konstruksi";

export default async function ProgresProyek({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const kodeProyek = kode.toUpperCase();

  const proyek = await proyekKonstruksi(kodeProyek);
  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  const bolehUnit = bolehLihat(pengguna, "daftarUnit");
  const bolehSarpras = bolehLihat(pengguna, "daftarSarpras");
  const bolehVendor = bolehLihat(pengguna, "progress");
  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");

  // Muat SELURUH unit & sarpras (tanpa saring fase di query): penyaringan &
  // pencarian kini dikerjakan klien lewat PanelTabel, seragam dengan RAB Estimasi.
  const { unit, sarpras } = await isiKonstruksiProyek(proyek.id, {
    fase: "Semua", bolehUnit, bolehSarpras,
  });
  const kontrak = bolehVendor ? await vendorKonstruksiProyek(proyek.id) : [];

  // Baris ramping untuk tabel klien — grup pekerjaan berjalan & progres
  // tertimbang dihitung di server agar payload klien tetap kecil.
  const unitRows = unit.map((u) => ({
    id: u.id, kode: u.kode, nomor: u.nomor, fase: u.phase.kode,
    tipe: u.unitType.nama, progress: u.progress, status: u.statusPembangunan,
    grup: grupBerjalan(u.boqItems),
  }));
  const sarprasRows = sarpras.map((s) => ({
    id: s.id, kode: s.kode, nama: s.nama, jenis: s.jenis, volume: s.volume,
    progress: s.progress, status: s.status,
  }));
  const vendorRows = kontrak.map((c) => ({
    id: c.id, kode: c.kode, vendor: c.vendor.nama, deskripsi: c.deskripsi,
    nominal: c.nominal, objek: c.objek, progres: c.progres,
  }));

  // Data laporan meeting — memuat SELURUH unit & sarpras (bukan hasil saringan),
  // supaya laporan tetap utuh apa pun filter yang sedang aktif di layar.
  const dataLaporan: DataLaporanKonstruksi = {
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
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          gap: 12, flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
          <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>{proyek.nama}</h2>
        </div>
        {(bolehUnit || bolehSarpras) && (
          <TombolLaporan kodeProyek={kodeProyek}>
            <IsiLaporan data={dataLaporan} />
          </TombolLaporan>
        )}
      </div>

      <Link
        href="/konstruksi"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 12 }}
      >
        ← Kembali ke Dashboard Konstruksi
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Badge nilai={proyek.statusLahan} peta={WARNA_STATUS.lahan} />
      </div>

      {/* ---------- ringkasan progress ---------- */}
      {(bolehUnit || bolehSarpras) && (
        <div className="grid grid2" style={{ gap: 12, marginBottom: 16 }}>
          {bolehUnit && (
            <RingkasProgress
              judul="Ringkasan Progress Unit"
              nilai={unit.map((u) => u.progress)}
              satuan="unit"
            />
          )}
          {bolehSarpras && (
            <RingkasProgress
              judul="Ringkasan Progress Sarana & Prasarana"
              nilai={sarpras.map((s) => s.progress)}
              satuan="item"
            />
          )}
        </div>
      )}

      {/* ---------- unit ---------- */}
      {bolehUnit ? (
        <TabelUnitKonstruksi kodeProyek={kodeProyek} data={unitRows} />
      ) : (
        <div className="card" style={{ overflow: "hidden", marginTop: 16, padding: 16 }}>
          <Terbatas apa="Daftar unit" />
        </div>
      )}

      {/* ---------- sarpras ---------- */}
      {bolehSarpras ? (
        <TabelSarprasKonstruksi kodeProyek={kodeProyek} data={sarprasRows} />
      ) : (
        <div className="card" style={{ overflow: "hidden", marginTop: 16, padding: 16 }}>
          <Terbatas apa="Daftar sarana & prasarana" />
        </div>
      )}

      {/* ---------- Progress Vendor ---------- */}
      {bolehVendor && (
        <TabelVendorKonstruksi kodeProyek={kodeProyek} data={vendorRows} bolehHarga={bolehHarga} />
      )}
    </div>
  );
}
