import { rp } from "@/lib/format";
import { Track } from "./ui";
import { ringkasOpname, type BarisOpname } from "@/lib/calc/opname";

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
  // Angka baris TOTAL diambil dari ringkasan yang sama dengan yang dipakai
  // laporan tersimpan, bukan dijumlah ulang di sini.
  const total = ringkasOpname(baris);

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
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "var(--rona-kosong)" }}>
              Progress Minggu Lalu
            </th>
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "var(--rona-teal)" }}>
              Progress Minggu Ini
            </th>
            <th colSpan={kolomBlok} style={{ textAlign: "center", background: "var(--rona-biru)" }}>
              Progress s.d. Minggu Ini
            </th>
          </tr>
          <tr>
            <th style={{ textAlign: "right", background: "var(--rona-kosong)" }}>%</th>
            <th style={{ textAlign: "right", background: "var(--rona-kosong)" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "var(--rona-kosong)" }}>Nilai</th>}
            <th style={{ textAlign: "right", background: "var(--rona-teal)" }}>%</th>
            <th style={{ textAlign: "right", background: "var(--rona-teal)" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "var(--rona-teal)" }}>Nilai</th>}
            <th style={{ background: "var(--rona-biru)", minWidth: 128 }}>Progress</th>
            <th style={{ textAlign: "right", background: "var(--rona-biru)" }}>Bobot</th>
            {bolehHarga && <th style={{ textAlign: "right", background: "var(--rona-biru)" }}>Nilai</th>}
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

                <td style={{ background: "var(--rona-baris)", minWidth: 128 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Track
                      nilai={r.progresKini}
                      tinggi={9}
                      warna={
                        r.progresKini === 100 ? "var(--green)" : r.progresKini === 0 ? "var(--rona-ikon)" : "var(--teal)"
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
                <td style={{ textAlign: "right", background: "var(--rona-baris)" }}>{r.bobotKini.toFixed(2)}</td>
                {bolehHarga && (
                  <td style={{ textAlign: "right", background: "var(--rona-baris)" }}>{rp(r.nilaiKini)}</td>
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
            <td style={{ textAlign: "right" }}>{total.bobotLalu.toFixed(2)}</td>
            {bolehHarga && <td style={{ textAlign: "right" }}>{rp(total.nilaiLalu)}</td>}
            <td />
            <td style={{ textAlign: "right" }}>{total.deltaBobot.toFixed(2)}</td>
            {bolehHarga && <td style={{ textAlign: "right" }}>{rp(total.deltaNilai)}</td>}
            <td style={{ background: "var(--rona-teal)" }} />
            <td style={{ textAlign: "right", background: "var(--rona-teal)" }}>{total.bobotKini.toFixed(2)}</td>
            {bolehHarga && (
              <td style={{ textAlign: "right", background: "var(--rona-teal)" }}>{rp(total.nilaiKini)}</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
