import { kodeProyekDari, segmen } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import {
  hargaDasarUntukPembelian, komposisi, kontrakUntukAlokasi, pemasokUntukPembelian,
  pembelianProyek, proyekKeuangan, WARNA_JENIS,
} from "@/lib/data/keuangan";
import {
  alokasiKontrakSarprasTerbayar, alokasiKontrakTerbayar, anggaranPerKategori, biayaLangsung,
  komposisiObjek, realisasiPerKategori, subtotalBiaya, totalAnggaranKategori, totalDibebankan,
  totalProyek, transaksiUntukObjek,
} from "@/lib/tampilan/keuangan-proyek";
import { nilaiSarpras, nilaiUnit } from "@/lib/tampilan/proyek";
import { pemegangKandidat, pettyCashProyek } from "@/lib/data/petty-cash";
import { alokasiKontrak, ringkasKontrak, statusSerapan } from "@/lib/calc/keuangan";
import { jumlahRapKategori, KATEGORI_DARI_JENIS, KATEGORI_RAP } from "@/lib/calc/boq";
import { pct, rp, tanggal } from "@/lib/format";
import { RvsRAP } from "@/components/charts";
import { Badge, Kartu, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { BreakdownKategori } from "../breakdown-kategori";
import { PanelTransaksi } from "./transaksi";
import { BagikanKeUnit } from "./bagi-unit";
import { PettyCash } from "./petty-cash";
import { BuatPO, PanelPembelian } from "../pembelian";
import { Tabel } from "@/components/kartu-tabel";

export default async function KeuanganProyek({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<{ unit?: string; sarpras?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const { unit: unitDipilih, sarpras: sarprasDipilih } = await searchParams;
  const kodeProyek = kodeProyekDari(kode);

  if (!bolehLihat(pengguna, "keuangan")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Keuangan proyek" />
      </div>
    );
  }

  const proyek = await proyekKeuangan(kodeProyek);

  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  // Alokasi kontrak ke unit: bagian unit dari kontrak borongan yang sudah
  // terbayar. Kontrak yang mencakup beberapa unit dibagi rata, kecuali unit
  // yang punya nilai override sendiri.
  const { kontrakUnit, kontrakSarpras } = await kontrakUntukAlokasi(proyek.id);

  const alokasiPerUnit = alokasiKontrakTerbayar(kontrakUnit);
  const alokasiPerSarpras = alokasiKontrakSarprasTerbayar(kontrakSarpras);

  // RAB & RAP proyek — dihitung lewat nilaiUnit/nilaiSarpras (fungsi yang sama
  // dengan Master Proyek & dashboard Keuangan), jadi angkanya sinkron di semua
  // halaman: mencakup unit (+ kerja tambah) dan sarpras.
  const { rab: totalRab, rap: totalRap, realisasi: totalRealisasi } = totalProyek(
    proyek.units.map(nilaiUnit),
    proyek.infrastructures.map(nilaiSarpras),
    proyek.expenses,
  );
  const kompJenis = komposisi(proyek.expenses, "jenis");
  const kompPeruntukan = komposisi(proyek.expenses, "peruntukan");

  // Anggaran per kategori (RAP unit + kerja tambah + sarpras) vs realisasi
  // swakelola. Pengeluaran berjenis "Kontraktor" (borongan) TIDAK dihitung di
  // sini — itu di luar basis RAP dan ditangani lewat nilai kontrak di Vendor.
  const objekRap = [
    ...proyek.units,
    ...proyek.units.flatMap((u) => u.customWorks),
    ...proyek.infrastructures,
  ];
  const rapKat = jumlahRapKategori(objekRap);
  const anggaranKategori = anggaranPerKategori(
    KATEGORI_RAP,
    {
      Material: rapKat.material,
      "Tenaga Kerja": rapKat.tenaga,
      Subkon: rapKat.subkon,
      "Lain-lain Proyek": rapKat.lain,
    },
    realisasiPerKategori(proyek.expenses, KATEGORI_DARI_JENIS),
  );

  // Satu pembayaran boleh menanggung beberapa unit, jadi angka per unit
  // dijumlahkan dari baris alokasinya — bukan dari totalnya.
  const {
    perUnit: langsungPerUnit,
    perSarpras: langsungPerSarpras,
    levelUnit,
    levelSarpras,
    levelUmum,
  } = biayaLangsung(proyek.expenses);

  // Subtotal tabel (baris SUM). Alokasi kontrak sudah dibagi ke tiap objek, jadi
  // dijumlahkan langsung dari petanya — bukan dari nilai kontrak utuh.
  const subUnit = subtotalBiaya(
    proyek.units, (u) => u.id, (u) => nilaiUnit(u).rap, langsungPerUnit, alokasiPerUnit,
  );
  const subSarpras = subtotalBiaya(
    proyek.infrastructures, (x) => x.id, (x) => nilaiSarpras(x).rap, langsungPerSarpras, alokasiPerSarpras,
  );

  const transaksiUntuk = (kunci: { unitId?: string; sarprasId?: string }) =>
    transaksiUntukObjek(proyek.expenses, kunci);

  // Unit yang sedang dibuka rinciannya. Dipegang di URL, bukan di state
  // komponen, supaya rincian sebuah unit bisa ditautkan langsung dan tetap
  // terbuka setelah halaman dimuat ulang.
  const unitRinci = unitDipilih
    ? proyek.units.find((u) => u.kode === unitDipilih.toUpperCase())
    : undefined;
  const sarprasRinci = sarprasDipilih
    ? proyek.infrastructures.find((s) => s.kode === sarprasDipilih.toUpperCase())
    : undefined;
  const alamatDasar = `/keuangan/${segmen(proyek.kode)}`;

  const bolehUbahKeuangan = bolehUbah(pengguna, "keuangan");
  const pilihanUnit = proyek.units.map((u) => ({
    id: u.id,
    label: `Unit ${u.phase.kode}-${u.nomor} · ${u.unitType.nama}`,
  }));
  const pilihanSarpras = proyek.infrastructures.map((s) => ({
    id: s.id,
    label: `${s.nama} · ${s.jenis}`,
  }));

  // Pembelian material (PO) proyek — satu-satunya pintu masuk belanja material.
  // Daftar pemasok & price book hanya dimuat bila boleh mencatat (untuk form).
  const pembelian = await pembelianProyek(proyek.id);
  const [pemasokPO, hargaDasarPO] = bolehUbahKeuangan
    ? await Promise.all([pemasokUntukPembelian(), hargaDasarUntukPembelian()])
    : [[], []];

  // Petty cash — dana talangan lapangan + alur pertanggungjawabannya. Kandidat
  // pemegang hanya dimuat bila boleh memberi dana (form Beri Dana milik Finance).
  const bolehLihatPetty = bolehLihat(pengguna, "pettyCash");
  const [danaPetty, kandidatPetty] = bolehLihatPetty
    ? await Promise.all([
        pettyCashProyek(proyek.id),
        bolehUbahKeuangan ? pemegangKandidat(proyek.id) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Keuangan Proyek</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>{proyek.nama}</h2>

      <Link
        href="/keuangan"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 10 }}
      >
        ← Kembali ke daftar
      </Link>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <Badge nilai={proyek.status} peta={WARNA_STATUS.proyek} />
        <div style={{ display: "flex", gap: 26, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>RAB</div>
            <div className="num">{rp(totalRab)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>RAP</div>
            <div className="num">{rp(totalRap)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <Kartu>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Realisasi vs RAP</div>
          <div className="num" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
            {rp(totalRealisasi)}
          </div>
          <RvsRAP realisasi={totalRealisasi} rap={totalRap} denganLabel />
        </Kartu>

        <BreakdownKategori jenis={kompJenis} peruntukan={kompPeruntukan} ukuran={130} />
      </div>

      {/* ---------- anggaran per kategori (RAP vs realisasi) ---------- */}
      <KartuAnggaranKategori data={anggaranKategori} />

      {/* ---------- pengeluaran per unit ---------- */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Pengeluaran per Unit · ${proyek.units.length} unit`}
          keterangan="Klik nomor unit untuk melihat rincian per jenis biaya · Alokasi kontrak adalah bagian unit dari kontrak borongan yang sudah terbayar."
        />
        <Tabel
          tinggiMaks={380}
          kolom={[
            { label: "Unit" },
            { label: "Fase" },
            { label: "Tipe" },
            { label: "RAP", rata: "kanan" },
            { label: "Pengeluaran Langsung", rata: "kanan" },
            { label: "Alokasi Kontrak", rata: "kanan" },
            { label: "Total Realisasi", rata: "kanan" },
            { label: "% vs RAP", minLebar: 150 },
          ]}
        >
          {proyek.units.map((u) => {
            const rap = nilaiUnit(u).rap;
            const langsung = langsungPerUnit.get(u.id) ?? 0;
            const alokasi = alokasiPerUnit.get(u.id) ?? 0;
            const total = langsung + alokasi;
            const rasio = rap ? total / rap : 0;

            return (
              <tr key={u.id}>
                <td>
                  <Link
                    href={
                      unitRinci?.id === u.id
                        ? alamatDasar
                        : `${alamatDasar}?unit=${u.kode}#rincian-unit`
                    }
                    scroll={false}
                    style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                  >
                    {u.nomor}
                  </Link>
                </td>
                <td>{u.phase.kode}</td>
                <td>{u.unitType.nama}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>{rp(rap)}</td>
                <td className="num" style={{ textAlign: "right" }}>{langsung ? rp(langsung) : "—"}</td>
                <td className="num" style={{ textAlign: "right" }}>
                  {alokasi ? rp(Math.round(alokasi)) : "—"}
                </td>
                <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                  {rp(Math.round(total))}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Track
                      nilai={rasio * 100}
                      tinggi={9}
                      warna={rasio > 1 ? "var(--red)" : rasio > 0.9 ? "var(--amber)" : "var(--teal)"}
                    />
                    <span
                      style={{
                        fontSize: 10.5, width: 38, textAlign: "right",
                        color: rasio > 1 ? "var(--red)" : "var(--muted)",
                      }}
                    >
                      {pct(rasio, 1)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          {proyek.units.length > 0 && (
            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
              <td colSpan={3}>Subtotal Unit</td>
              <td className="num" style={{ textAlign: "right" }}>{rp(subUnit.rap)}</td>
              <td className="num" style={{ textAlign: "right" }}>{subUnit.langsung ? rp(subUnit.langsung) : "—"}</td>
              <td className="num" style={{ textAlign: "right" }}>
                {subUnit.alokasi ? rp(Math.round(subUnit.alokasi)) : "—"}
              </td>
              <td className="num" style={{ textAlign: "right" }}>
                {rp(Math.round(subUnit.langsung + subUnit.alokasi))}
              </td>
              <td>
                {(() => {
                  const rasio = subUnit.rap ? (subUnit.langsung + subUnit.alokasi) / subUnit.rap : 0;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Track
                        nilai={rasio * 100}
                        tinggi={9}
                        warna={rasio > 1 ? "var(--red)" : rasio > 0.9 ? "var(--amber)" : "var(--teal)"}
                      />
                      <span style={{ fontSize: 10.5, width: 38, textAlign: "right", color: rasio > 1 ? "var(--red)" : "var(--muted)" }}>
                        {pct(rasio, 1)}
                      </span>
                    </div>
                  );
                })()}
              </td>
            </tr>
          )}
          {proyek.units.length > 0 && (
            <tr style={{ fontWeight: 600, background: "var(--rona-baris)" }}>
              <td colSpan={6} style={{ color: "var(--muted)", whiteSpace: "normal" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    Biaya level proyek (unit) — berperuntukan unit, belum dialokasikan ke unit tertentu
                  </span>
                  {levelUnit > 0 && bolehUbahKeuangan && (
                    <BagikanKeUnit
                      projectId={proyek.id}
                      nilai={levelUnit}
                      jumlahUnit={proyek.units.length}
                    />
                  )}
                </div>
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(levelUnit)}</td>
              <td />
            </tr>
          )}
        </Tabel>
      </div>

      {/* ---------- rincian biaya satu unit ---------- */}
      {unitRinci &&
        (() => {
          const tx = transaksiUntuk({ unitId: unitRinci.id });
          const rap = nilaiUnit(unitRinci).rap;
          const terpakai = totalDibebankan(tx);
          // Pembagi dijaga agar tidak nol supaya bar tetap tergambar walau unit
          // ini belum punya transaksi sama sekali.
          const pembagi = terpakai || 1;

          const perJenis = komposisiObjek(tx, Object.keys(WARNA_JENIS));

          return (
            <div
              id="rincian-unit"
              className="card"
              style={{ marginTop: 16, padding: "16px 20px", border: "1px solid var(--teal)" }}
            >
              <div
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: 10,
                }}
              >
                <div>
                  <div className="eyebrow">Rincian Biaya per Unit</div>
                  <div className="disp" style={{ fontWeight: 600, fontSize: 16, marginTop: 3 }}>
                    {proyek.nama} — Unit {unitRinci.nomor}{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>
                      · Fase {unitRinci.phase.kode} · {unitRinci.unitType.nama}
                    </span>
                  </div>
                </div>
                <Link
                  href={alamatDasar}
                  scroll={false}
                  style={{ color: "var(--muted)", fontSize: 12.5, textDecoration: "none" }}
                >
                  Tutup ×
                </Link>
              </div>

              <div className="grid grid4" style={{ gap: 14, margin: "14px 0" }}>
                {(
                  [
                    ["RAP Unit", rp(rap), false],
                    ["Total Pengeluaran", rp(terpakai), false],
                    ["Sisa Anggaran", rp(rap - terpakai), rap - terpakai < 0],
                    ["Terpakai", pct(terpakai / (rap || 1), 1), false],
                  ] as [string, string, boolean][]
                ).map(([label, nilai, merah]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: 0.5 }}>{label}</div>
                    <div className="num" style={{ fontSize: 15, color: merah ? "var(--red)" : "var(--ink)" }}>
                      {nilai}
                    </div>
                  </div>
                ))}
              </div>

              <div className="eyebrow" style={{ marginBottom: 8 }}>Pengeluaran per Jenis Biaya</div>
              {perJenis.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0 8px" }}>
                  Unit ini belum punya pengeluaran langsung yang tercatat.
                </div>
              ) : (
                perJenis.map((x) => (
                  <div
                    key={x.jenis}
                    style={{
                      display: "grid", gridTemplateColumns: "160px 1fr 190px",
                      gap: 12, alignItems: "center", padding: "6px 0",
                    }}
                  >
                    <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: WARNA_JENIS[x.jenis], flexShrink: 0,
                        }}
                      />
                      {x.jenis}
                    </div>
                    <Track nilai={(x.nilai / pembagi) * 100} tinggi={12} warna={WARNA_JENIS[x.jenis]} />
                    <div style={{ textAlign: "right", fontSize: 12.5 }}>
                      <b className="num">{rp(x.nilai)}</b>{" "}
                      <span style={{ color: "var(--muted)" }}>· {pct(x.nilai / pembagi, 1)}</span>
                    </div>
                  </div>
                ))
              )}

              <div className="eyebrow" style={{ margin: "16px 0 8px" }}>
                Transaksi Unit · {tx.length} entri
              </div>
              <Tabel
                tinggiMaks={260}
                kolom={[
                  { label: "Tanggal" },
                  { label: "Jenis" },
                  { label: "Keterangan", minLebar: 200 },
                  { label: "Metode" },
                  { label: "Alokasi ke Sini", rata: "kanan" },
                  { label: "Total Pembayaran", rata: "kanan" },
                ]}
                kosong="Belum ada transaksi yang dicatat langsung ke unit ini. Biaya yang masuk lewat kontrak borongan muncul sebagai Alokasi Kontrak, bukan sebagai transaksi unit."
              >
                {tx.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: "var(--muted)" }}>{tanggal(e.tanggal)}</td>
                    <td>
                      <span style={{ color: WARNA_JENIS[e.jenis] ?? "#999", marginRight: 4 }}>■</span>
                      {e.jenis}
                    </td>
                    <td style={{ whiteSpace: "normal" }}>
                      {e.uraian}
                      {/* Sebagian besar transaksi per unit belum punya PIC;
                          barisnya disembunyikan alih-alih menulis "oleh —". */}
                      {e.pic && (
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>oleh {e.pic}</div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{e.metode}</td>
                    {/* Dua kolom terpisah, bukan satu: "Alokasi ke Sini" adalah
                        bagian yang ditanggung unit/item ini, sedangkan "Total
                        Pembayaran" adalah nilai transaksi utuh yang cocok dengan
                        satu baris mutasi bank. Menggabungkan keduanya membuat
                        pembayaran lumsum terbaca seolah seluruhnya milik unit ini. */}
                    <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                      {rp(e.nominalDibebankan)}
                    </td>
                    <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                      {rp(e.total)}
                      {e.jumlahTujuan > 1 && (
                        <div style={{ fontSize: 10, fontWeight: 400 }}>
                          dibagi ke {e.jumlahTujuan} tujuan
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {tx.length > 0 && (
                  <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                    <td colSpan={4}>JUMLAH DIBEBANKAN KE UNIT INI</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(terpakai)}</td>
                    <td style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)", whiteSpace: "normal" }}>
                      sama dengan Total Pengeluaran di atas
                    </td>
                  </tr>
                )}
              </Tabel>
            </div>
          );
        })()}

      {/* ---------- pengeluaran per sarana & prasarana ---------- */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Pengeluaran Sarana & Prasarana · ${proyek.infrastructures.length} item`}
          keterangan="Klik nama item untuk melihat rincian per jenis biaya."
        />
        <Tabel
          tinggiMaks={380}
          kolom={[
            { label: "Item", minLebar: 150 },
            { label: "Jenis" },
            { label: "RAP", rata: "kanan" },
            { label: "Pengeluaran Langsung", rata: "kanan" },
            { label: "Alokasi Kontrak", rata: "kanan" },
            { label: "Total Realisasi", rata: "kanan" },
            { label: "% vs RAP", minLebar: 150 },
          ]}
          kosong="Proyek ini belum punya item sarana & prasarana."
        >
          {proyek.infrastructures.map((s) => {
            const rap = nilaiSarpras(s).rap;
            const langsung = langsungPerSarpras.get(s.id) ?? 0;
            const alokasi = alokasiPerSarpras.get(s.id) ?? 0;
            const total = langsung + alokasi;
            const rasio = rap ? total / rap : 0;

            return (
              <tr key={s.id}>
                <td>
                  <Link
                    href={
                      sarprasRinci?.id === s.id
                        ? alamatDasar
                        : `${alamatDasar}?sarpras=${s.kode}#rincian-sarpras`
                    }
                    scroll={false}
                    style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                  >
                    {s.nama}
                  </Link>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {s.kode} · {s.volume}
                  </div>
                </td>
                <td>{s.jenis}</td>
                <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>{rp(rap)}</td>
                <td className="num" style={{ textAlign: "right" }}>{langsung ? rp(langsung) : "—"}</td>
                <td className="num" style={{ textAlign: "right" }}>
                  {alokasi ? rp(Math.round(alokasi)) : "—"}
                </td>
                <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                  {rp(Math.round(total))}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Track
                      nilai={rasio * 100}
                      tinggi={9}
                      warna={rasio > 1 ? "var(--red)" : rasio > 0.9 ? "var(--amber)" : "var(--teal)"}
                    />
                    <span
                      style={{
                        fontSize: 10.5, width: 38, textAlign: "right",
                        color: rasio > 1 ? "var(--red)" : "var(--muted)",
                      }}
                    >
                      {pct(rasio, 1)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          {proyek.infrastructures.length > 0 && (
            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
              <td colSpan={2}>Subtotal Sarana &amp; Prasarana</td>
              <td className="num" style={{ textAlign: "right" }}>{rp(subSarpras.rap)}</td>
              <td className="num" style={{ textAlign: "right" }}>{subSarpras.langsung ? rp(subSarpras.langsung) : "—"}</td>
              <td className="num" style={{ textAlign: "right" }}>
                {subSarpras.alokasi ? rp(Math.round(subSarpras.alokasi)) : "—"}
              </td>
              <td className="num" style={{ textAlign: "right" }}>
                {rp(Math.round(subSarpras.langsung + subSarpras.alokasi))}
              </td>
              <td>
                {(() => {
                  const rasio = subSarpras.rap ? (subSarpras.langsung + subSarpras.alokasi) / subSarpras.rap : 0;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Track
                        nilai={rasio * 100}
                        tinggi={9}
                        warna={rasio > 1 ? "var(--red)" : rasio > 0.9 ? "var(--amber)" : "var(--teal)"}
                      />
                      <span style={{ fontSize: 10.5, width: 38, textAlign: "right", color: rasio > 1 ? "var(--red)" : "var(--muted)" }}>
                        {pct(rasio, 1)}
                      </span>
                    </div>
                  );
                })()}
              </td>
            </tr>
          )}
          {proyek.infrastructures.length > 0 && (
            <tr style={{ fontWeight: 600, background: "var(--rona-baris)" }}>
              <td colSpan={5} style={{ color: "var(--muted)", whiteSpace: "normal" }}>
                Biaya level proyek (sarpras) — berperuntukan prasarana &amp; sarana, belum dialokasikan ke item tertentu
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(levelSarpras)}</td>
              <td />
            </tr>
          )}
        </Tabel>
      </div>

      <div
        className="card"
        style={{
          marginTop: 16, padding: "14px 20px", display: "flex",
          justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Biaya Level Proyek (Umum)</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 620, lineHeight: 1.5 }}>
            Perijinan &amp; ormas, pengolahan lahan — biaya proyek yang tidak menempel pada unit
            maupun sarana &amp; prasarana, jadi tidak dibagi ke keduanya.
          </div>
        </div>
        <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{rp(levelUmum)}</div>
      </div>

      {bolehLihatPetty && (
        <PettyCash
          projectId={proyek.id}
          funds={danaPetty}
          kandidat={kandidatPetty}
          konteks={{
            id: pengguna.id,
            jabatan: pengguna.jabatan,
            bolehKeuangan: bolehUbahKeuangan,
            bolehPetty: bolehUbah(pengguna, "pettyCash"),
          }}
        />
      )}

      {/* ---------- rincian biaya satu item sarpras ---------- */}
      {sarprasRinci &&
        (() => {
          const tx = transaksiUntuk({ sarprasId: sarprasRinci.id });
          const rap = nilaiSarpras(sarprasRinci).rap;
          const terpakai = totalDibebankan(tx);
          const pembagi = terpakai || 1;

          const perJenis = komposisiObjek(tx, Object.keys(WARNA_JENIS));

          return (
            <div
              id="rincian-sarpras"
              className="card"
              style={{ marginTop: 16, padding: "16px 20px", border: "1px solid var(--teal)" }}
            >
              <div
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: 10,
                }}
              >
                <div>
                  <div className="eyebrow">Rincian Biaya Sarana &amp; Prasarana</div>
                  <div className="disp" style={{ fontWeight: 600, fontSize: 16, marginTop: 3 }}>
                    {proyek.nama} — {sarprasRinci.nama}{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>
                      · {sarprasRinci.jenis} · {sarprasRinci.volume} · progres {sarprasRinci.progress}%
                    </span>
                  </div>
                </div>
                <Link
                  href={alamatDasar}
                  scroll={false}
                  style={{ color: "var(--muted)", fontSize: 12.5, textDecoration: "none" }}
                >
                  Tutup ×
                </Link>
              </div>

              <div className="grid grid4" style={{ gap: 14, margin: "14px 0" }}>
                {(
                  [
                    ["RAB", rp(sarprasRinci.rab), false],
                    ["RAP", rp(rap), false],
                    ["Total Pengeluaran", rp(terpakai), false],
                    ["Sisa Anggaran", rp(rap - terpakai), rap - terpakai < 0],
                  ] as [string, string, boolean][]
                ).map(([label, nilai, merah]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: 0.5 }}>{label}</div>
                    <div className="num" style={{ fontSize: 15, color: merah ? "var(--red)" : "var(--ink)" }}>
                      {nilai}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pembanding yang khas sarpras: biaya yang sudah keluar diadu
                  dengan progres fisiknya, karena sarpras dikerjakan bertahap
                  dan seringkali lintas tahun. */}
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
                Terpakai {pct(terpakai / (rap || 1), 1)} dari RAP dengan progres fisik{" "}
                {sarprasRinci.progress}%
                {rap > 0 && statusSerapan(terpakai / rap, sarprasRinci.progress) === "Over" && (
                  <span style={{ color: "var(--red)", fontWeight: 600 }}> · biaya mendahului progres</span>
                )}
              </div>

              <div className="eyebrow" style={{ marginBottom: 8 }}>Pengeluaran per Jenis Biaya</div>
              {perJenis.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0 8px" }}>
                  Item ini belum punya pengeluaran langsung yang tercatat.
                </div>
              ) : (
                perJenis.map((x) => (
                  <div
                    key={x.jenis}
                    style={{
                      display: "grid", gridTemplateColumns: "160px 1fr 190px",
                      gap: 12, alignItems: "center", padding: "6px 0",
                    }}
                  >
                    <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: WARNA_JENIS[x.jenis], flexShrink: 0,
                        }}
                      />
                      {x.jenis}
                    </div>
                    <Track nilai={(x.nilai / pembagi) * 100} tinggi={12} warna={WARNA_JENIS[x.jenis]} />
                    <div style={{ textAlign: "right", fontSize: 12.5 }}>
                      <b className="num">{rp(x.nilai)}</b>{" "}
                      <span style={{ color: "var(--muted)" }}>· {pct(x.nilai / pembagi, 1)}</span>
                    </div>
                  </div>
                ))
              )}

              <div className="eyebrow" style={{ margin: "16px 0 8px" }}>
                Transaksi Sarpras · {tx.length} entri
              </div>
              <Tabel
                tinggiMaks={260}
                kolom={[
                  { label: "Tanggal" },
                  { label: "Jenis" },
                  { label: "Keterangan", minLebar: 200 },
                  { label: "Metode" },
                  { label: "Alokasi ke Sini", rata: "kanan" },
                  { label: "Total Pembayaran", rata: "kanan" },
                ]}
                kosong="Belum ada transaksi yang dicatat langsung ke item ini. Biaya yang masuk lewat kontrak vendor muncul sebagai Alokasi Kontrak."
              >
                {tx.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: "var(--muted)" }}>{tanggal(e.tanggal)}</td>
                    <td>
                      <span style={{ color: WARNA_JENIS[e.jenis] ?? "#999", marginRight: 4 }}>■</span>
                      {e.jenis}
                    </td>
                    <td style={{ whiteSpace: "normal" }}>
                      {e.uraian}
                      {e.pic && (
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>oleh {e.pic}</div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{e.metode}</td>
                    {/* Dua kolom terpisah, bukan satu: "Alokasi ke Sini" adalah
                        bagian yang ditanggung unit/item ini, sedangkan "Total
                        Pembayaran" adalah nilai transaksi utuh yang cocok dengan
                        satu baris mutasi bank. Menggabungkan keduanya membuat
                        pembayaran lumsum terbaca seolah seluruhnya milik unit ini. */}
                    <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                      {rp(e.nominalDibebankan)}
                    </td>
                    <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                      {rp(e.total)}
                      {e.jumlahTujuan > 1 && (
                        <div style={{ fontSize: 10, fontWeight: 400 }}>
                          dibagi ke {e.jumlahTujuan} tujuan
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {tx.length > 0 && (
                  <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                    <td colSpan={4}>JUMLAH DIBEBANKAN KE ITEM INI</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(terpakai)}</td>
                    <td style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)", whiteSpace: "normal" }}>
                      sama dengan Total Pengeluaran di atas
                    </td>
                  </tr>
                )}
              </Tabel>
            </div>
          );
        })()}

      {/* ---------- pembelian material (PO) ---------- */}
      <div className="card" style={{ marginTop: 16, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Pembelian Material · PO</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 560, lineHeight: 1.5 }}>
              Satu-satunya tempat belanja material dicatat. Buat PO (Draft), tandai
              barang <b>Diterima</b> saat datang, lalu bayar bertermin — tiap termin jadi satu pengeluaran proyek.
            </div>
          </div>
          {bolehUbahKeuangan && (
            <BuatPO projectId={proyek.id} proyekNama={proyek.nama} pemasok={pemasokPO} hargaDasar={hargaDasarPO} />
          )}
        </div>
        <PanelPembelian
          bolehKelola={bolehUbahKeuangan}
          pembelian={pembelian}
          units={pilihanUnit}
          sarpras={pilihanSarpras}
          namaPengguna={pengguna.nama}
        />
      </div>

      {/* ---------- transaksi ---------- */}
      <PanelTransaksi
        expenses={proyek.expenses}
        bolehUbah={bolehUbahKeuangan}
        units={pilihanUnit}
        sarpras={pilihanSarpras}
        warnaJenis={WARNA_JENIS}
      />
    </div>
  );
}

