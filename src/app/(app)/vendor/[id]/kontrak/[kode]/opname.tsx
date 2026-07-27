"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabel } from "@/components/kartu-tabel";
import { pct, rp } from "@/lib/format";
import type { HasilAksi } from "@/lib/actions/guard";
import { simpanProgresBoqSpk } from "../../../boq-actions";

export interface BarisOpnameSpk {
  id: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  progress: number;
}

export interface ObjekOpname {
  kunci: string;
  label: string;
  keterangan: string;
  baris: BarisOpnameSpk[];
}

function TombolSimpan({ berubah }: { berubah: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending || berubah === 0}>
      {pending ? "Menyimpan…" : berubah === 0 ? "Belum ada perubahan" : `Simpan ${berubah} baris`}
    </button>
  );
}

/**
 * Tabel opname: QS mengisi progres tiap baris pekerjaan, lalu menyimpan sekali.
 *
 * Disimpan sekali untuk seluruh SPK, bukan per baris, karena satu kali opname
 * menyentuh puluhan baris — dan tiap penyimpanan memicu penghitungan ulang
 * progres unit. Menyimpan per baris berarti puluhan kali hitung ulang untuk
 * satu pekerjaan yang sama.
 *
 * Nilai terpasang dihitung ulang di layar sambil QS mengetik, supaya angka
 * yang nanti jadi dasar penagihan terlihat sebelum disimpan, bukan sesudah.
 */
