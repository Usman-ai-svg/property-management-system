"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabel } from "@/components/kartu-tabel";
import { pct, rp } from "@/lib/format";
import type { HasilAksi } from "@/lib/actions/guard";

/**
 * Opname konstruksi: QS mengisi persentase tiap baris BOQ Master Proyek.
 *
 * Inilah sumber **Progress Konstruksi** — lingkup penuh sebuah unit atau item
 * sarpras: struktur, arsitektur, MEP, hingga subkon, baik yang dikerjakan
 * sendiri maupun yang dikontrakkan ke vendor.
 *
 * Jangan dikacaukan dengan opname di halaman SPK, yang mengisi progres BOQ
 * kontrak dan hanya mencakup lingkup vendor bersangkutan. Keduanya dicatat
 * terpisah dan tidak saling mengisi.
 *
 * Disimpan sekali untuk seluruh tabel, bukan per baris, karena satu kali
 * opname menyentuh puluhan baris dan tiap penyimpanan memicu penghitungan
 * ulang progres objeknya.
 */

export interface BarisOpnameUI {
  id: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  progress: number;
}

function TombolSimpan({ berubah }: { berubah: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending || berubah === 0}>
      {pending ? "Menyimpan…" : berubah === 0 ? "Belum ada perubahan" : `Simpan ${berubah} baris`}
    </button>
  );
}

export function OpnameBoq({
  aksi,
  namaId,
  nilaiId,
  baris,
  bolehUbah,
  bolehHarga,
}: {
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  /** Nama kolom tersembunyi pengenal objek: "unitId" atau "sarprasId". */
  namaId: string;
  nilaiId: string;
  baris: BarisOpnameUI[];
  bolehUbah: boolean;
  bolehHarga: boolean;
}) {
  const semula = useMemo(
    () => new Map(baris.map((b) => [b.id, b.progress])),
    [baris],
  );
  const [nilai, setNilai] = useState<Map<string, number>>(() => new Map(semula));
  const [hasil, kirim] = useActionState(aksi, null);

  const berubah = useMemo(
    () => [...nilai.entries()].filter(([id, v]) => semula.get(id) !== v).length,
    [nilai, semula],
  );

  const angka = (id: string) => nilai.get(id) ?? 0;
  const ubah = (id: string, v: number) =>
    setNilai((lama) => new Map(lama).set(id, Math.max(0, Math.min(100, v))));

  const total = baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
  const terpasang = baris.reduce(
    (s, b) => s + b.volume * b.hargaSatuan * (angka(b.id) / 100),
    0,
  );
  const persen = total ? (terpasang / total) * 100 : 0;

  return (
    <form action={kirim}>
      <input type="hidden" name={namaId} value={nilaiId} />

      <Tabel
        kelasBungkus="card tablewrap"
        tinggiMaks={460}
        kolom={[
          { label: "Grup" },
          { label: "Uraian Pekerjaan", minLebar: 220 },
          { label: "Volume", rata: "kanan" },
          { label: "Satuan" },
          bolehHarga && { label: "Nilai", rata: "kanan" },
          bolehHarga && { label: "Bobot", rata: "kanan" },
          { label: "Progres", lebar: 110 },
          bolehHarga && { label: "Terpasang", rata: "kanan" },
        ]}
        kosong="BOQ unit ini belum disusun, jadi belum ada yang bisa diopname."
      >
        {baris.map((b) => {
          const nilaiBaris = b.volume * b.hargaSatuan;
          const p = angka(b.id);
          const diubah = semula.get(b.id) !== p;
          return (
            <tr key={b.id} style={{ background: diubah ? "var(--rona-amber)" : undefined }}>
              <td style={{ color: "var(--muted)", fontSize: 11 }}>{b.grup}</td>
              <td>{b.uraian}</td>
              <td style={{ textAlign: "right" }}>{b.volume.toLocaleString("id-ID")}</td>
              <td style={{ color: "var(--muted)" }}>{b.satuan}</td>
              {bolehHarga && (
                <td className="num" style={{ textAlign: "right" }}>{rp(nilaiBaris)}</td>
              )}
              {bolehHarga && (
                <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 11 }}>
                  {total ? pct(nilaiBaris / total, 1) : "—"}
                </td>
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

        {baris.length > 0 && (
          <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
            <td colSpan={bolehHarga ? 4 : 4}>JUMLAH</td>
            {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(total)}</td>}
            {bolehHarga && <td style={{ textAlign: "right" }}>100%</td>}
            <td>{Math.round(persen)}%</td>
            {bolehHarga && (
              <td className="num" style={{ textAlign: "right", color: "var(--green)" }}>
                {rp(terpasang)}
              </td>
            )}
          </tr>
        )}
      </Tabel>

      {bolehUbah && baris.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            flexWrap: "wrap", marginTop: 10,
          }}
        >
          <TombolSimpan berubah={berubah} />

          {berubah > 0 && (
            <button type="button" className="btn-garis" onClick={() => setNilai(new Map(semula))}>
              Batalkan perubahan
            </button>
          )}

          <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
            Progres objek dihitung dari baris-baris ini, tertimbang nilai tiap pekerjaan.
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
