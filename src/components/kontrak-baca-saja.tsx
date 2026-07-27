import Link from "next/link";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp } from "@/lib/format";
import { Track } from "./ui";

/**
 * Ringkasan kontrak vendor yang menyentuh sebuah unit atau item sarpras.
 * Baca-saja — pengelolaannya ada di modul Vendor Management.
 */
export function KontrakBacaSaja({
  daftar,
  bolehHarga,
  kosong,
}: {
  daftar: {
    id: string;
    nominal: number;
    retensiPct: number;
    vendor: { nama: string };
    deskripsi: string;
    expenses: { total: number }[];
    variationOrders: { nominal: number; status: string }[];
  }[];
  bolehHarga: boolean;
  kosong: string;
}) {
  return (
    <>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div className="eyebrow">Kontrak Vendor</div>
        <Link
          href="/vendor"
          style={{ color: "var(--teal)", fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}
        >
          Kelola di Vendor Management →
        </Link>
      </div>

      {daftar.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--amber)" }}>{kosong}</div>
      ) : (
        daftar.map((k) => {
          const r = ringkasKontrak(k);
          return (
            <div key={k.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--garis-halus)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{k.vendor.nama}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>{k.deskripsi}</div>
              {bolehHarga ? (
                <>
                  <Track nilai={r.nilaiEfektif ? (r.terbayar / r.nilaiEfektif) * 100 : 0} tinggi={9} warna="var(--green)" />
                  <div
                    style={{
                      display: "flex", justifyContent: "space-between", gap: 10,
                      fontSize: 10.5, color: "var(--muted)", marginTop: 3,
                    }}
                  >
                    <span>
                      {rp(r.terbayar)} / {rp(r.nilaiEfektif)}
                      {r.voDisetujui !== 0 ? " (termasuk VO)" : ""}
                    </span>
                    <span>{pct(r.persenTerbayar, 1)} terbayar</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Nilai kontrak tidak ditampilkan untuk peran Anda.
                </div>
              )}
            </div>
          );
        })
      )}

      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>
        Baca-saja · sumber data: modul Vendor Management.
      </div>
    </>
  );
}
