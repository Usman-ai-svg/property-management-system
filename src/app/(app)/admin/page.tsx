import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehUbah, filterProjectIdOpsional, filterProyek } from "@/lib/auth/rbac";
import { SECTION_LABELS, SECTIONS, type Section } from "@/lib/domain/enums";
import { luasTotal } from "@/lib/data/proyek";
import { m2, tanggalJam } from "@/lib/format";
import { Badge, TabelHead, Terbatas, WARNA_STATUS } from "@/components/ui";
import { SelIzin, TombolStatusUser } from "./matriks";
import {
  HapusFase, HapusProyek, HapusUser, KelolaFase, TambahProyek, TambahUser,
  UbahFase, UbahProyek, UbahUser,
} from "./editors-admin";

const TAB = [
  ["proyek", "Pengelolaan Proyek"],
  ["akses", "Kelola Hak Akses"],
  ["user", "Kelola User"],
  ["log", "Log Perubahan"],
] as const;

/** Warna chip peran, mengikuti pengelompokan pada artifact. */
const WARNA_GRUP: Record<string, [string, string]> = {
  lead: ["var(--rona-brass)", "var(--brass)"],
  ops: ["var(--rona-biru)", "var(--blue)"],
  biz: ["var(--rona-brass)", "var(--brass)"],
  tech: ["var(--rona-teal2)", "var(--teal)"],
  cc: ["var(--rona-abu)", "var(--muted)"],
  fin: ["var(--rona-hijau2)", "var(--green)"],
  hr: ["var(--rona-amber)", "var(--amber)"],
  mkt: ["var(--rona-biru)", "var(--blue)"],
  media: ["var(--rona-ungu)", "#8b5cf6"],
};

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { tab = "proyek" } = await searchParams;
  const tabAktif = TAB.some(([t]) => t === tab) ? tab : "proyek";

  // Halaman Admin dibuka untuk semua peran yang bisa melihat deskripsi proyek,
  // tetapi hanya yang boleh MENGUBAHNYA yang bisa menyunting matriks.
  const bisaKelola = bolehUbah(pengguna, "deskripsi");

  const [proyek, peran, users, log] = await Promise.all([
    prisma.project.findMany({
      where: filterProyek(pengguna),
      orderBy: { kode: "asc" },
      select: {
        id: true, kode: true, nama: true, status: true, statusLahan: true,
        luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
        fases: {
          orderBy: { urutan: "asc" as const },
          select: { id: true, kode: true, nama: true, urutan: true, _count: { select: { units: true } } },
        },
        _count: { select: { units: true, infrastructures: true, contracts: true } },
      },
    }),
    prisma.role.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true, nama: true, grup: true,
        permissions: { select: { section: true, bolehUbah: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true, nama: true, inisial: true, email: true, aktif: true, semuaProyek: true,
        roles: { select: { role: { select: { id: true, nama: true, grup: true } } } },
        aksesProyek: { select: { project: { select: { id: true, kode: true } } } },
      },
    }),
    prisma.auditLog.findMany({
      where: filterProjectIdOpsional(pengguna),
      orderBy: { waktu: "desc" },
      take: 60,
      select: {
        id: true, waktu: true, peran: true, objek: true, aksi: true,
        nilaiDari: true, nilaiKe: true,
        user: { select: { nama: true } },
        project: { select: { kode: true } },
      },
    }),
  ]);

  const tingkatIzin = (
    p: { section: string; bolehUbah: boolean }[],
    s: Section,
  ): "tidak" | "lihat" | "ubah" => {
    const izin = p.find((x) => x.section === s);
    if (!izin) return "tidak";
    return izin.bolehUbah ? "ubah" : "lihat";
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Administrasi Sistem</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Admin</h2>

      <div className="tabbar" style={{ margin: "14px 0 18px" }}>
        {TAB.map(([id, label]) => (
          <Link key={id} href={`?tab=${id}`} className={"tab" + (tabAktif === id ? " active" : "")}>
            {label}
          </Link>
        ))}
      </div>

      {/* ================= PENGELOLAAN PROYEK ================= */}
      {tabAktif === "proyek" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <TabelHead
            judul={`Pengelolaan Proyek · ${proyek.length} proyek`}
            keterangan="Fase dikelola di sini. Lokasi, luas, unit, dan sarpras disunting dari Master Proyek."
            aksi={bisaKelola && <TambahProyek />}
          />
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Proyek</th>
                  <th>Status</th>
                  <th>Status Lahan</th>
                  <th style={{ textAlign: "right" }}>Luas Total</th>
                  <th style={{ textAlign: "right" }}>Unit</th>
                  <th style={{ textAlign: "right" }}>Sarpras</th>
                  <th style={{ textAlign: "right" }}>Kontrak</th>
                  <th style={{ minWidth: 150 }}>Fase</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {proyek.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.nama}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.kode}</div>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{p.status}</td>
                    <td>
                      <Badge nilai={p.statusLahan} peta={WARNA_STATUS.lahan} />
                    </td>
                    <td style={{ textAlign: "right" }}>{m2(luasTotal(p))}</td>
                    <td style={{ textAlign: "right" }}>{p._count.units}</td>
                    <td style={{ textAlign: "right" }}>{p._count.infrastructures}</td>
                    <td style={{ textAlign: "right" }}>{p._count.contracts}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        {p.fases.map((f) => (
                          <span key={f.id} style={{ display: "flex", alignItems: "center" }}>
                            <span className="chip" style={{ background: "var(--rona-teal)", color: "var(--muted)" }}>
                              {f.kode}
                            </span>
                            {bisaKelola && (
                              <>
                                <UbahFase fase={f} />
                                <HapusFase id={f.id} kode={f.kode} />
                              </>
                            )}
                          </span>
                        ))}
                        {bisaKelola && (
                          <KelolaFase
                            projectId={p.id}
                            kodeProyek={p.kode}
                            fases={p.fases.map((f) => ({
                              id: f.id, kode: f.kode, nama: f.nama,
                              urutan: f.urutan, jumlahUnit: f._count.units,
                            }))}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <Link
                          href={`/master/${p.kode}`}
                          style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                        >
                          Buka →
                        </Link>
                        {bisaKelola && (
                          <>
                            <UbahProyek proyek={p} />
                            <HapusProyek id={p.id} kode={p.kode} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= KELOLA HAK AKSES ================= */}
      {tabAktif === "akses" && (
        <>
          <div
            className="card"
            style={{ padding: "13px 16px", marginBottom: 12, fontSize: 12.5, lineHeight: 1.65 }}
          >
            Matriks ini <strong>tersimpan sebagai data, bukan di dalam kode</strong> — perubahannya
            langsung berlaku tanpa deploy ulang.
            {bisaKelola ? (
              <>
                {" "}Klik sel untuk memutar tingkatnya: <b>—</b> → <b>Lihat</b> → <b>Ubah</b> → <b>—</b>.
              </>
            ) : (
              <>
                {" "}Peran Anda hanya dapat melihat matriks ini.
              </>
            )}
          </div>

          <div className="card tablewrap" style={{ maxHeight: 620, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="frz frzedge" style={{ left: 0, minWidth: 190, width: 190 }}>
                    Peran
                  </th>
                  {SECTIONS.map((s) => (
                    <th key={s} style={{ textAlign: "center", minWidth: 96 }}>
                      {SECTION_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peran.map((r) => {
                  const [bg, warna] = WARNA_GRUP[r.grup] ?? ["var(--rona-abu)", "var(--muted)"];
                  return (
                    <tr key={r.id}>
                      <td className="frz frzedge" style={{ left: 0, minWidth: 190, width: 190 }}>
                        <span className="chip" style={{ background: bg, color: warna }}>
                          {r.nama}
                        </span>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
                          {r._count.users} pengguna
                        </div>
                      </td>
                      {SECTIONS.map((s) => (
                        <td key={s} style={{ textAlign: "center" }}>
                          <SelIzin
                            roleId={r.id}
                            section={s}
                            tingkat={tingkatIzin(r.permissions, s)}
                            bolehUbah={bisaKelola}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= KELOLA USER ================= */}
      {tabAktif === "user" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <TabelHead
            judul={`Kelola User · ${users.length} pengguna`}
            keterangan={
              bisaKelola
                ? "Klik status untuk mengaktifkan atau menonaktifkan akun."
                : "Peran Anda hanya dapat melihat daftar ini."
            }
            aksi={
              bisaKelola && (
                <TambahUser
                  peran={peran.map((r) => ({ id: r.id, nama: r.nama }))}
                  proyek={proyek.map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
                />
              )
            }
          />
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Akses Proyek</th>
                  <th>Status</th>
                  {bisaKelola && <th style={{ width: 74 }} />}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 26, height: 26, borderRadius: 7, background: "var(--ink)",
                            color: "#fff", display: "grid", placeItems: "center",
                            fontSize: 10, fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          {u.inisial}
                        </span>
                        <span style={{ fontWeight: 600 }}>{u.nama}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{u.email}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {u.roles.map(({ role }) => {
                          const [bg, warna] = WARNA_GRUP[role.grup] ?? ["var(--rona-abu)", "var(--muted)"];
                          return (
                            <span key={role.nama} className="chip" style={{ background: bg, color: warna }}>
                              {role.nama}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 11.5 }}>
                      {u.semuaProyek
                        ? "Semua proyek"
                        : u.aksesProyek.length
                          ? u.aksesProyek.map((a) => a.project.kode).join(", ")
                          : "— tidak ada —"}
                    </td>
                    <td>
                      <TombolStatusUser userId={u.id} aktif={u.aktif} bolehUbah={bisaKelola} />
                    </td>
                    {bisaKelola && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <UbahUser
                            user={{
                              id: u.id, nama: u.nama, email: u.email, inisial: u.inisial,
                              semuaProyek: u.semuaProyek,
                              peranIds: u.roles.map((r) => r.role.id),
                              proyekIds: u.aksesProyek.map((a) => a.project.id),
                            }}
                            peran={peran.map((r) => ({ id: r.id, nama: r.nama }))}
                            proyek={proyek.map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
                          />
                          <HapusUser id={u.id} nama={u.nama} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= LOG PERUBAHAN ================= */}
      {tabAktif === "log" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <TabelHead
            judul={`Log Perubahan · ${log.length} entri terbaru`}
            keterangan="Bersifat append-only — tidak dapat diubah atau dihapus dari aplikasi."
          />
          {log.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Belum ada perubahan tercatat.
            </div>
          ) : (
            <div className="tablewrap" style={{ maxHeight: 620, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Waktu</th>
                    <th>Oleh</th>
                    <th>Proyek</th>
                    <th style={{ minWidth: 200 }}>Objek</th>
                    <th>Aksi</th>
                    <th style={{ minWidth: 240 }}>Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e) => (
                    <tr key={e.id}>
                      <td style={{ color: "var(--muted)" }}>{tanggalJam(e.waktu)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{e.user?.nama ?? "—"}</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{e.peran}</div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{e.project?.kode ?? "—"}</td>
                      <td style={{ whiteSpace: "normal" }}>{e.objek}</td>
                      <td>{e.aksi}</td>
                      <td style={{ whiteSpace: "normal", fontSize: 11.5 }}>
                        {e.nilaiDari != null ? (
                          <>
                            <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>
                              {e.nilaiDari}
                            </span>
                            {" → "}
                            <b>{e.nilaiKe}</b>
                          </>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>{e.nilaiKe ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!bisaKelola && (tabAktif === "akses" || tabAktif === "user") && (
        <div style={{ marginTop: 12 }}>
          <Terbatas apa="Penyuntingan hak akses dan status pengguna" />
        </div>
      )}
    </div>
  );
}
