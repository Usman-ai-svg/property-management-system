import { kodeProyekDari, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { unitKonstruksi, daftarUnitKonstruksi } from "@/lib/data/konstruksi";
import { susunOpname } from "@/lib/calc/opname";
import { tanggal } from "@/lib/format";
import { OpnameBoq } from "@/components/opname-boq";
import { Badge, Terbatas, WARNA_STATUS } from "@/components/ui";
import { TabelMingguan } from "@/components/tabel-mingguan";
import { UbahProgres } from "@/components/ubah-progres";
import { NavObjek } from "@/components/nav-objek";
import { ubahProgresUnit, simpanOpnameUnit } from "../../../actions";

export default async function OpnameUnit({
  params,
}: {
  params: Promise<{ kode: string; unitKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, unitKode } = await params;
  const kodeProyek = kodeProyekDari(kode);

  const unit = await unitKonstruksi(unitKode);

  if (!unit || unit.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, unit.projectId)) notFound();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehProgres = bolehLihat(pengguna, "progress");
  const ubahProgres = bolehUbah(pengguna, "progress");

  // Progres yang sudah dirinci lewat BOQ Master adalah nilai turunan.
  // Menimpanya manual hanya bertahan sampai opname berikutnya, jadi tombol
  // satu-angka ditiadakan dan digantikan tabel opname per baris di bawah.
  const dariBoq = unit.boqItems.length > 0;

  if (!bolehProgres) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/konstruksi/${segmen(kodeProyek)}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← {unit.project.nama}
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Rincian progress konstruksi" />
        </div>
      </div>
    );
  }

  const baris = susunOpname(unit.boqItems);

  // Navigasi antar unit + catatan opname terakhir (untuk melacak kapan unit
  // terakhir diperbarui, mis. saat pembangunannya sempat dihentikan).
  const daftarUnit = await daftarUnitKonstruksi(unit.projectId);
  const opsiUnit = daftarUnit.map((d) => ({
    kode: d.kode,
    label: `${d.phase.kode}-${d.nomor} · ${d.unitType.nama}`,
  }));
  const rekamTerakhir = unit.progressRecords[0] ?? null;

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>Detail Progress Unit</h2>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/konstruksi" style={{ color: "inherit", textDecoration: "none" }}>Konstruksi</Link>
        {" / "}
        <Link href={`/konstruksi/${segmen(kodeProyek)}`} style={{ color: "inherit", textDecoration: "none" }}>
          {unit.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>Unit {unit.nomor}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <NavObjek
          basis={`/konstruksi/${segmen(kodeProyek)}/unit`}
          sekarang={unit.kode}
          daftar={opsiUnit}
          ariaLabel="Pilih unit"
        />
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 14,
        }}
      >
        <div>
          <div className="eyebrow">
            Fase {unit.phase.kode} · {unit.unitType.nama}
          </div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>Unit {unit.nomor}</h3>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {rekamTerakhir
              ? `Update terakhir: ${tanggal(rekamTerakhir.tanggal)}${rekamTerakhir.dicatatOleh ? ` · oleh ${rekamTerakhir.dicatatOleh}` : ""}`
              : "Belum ada catatan progres"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
          {ubahProgres && !dariBoq && (
            <UbahProgres id={unit.id} nilai={unit.progress} aksi={ubahProgresUnit} />
          )}
          {dariBoq && (
            <span
              className="chip"
              title="Progres dihitung dari baris BOQ Master Proyek, tertimbang nilai tiap pekerjaan"
              style={{ background: "var(--rona-teal2)", color: "var(--teal)" }}
            >
              {unit.progress}% · dari opname BOQ
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6,
        }}
      >
        Progres diisi per baris pekerjaan pada BOQ Master Proyek, mencakup seluruh
        lingkup unit — struktur, arsitektur, MEP, hingga subkon. Pekerjaan yang
        dikontrakkan ke vendor punya opname sendiri di halaman SPK-nya, dan tidak
        otomatis mengisi angka di sini.
      </div>

      <OpnameBoq
        aksi={simpanOpnameUnit}
        namaId="unitId"
        nilaiId={unit.id}
        baris={unit.boqItems}
        bolehUbah={ubahProgres}
        bolehHarga={bolehHarga}
      />

      <div className="sectitle">Laporan opname mingguan</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
        Kolom &ldquo;minggu lalu&rdquo; adalah capaian tiap baris pada opname minggu
        sebelumnya. Ia hanya bergeser bila opname berikutnya berjarak minimal satu
        minggu kerja (5 hari kerja, Senin&ndash;Sabtu) — koreksi dalam minggu yang
        sama tidak mengubahnya.
      </div>

      <TabelMingguan baris={baris} bolehHarga={bolehHarga} />
    </div>
  );
}
