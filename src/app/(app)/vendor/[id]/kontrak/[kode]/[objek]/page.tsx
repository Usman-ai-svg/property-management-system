import { bacaSegmen, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { kontrakDetail, petaOverrideBoq } from "@/lib/data/vendor";
import { barisEfektif, progresTertimbang } from "@/lib/calc/kontrak-boq";
import { rp } from "@/lib/format";
import { Tabel } from "@/components/kartu-tabel";
import { NavObjek } from "@/components/nav-objek";
import { Terbatas } from "@/components/ui";
import { SamakanKeTemplate, SesuaikanBaris } from "../editors-boq";

/**
 * Detail satu OBJEK (unit/sarpras) dalam sebuah SPK — rincian pekerjaan (BOQ)
 * efektif objek itu: nilai mengikuti template SPK, dan bisa DISESUAIKAN per
 * objek. Tanpa kolom objek karena laman ini sudah dalam konteks satu objek.
 *
 * Opname progres vendor per objek TIDAK di sini — diisi di modul Konstruksi.
 */
export default async function DetailObjekSpk({
  params,
}: {
  params: Promise<{ id: string; kode: string; objek: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  if (!bolehLihat(pengguna, "progress")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Kontrak vendor" />
      </div>
    );
  }

  const { id: vendorId, kode, objek } = await params;
  const kontrak = await kontrakDetail(kode);
  if (!kontrak) notFound();
  if (!bolehAksesProyek(pengguna, kontrak.projectId)) notFound();
  if (kontrak.vendor.id !== vendorId) notFound();

  // objek = "unit_<id>" | "sarpras_<id>" — pisah pada pemisah pertama.
  const pisah = bacaSegmen(objek).indexOf("_");
  const jenis = pisah >= 0 ? bacaSegmen(objek).slice(0, pisah) : "";
  const objekId = pisah >= 0 ? bacaSegmen(objek).slice(pisah + 1) : "";

  const unit = jenis === "unit" ? kontrak.units.find(({ unit }) => unit.id === objekId)?.unit : undefined;
  const sarpras =
    jenis === "sarpras" ? kontrak.infrastructures.find(({ infrastructure }) => infrastructure.id === objekId)?.infrastructure : undefined;
  if (!unit && !sarpras) notFound();

  const label = unit ? `Unit ${unit.phase.kode}-${unit.nomor}` : sarpras!.nama;
  const keterangan = unit ? unit.unitType.nama : sarpras!.jenis;
  const tujuan = `${jenis}:${objekId}`; // format aksi override

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahBoq = bolehUbah(pengguna, "progress");

  // Baris efektif + override mentahnya (untuk prefill editor).
  const peta = petaOverrideBoq(kontrak.boqUnit);
  const baris = kontrak.boqItems.map((t) => {
    const o = peta.get(`${t.id}:${objekId}`);
    return { template: t, override: o ?? null, efektif: barisEfektif(t, o) };
  });
  const adaBoq = baris.length > 0;
  const nilai = baris.reduce((s, b) => s + b.efektif.volume * b.efektif.hargaSatuan, 0);
  const progres = adaBoq ? progresTertimbang(baris.map((b) => b.efektif)) : 0;

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
      <div className="eyebrow">Vendor Management · Detail SPK · Objek</div>
      <h2 className="disp" style={{ margin: "4px 0 4px", fontSize: 20 }}>{label}</h2>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        {keterangan} · SPK {kontrak.kode} · {kontrak.vendor.nama}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
        <Link href={`/vendor/${kontrak.vendor.id}`} style={{ color: "inherit", textDecoration: "none" }}>
          {kontrak.vendor.nama}
        </Link>
        {" / "}
        <Link
          href={`/vendor/${kontrak.vendor.id}/kontrak/${encodeURIComponent(kontrak.kode)}`}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {kontrak.kode}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>{label}</b>
      </div>

      {opsiObjek.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <NavObjek
            basis={`/vendor/${kontrak.vendor.id}/kontrak/${encodeURIComponent(kontrak.kode)}`}
            sekarang={`${jenis}_${objekId}`}
            daftar={opsiObjek}
            ariaLabel="Pilih objek dalam SPK"
          />
        </div>
      )}

      <div
        className="card"
        style={{ padding: "12px 16px", marginBottom: 12, background: "var(--rona-panel)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}
      >
        BOQ di bawah mengikuti <b>template SPK</b>; ubah baris untuk objek ini bila
        nilainya berbeda ({bolehHarga ? "volume/harga" : "volume"}/uraian). Opname
        progres vendor diisi di{" "}
        <Link
          href={`/konstruksi/${segmen(kontrak.project.kode)}/vendor/${encodeURIComponent(kontrak.kode)}/${jenis}_${objekId}`}
          style={{ color: "var(--teal)", fontWeight: 600 }}
        >
          Konstruksi › Progress Vendor
        </Link>
        {adaBoq ? ` · progres objek ini ${progres}%` : ""}.
      </div>

      {!adaBoq ? (
        <div className="card" style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          Template BOQ SPK ini masih kosong. Susun dulu barisnya di{" "}
          <Link
            href={`/vendor/${kontrak.vendor.id}/kontrak/${encodeURIComponent(kontrak.kode)}`}
            style={{ color: "var(--teal)", fontWeight: 600 }}
          >
            Detail SPK
          </Link>
          .
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <Tabel
            tinggiMaks={460}
            kolom={[
              { label: "Grup" },
              { label: "Uraian" },
              { label: "Volume", rata: "kanan" },
              { label: "Satuan" },
              bolehHarga && { label: "Harga Satuan", rata: "kanan" },
              bolehHarga && { label: "Nilai", rata: "kanan" },
              bolehUbahBoq && { lebar: 110 },
            ]}
          >
            {baris.map((b) => {
              const e = b.efektif;
              return (
                <tr key={b.template.id} style={e.disesuaikan ? { background: "var(--rona-teal)" } : undefined}>
                  <td style={{ color: "var(--muted)", fontSize: 11 }}>{e.grup}</td>
                  <td>
                    {e.uraian}
                    {e.disesuaikan && (
                      <span className="chip" style={{ marginLeft: 6, background: "var(--rona-teal2)", color: "var(--teal)" }}>
                        disesuaikan
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>{e.volume.toLocaleString("id-ID")}</td>
                  <td style={{ color: "var(--muted)" }}>{e.satuan}</td>
                  {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(e.hargaSatuan)}</td>}
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(e.volume * e.hargaSatuan)}</td>
                  )}
                  {bolehUbahBoq && (
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                        <SesuaikanBaris
                          boqItemId={b.template.id}
                          objek={tujuan}
                          template={b.template}
                          override={b.override}
                        />
                        {e.disesuaikan && <SamakanKeTemplate boqItemId={b.template.id} objek={tujuan} />}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {bolehHarga && (
              <tr style={{ borderTop: "2px solid var(--line)", fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: "right" }}>Nilai BOQ objek</td>
                <td />
                <td className="num" style={{ textAlign: "right" }}>{rp(nilai)}</td>
                {bolehUbahBoq && <td />}
              </tr>
            )}
          </Tabel>
        </div>
      )}
    </div>
  );
}
