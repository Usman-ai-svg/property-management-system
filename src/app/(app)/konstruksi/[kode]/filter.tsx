"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Penyaring fase dan kotak pencarian.
 *
 * Keadaannya disimpan di URL, bukan di dalam komponen — supaya tautan ke
 * hasil saringan tertentu bisa dibagikan dan tombol kembali bekerja wajar.
 */
export function FilterKonstruksi({
  fases,
  faseAktif,
  cariAwal,
}: {
  fases: string[];
  faseAktif: string;
  cariAwal: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [cari, setCari] = useState(cariAwal);

  const ganti = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  // Pencarian ditunda 300 ms supaya tidak menembak URL tiap ketikan.
  useEffect(() => {
    if (cari === cariAwal) return;
    const t = setTimeout(() => ganti({ cari }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari]);

  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Fase:</span>
        {["Semua", ...fases].map((f) => (
          <button
            key={f}
            type="button"
            className={"pill" + (faseAktif === f ? " active" : "")}
            onClick={() => ganti({ fase: f === "Semua" ? "" : f })}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
        <input
          className="inp"
          style={{ paddingLeft: 30, width: 220 }}
          placeholder="Cari unit / tipe…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>
    </div>
  );
}
