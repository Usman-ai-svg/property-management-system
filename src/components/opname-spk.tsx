"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabel } from "@/components/kartu-tabel";
import { pct, rp } from "@/lib/format";
import type { HasilAksi } from "@/lib/actions/guard";
import { jepitProgres, ringkasOpnamePersen } from "@/lib/calc/opname";
import { boqCocokDenganSpk } from "@/lib/calc/kontrak-boq";

/**
 * Opname BOQ SPK (Progress Vendor): QS mengisi progres tiap baris pekerjaan
 * kontrak, lalu menyimpan sekali. Dipakai di modul Konstruksi.
 *
 * Aksi penyimpanan diterima lewat prop `aksi` — komponen di `components/`
 * tidak boleh bergantung pada berkas di `app/`.
 *
 * PENTING: ini Progress Vendor (lingkup satu SPK), BUKAN Progress Konstruksi
 * (lingkup penuh unit dari BOQ Master). Keduanya sengaja tidak saling mengisi.
 */

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

export function TabelOpnameSpk({
  aksi,
  contractId,
  tujuan,
  objek,
  bolehUbah,
  bolehHarga,
}: {
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  contractId: string;
  /** Objek yang diopname: "unit:<id>" | "sarpras:<id>". */
  tujuan: string;
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
  const [hasil, kirim] = useActionState(aksi, null);

  const berubah = useMemo(
    () => [...nilai.entries()].filter(([id, v]) => semula.get(id) !== v).length,
    [nilai, semula],
  );

  const angka = (id: string) => nilai.get(id) ?? 0;
  const ubah = (id: string, v: number) =>
    setNilai((lama) => new Map(lama).set(id, jepitProgres(v)));

  return (
    <form action={kirim}>
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="objek" value={tujuan} />

      {objek.map((o) => {
        const { total, terpasang, persen } = ringkasOpnamePersen(o.baris, (b) => angka(b.id));

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
                    style={{ background: diubah ? "var(--rona-amber)" : p === 100 ? "var(--rona-hijau)" : undefined }}
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
            Progress Vendor ini lingkup satu SPK — tidak mengubah Progress Konstruksi unit.
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

/** Ringkasan capaian SPK, dipakai di kepala halaman drill vendor. */
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

  const selisih = nilaiBoq - nilaiKontrak;
  const cocok = boqCocokDenganSpk(nilaiBoq, nilaiKontrak);

  return (
    <div className="grid grid4" style={{ gap: 12, marginBottom: 16 }}>
      {(
        [
          ["NILAI SPK", rp(nilaiKontrak), "var(--ink)"],
          ["NILAI BOQ TERINCI", rp(nilaiBoq), cocok ? "var(--ink)" : "var(--amber)"],
          ["PEKERJAAN TERPASANG", rp(terpasang), "var(--green)"],
          ["CAPAIAN", nilaiBoq ? pct(terpasang / nilaiBoq, 1) : "—", "var(--teal)"],
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
