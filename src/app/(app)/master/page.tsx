import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { ambilPengguna } from "@/lib/auth/rbac";
import { daftarProyek } from "@/lib/data/proyek";
import { m2 } from "@/lib/format";
import { Badge, JudulHalaman, WARNA_STATUS } from "@/components/ui";

export default async function MasterProyek() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const proyek = await daftarProyek(pengguna);

  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <JudulHalaman
        judul="Master Proyek"
        keterangan="Deskripsi lahan, legalitas, tipe unit, dan daftar unit per proyek."
      />

      {proyek.length === 0 && (
        <div className="terbatas">Belum ada proyek yang dapat Anda akses.</div>
      )}

      <div className="grid grid3">
        {proyek.map((p) => {
          const luasTotal =
            p.luasKavlingEfektif + p.luasSarana + p.luasPrasarana + p.luasRth;

          return (
            <Link
              key={p.id}
              href={`/master/${p.kode}`}
              className="card"
              style={{ padding: 18, textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <div>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>
                    {p.nama}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.kode}</div>
                </div>
                <ArrowUpRight size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </div>

              <div style={{ margin: "12px 0" }}>
                <Badge nilai={p.statusLahan} peta={WARNA_STATUS.lahan} />
              </div>

              <div
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, color: "var(--muted)", marginBottom: 12,
                }}
              >
                <MapPin size={13} />
                {p.kecamatan}, {p.kota}
              </div>

              <div
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                  borderTop: "1px solid var(--line)", paddingTop: 12,
                }}
              >
                <div>
                  <div className="eyebrow" style={{ fontSize: 10 }}>Unit</div>
                  <div className="num" style={{ fontSize: 15, marginTop: 2 }}>{p._count.units}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ fontSize: 10 }}>Luas total</div>
                  <div className="num" style={{ fontSize: 15, marginTop: 2 }}>{m2(luasTotal)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
