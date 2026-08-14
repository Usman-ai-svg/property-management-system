"use client";

import { useState } from "react";
import { periodeBulan, rp, rpRingkas } from "@/lib/format";

/**
 * Grafik rencana cashflow per bulan.
 *
 * Batang berkelompok Kas Masuk (teal) vs Kas Keluar (amber) di satu sumbu
 * Rupiah — sama satuan, jadi tak ada sumbu ganda. Pasangan teal/amber aman
 * untuk buta warna (biru↔jingga). Kumulatif & net ditunjukkan lewat tooltip
 * hover, bukan garis kedua, supaya skala batang tetap terbaca. Warna memakai
 * token desain aplikasi sehingga otomatis mengikuti tema terang/gelap.
 */

/** Label sumbu ringkas "Agu 26" (tahun 2 digit) dari "YYYY-MM". */
function labelSumbu(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  return m ? `${periodeBulan(periode).slice(0, 3)} ${m[1].slice(2)}` : periode;
}

interface Titik {
  periode: string;
  masuk: number;
  keluar: number;
}

export function GrafikCashflow({ data }: { data: Titik[] }) {
  const [aktif, setAktif] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
        Belum ada periode cashflow untuk digambar.
      </div>
    );
  }

  // Geometri (user unit = pixel; svg tidak diskalakan agar tooltip presisi).
  const padT = 14, padB = 30, padL = 68, padR = 12;
  const grupW = 60, plotH = 220;
  const totalW = padL + data.length * grupW + padR;
  const totalH = padT + plotH + padB;

  const maks = Math.max(1, ...data.map((d) => Math.max(d.masuk, d.keluar)));
  // Skala "cantik": bulatkan ke atas ke kelipatan yang enak dibaca.
  const langkah = niceStep(maks / 4);
  const atas = Math.ceil(maks / langkah) * langkah;
  const y = (v: number) => padT + plotH - (v / atas) * plotH;

  const garisY: number[] = [];
  for (let v = 0; v <= atas + 0.5; v += langkah) garisY.push(v);

  const barW = (grupW - 10) / 2 - 2; // dua batang + jeda tengah + margin grup

  let kum = 0;
  const titik = data.map((d) => {
    kum += d.masuk - d.keluar;
    return { ...d, net: d.masuk - d.keluar, kumulatif: kum };
  });

  const xGrup = (i: number) => padL + i * grupW;

  return (
    <div style={{ position: "relative" }}>
      {/* Legenda */}
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 11.5 }}>
        {[
          ["Kas Masuk", "var(--teal)"],
          ["Kas Keluar", "var(--amber)"],
        ].map(([label, warna]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: warna }} />
            <span style={{ color: "var(--muted)" }}>{label}</span>
          </span>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg
          width={totalW}
          height={totalH}
          role="img"
          aria-label="Grafik rencana cashflow per bulan"
          style={{ display: "block", maxWidth: "none", fontFamily: "inherit" }}
        >
          {/* Gridlines + label sumbu Y */}
          {garisY.map((v, i) => (
            <g key={i}>
              <line
                x1={padL} x2={totalW - padR} y1={y(v)} y2={y(v)}
                stroke="var(--garis-halus)" strokeWidth={1}
              />
              <text
                x={padL - 8} y={y(v) + 3} textAnchor="end"
                fontSize={10} fill="var(--muted)"
              >
                {v === 0 ? "0" : rpRingkas(v).replace("Rp ", "")}
              </text>
            </g>
          ))}

          {titik.map((d, i) => {
            const gx = xGrup(i);
            const hovered = aktif === i;
            return (
              <g key={d.periode}>
                {/* Pita sorot + area hit (setinggi plot) */}
                <rect
                  x={gx} y={padT} width={grupW} height={plotH}
                  fill={hovered ? "var(--rona-abu)" : "transparent"}
                  onMouseEnter={() => setAktif(i)}
                  onMouseLeave={() => setAktif((a) => (a === i ? null : a))}
                />
                {/* Batang Kas Masuk */}
                <rect
                  x={gx + 5} y={y(d.masuk)} width={barW} height={padT + plotH - y(d.masuk)}
                  rx={3} fill="var(--teal)" pointerEvents="none"
                />
                {/* Batang Kas Keluar */}
                <rect
                  x={gx + 5 + barW + 4} y={y(d.keluar)} width={barW} height={padT + plotH - y(d.keluar)}
                  rx={3} fill="var(--amber)" pointerEvents="none"
                />
                {/* Label bulan */}
                <text
                  x={gx + grupW / 2} y={totalH - 10} textAnchor="middle"
                  fontSize={10} fill={hovered ? "var(--text)" : "var(--muted)"}
                  fontWeight={hovered ? 700 : 400}
                >
                  {labelSumbu(d.periode)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {aktif != null && (
        <div
          style={{
            position: "absolute", top: 30,
            left: Math.min(xGrup(aktif) + grupW / 2 + 8, totalW - 190),
            pointerEvents: "none",
            background: "var(--card, #fff)", border: "1px solid var(--line)", borderRadius: 9,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)", padding: "9px 12px", fontSize: 11.5, minWidth: 170,
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{periodeBulan(titik[aktif].periode)}</div>
          {(
            [
              ["Kas Masuk", rp(titik[aktif].masuk), "var(--teal)"],
              ["Kas Keluar", rp(titik[aktif].keluar), "var(--amber)"],
              ["Net", (titik[aktif].net < 0 ? "−" : "") + rp(Math.abs(titik[aktif].net)), titik[aktif].net >= 0 ? "var(--green)" : "var(--red)"],
              ["Kumulatif", (titik[aktif].kumulatif < 0 ? "−" : "") + rp(Math.abs(titik[aktif].kumulatif)), "var(--text)"],
            ] as [string, string, string][]
          ).map(([label, nilai, warna], i) => (
            <div
              key={label}
              style={{
                display: "flex", justifyContent: "space-between", gap: 14,
                padding: "2px 0",
                borderTop: i === 2 ? "1px solid var(--garis-halus)" : undefined,
                marginTop: i === 2 ? 3 : 0, paddingTop: i === 2 ? 5 : 2,
              }}
            >
              <span style={{ color: "var(--muted)" }}>{label}</span>
              <span className="num" style={{ color: warna, fontWeight: 600 }}>{nilai}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kelipatan "cantik" (1/2/5 × 10ⁿ) terdekat di atas sebuah nilai kasar. */
function niceStep(kasar: number): number {
  if (kasar <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(kasar)));
  const n = kasar / p;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return f * p;
}
