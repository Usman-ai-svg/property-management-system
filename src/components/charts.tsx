import { pct, rp } from "@/lib/format";
import { Track } from "./ui";

/** Diagram donat sederhana, digambar sebagai SVG tanpa pustaka grafik. */
export function Donut({
  data,
  ukuran = 150,
}: {
  data: { label: string; nilai: number; warna: string }[];
  ukuran?: number;
}) {
  const total = data.reduce((s, d) => s + d.nilai, 0) || 1;
  const R = 54;
  const keliling = 2 * Math.PI * R;
  let geser = 0;

  return (
    <svg viewBox="0 0 140 140" width={ukuran} height={ukuran} role="img" aria-label="Diagram komposisi">
      <g transform="rotate(-90 70 70)">
        {data.map((d) => {
          const panjang = (d.nilai / total) * keliling;
          const el = (
            <circle
              key={d.label}
              cx="70" cy="70" r={R} fill="none"
              stroke={d.warna} strokeWidth="17"
              strokeDasharray={`${panjang} ${keliling - panjang}`}
              strokeDashoffset={-geser}
            />
          );
          geser += panjang;
          return el;
        })}
      </g>
      <text
        x="70" y="68" textAnchor="middle"
        style={{ fontFamily: "var(--font-grotesk)", fontWeight: 600, fontSize: 11, fill: "var(--ink)" }}
      >
        {rp(total).replace("Rp ", "")}
      </text>
      <text x="70" y="84" textAnchor="middle" style={{ fontSize: 8, letterSpacing: 1, fill: "var(--muted)" }}>
        TOTAL
      </text>
    </svg>
  );
}

/** Grafik garis tren bulanan. */
export function TrenChart({ data }: { data: { bulan: string; nilai: number }[] }) {
  if (data.length < 2) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
        Belum cukup data untuk menggambar tren.
      </div>
    );
  }

  const w = 760, h = 190, pad = 34, padB = 26;
  const maks = Math.max(...data.map((d) => d.nilai)) * 1.12 || 1;
  const titik = data.map((d, i) => [
    pad + (i * (w - pad - 12)) / (data.length - 1),
    h - padB - (d.nilai / maks) * (h - padB - 12),
  ]);

  const garis = titik.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${garis} L ${titik[titik.length - 1][0].toFixed(1)} ${h - padB} L ${titik[0][0].toFixed(1)} ${h - padB} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }} role="img" aria-label="Tren pengeluaran">
      <path d={area} fill="rgba(31,78,95,.10)" />
      <path d={garis} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" />
      {titik.map((p, i) => (
        <circle
          key={i}
          cx={p[0]} cy={p[1]}
          r={i === titik.length - 1 ? 4.5 : 3}
          fill={i === titik.length - 1 ? "var(--teal)" : "#fff"}
          stroke="var(--teal)" strokeWidth="2"
        />
      ))}
      {data.map((d, i) => (
        <text key={d.bulan} x={titik[i][0]} y={h - 8} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>
          {d.bulan}
        </text>
      ))}
    </svg>
  );
}

/**
 * Batang realisasi terhadap RAP.
 *
 * Warnanya menandai posisi: hijau selama masih di bawah 90%, kuning saat
 * mendekati batas, merah begitu melewati RAP.
 */
export function RvsRAP({
  realisasi,
  rap,
  denganLabel,
}: {
  realisasi: number;
  rap: number;
  denganLabel?: boolean;
}) {
  const p = rap ? realisasi / rap : 0;
  const [warna, label] =
    p > 1
      ? ["var(--red)", "Melebihi RAP"]
      : p > 0.9
        ? ["var(--amber)", "Mendekati batas"]
        : ["var(--green)", "Sehat"];

  return (
    <div>
      <Track nilai={p * 100} tinggi={16} warna={warna} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
          {rp(realisasi)} / {rp(rap)} RAP
        </span>
        {denganLabel && (
          <span style={{ fontSize: 10.5, color: warna, fontWeight: 600 }}>● {label}</span>
        )}
      </div>
    </div>
  );
}

/** Daftar legenda di samping donat. */
export function LegendaDonut({
  data,
}: {
  data: { label: string; nilai: number; warna: string }[];
}) {
  const total = data.reduce((s, d) => s + d.nilai, 0) || 1;
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      {data.map((d) => (
        <div
          key={d.label}
          style={{
            display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 8,
            alignItems: "center", padding: "5px 0", fontSize: 12.5,
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: 3, background: d.warna }} />
          <span>{d.label}</span>
          <span>
            <span style={{ color: "var(--muted)", marginRight: 8 }}>{pct(d.nilai / total, 1)}</span>
            <b className="num">{rp(d.nilai)}</b>
          </span>
        </div>
      ))}
      {data.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Belum ada pengeluaran tercatat.</div>
      )}
    </div>
  );
}
