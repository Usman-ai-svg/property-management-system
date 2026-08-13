import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { kontrakDetail, petaOverrideBoq } from "@/lib/data/vendor";
import { barisEfektif, nilaiTerpasang, progresTertimbang } from "@/lib/calc/kontrak-boq";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp, tanggal } from "@/lib/format";
import { Tabel } from "@/components/kartu-tabel";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../../../../master/actions";
import { Badge, Kartu, Petunjuk, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { RingkasOpname } from "@/components/opname-spk";
import { HapusBarisBoq, ImporBoqSpk, TambahBarisBoq, UbahBarisBoq } from "./editors-boq";

/**
 * Detail satu SPK — ringkasan kontrak.
 *
 * Deskripsi SPK (identitas & nilai) + Dokumen + capaian + daftar objek yang
 * dicakup, serta TEMPLATE BOQ level-SPK ("satu BOQ berlaku untuk tiap unit").
 * Rincian pekerjaan per objek (nilai efektif + penyesuaian) dibuka di laman
 * detail per objek; opname progres tetap diisi di modul Konstruksi.
 */
export default async function DetailKontrak({
  params,
}: {
  params: Promise<{ id: string; kode: string }>;
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

  const { id: vendorId, kode } = await params;
  const kontrak = await kontrakDetail(kode);

  if (!kontrak) notFound();
  if (!bolehAksesProyek(pengguna, kontrak.projectId)) notFound();
  if (kontrak.vendor.id !== vendorId) notFound();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahProgres = bolehUbah(pengguna, "progress");

  const ringkas = ringkasKontrak(kontrak);

  // Baris efektif tiap objek = template SPK ⊕ override objeknya.
  const peta = petaOverrideBoq(kontrak.boqUnit);
  const efektifObjek = (objId: string) =>
    kontrak.boqItems.map((t) => barisEfektif(t, peta.get(`${t.id}:${objId}`)));

  const objekUnit = kontrak.units.map(({ unit }) => ({
    kunci: `unit_${unit.id}`,
    unit: String(unit.nomor),
    fase: unit.phase.kode,
    keterangan: unit.unitType.nama,
    progresTersimpan: unit.progress,
    status: unit.statusPembangunan,
    baris: efektifObjek(unit.id),
  }));
  const objekSarpras = kontrak.infrastructures.map(({ infrastructure: s }) => ({
    kunci: `sarpras_${s.id}`,
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

  const template = kontrak.boqItems;
  const adaTemplate = template.length > 0;
  const nilaiTemplate = template.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);

  // Objek yang dikontrakkan, untuk baris "Unit terkontrak" pada Deskripsi SPK.
  const objekLabel = semuaObjek.map((o) => (o.fase !== "—" ? `${o.fase}-${o.unit}` : o.unit));

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Vendor Management · Detail SPK</div>
      <h2 className="disp" style={{ margin: "4px 0 4px", fontSize: 20 }}>{kontrak.kode}</h2>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        {kontrak.deskripsi} · {kontrak.vendor.nama} · {kontrak.project.nama}
      </div>

      <Link
        href={`/vendor/${kontrak.vendor.id}`}
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 16 }}
      >
        ← Kembali ke {kontrak.vendor.nama}
      </Link>

      {/* ---------- Deskripsi SPK ---------- */}
      <Kartu padding="14px 18px" bawah={16}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Deskripsi SPK</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px 24px" }}>
          <Info label="Kode kontrak" nilai={kontrak.kode} />
          <Info label="Proyek" nilai={`${kontrak.project.kode} · ${kontrak.project.nama}`} />
          <Info label="Vendor" nilai={`${kontrak.vendor.nama}${kontrak.vendor.bidang ? ` · ${kontrak.vendor.bidang}` : ""}`} />
          <Info label="Jenis SPK" nilai={kontrak.jenis} />
          <Info
            label={`${kontrak.jenis === "Unit" ? "Unit" : "Sarpras"} terkontrak`}
            nilai={objekLabel.length ? `${objekLabel.length} · ${objekLabel.join(", ")}` : "—"}
          />
          <Info label="Tanggal kontrak" nilai={tanggal(kontrak.mulai)} />
          {bolehHarga && <Info label="Nilai kontrak" nilai={rp(kontrak.nominal)} />}
          {bolehHarga && ringkas.voDisetujui > 0 && (
            <Info label="Nilai efektif (+ VO)" nilai={rp(ringkas.nilaiEfektif)} />
          )}
          {bolehHarga && (
            <Info
              label="Retensi"
              nilai={
                kontrak.retensiPct > 0
                  ? `${kontrak.retensiPct}% · ${rp(ringkas.retensi)} (jatuh tempo ${kontrak.jatuhTempoBln} bln setelah pelunasan)`
                  : "—"
              }
            />
          )}
          {bolehHarga && (
            <Info label="Terbayar" nilai={`${rp(ringkas.terbayar)} · ${pct(ringkas.persenTerbayar, 1)}`} />
          )}
        </div>
      </Kartu>

      {/* ---------- dokumen SPK ---------- */}
      <Kartu padding="14px 18px" bawah={16}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Dokumen SPK</div>
        <FileRow
          label={`SPK ${kontrak.kode}`}
          dokumen={kontrak.docSpk ? { ...kontrak.docSpk, versi: kontrak.docSpk.versions } : null}
          bolehUbah={bolehUbahProgres}
          konteks={`SPK ${kontrak.kode} · ${kontrak.vendor.nama}`}
          pemilik={{ jenis: "kontrak", id: kontrak.id, kategori: "spk" }}
          aksiUnggah={unggahRevisi}
        />
        <Petunjuk jarak={"8px 0 0"}>
          SPK yang direvisi diunggah sebagai revisi baru, bukan menimpa yang lama —
          versi mana yang berlaku saat sebuah opname disetujui tetap bisa ditelusuri.
        </Petunjuk>
      </Kartu>

      <RingkasOpname nilaiKontrak={ringkas.nilaiEfektif} nilaiBoq={nilaiBoq} terpasang={terpasang} bolehHarga={bolehHarga} />

      {/* ---------- objek yang dikontrakkan ---------- */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <TabelHead
          judul={`Objek dalam SPK · ${semuaObjek.length}`}
          keterangan="Klik sebuah objek untuk membuka rincian pekerjaannya (BOQ efektif & penyesuaian per objek)."
        />
        <Tabel
          kolom={[
            { label: "Unit" },
            { label: "Fase" },
            { label: "Jenis" },
            { label: "Baris BOQ", rata: "kanan" },
            bolehHarga && { label: "Nilai BOQ", rata: "kanan" },
            { label: "Progres", minLebar: 170 },
            { label: "Status" },
          ]}
          kosong="SPK ini belum mencakup unit atau sarana & prasarana mana pun."
        >
          {semuaObjek.map((o) => {
            const nilai = o.baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
            const progres = o.baris.length ? progresTertimbang(o.baris) : o.progresTersimpan;
            return (
              <tr key={o.kunci}>
                <td style={{ fontWeight: 600 }}>
                  <Link
                    href={`/vendor/${kontrak.vendor.id}/kontrak/${encodeURIComponent(kontrak.kode)}/${o.kunci}`}
                    style={{ color: "var(--teal)", textDecoration: "none" }}
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
                    <Track nilai={progres} tinggi={9} warna={progres === 100 ? "var(--green)" : "var(--teal)"} />
                    <span style={{ fontSize: 10.5, color: "var(--muted)", width: 32 }}>{progres}%</span>
                  </div>
                </td>
                <td>
                  <Badge nilai={o.status} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            );
          })}
        </Tabel>
      </div>

      {/* ---------- BOQ Template SPK ---------- */}
      <div className="card" style={{ overflow: "hidden", marginTop: 20 }}>
        <TabelHead
          judul={`BOQ Template SPK · ${template.length} baris`}
          keterangan="Satu BOQ untuk seluruh objek SPK. Perubahan di sini menurun ke semua objek yang belum disesuaikan. Nilai per objek diubah di laman detail objek; opname di modul Konstruksi."
          aksi={
            bolehUbahProgres ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <TambahBarisBoq contractId={kontrak.id} />
                <ImporBoqSpk contractId={kontrak.id} />
              </div>
            ) : undefined
          }
        />
        {!adaTemplate ? (
          <div style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
            Belum ada baris pekerjaan. Tambahkan satu per satu, atau impor dari berkas Excel SPK.
          </div>
        ) : (
          <Tabel
            tinggiMaks={360}
            kolom={[
              { label: "Grup" },
              { label: "Uraian" },
              { label: "Volume", rata: "kanan" },
              { label: "Satuan" },
              bolehHarga && { label: "Harga Satuan", rata: "kanan" },
              bolehHarga && { label: "Nilai", rata: "kanan" },
              bolehUbahProgres && { lebar: 74 },
            ]}
          >
            {template.map((b) => (
              <tr key={b.id}>
                <td style={{ color: "var(--muted)", fontSize: 11 }}>{b.grup}</td>
                <td>{b.uraian}</td>
                <td style={{ textAlign: "right" }}>{b.volume.toLocaleString("id-ID")}</td>
                <td style={{ color: "var(--muted)" }}>{b.satuan}</td>
                {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(b.hargaSatuan)}</td>}
                {bolehHarga && (
                  <td className="num" style={{ textAlign: "right" }}>{rp(b.volume * b.hargaSatuan)}</td>
                )}
                {bolehUbahProgres && (
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <UbahBarisBoq baris={b} />
                      <HapusBarisBoq id={b.id} uraian={b.uraian} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {bolehHarga && (
              <tr style={{ borderTop: "2px solid var(--line)", fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: "right" }}>Nilai template / objek</td>
                <td className="num" style={{ textAlign: "right" }}>{rp(nilaiTemplate)}</td>
                <td />
                {bolehUbahProgres && <td />}
              </tr>
            )}
          </Tabel>
        )}
      </div>
    </div>
  );
}

function Info({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>{nilai}</div>
    </div>
  );
}
