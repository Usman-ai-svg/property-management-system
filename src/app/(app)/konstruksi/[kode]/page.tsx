import { kodeProyekDari, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { isiKonstruksiProyek, proyekKonstruksi, vendorKonstruksiProyek } from "@/lib/data/konstruksi";
import { grupBerjalan } from "@/lib/calc/opname";
import { progresTertimbang } from "@/lib/calc/kontrak-boq";
import { rp, tanggal } from "@/lib/format";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { RingkasProgress } from "@/components/ringkas-progress";
import { TombolLaporan } from "@/components/laporan-tombol";
import { IsiLaporan, type DataLaporanKonstruksi } from "@/components/laporan-konstruksi";
import { FilterKonstruksi } from "./filter";

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
  const kodeProyek = kodeProyekDari(kode);

  const proyek = await proyekKonstruksi(kodeProyek);
  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  const bolehUnit = bolehLihat(pengguna, "daftarUnit");
  const bolehSarpras = bolehLihat(pengguna, "daftarSarpras");
  const bolehVendor = bolehLihat(pengguna, "progress");
  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");

  const { unit, sarpras } = await isiKonstruksiProyek(proyek.id, {
    fase, bolehUnit, bolehSarpras,
  });
  const kontrak = bolehVendor ? await vendorKonstruksiProyek(proyek.id) : [];

  // Pencarian dilakukan di sini, bukan di database, karena yang dicari adalah
  // gabungan "F2-3 Galileo" yang tidak tersimpan sebagai satu kolom.
  const kunci = cari.trim().toLowerCase();
  const unitTampil = kunci
    ? unit.filter((u) =>
        `${u.phase.kode}-${u.nomor} ${u.unitType.nama}`.toLowerCase().includes(kunci),
      )
    : unit;

  // Data laporan meeting — memuat SELURUH unit (bukan hasil saringan), supaya
  // laporan tetap utuh apa pun filter yang sedang aktif di layar.
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

      <FilterKonstruksi
        fases={proyek.fases.map((f) => f.kode)}
        faseAktif={fase}
        cariAwal={cari}
      />

      {/* ---------- unit ---------- */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <TabelHead
          judul={`Progress Unit · ${unitTampil.length} unit`}
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
            {unitTampil.map((u) => {
              const grup = grupBerjalan(u.boqItems);
              return (
                <tr key={u.id}>
                  <td>
                    <Link
                      href={`/konstruksi/${segmen(kodeProyek)}/unit/${segmen(u.kode)}`}
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
                    {grup.length === 0 ? (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    ) : (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {grup.map((k) => (
                          <span key={k} className="chip" style={{ background: "var(--rona-teal)", color: "var(--teal)" }}>
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge nilai={u.statusPembangunan} peta={WARNA_STATUS.bangun} />
                  </td>
                </tr>
              );
            })}
          </Tabel>
        )}
      </div>

      {/* ---------- sarpras ---------- */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <TabelHead
          judul={`Sarana & Prasarana · ${sarpras.length} item`}
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
                    href={`/konstruksi/${segmen(kodeProyek)}/sarpras/${segmen(s.kode)}`}
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

      {/* ---------- Progress Vendor ---------- */}
      {bolehVendor && (
        <div className="card" style={{ overflow: "hidden" }}>
          <TabelHead
            judul={`Progress Vendor · ${kontrak.length} SPK`}
            keterangan="Capaian per SPK dari BOQ kontrak (lingkup vendor, terpisah dari Progress Konstruksi). Klik untuk membuka objek & opname-nya."
          />
          <Tabel
            kolom={[
              { label: "SPK" },
              { label: "Vendor" },
              { label: "Pekerjaan" },
              bolehHarga && { label: "Nilai", rata: "kanan" },
              { label: "Objek", rata: "kanan" },
              { label: "Progress Vendor", minLebar: 190 },
            ]}
            kosong="Belum ada SPK vendor pada proyek ini."
          >
            {kontrak.map((c) => {
              const progres = c.boqItems.length ? progresTertimbang(c.boqItems) : 0;
              const jumlahObjek = c._count.units + c._count.infrastructures;
              return (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/konstruksi/${segmen(kodeProyek)}/vendor/${segmen(c.kode)}`}
                      style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
                    >
                      {c.kode}
                    </Link>
                  </td>
                  <td>{c.vendor.nama}</td>
                  <td style={{ color: "var(--muted)" }}>{c.deskripsi}</td>
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(c.nominal)}</td>
                  )}
                  <td style={{ textAlign: "right" }}>{jumlahObjek}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Track
                        nilai={progres}
                        tinggi={9}
                        warna={progres === 100 ? "var(--green)" : "var(--brass)"}
                      />
                      <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>{progres}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabel>
        </div>
      )}
    </div>
  );
}
