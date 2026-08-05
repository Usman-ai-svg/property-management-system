import { kodeProyekDari, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { sarprasKonstruksi, daftarSarprasKonstruksi } from "@/lib/data/konstruksi";
import { susunOpname } from "@/lib/calc/opname";
import { OpnameBoq } from "@/components/opname-boq";
import { Badge, Terbatas, WARNA_STATUS } from "@/components/ui";
import { TabelMingguan } from "@/components/tabel-mingguan";
import { UbahProgres } from "@/components/ubah-progres";
import { NavObjek } from "@/components/nav-objek";
import { ubahProgresSarpras, simpanOpnameSarpras } from "../../../actions";

export default async function OpnameSarpras({
  params,
}: {
  params: Promise<{ kode: string; kodeSarpras: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, kodeSarpras } = await params;
  const kodeProyek = kodeProyekDari(kode);

  const item = await sarprasKonstruksi(kodeSarpras);

  if (!item || item.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, item.projectId)) notFound();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehProgres = bolehLihat(pengguna, "progress");
  const ubahProgres = bolehUbah(pengguna, "progress");

  // Sama seperti unit: progres yang dirinci lewat BOQ Master tidak boleh
  // ditimpa manual karena akan tertulis ulang saat opname berikutnya.
  const dariBoq = item.boqItems.length > 0;

  if (!bolehProgres) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/konstruksi/${segmen(kodeProyek)}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← {item.project.nama}
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Rincian progress konstruksi" />
        </div>
      </div>
    );
  }

  const baris = susunOpname(item.boqItems);

  const daftarSarpras = await daftarSarprasKonstruksi(item.projectId);
  const opsiSarpras = daftarSarpras.map((s) => ({
    kode: s.kode,
    label: `${s.nama} · ${s.jenis}`,
  }));

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>
        Detail Progress Sarana &amp; Prasarana
      </h2>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/konstruksi" style={{ color: "inherit", textDecoration: "none" }}>Konstruksi</Link>
        {" / "}
        <Link href={`/konstruksi/${segmen(kodeProyek)}`} style={{ color: "inherit", textDecoration: "none" }}>
          {item.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>{item.nama}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <NavObjek
          basis={`/konstruksi/${kodeProyek}/sarpras`}
          sekarang={item.kode}
          daftar={opsiSarpras}
          ariaLabel="Pilih sarana & prasarana"
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
            {item.jenis} · volume {item.volume}
          </div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>{item.nama}</h3>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge nilai={item.status} peta={WARNA_STATUS.bangun} />
          {ubahProgres && !dariBoq && (
            <UbahProgres id={item.id} nilai={item.progress} aksi={ubahProgresSarpras} />
          )}
          {dariBoq && (
            <span
              className="chip"
              title="Progres dihitung dari baris BOQ Master Proyek, tertimbang nilai tiap pekerjaan"
              style={{ background: "var(--rona-teal2)", color: "var(--teal)" }}
            >
              {item.progress}% · dari opname BOQ
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
        Progres diisi per baris pekerjaan pada BOQ Master Proyek, mencakup seluruh
        lingkup item ini. Pekerjaan yang dikontrakkan ke vendor punya opname sendiri
        di halaman SPK-nya, dan tidak otomatis mengisi angka di sini.
      </div>

      <OpnameBoq
        aksi={simpanOpnameSarpras}
        namaId="sarprasId"
        nilaiId={item.id}
        baris={item.boqItems}
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
