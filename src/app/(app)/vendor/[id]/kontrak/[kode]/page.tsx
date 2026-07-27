import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { nilaiTerpasang, progresTertimbang } from "@/lib/calc/kontrak-boq";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp, tanggal } from "@/lib/format";
import { Tabel } from "@/components/kartu-tabel";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import {
  HapusBarisBoq,
  ImporBoqSpk,
  SalinBoqKeSemua,
  TambahBarisBoq,
  UbahBarisBoq,
  type PilihanObjek,
} from "./editors-boq";
import { RingkasOpname, TabelOpnameSpk, type ObjekOpname } from "./opname";

/**
 * Detail satu SPK: rincian pekerjaan yang diperintahkan, dan opname progresnya.
 *
 * Halaman ini sengaja dipisah dari kartu kontrak di halaman vendor. Sebuah SPK
 * borongan sepuluh unit bisa berisi ratusan baris pekerjaan — memaksakannya
 * masuk ke daftar kontrak akan membuat halaman vendor tidak terbaca, sementara
 * opname butuh layar penuh untuk diisi.
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

  const kontrak = await prisma.contract.findUnique({
    where: { kode: decodeURIComponent(kode).toUpperCase() },
    select: {
      id: true, kode: true, jenis: true, deskripsi: true, nominal: true,
      retensiPct: true, jatuhTempoBln: true, mulai: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      vendor: { select: { id: true, nama: true, bidang: true } },
      pembayaran: { select: { nominal: true } },
      variationOrders: { select: { nominal: true, status: true } },
      units: {
        select: {
          unit: {
            select: {
              id: true, nomor: true, progress: true, statusPembangunan: true,
              phase: { select: { kode: true } },
              unitType: { select: { nama: true } },
            },
          },
        },
      },
      infrastructures: {
        select: {
          infrastructure: {
            select: { id: true, nama: true, jenis: true, progress: true, status: true },
          },
        },
      },
      boqItems: {
        orderBy: [{ urutan: "asc" }],
        select: {
          id: true, unitId: true, infrastructureId: true, grup: true, uraian: true,
          satuan: true, volume: true, hargaSatuan: true, progress: true,
        },
      },
    },
  });

  if (!kontrak) notFound();
  if (!bolehAksesProyek(pengguna, kontrak.projectId)) notFound();
  if (kontrak.vendor.id !== vendorId) notFound();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahProgres = bolehUbah(pengguna, "progress");

  const ringkas = ringkasKontrak(kontrak);
  const nilaiBoq = kontrak.boqItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
  const terpasang = nilaiTerpasang(kontrak.boqItems);

  // Objek yang tercakup SPK ini, masing-masing dengan baris BOQ-nya.
  const objekUnit = kontrak.units.map(({ unit }) => ({
    kunci: `unit:${unit.id}`,
    label: `Unit ${unit.phase.kode}-${unit.nomor}`,
    keterangan: unit.unitType.nama,
    progresTersimpan: unit.progress,
    status: unit.statusPembangunan,
    baris: kontrak.boqItems.filter((b) => b.unitId === unit.id),
  }));

  const objekSarpras = kontrak.infrastructures.map(({ infrastructure: s }) => ({
    kunci: `sarpras:${s.id}`,
    label: s.nama,
    keterangan: s.jenis,
    progresTersimpan: s.progress,
    status: s.status,
    baris: kontrak.boqItems.filter((b) => b.infrastructureId === s.id),
  }));

  const semuaObjek = [...objekUnit, ...objekSarpras];
  const pilihanObjek: PilihanObjek[] = semuaObjek.map((o) => ({
    kunci: o.kunci,
    label: `${o.label} · ${o.keterangan}`,
  }));

  const untukOpname: ObjekOpname[] = semuaObjek.map((o) => ({
    kunci: o.kunci,
    label: o.label,
    keterangan: o.keterangan,
    baris: o.baris.map((b) => ({
      id: b.id, grup: b.grup, uraian: b.uraian, satuan: b.satuan,
      volume: b.volume, hargaSatuan: b.hargaSatuan, progress: b.progress,
    })),
  }));

  const adaBoq = kontrak.boqItems.length > 0;

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Vendor Management · Detail SPK</div>
      <h2 className="disp" style={{ margin: "4px 0 4px", fontSize: 20 }}>
        {kontrak.kode}
      </h2>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        {kontrak.deskripsi} · {kontrak.vendor.nama} · {kontrak.project.nama}
      </div>

      <Link
        href={`/vendor/${kontrak.vendor.id}`}
        style={{
          fontSize: 12.5, color: "var(--muted)", textDecoration: "none",
          display: "inline-block", marginBottom: 16,
        }}
      >
        ← Kembali ke {kontrak.vendor.nama}
      </Link>

      <RingkasOpname
        nilaiKontrak={ringkas.nilaiEfektif}
        nilaiBoq={nilaiBoq}
        terpasang={terpasang}
        bolehHarga={bolehHarga}
      />

      {/* ---------- objek yang dikontrakkan ---------- */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <TabelHead
          judul={`Objek dalam SPK · ${semuaObjek.length}`}
          keterangan="Progres di sini dihitung dari baris BOQ di bawah, tertimbang nilai tiap pekerjaan."
        />
        <Tabel
          kolom={[
            { label: "Objek" },
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
                <td style={{ fontWeight: 600 }}>{o.label}</td>
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
                    <Track
                      nilai={progres}
                      tinggi={9}
                      warna={progres === 100 ? "var(--green)" : "var(--teal)"}
                    />
                    <span style={{ fontSize: 10.5, color: "var(--muted)", width: 32 }}>
                      {progres}%
                    </span>
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

      {/* ---------- rincian & opname ---------- */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 8, margin: "22px 0 12px",
        }}
      >
        <div>
          <div className="sectitle" style={{ margin: 0 }}>
            Rincian Pekerjaan &amp; Opname
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            {adaBoq
              ? "Isi persentase tiap pekerjaan, lalu simpan sekali untuk seluruh SPK."
              : "Rinci dulu pekerjaan SPK ini sebelum progres bisa diopname per baris."}
          </div>
        </div>

        {bolehUbahProgres && semuaObjek.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <TambahBarisBoq contractId={kontrak.id} objek={pilihanObjek} />
            <ImporBoqSpk contractId={kontrak.id} objek={pilihanObjek} />
            {objekUnit.length > 1 && (
              <SalinBoqKeSemua
                contractId={kontrak.id}
                objek={objekUnit.map((o) => ({ kunci: o.kunci, label: o.label }))}
                jumlahUnitLain={objekUnit.length - 1}
              />
            )}
          </div>
        )}
      </div>

      {adaBoq ? (
        <TabelOpnameSpk
          contractId={kontrak.id}
          objek={untukOpname}
          bolehUbah={bolehUbahProgres}
          bolehHarga={bolehHarga}
        />
      ) : (
        <div
          className="card"
          style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}
        >
          Belum ada baris pekerjaan. Tambahkan satu per satu, atau impor dari
          berkas Excel SPK.
        </div>
      )}

      {/* ---------- daftar baris untuk disunting ---------- */}
      {bolehUbahProgres && adaBoq && (
        <div className="card" style={{ overflow: "hidden", marginTop: 20 }}>
          <TabelHead
            judul={`Sunting Baris BOQ · ${kontrak.boqItems.length} baris`}
            keterangan="Untuk mengoreksi uraian, volume, atau harga satuan. Progres diisi lewat tabel opname di atas."
          />
          <Tabel
            tinggiMaks={360}
            kolom={[
              { label: "Objek" },
              { label: "Grup" },
              { label: "Uraian" },
              { label: "Volume", rata: "kanan" },
              { label: "Satuan" },
              bolehHarga && { label: "Harga Satuan", rata: "kanan" },
              { lebar: 74 },
            ]}
          >
            {kontrak.boqItems.map((b) => {
              const objek = semuaObjek.find(
                (o) => o.kunci === `unit:${b.unitId}` || o.kunci === `sarpras:${b.infrastructureId}`,
              );
              return (
                <tr key={b.id}>
                  <td style={{ color: "var(--muted)" }}>{objek?.label ?? "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 11 }}>{b.grup}</td>
                  <td>{b.uraian}</td>
                  <td style={{ textAlign: "right" }}>{b.volume.toLocaleString("id-ID")}</td>
                  <td style={{ color: "var(--muted)" }}>{b.satuan}</td>
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(b.hargaSatuan)}</td>
                  )}
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <UbahBarisBoq baris={b} />
                      <HapusBarisBoq id={b.id} uraian={b.uraian} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabel>
        </div>
      )}

      {/* ---------- keterangan kontrak ---------- */}
      <div className="card" style={{ padding: "14px 18px", marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Keterangan SPK</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>
          Mulai {tanggal(kontrak.mulai)} · jenis {kontrak.jenis} ·{" "}
          {kontrak.vendor.bidang}
          {bolehHarga && kontrak.retensiPct > 0 && (
            <>
              {" "}· retensi {kontrak.retensiPct}% = {rp(ringkas.retensi)}, jatuh tempo{" "}
              {kontrak.jatuhTempoBln} bulan setelah pelunasan
            </>
          )}
          {bolehHarga && (
            <>
              {" "}· terbayar {rp(ringkas.terbayar)} ({pct(ringkas.persenTerbayar, 1)} dari
              nilai akhir)
            </>
          )}
        </div>
      </div>
    </div>
  );
}
