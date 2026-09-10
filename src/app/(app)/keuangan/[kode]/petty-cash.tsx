"use client";

import { useActionState, useEffect, useState } from "react";
import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { Badge } from "@/components/ui";
import { rp, tanggal } from "@/lib/format";
import { JENIS_BIAYA_SWAKELOLA, PERUNTUKAN_BIAYA, type StatusPettyCash } from "@/lib/domain/enums";
import { LABEL_STATUS_PETTY, transisiUntuk } from "@/lib/calc/petty-cash";
import type { DanaPettyCash } from "@/lib/data/petty-cash";
import type { HasilAksi } from "@/lib/actions/guard";
import {
  ajukanLaporanPetty, beriDanaPetty, catatPengeluaranPetty,
  reimburseLaporanPetty, transisiLaporanPetty,
} from "../petty-actions";

const WARNA_PETTY: Record<string, [string, string]> = {
  Draft: ["var(--rona-abu)", "var(--muted)"],
  Diajukan: ["var(--rona-amber)", "var(--amber)"],
  DiverifikasiQS: ["var(--rona-biru)", "var(--blue)"],
  Disetujui: ["var(--rona-teal2)", "var(--teal)"],
  Direimburse: ["var(--rona-hijau2)", "var(--green)"],
};

interface Konteks {
  id: string;
  jabatan: string[];
  bolehKeuangan: boolean;
  bolehPetty: boolean;
}

export function PettyCash({
  projectId,
  funds,
  kandidat,
  konteks,
}: {
  projectId: string;
  funds: DanaPettyCash[];
  kandidat: { id: string; nama: string }[];
  konteks: Konteks;
}) {
  return (
    <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Petty Cash</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            Dana talangan lapangan per pemegang · saldo = dana masuk − pengeluaran. Saldo boleh minus
            (ditalangi dulu), dikembalikan lewat reimburse.
          </div>
        </div>
        {konteks.bolehKeuangan && kandidat.length > 0 && (
          <BeriDana projectId={projectId} kandidat={kandidat} />
        )}
      </div>

      {funds.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          Belum ada dana petty cash.
          {konteks.bolehKeuangan
            ? " Beri dana ke pemegang di lapangan untuk memulai."
            : " Finance yang memberi dana ke pemegangnya."}
        </div>
      ) : (
        funds.map((f) => <DanaBlok key={f.id} dana={f} konteks={konteks} />)
      )}
    </div>
  );
}

function DanaBlok({ dana, konteks }: { dana: DanaPettyCash; konteks: Konteks }) {
  // Pemegang dana adalah orangnya sendiri — tidak ada lagi jabatan yang
  // "dianggap pemegang". Mencatat pengeluaran atas nama orang lain membuat
  // selisih kas tidak bisa ditanyakan ke siapa pun.
  const isPemegang = konteks.id === dana.pemegang.id;
  const saldoMinus = dana.saldo < 0;

  return (
    <div style={{ borderBottom: "1px solid var(--line)", padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {dana.pemegang.nama}
            {!dana.aktif && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · ditutup</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Plafon acuan {rp(dana.plafon)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 0.6 }}>SALDO</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: saldoMinus ? "var(--red)" : "var(--ink)" }}>
              {rp(dana.saldo)}
            </div>
          </div>
          {isPemegang && dana.aktif && konteks.bolehPetty && (
            <CatatPengeluaran fundId={dana.id} />
          )}
        </div>
      </div>

      {dana.laporan.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Belum ada laporan.</div>
      ) : (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {dana.laporan.map((l) => (
            <LaporanBaris key={l.id} laporan={l} isPemegang={isPemegang} konteks={konteks} />
          ))}
        </div>
      )}
    </div>
  );
}

type Laporan = DanaPettyCash["laporan"][number];

