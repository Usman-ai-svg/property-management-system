"use client";

import { useState } from "react";
import { Donut, LegendaDonut } from "@/components/charts";
import { Kartu } from "@/components/ui";

type Komp = { label: string; nilai: number; warna: string }[];

/**
 * Kartu "Breakdown Kategori" dengan peralihan Jenis/Peruntukan.
 *
 * Dulu peralihannya memakai `<Link href="?donat=…">` yang memicu navigasi server
 * penuh — halaman ter-render ulang dan scroll melompat ke atas tiap kali ditekan.
 * Kedua komposisi kini dihitung di server lalu dikirim ke sini, dan peralihannya
 * murni state lokal: tak ada muat ulang, tak ada lompatan scroll.
 */
export function BreakdownKategori({
  jenis, peruntukan, ukuran,
}: {
  jenis: Komp;
  peruntukan: Komp;
  ukuran?: number;
}) {
  const [mode, setMode] = useState<"jenis" | "peruntukan">("jenis");
  const komp = mode === "jenis" ? jenis : peruntukan;

  return (
    <Kartu>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8, gap: 8, flexWrap: "wrap",
        }}
      >
        <div className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Breakdown Kategori</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setMode("jenis")}
            className={"pill" + (mode === "jenis" ? " active" : "")}
          >
            Jenis
          </button>
          <button
            type="button"
            onClick={() => setMode("peruntukan")}
            className={"pill" + (mode === "peruntukan" ? " active" : "")}
          >
            Peruntukan
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Donut data={komp} ukuran={ukuran} />
        <LegendaDonut data={komp} />
      </div>
    </Kartu>
  );
}
