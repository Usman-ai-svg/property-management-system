import { rp } from "@/lib/format";
import { Track } from "./ui";
import type { BarisOpname } from "@/lib/calc/opname";

/**
 * Laporan opname mingguan.
 *
 * Tiga blok kolom: sampai minggu lalu, penambahan minggu ini, dan kumulatif
 * sampai minggu ini. Kolom uraian, volume, dan satuan dibekukan di kiri
 * karena sisanya sembilan kolom angka — tanpa itu, konteks barisnya hilang
 * begitu tabel digeser.
 */
export function TabelMingguan({
  baris,
  bolehHarga,
}: {
  baris: BarisOpname[];
  bolehHarga: boolean;
}) {
  const total = (k: keyof BarisOpname) =>
    baris.reduce((a, r) => a + (r[k] as number), 0);

  const kolomBlok = bolehHarga ? 3 : 2;

  return (
    <div className="card tablewrap" style={{ maxHeight: 460, overflowY: "auto" }}>
      <table>
        <thead>
          <tr>
            <th className="frz" rowSpan={2} style={{ left: 0, minWidth: 180, width: 180 }}>
              Uraian Pekerjaan
            </th>
            <th className="frz" rowSpan={2} style={{ left: 180, minWidth: 46, width: 46, textAlign: "right" }}>
              Vol
            </th>
            <th className="frz frzedge" rowSpan={2} style={{ left: 226, minWidth: 40, width: 40 }}>
              Sat
            </th>
            <th rowSpan={2} style={{ textAlign: "right" }}>Bobot</th>
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "#f2f5f6" }}>
              Progress Minggu Lalu
            </th>
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "#eef3f4" }}>
              Progress Minggu Ini
            </th>
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "#e7eefb" }}>
              Progress s.d. Minggu Ini
            </th>
          </tr>
          <tr>
            <th style={{ textAlign: "right", background: "#f2f5f6" }}>%</th>
            <th style={{ textAlign: "right", background: "#f2f5f6" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "#f2f5f6" }}>Nilai</th>}
            <th style={{ textAlign: "right", background: "#eef3f4" }}>%</th>
            <th style={{ textAlign: "right", background: "#eef3f4" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "#eef3f4" }}>Nilai</th>}
            <th style={{ background: "#e7eefb", minWidth: 128 }}>Progress</th>
            <th style={{ textAlign: "right", background: "#e7eefb" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "#e7eefb" }}>Nilai</th>}
          </tr>
        </thead>
        <tbody>
          {baris.map((r, i) => {
            const naik = r.deltaProgres > 0;
            return (
              <tr key={i}>
                <td className="frz" style={{ left: 0, minWidth: 180, width: 180 }}>
                  {r.grup && (
                    <span style={{ fontSize: 9.5, color: "var(--muted)", display: "block" }}>{r.grup}</span>
                  )}
                  {r.uraian}
                </td>
                <td className="frz" style={{ left: 180, width: 46, textAlign: "right" }}>
                  {r.volume.toLocaleString("id-ID")}
                </td>
                <td className="frz frzedge" style={{ left: 226, width: 40 }}>{r.satuan}</td>
                <td style={{ textAlign: "right", color: "var(--muted)" }}>{r.bobot.toFixed(2)}</td>

                <td style={{ textAlign: "right" }}>{r.progresLalu}%</td>
                <td style={{ textAlign: "right" }}>{r.bobotLalu.toFixed(2)}</td>
                {bolehHarga && <td style={{ textAlign: "right" }}>{rp(r.nilaiLalu)}</td>}

                <td
                  style={{
                    textAlign: "right",
                    color: naik ? "var(--teal)" : "var(--muted)",
                    fontWeight: naik ? 600 : 400,
                  }}
                >
                  {naik ? "+" : ""}
                  {r.deltaProgres}%
                </td>
                <td style={{ textAlign: "right", color: naik ? "var(--teal)" : "var(--muted)" }}>
                  {r.deltaBobot > 0 ? "+" : ""}
                  {r.deltaBobot.toFixed(2)}
                </td>
                {bolehHarga && (
                  <td style={{ textAlign: "right", color: naik ? "var(--teal)" : "var(--muted)" }}>
                    {r.deltaNilai > 0 ? "+" : ""}
                    {rp(r.deltaNilai)}
                  </td>
                )}

                <td style={{ background: "#f6f9fa", minWidth: 128 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Track
                      nilai={r.progresKini}
                      tinggi={9}
                      warna={
                        r.progresKini === 100 ? "var(--green)" : r.progresKini === 0 ? "#c3ccd0" : "var(--teal)"
                      }
                    />
                    <span
                      style={{
                        fontSize: 10.5, fontWeight: 600, width: 30, textAlign: "right",
                        color: r.progresKini === 100 ? "var(--green)" : "var(--muted)",
                      }}
                    >
                      {r.progresKini}%
                    </span>
                  </div>
                </td>
                <td style={{ textAlign: "right", background: "#f6f9fa" }}>{r.bobotKini.toFixed(2)}</td>
                {bolehHarga && (
                  <td style={{ textAlign: "right", background: "#f6f9fa" }}>{rp(r.nilaiKini)}</td>
                )}
              </tr>
            );
          })}

          <tr style={{ fontWeight: 700 }}>
            <td className="frz" style={{ left: 0, width: 180 }}>TOTAL</td>
            <td className="frz" style={{ left: 180, width: 46 }} />
            <td className="frz frzedge" style={{ left: 226, width: 40 }} />
            <td style={{ textAlign: "right" }}>100,00</td>
            <td />
            <td style={{ textAlign: "right" }}>{total("bobotLalu").toFixed(2)}</td>
            {bolehHarga && <td style={{ textAlign: "right" }}>{rp(total("nilaiLalu"))}</td>}
            <td />
            <td style={{ textAlign: "right" }}>{total("deltaBobot").toFixed(2)}</td>
            {bolehHarga && <td style={{ textAlign: "right" }}>{rp(total("deltaNilai"))}</td>}
            <td style={{ background: "#eef3f4" }} />
            <td style={{ textAlign: "right", background: "#eef3f4" }}>{total("bobotKini").toFixed(2)}</td>
            {bolehHarga && (
              <td style={{ textAlign: "right", background: "#eef3f4" }}>{rp(total("nilaiKini"))}</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
