"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { rp } from "@/lib/format";

/**
 * Tren pengeluaran 12 bulan, bisa ditelusuri per bulan.
 *
 * Titik yang sedang dibaca ditentukan oleh papan ketik maupun tetikus: tiap
 * bulan punya bidang sentuh selebar jaraknya, jadi tidak perlu membidik titik
 * kecil. Bulan terakhir terpilih lebih dulu karena itu yang paling sering
 * ingin dilihat.
 */
export interface TitikTren {
  bulan: string;
  label: string;
  nilai: number;
}

export function TrenChart({ data }: { data: TitikTren[] }) {
  const [pilih, setPilih] = useState(data.length - 1);

  if (data.length < 2) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>
        Belum cukup data untuk menggambar tren.
      </div>
    );
  }

  const i = Math.min(Math.max(pilih, 0), data.length - 1);
  const aktif = data[i];
  const sebelumnya = i > 0 ? data[i - 1] : null;
  const selisih = sebelumnya ? aktif.nilai - sebelumnya.nilai : null;

  const w = 760, h = 190, pad = 34, padB = 26;
  const maks = Math.max(...data.map((d) => d.nilai)) * 1.12 || 1;
  const x = (k: number) => pad + (k * (w - pad - 12)) / (data.length - 1);
  const y = (v: number) => h - padB - (v / maks) * (h - padB - 12);

  const titik = data.map((d, k) => [x(k), y(d.nilai)] as const);
  const garis = titik.map((p, k) => `${k ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${garis} L ${titik[titik.length - 1][0].toFixed(1)} ${h - padB} L ${titik[0][0].toFixed(1)} ${h - padB} Z`;

  // Lebar bidang sentuh tiap bulan: setengah jarak ke tetangga kiri dan kanan.
  const jarak = (w - pad - 12) / (data.length - 1);

  const geser = (arah: number) =>
    setPilih((p) => Math.min(Math.max(p + arah, 0), data.length - 1));

  return (
    <div>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          gap: 12, flexWrap: "wrap", marginBottom: 6,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{aktif.label}</div>
          <div className="num" style={{ fontSize: 19 }}>{rp(aktif.nilai)}</div>
          {selisih !== null && (
            <div
              style={{
                fontSize: 11.5,
                color: selisih > 0 ? "var(--red)" : selisih < 0 ? "var(--green)" : "var(--muted)",
              }}
            >
              {selisih === 0
                ? "sama dengan bulan sebelumnya"
                : `${selisih > 0 ? "+" : "−"}${rp(Math.abs(selisih))} dari ${sebelumnya!.label}`}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className="btn-garis"
            onClick={() => geser(-1)}
            disabled={i === 0}
            aria-label="Bulan sebelumnya"
            style={{ padding: "4px 7px", opacity: i === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="btn-garis"
            onClick={() => geser(1)}
            disabled={i === data.length - 1}
            aria-label="Bulan berikutnya"
            style={{ padding: "4px 7px", opacity: i === data.length - 1 ? 0.4 : 1 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        style={{ display: "block", touchAction: "pan-y" }}
        role="img"
        aria-label={`Tren pengeluaran 12 bulan. Bulan terpilih ${aktif.label}, ${rp(aktif.nilai)}.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); geser(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); geser(1); }
          if (e.key === "Home") { e.preventDefault(); setPilih(0); }
          if (e.key === "End") { e.preventDefault(); setPilih(data.length - 1); }
        }}
      >
        <path d={area} fill="rgba(31,78,95,.10)" />
        <path d={garis} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Garis penunjuk bulan yang sedang dibaca */}
        <line
          x1={titik[i][0]} y1={12} x2={titik[i][0]} y2={h - padB}
          stroke="var(--teal)" strokeWidth="1" strokeDasharray="3 3" opacity={0.55}
        />

        {titik.map((p, k) => (
          <circle
            key={k}
            cx={p[0]} cy={p[1]}
            r={k === i ? 5.5 : 3}
            fill={k === i ? "var(--teal)" : "#fff"}
            stroke="var(--teal)" strokeWidth="2"
          />
        ))}

        {data.map((d, k) => (
          <text
            key={d.label}
            x={titik[k][0]} y={h - 8}
            textAnchor="middle"
            style={{
              fontSize: 10,
              fill: k === i ? "var(--teal)" : "var(--muted)",
              fontWeight: k === i ? 700 : 400,
            }}
          >
            {d.bulan}
          </text>
        ))}

        {/* Bidang sentuh transparan, digambar terakhir supaya ada di atas. */}
        {data.map((d, k) => (
          <rect
            key={`sentuh-${d.label}`}
            x={titik[k][0] - jarak / 2} y={0}
            width={jarak} height={h}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setPilih(k)}
            onClick={() => setPilih(k)}
          >
            <title>{`${d.label} · ${rp(d.nilai)}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
