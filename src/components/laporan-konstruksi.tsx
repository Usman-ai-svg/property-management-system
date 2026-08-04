import { Badge, WARNA_STATUS } from "@/components/ui";
import { RingkasProgress } from "@/components/ringkas-progress";

/**
 * Isi laporan progres konstruksi satu proyek — ringkasan + seluruh unit &
 * sarpras dalam satu tampilan, untuk bahan meeting rutin. Murni presentasional
 * dan menerima data siap-saji, jadi dipakai bersama oleh modal cepat maupun
 * halaman laporan yang bisa dicetak.
 */

export interface BarisLaporanUnit {
  nomor: number;
  fase: string;
  tipe: string;
  progress: number;
  grup: string[];
  status: string;
  updateTerakhir: string | null;
}

export interface BarisLaporanSarpras {
  nama: string;
  jenis: string;
  volume: string;
  progress: number;
  status: string;
}

export interface DataLaporanKonstruksi {
  proyek: { kode: string; nama: string };
  dicetak: string;
  unit: BarisLaporanUnit[];
  sarpras: BarisLaporanSarpras[];
}

const sel = { padding: "5px 8px", fontSize: 11.5, borderBottom: "1px solid var(--garis-halus)" } as const;

export function IsiLaporan({ data }: { data: DataLaporanKonstruksi }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow">Laporan Progres Konstruksi</div>
        <h3 className="disp" style={{ margin: "3px 0 2px", fontSize: 18 }}>{data.proyek.nama}</h3>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
          {data.proyek.kode} · dicetak {data.dicetak}
        </div>
      </div>

      <div className="grid grid2" style={{ gap: 12, marginBottom: 16 }}>
        <RingkasProgress judul="Ringkasan Progress Unit" nilai={data.unit.map((u) => u.progress)} satuan="unit" />
        <RingkasProgress judul="Ringkasan Progress Sarana & Prasarana" nilai={data.sarpras.map((s) => s.progress)} satuan="item" />
      </div>

      {/* ---------- unit ---------- */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>Progress Unit · {data.unit.length}</div>
      <div style={{ overflowX: "auto", marginBottom: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={sel}>Unit</th>
              <th style={sel}>Fase</th>
              <th style={sel}>Tipe</th>
              <th style={{ ...sel, textAlign: "right" }}>Progress</th>
              <th style={sel}>Keterangan Pekerjaan</th>
              <th style={sel}>Status</th>
              <th style={sel}>Update Terakhir</th>
            </tr>
          </thead>
          <tbody>
            {data.unit.map((u) => (
              <tr key={`${u.fase}-${u.nomor}`}>
                <td style={{ ...sel, fontWeight: 600 }}>{u.nomor}</td>
                <td style={sel}>{u.fase}</td>
                <td style={sel}>{u.tipe}</td>
                <td style={{ ...sel, textAlign: "right", fontWeight: 600 }}>{u.progress}%</td>
                <td style={sel}>{u.grup.length ? u.grup.join(", ") : "—"}</td>
                <td style={sel}><Badge nilai={u.status} peta={WARNA_STATUS.bangun} /></td>
                <td style={{ ...sel, color: "var(--muted)" }}>{u.updateTerakhir ?? "—"}</td>
              </tr>
            ))}
            {data.unit.length === 0 && (
              <tr><td style={{ ...sel, color: "var(--muted)" }} colSpan={7}>Tidak ada unit.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- sarpras ---------- */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>Sarana & Prasarana · {data.sarpras.length}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={sel}>Item</th>
              <th style={sel}>Jenis</th>
              <th style={sel}>Volume</th>
              <th style={{ ...sel, textAlign: "right" }}>Progress</th>
              <th style={sel}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.sarpras.map((s) => (
              <tr key={s.nama}>
                <td style={{ ...sel, fontWeight: 600 }}>{s.nama}</td>
                <td style={sel}>{s.jenis}</td>
                <td style={sel}>{s.volume}</td>
                <td style={{ ...sel, textAlign: "right", fontWeight: 600 }}>{s.progress}%</td>
                <td style={sel}><Badge nilai={s.status} peta={WARNA_STATUS.bangun} /></td>
              </tr>
            ))}
            {data.sarpras.length === 0 && (
              <tr><td style={{ ...sel, color: "var(--muted)" }} colSpan={5}>Tidak ada item.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
