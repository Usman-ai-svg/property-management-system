import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { kontrakDetail, petaOverrideBoq } from "@/lib/data/vendor";
import { barisEfektif, nilaiTerpasang, progresTertimbang } from "@/lib/calc/kontrak-boq";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { rp } from "@/lib/format";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { RingkasOpname } from "@/components/opname-spk";

/**
 * Progress Vendor — tingkat 2: daftar unit & sarpras yang dicakup sebuah SPK,
 * masing-masing dengan capaian tertimbang dari BOQ kontraknya. Klik sebuah
 * objek untuk membuka tabel opname-nya.
 *
 * Data kontrak berasal dari modul Vendor, tetapi progress-nya dikelola di sini
 * (Konstruksi) sesuai penataan modul.
 */
export default async function ObjekVendorKonstruksi({
  params,
}: {
  params: Promise<{ kode: string; kontrakKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, kontrakKode } = await params;
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

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");

  const ringkas = ringkasKontrak(kontrak);

  // Baris efektif tiap objek = template SPK ⊕ override objeknya.
  const peta = petaOverrideBoq(kontrak.boqUnit);
  const efektifObjek = (objId: string) =>
    kontrak.boqItems.map((t) => barisEfektif(t, peta.get(`${t.id}:${objId}`)));

  const objekUnit = kontrak.units.map(({ unit }) => ({
    jenis: "unit" as const,
    id: unit.id,
    // Dipecah menjadi kolom Unit + Fase, mengikuti tabel Daftar Unit.
    unit: String(unit.nomor),
    fase: unit.phase.kode,
    keterangan: unit.unitType.nama,
    progresTersimpan: unit.progress,
    status: unit.statusPembangunan,
    baris: efektifObjek(unit.id),
  }));
  const objekSarpras = kontrak.infrastructures.map(({ infrastructure: s }) => ({
    jenis: "sarpras" as const,
    id: s.id,
    unit: s.nama,
    fase: "—",
    keterangan: s.jenis,
    progresTersimpan: s.progress,
    status: s.status,
    baris: efektifObjek(s.id),
  }));
  const semuaObjek = [...objekUnit, ...objekSarpras];
  const semuaBaris = semuaObjek.flatMap((o) => o.baris);
  const nilaiBoq = semuaBaris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
  const terpasang = nilaiTerpasang(semuaBaris);

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi · Progress Vendor</div>
      <h2 className="disp" style={{ margin: "4px 0 4px", fontSize: 20 }}>{kontrak.kode}</h2>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        {kontrak.deskripsi} · {kontrak.vendor.nama} · {kontrak.project.nama}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
        <Link href="/konstruksi" style={{ color: "inherit", textDecoration: "none" }}>Konstruksi</Link>
        {" / "}
        <Link href={`/konstruksi/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {kontrak.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>{kontrak.kode}</b>
      </div>

      <RingkasOpname
        nilaiKontrak={ringkas.nilaiEfektif}
        nilaiBoq={nilaiBoq}
        terpasang={terpasang}
        bolehHarga={bolehHarga}
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <TabelHead
          judul={`Objek dalam SPK · ${semuaObjek.length}`}
          keterangan="Klik objek untuk membuka & mengisi opname BOQ kontraknya."
        />
        <Tabel
          kolom={[
            { label: "Unit" },
            { label: "Fase" },
            { label: "Jenis" },
            { label: "Baris BOQ", rata: "kanan" },
            bolehHarga && { label: "Nilai BOQ", rata: "kanan" },
            { label: "Progress Vendor", minLebar: 190 },
            { label: "Status" },
          ]}
          kosong="SPK ini belum mencakup unit atau sarana & prasarana mana pun."
        >
          {semuaObjek.map((o) => {
            const nilai = o.baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
            const progres = o.baris.length ? progresTertimbang(o.baris) : o.progresTersimpan;
            return (
              <tr key={`${o.jenis}_${o.id}`}>
                <td>
                  <Link
                    href={`/konstruksi/${kodeProyek}/vendor/${encodeURIComponent(kontrak.kode)}/${o.jenis}_${o.id}`}
                    style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                  >
                    {o.unit}
                  </Link>
                </td>
                <td>{o.fase}</td>
                <td style={{ color: "var(--muted)" }}>{o.keterangan}</td>
                <td style={{ textAlign: "right" }}>
                  {o.baris.length || <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                {bolehHarga && (
                  <td className="num" style={{ textAlign: "right" }}>
                    {nilai ? rp(nilai) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                )}
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Track nilai={progres} tinggi={9} warna={progres === 100 ? "var(--green)" : "var(--brass)"} />
                    <span style={{ fontSize: 10.5, color: "var(--muted)", width: 32 }}>{progres}%</span>
                  </div>
                  {o.baris.length === 0 && (
                    <div style={{ fontSize: 10, color: "var(--amber)" }}>
                      belum dirinci — masih memakai progres manual
                    </div>
                  )}
                </td>
                <td>
                  <Badge nilai={o.status} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            );
          })}
        </Tabel>
      </div>
    </div>
  );
}