function LaporanBaris({
  laporan,
  isPemegang,
  konteks,
}: {
  laporan: Laporan;
  isPemegang: boolean;
  konteks: Konteks;
}) {
  const [buka, setBuka] = useState(false);
  const status = laporan.status as StatusPettyCash;

  // Aturan siapa boleh menggerakkan apa ada di lapisan murni, bukan di sini.
  // Tombol yang tampil harus persis sama dengan yang diterima server; dua
  // salinan aturan berarti tombol yang ada tapi ditolak, atau sebaliknya.
  const aksi = transisiUntuk(status, {
    jabatan: konteks.jabatan,
    pemegangDana: isPemegang,
    bolehKeuangan: konteks.bolehKeuangan,
  });

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setBuka((b) => !b)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{buka ? "▾" : "▸"}</span>
          <Badge nilai={LABEL_STATUS_PETTY[status]} peta={{ [LABEL_STATUS_PETTY[status]]: WARNA_PETTY[status] }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{laporan.rentang ?? "Batch berjalan"}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>· {laporan.expenses.length} pengeluaran</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {laporan.buktiKey && (
            <a
              href={`/api/petty-bukti/${laporan.id}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
            >
              Nota PDF ↗
            </a>
          )}
          <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{rp(laporan.total)}</span>
          {aksi.map((t) =>
            t.olehPemegang ? (
              <AjukanLaporan key={t.ke + t.aksi} reportId={laporan.id} />
            ) : (
              <AksiPetty
                key={t.ke + t.aksi}
                reportId={laporan.id}
                ke={t.ke}
                label={t.aksi}
                mundur={t.mundur}
                finance={!!t.perluIzinKeuangan}
              />
            ),
          )}
        </div>
      </div>

      {laporan.catatan && (
        <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 6 }}>Catatan: {laporan.catatan}</div>
      )}

      {buka && (
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "4px 6px", fontWeight: 600 }}>Tanggal</th>
                <th style={{ padding: "4px 6px", fontWeight: 600 }}>Jenis</th>
                <th style={{ padding: "4px 6px", fontWeight: 600 }}>Uraian</th>
                <th style={{ padding: "4px 6px", fontWeight: 600, textAlign: "right" }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {laporan.expenses.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>{tanggal(e.tanggal)}</td>
                  <td style={{ padding: "4px 6px" }}>{e.jenis}</td>
                  <td style={{ padding: "4px 6px" }}>{e.uraian}</td>
                  <td className="num" style={{ padding: "4px 6px", textAlign: "right" }}>{rp(e.total)}</td>
                </tr>
              ))}
              {laporan.expenses.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "6px", color: "var(--muted)" }}>Belum ada pengeluaran.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tombol aksi transisi (ajukan / verifikasi / setujui / reimburse / mundur)
// ---------------------------------------------------------------------------

function AksiPetty({
  reportId,
  ke,
  label,
  mundur,
  finance,
}: {
  reportId: string;
  ke: string;
  label: string;
  mundur?: boolean;
  finance?: boolean;
}) {
  // reimburse → reimburseLaporanPetty; sisanya (verifikasi/kembalikan/setujui/
  // tolak) → transisiLaporanPetty dengan target. Ajukan punya modalnya sendiri
  // (AjukanLaporan) karena mewajibkan unggah PDF nota.
  const aksi = finance ? reimburseLaporanPetty : transisiLaporanPetty;
  const [hasil, kirim] = useActionState<HasilAksi | null, FormData>(aksi, null);

  return (
    <form action={kirim} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="hidden" name="reportId" value={reportId} />
      {!finance && <input type="hidden" name="ke" value={ke} />}
      <button
        type="submit"
        style={{
          background: mundur ? "none" : "var(--teal)",
          color: mundur ? "var(--red)" : "#fff",
          border: mundur ? "1px solid var(--line)" : "none",
          borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "3px 9px",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {label}
      </button>
      {hasil && !hasil.ok && (
        <span style={{ color: "var(--red)", fontSize: 10.5, fontWeight: 600 }}>{hasil.error}</span>
      )}
    </form>
  );
}

/**
 * Ajukan laporan — modal yang MEWAJIBKAN unggah PDF nota gabungan.
 *
 * 1 pengajuan = 1 dokumen: seluruh foto nota siklus ini dikumpulkan pemegang dana
 * jadi satu PDF, diunggah di sini. Begitu diajukan, barisnya terkunci.
 */
function AjukanLaporan({ reportId }: { reportId: string }) {
  return (
    <FormModal
      judul="Ajukan Laporan Petty Cash"
      keterangan="Lampirkan satu PDF berisi seluruh foto nota siklus ini. Setelah diajukan, baris pengeluaran terkunci dan diteruskan ke QS."
      aksi={ajukanLaporanPetty}
      labelSimpan="Ajukan"
      lebar={460}
      pemicu={(buka) => (
        <button type="button" onClick={buka} style={gayaTombolAksi}>Ajukan</button>
      )}
    >
      <input type="hidden" name="reportId" value={reportId} />
      <BarisField kolom={1}>
        <Field label="Nota gabungan (PDF)" nama="berkas" tipe="berkas" wajib />
      </BarisField>
    </FormModal>
  );
}

const gayaTombolAksi: React.CSSProperties = {
  background: "var(--teal)", color: "#fff", border: "none", borderRadius: 6,
  fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit",
};

// ---------------------------------------------------------------------------
// Modal Beri Dana (Finance) & Catat Pengeluaran (pemegang)
// ---------------------------------------------------------------------------

function BeriDana({
  projectId,
  kandidat,
}: {
  projectId: string;
  kandidat: { id: string; nama: string }[];
}) {
  return (
    <FormModal
      judul="Beri Dana Petty Cash"
      keterangan="Berikan / isi dana talangan untuk pemegang di lapangan. Plafon hanya nilai acuan imprest — tidak membatasi pengeluaran maupun reimburse."
      aksi={beriDanaPetty}
      labelSimpan="Beri Dana"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Beri Dana" />}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <BarisField kolom={1}>
        <Field
          label="Pemegang dana"
          nama="pemegangId"
          wajib
          pilihan={kandidat.map((k) => ({ nilai: k.id, label: k.nama }))}
        />
      </BarisField>
      <BarisField>
        <Field label="Plafon acuan" nama="plafon" tipe="number" satuan="Rp" wajib />
        <Field label="Nominal diberikan" nama="nominal" tipe="number" satuan="Rp" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Bukti transfer (opsional)" nama="berkas" tipe="berkas" />
      </BarisField>
    </FormModal>
  );
}

function CatatPengeluaran({ fundId }: { fundId: string }) {
  return (
    <FormModal
      judul="Catat Pengeluaran Petty Cash"
      keterangan="Menempel ke laporan berjalan (Draft) dana ini. Bisa lintas jenis biaya."
      aksi={catatPengeluaranPetty}
      labelSimpan="Catat"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat pengeluaran" />}
    >
      <input type="hidden" name="fundId" value={fundId} />
      <BarisField>
        <Field
          label="Peruntukan"
          nama="peruntukan"
          wajib
          pilihan={PERUNTUKAN_BIAYA.map((p) => ({ nilai: p, label: p }))}
        />
        <Field
          label="Jenis biaya"
          nama="jenis"
          wajib
          pilihan={JENIS_BIAYA_SWAKELOLA.map((j) => ({ nilai: j, label: j }))}
        />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Nominal" nama="total" tipe="number" satuan="Rp" wajib />
      </BarisField>
      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
        Nota tidak dilampirkan per baris — kumpulkan seluruh foto nota siklus ini jadi
        satu PDF dan unggah saat menekan <b>Ajukan</b>.
      </div>
    </FormModal>
  );
}
