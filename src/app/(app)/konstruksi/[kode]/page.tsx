import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { isiKonstruksiProyek, proyekKonstruksi } from "@/lib/data/konstruksi";
import { keteranganPekerjaan } from "@/lib/calc/opname";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { FilterKonstruksi } from "./filter";
import { Tabel } from "@/components/kartu-tabel";

export default async function ProgresProyek({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<{ fase?: string; cari?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const { fase = "Semua", cari = "" } = await searchParams;
  const kodeProyek = kode.toUpperCase();

  const proyek = await proyekKonstruksi(kodeProyek);
  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  const bolehUnit = bolehLihat(pengguna, "daftarUnit");
  const bolehSarpras = bolehLihat(pengguna, "daftarSarpras");

  const { unit, sarpras } = await isiKonstruksiProyek(proyek.id, {
    fase, bolehUnit, bolehSarpras,
  });

  // Pencarian dilakukan di sini, bukan di database, karena yang dicari adalah
  // gabungan "F2-3 Galileo" yang tidak tersimpan sebagai satu kolom.
  const kunci = cari.trim().toLowerCase();
  const unitTampil = kunci
    ? unit.filter((u) =>
        `${u.phase.kode}-${u.nomor} ${u.unitType.nama}`.toLowerCase().includes(kunci),
      )
    : unit;


  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>{proyek.nama}</h2>

      <Link
        href="/konstruksi"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 12 }}
      >
        ← Kembali ke Dashboard Konstruksi
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Badge nilai={proyek.statusLahan} peta={WARNA_STATUS.lahan} />
      </div>

      <FilterKonstruksi
        fases={proyek.fases.map((f) => f.kode)}
        faseAktif={fase}
        cariAwal={cari}
      />

      {/* ---------- unit ---------- */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <TabelHead
          judul={`Tabel Progress Unit · ${unitTampil.length} unit`}
          keterangan="Klik nomor unit untuk membuka rincian mingguan."
        />
        {!bolehUnit ? (
          <div style={{ padding: 16 }}>
            <Terbatas apa="Daftar unit" />
          </div>
        ) : (
          <Tabel
            tinggiMaks={340}
            kolom={[
              { label: "Unit" },
              { label: "Fase" },
              { label: "Tipe" },
              { label: "Progress s.d. Minggu Ini", minLebar: 190 },
              { label: "Keterangan Pekerjaan" },
              { label: "Status" },
            ]}
            kosong="Tidak ada unit yang cocok dengan saringan ini."
          >
            {unitTampil.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link
                    href={`/konstruksi/${kodeProyek}/unit/${u.kode}`}
                    style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
                  >
                    {u.nomor}
                  </Link>
                </td>
                <td>{u.phase.kode}</td>
                <td>{u.unitType.nama}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Track
                      nilai={u.progress}
                      tinggi={9}
                      warna={u.progress === 100 ? "var(--green)" : "var(--teal)"}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>{u.progress}%</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {keteranganPekerjaan(u.progress).map((k) => (
                      <span key={k} className="chip" style={{ background: "var(--rona-teal)", color: "var(--teal)" }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <Badge nilai={u.statusPembangunan} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            ))}
          </Tabel>
        )}
      </div>

      {/* ---------- sarpras ---------- */}
      <div className="card" style={{ overflow: "hidden" }}>
        <TabelHead
          judul={`Tabel Progress Sarana & Prasarana · ${sarpras.length} item`}
          keterangan="Klik nama item untuk membuka rincian mingguan."
        />
        {!bolehSarpras ? (
          <div style={{ padding: 16 }}>
            <Terbatas apa="Daftar sarana & prasarana" />
          </div>
        ) : (
          <Tabel
            kolom={[
              { label: "Item" },
              { label: "Jenis" },
              { label: "Volume" },
              { label: "Progress s.d. Minggu Ini", minLebar: 190 },
              { label: "Status" },
            ]}
            kosong="Belum ada item sarana &amp; prasarana di proyek ini."
          >
            {sarpras.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link
                    href={`/konstruksi/${kodeProyek}/sarpras/${s.kode}`}
                    style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
                  >
                    {s.nama}
                  </Link>
                </td>
                <td style={{ color: "var(--muted)" }}>{s.jenis}</td>
                <td>{s.volume}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Track
                      nilai={s.progress}
                      tinggi={9}
                      warna={s.progress === 100 ? "var(--green)" : "var(--brass)"}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>{s.progress}%</span>
                  </div>
                </td>
                <td>
                  <Badge nilai={s.status} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            ))}
          </Tabel>
        )}
      </div>
    </div>
  );
}
