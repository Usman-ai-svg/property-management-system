import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { kontrakDetail } from "@/lib/data/vendor";
import { susunOpname } from "@/lib/calc/opname";
import { Terbatas } from "@/components/ui";
import { TabelOpnameSpk, type ObjekOpname } from "@/components/opname-spk";
import { TabelMingguan } from "@/components/tabel-mingguan";
import { NavObjek } from "@/components/nav-objek";
import { simpanProgresBoqSpk } from "../../../../../vendor/boq-actions";

/**
 * Progress Vendor — tingkat 3: tabel opname BOQ kontrak untuk satu objek
 * (unit/sarpras) yang dicakup SPK. Di sinilah QS mengisi progress vendor.
 *
 * Menyimpan memakai aksi yang sama dengan sebelumnya (`simpanProgresBoqSpk`);
 * ia hanya menyentuh `ContractBoqItem`, tidak mengubah Progress Konstruksi unit.
 */
export default async function OpnameVendorKonstruksi({
  params,
}: {
  params: Promise<{ kode: string; kontrakKode: string; objek: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, kontrakKode, objek } = await params;
  const kodeProyek = kode.toUpperCase();

  if (!bolehLihat(pengguna, "progress")) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/konstruksi/${kodeProyek}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Konstruksi
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Progress vendor" />
        </div>
      </div>
    );
  }

  const kontrak = await kontrakDetail(kontrakKode);
  if (!kontrak) notFound();
  if (!bolehAksesProyek(pengguna, kontrak.projectId)) notFound();
  if (kontrak.project.kode !== kodeProyek) notFound();

  // objek = "unit_<id>" | "sarpras_<id>" — pisah pada pemisah pertama.
  const pisah = decodeURIComponent(objek).indexOf("_");
  const jenis = pisah >= 0 ? decodeURIComponent(objek).slice(0, pisah) : "";
  const objekId = pisah >= 0 ? decodeURIComponent(objek).slice(pisah + 1) : "";

  const unit = jenis === "unit" ? kontrak.units.find(({ unit }) => unit.id === objekId)?.unit : undefined;
  const sarpras =
    jenis === "sarpras" ? kontrak.infrastructures.find(({ infrastructure }) => infrastructure.id === objekId)?.infrastructure : undefined;

  if (!unit && !sarpras) notFound();

  const label = unit ? `Unit ${unit.phase.kode}-${unit.nomor}` : sarpras!.nama;
  const keterangan = unit ? unit.unitType.nama : sarpras!.jenis;
  const baris = kontrak.boqItems.filter((b) =>
    unit ? b.unitId === unit.id : b.infrastructureId === sarpras!.id,
  );

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahProgres = bolehUbah(pengguna, "progress");

  const untukOpname: ObjekOpname[] = [
    {
      kunci: `${jenis}:${objekId}`,
      label,
      keterangan,
      baris: baris.map((b) => ({
        id: b.id, grup: b.grup, uraian: b.uraian, satuan: b.satuan,
        volume: b.volume, hargaSatuan: b.hargaSatuan, progress: b.progress,
      })),
    },
  ];

  // Laporan opname mingguan untuk objek ini (Progress Vendor), memakai
  // `progressLalu` yang digeser dengan aturan hari-kerja yang sama.
  const barisMingguan = susunOpname(
    baris.map((b) => ({
      grup: b.grup, uraian: b.uraian, satuan: b.satuan,
      volume: b.volume, hargaSatuan: b.hargaSatuan,
      progress: b.progress, progressLalu: b.progressLalu,
    })),
  );

  // Navigasi antar-objek dalam SPK ini (analog Detail Unit).
  const opsiObjek = [
    ...kontrak.units.map(({ unit: u }) => ({
      kode: `unit_${u.id}`,
      label: `Unit ${u.phase.kode}-${u.nomor} · ${u.unitType.nama}`,
    })),
    ...kontrak.infrastructures.map(({ infrastructure: s }) => ({
      kode: `sarpras_${s.id}`,
      label: `${s.nama} · ${s.jenis}`,
    })),
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi · Progress Vendor</div>
      <h2 className="disp" style={{ margin: "4px 0 4px", fontSize: 20 }}>{label}</h2>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        {keterangan} · SPK {kontrak.kode} · {kontrak.vendor.nama}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
        <Link href="/konstruksi" style={{ color: "inherit", textDecoration: "none" }}>Konstruksi</Link>
        {" / "}
        <Link href={`/konstruksi/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {kontrak.project.nama}
        </Link>
        {" / "}
        <Link href={`/konstruksi/${kodeProyek}/vendor/${encodeURIComponent(kontrak.kode)}`} style={{ color: "inherit", textDecoration: "none" }}>
          {kontrak.kode}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>{label}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <NavObjek
          basis={`/konstruksi/${kodeProyek}/vendor/${encodeURIComponent(kontrak.kode)}`}
          sekarang={`${jenis}_${objekId}`}
          daftar={opsiObjek}
          ariaLabel="Pilih objek dalam SPK"
        />
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
        Isi persentase tiap baris pekerjaan SPK, lalu simpan sekali. Ini{" "}
        <b>Progress Vendor</b> — lingkup satu SPK, terpisah dari Progress Konstruksi unit.
      </div>

      {baris.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          Objek ini belum punya baris BOQ pada SPK tersebut. Rinci dulu BOQ-nya di
          laman SPK (modul Vendor) sebelum bisa diopname di sini.
        </div>
      ) : (
        <>
          <TabelOpnameSpk
            aksi={simpanProgresBoqSpk}
            contractId={kontrak.id}
            objek={untukOpname}
            bolehUbah={bolehUbahProgres}
            bolehHarga={bolehHarga}
          />

          <div className="sectitle">Laporan opname mingguan</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
            Kolom &ldquo;minggu lalu&rdquo; adalah capaian tiap baris pada opname minggu
            sebelumnya. Ia hanya bergeser bila opname berikutnya berjarak minimal satu
            minggu kerja (5 hari kerja, Senin&ndash;Sabtu) — koreksi dalam minggu yang
            sama tidak mengubahnya.
          </div>
          <TabelMingguan baris={barisMingguan} bolehHarga={bolehHarga} />
        </>
      )}
    </div>
  );
}
