"use client";

import { useEffect, useState } from "react";
import { bagiRata, periksaAlokasi } from "@/lib/calc/keuangan";
import { rp } from "@/lib/format";

/**
 * Pembebanan satu pembayaran ke beberapa tujuan.
 *
 * Satu pembayaran tetap tersimpan sebagai **satu** baris transaksi yang cocok
 * dengan satu baris mutasi bank; yang dipecah hanyalah pembebanannya. Karena
 * itu jumlah seluruh baris di sini wajib sama persis dengan totalnya, dan
 * selisihnya ditampilkan terus-menerus supaya tidak perlu menunggu ditolak
 * server untuk tahu ada yang belum pas.
 *
 * Bagi rata hanya pengisian awal. Upah borongan untuk unit yang tipenya berbeda
 * memang tidak sama besar, jadi tiap baris tetap bisa disunting nominalnya.
 */

export interface BarisBeban {
  /** "" = level proyek, "unit:<id>", atau "sarpras:<id>" */
  tujuan: string;
  nominal: number;
}

export interface PilihanBeban {
  units: { id: string; label: string }[];
  sarpras: { id: string; label: string }[];
}

const pisah = (tujuan: string): { unitId: string | null; infrastructureId: string | null } => {
  const [jenis, id] = tujuan.split(":");
  if (jenis === "unit") return { unitId: id, infrastructureId: null };
  if (jenis === "sarpras") return { unitId: null, infrastructureId: id };
  return { unitId: null, infrastructureId: null };
};

export function AlokasiBiaya({
  total,
  pilihan,
  awal,
}: {
  total: number;
  pilihan: PilihanBeban;
  awal?: BarisBeban[];
}) {
  const [baris, setBaris] = useState<BarisBeban[]>(awal ?? [{ tujuan: "", nominal: 0 }]);
  const [kunciRata, setKunciRata] = useState(!awal);

  // Selama pengguna belum menyunting nominalnya sendiri, pembagian mengikuti
  // total yang sedang diketik. Begitu satu baris disunting manual, pengisian
  // otomatis berhenti supaya tidak menimpa angka yang sengaja dibuat berbeda.
  useEffect(() => {
    if (!kunciRata) return;
    setBaris((b) => {
      const bagian = bagiRata(total, b.length);
      return b.map((x, i) => ({ ...x, nominal: bagian[i] ?? 0 }));
    });
  }, [total, kunciRata, baris.length]);

  const ubah = (i: number, patch: Partial<BarisBeban>) =>
    setBaris((b) => b.map((x, y) => (y === i ? { ...x, ...patch } : x)));

  const tambah = () => setBaris((b) => [...b, { tujuan: "", nominal: 0 }]);
  const hapus = (i: number) => setBaris((b) => (b.length === 1 ? b : b.filter((_, y) => y !== i)));

  const ratakan = () => {
    setKunciRata(true);
    setBaris((b) => {
      const bagian = bagiRata(total, b.length);
      return b.map((x, i) => ({ ...x, nominal: bagian[i] ?? 0 }));
    });
  };

  const jumlah = baris.reduce((s, b) => s + (Number(b.nominal) || 0), 0);
  const selisih = jumlah - total;

  const galat = periksaAlokasi(
    total,
    baris.map((b) => ({ ...pisah(b.tujuan), nominal: Number(b.nominal) || 0 })),
  );

  return (
    <div>
      {baris.map((b, i) => {
        const { unitId, infrastructureId } = pisah(b.tujuan);
        return (
          <div key={i}>
            <input type="hidden" name="alokasiUnitId" value={unitId ?? ""} />
            <input type="hidden" name="alokasiSarprasId" value={infrastructureId ?? ""} />
            <input type="hidden" name="alokasiNominal" value={Number(b.nominal) || 0} />

            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 150px 26px",
                gap: 8, alignItems: "center", marginBottom: 6,
              }}
            >
              <select
                className="inp"
                value={b.tujuan}
                onChange={(e) => ubah(i, { tujuan: e.target.value })}
                style={{ fontSize: 12 }}
              >
                <option value="">— biaya level proyek —</option>
                {pilihan.units.length > 0 && (
                  <optgroup label="Unit">
                    {pilihan.units.map((u) => (
                      <option key={u.id} value={`unit:${u.id}`}>{u.label}</option>
                    ))}
                  </optgroup>
                )}
                {pilihan.sarpras.length > 0 && (
                  <optgroup label="Sarana &amp; Prasarana">
                    {pilihan.sarpras.map((s) => (
                      <option key={s.id} value={`sarpras:${s.id}`}>{s.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              <input
                className="inp"
                type="number"
                // Diberi nama supaya bisa dibedakan dari kolom Total yang juga
                // bertipe number; nilai yang dikirim ke server ada di input
                // tersembunyi bernama alokasiNominal.
                name="alokasiNominalTampil"
                value={b.nominal}
                min={0}
                onChange={(e) => {
                  setKunciRata(false);
                  ubah(i, { nominal: Number(e.target.value) || 0 });
                }}
                style={{ fontSize: 12, textAlign: "right" }}
              />

              <button
                type="button"
                onClick={() => hapus(i)}
                title="Hapus baris pembebanan"
                disabled={baris.length === 1}
                style={{
                  background: "none", border: "none", padding: 0,
                  cursor: baris.length === 1 ? "default" : "pointer",
                  color: baris.length === 1 ? "var(--line)" : "var(--red)",
                  fontSize: 15, fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        <button type="button" onClick={tambah} style={tautan}>+ Tambah tujuan</button>
        {baris.length > 1 && (
          <button type="button" onClick={ratakan} style={tautan}>Bagi rata</button>
        )}
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", gap: 10,
          marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--line)",
          fontSize: 12, flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--muted)" }}>
          Jumlah pembebanan <b className="num">{rp(jumlah)}</b> dari total{" "}
          <b className="num">{rp(total)}</b>
        </span>
        <span
          style={{
            fontWeight: 600,
            color: selisih === 0 ? "var(--green)" : "var(--red)",
          }}
        >
          {selisih === 0
            ? "seimbang"
            : `${selisih > 0 ? "lebih" : "kurang"} ${rp(Math.abs(selisih))}`}
        </span>
      </div>

      {/* Ketidakseimbangan sudah punya penandanya sendiri di atas; yang
          ditampilkan di sini hanya masalah lain — mis. tujuan yang dobel. */}
      {galat && selisih === 0 && (
        <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 6, lineHeight: 1.5 }}>
          {galat}
        </div>
      )}
    </div>
  );
}

const tautan = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "var(--teal)", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit",
} as const;