/**
 * Sisa anggaran per kategori RAP. Tiap kategori: anggaran (RAP), realisasi
 * (pengeluaran dengan jenis biaya yang jatuh ke kategori itu), dan sisa. Batang
 * merah begitu realisasi melewati anggaran. Kategori "Kontraktor" muncul untuk
 * objek yang diborongkan penuh; kategori tanpa anggaran maupun realisasi tetap
 * ditampilkan agar strukturnya terbaca utuh.
 */
function KartuAnggaranKategori({
  data,
}: {
  data: { kategori: string; rap: number; realisasi: number }[];
}) {
  const { rap: totalRapKat, realisasi: totalRealKat, melampaui } = totalAnggaranKategori(data);

  return (
    <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
      <TabelHead
        judul="Anggaran per Kategori (RAP)"
        keterangan="Sisa anggaran tiap kategori: RAP dari Master Proyek dikurangi realisasi pengeluaran. Lain-lain Proyek = 5% dari (Material + Tenaga Kerja + Subkon)."
      />
      <Tabel
        kolom={[
          { label: "Kategori" },
          { label: "Anggaran RAP", rata: "kanan" },
          { label: "Realisasi", rata: "kanan" },
          { label: "Sisa", rata: "kanan" },
          { label: "Serapan", minLebar: 180 },
        ]}
      >
        {data.map((d) => {
          const sisa = d.rap - d.realisasi;
          const over = d.realisasi > d.rap;
          return (
            <tr key={d.kategori}>
              <td style={{ fontWeight: 600 }}>{d.kategori}</td>
              <td style={{ textAlign: "right" }}>{rp(d.rap)}</td>
              <td style={{ textAlign: "right" }}>{rp(d.realisasi)}</td>
              <td style={{ textAlign: "right", color: over ? "var(--red)" : "var(--text)", fontWeight: 600 }}>
                {rp(sisa)}
              </td>
              <td>
                <RvsRAP realisasi={d.realisasi} rap={d.rap} />
              </td>
            </tr>
          );
        })}
        <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
          <td>Total</td>
          <td style={{ textAlign: "right" }}>{rp(totalRapKat)}</td>
          <td style={{ textAlign: "right" }}>{rp(totalRealKat)}</td>
          <td style={{ textAlign: "right", color: melampaui ? "var(--red)" : "var(--text)" }}>
            {rp(totalRapKat - totalRealKat)}
          </td>
          <td />
        </tr>
      </Tabel>
    </div>
  );
}