export function TabelOpnameSpk({
  contractId,
  objek,
  bolehUbah,
  bolehHarga,
}: {
  contractId: string;
  objek: ObjekOpname[];
  bolehUbah: boolean;
  bolehHarga: boolean;
}) {
  const semula = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of objek) for (const b of o.baris) m.set(b.id, b.progress);
    return m;
  }, [objek]);

  const [nilai, setNilai] = useState<Map<string, number>>(() => new Map(semula));
  const [hasil, kirim] = useActionState(simpanProgresBoqSpk, null);

  const berubah = useMemo(
    () => [...nilai.entries()].filter(([id, v]) => semula.get(id) !== v).length,
    [nilai, semula],
  );

  const angka = (id: string) => nilai.get(id) ?? 0;

  const ubah = (id: string, v: number) =>
    setNilai((lama) => new Map(lama).set(id, Math.max(0, Math.min(100, v))));

  return (
    <form action={kirim}>
      <input type="hidden" name="contractId" value={contractId} />

      {objek.map((o) => {
        const total = o.baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
        const terpasang = o.baris.reduce(
          (s, b) => s + b.volume * b.hargaSatuan * (angka(b.id) / 100),
          0,
        );
        const persen = total ? (terpasang / total) * 100 : 0;

        return (
          <div key={o.kunci} style={{ marginBottom: 18 }}>
            <Tabel
              kelasBungkus="card tablewrap"
              kolom={[
                { label: "Grup" },
                { label: "Uraian Pekerjaan", minLebar: 220 },
                { label: "Volume", rata: "kanan" },
                { label: "Satuan" },
                bolehHarga && { label: "Harga Satuan", rata: "kanan" },
                bolehHarga && { label: "Nilai", rata: "kanan" },
                { label: "Progres", lebar: 110 },
                bolehHarga && { label: "Terpasang", rata: "kanan" },
              ]}
              kosong="Belum ada baris pekerjaan pada objek ini."
            >
              {o.baris.map((b) => {
                const nilaiBaris = b.volume * b.hargaSatuan;
                const p = angka(b.id);
                const diubah = semula.get(b.id) !== p;
                return (
                  <tr
                    key={b.id}
                    style={{ background: diubah ? "var(--rona-amber)" : undefined }}
                  >
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{b.grup}</td>
                    <td>{b.uraian}</td>
                    <td style={{ textAlign: "right" }}>{b.volume.toLocaleString("id-ID")}</td>
                    <td style={{ color: "var(--muted)" }}>{b.satuan}</td>
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(b.hargaSatuan)}</td>
                    )}
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(nilaiBaris)}</td>
                    )}
                    <td>
                      <input type="hidden" name="barisId" value={b.id} />
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          className="inp"
                          type="number"
                          name="barisProgress"
                          min={0}
                          max={100}
                          value={p}
                          disabled={!bolehUbah}
                          onChange={(e) => ubah(b.id, Number(e.target.value))}
                          style={{ width: 62, fontSize: 12, padding: "4px 6px" }}
                          aria-label={`Progres ${b.uraian}`}
                        />
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>%</span>
                      </div>
                    </td>
                    {bolehHarga && (
                      <td
                        className="num"
                        style={{ textAlign: "right", color: p > 0 ? "var(--green)" : "var(--muted)" }}
                      >
                        {rp(nilaiBaris * (p / 100))}
                      </td>
                    )}
                  </tr>
                );
              })}

              {o.baris.length > 0 && (
                <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                  <td colSpan={bolehHarga ? 5 : 4}>
                    {o.label} · {o.keterangan}
                  </td>
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(total)}</td>
                  )}
                  <td>{Math.round(persen)}%</td>
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right", color: "var(--green)" }}>
                      {rp(terpasang)}
                    </td>
                  )}
                </tr>
              )}
            </Tabel>
          </div>
        );
      })}

      {bolehUbah && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            flexWrap: "wrap", marginTop: 4,
          }}
        >
          <TombolSimpan berubah={berubah} />

          {berubah > 0 && (
            <button
              type="button"
              className="btn-garis"
              onClick={() => setNilai(new Map(semula))}
            >
              Batalkan perubahan
            </button>
          )}

          <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
            Menyimpan opname otomatis memperbarui progres unit yang bersangkutan,
            tertimbang nilai tiap pekerjaan.
          </span>

          {hasil && (
            <span
              role={hasil.ok ? "status" : "alert"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, color: hasil.ok ? "var(--green)" : "var(--red)",
              }}
            >
              {hasil.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {hasil.ok ? (hasil.pesan ?? "Tersimpan.") : hasil.error}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

/** Ringkasan capaian SPK, ditampilkan di kepala halaman. */
export function RingkasOpname({
  nilaiKontrak,
  nilaiBoq,
  terpasang,
  bolehHarga,
}: {
  nilaiKontrak: number;
  nilaiBoq: number;
  terpasang: number;
  bolehHarga: boolean;
}) {
  if (!bolehHarga) return null;

  // Selisih nilai BOQ terhadap nilai kontrak layak ditunjukkan: BOQ yang
  // jumlahnya tidak sama dengan nilai SPK berarti rinciannya belum lengkap
  // atau ada yang tercatat dobel.
  const selisih = nilaiBoq - nilaiKontrak;
  const cocok = Math.abs(selisih) < 1;

  return (
    <div className="grid grid4" style={{ gap: 12, marginBottom: 16 }}>
      {(
        [
          ["NILAI SPK", rp(nilaiKontrak), "var(--ink)"],
          ["NILAI BOQ TERINCI", rp(nilaiBoq), cocok ? "var(--ink)" : "var(--amber)"],
          ["PEKERJAAN TERPASANG", rp(terpasang), "var(--green)"],
          [
            "CAPAIAN",
            nilaiBoq ? pct(terpasang / nilaiBoq, 1) : "—",
            "var(--teal)",
          ],
        ] as [string, string, string][]
      ).map(([label, isi, warna]) => (
        <div key={label} className="card kpi">
          <div className="eyebrow">{label}</div>
          <div className="v" style={{ fontSize: 15, color: warna }}>{isi}</div>
          {label === "NILAI BOQ TERINCI" && !cocok && (
            <div style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 3 }}>
              {selisih > 0 ? "lebih" : "kurang"} {rp(Math.abs(selisih))} dari nilai SPK
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
