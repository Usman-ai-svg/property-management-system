import { Fragment } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { dataAdmin } from "@/lib/data/admin";
import { DIVISI, divisiPeran, SECTION_LABELS, SECTIONS, type Section } from "@/lib/domain/enums";
import { tanggalJam } from "@/lib/format";
import { TabelHead, Terbatas } from "@/components/ui";
import { SelIzin, TombolStatusUser } from "./matriks";
import { HapusUser, TambahUser, UbahUser } from "./editors-admin";
import { Tabel } from "@/components/kartu-tabel";

const TAB = [
  ["akses", "Kelola Hak Akses"],
  ["user", "Kelola User"],
  ["log", "Log Perubahan"],
] as const;

/** Warna chip peran, mengikuti pengelompokan pada artifact. */
const WARNA_GRUP: Record<string, [string, string]> = {
  sys: ["var(--rona-teal)", "var(--ink)"],
  lead: ["var(--rona-brass)", "var(--brass)"],
  ops: ["var(--rona-biru)", "var(--blue)"],
  biz: ["var(--rona-brass)", "var(--brass)"],
  tech: ["var(--rona-teal2)", "var(--teal)"],
  cc: ["var(--rona-abu)", "var(--muted)"],
  fin: ["var(--rona-hijau2)", "var(--green)"],
  hr: ["var(--rona-amber)", "var(--amber)"],
  mkt: ["var(--rona-biru)", "var(--blue)"],
  media: ["var(--rona-ungu)", "var(--ungu)"],
};

/**
 * Baris kepala divisi yang membentang penuh, memisahkan kelompok peran/user
 * di bawahnya. Mengikuti pola baris kelompok pada tabel RAB & RAP (latar teal).
 * Labelnya dibuat lengket ke kiri supaya tetap terlihat saat tabel digulir
 * mendatar — sejajar dengan kolom "Peran" yang dibekukan.
 */
function BarisDivisi({ nama, kolom }: { nama: string; kolom: number }) {
  return (
    <tr style={{ background: "var(--rona-teal)" }}>
      <td colSpan={kolom} style={{ padding: 0 }}>
        <div
          style={{
            position: "sticky", left: 0, display: "inline-block",
            padding: "6px 10px", fontWeight: 700, fontSize: 10.5,
            letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink)",
          }}
        >
          {nama}
        </div>
      </td>
    </tr>
  );
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { tab = "akses" } = await searchParams;
  const tabAktif = TAB.some(([t]) => t === tab) ? tab : "akses";

  // Halaman Admin dibuka untuk semua peran yang bisa melihat deskripsi proyek,
  // tetapi hanya yang boleh MENGUBAHNYA yang bisa menyunting matriks.
  const bisaKelola = bolehUbah(pengguna, "deskripsi");

  const { proyek, peran, users, log } = await dataAdmin(pengguna);

  const tingkatIzin = (
    p: { section: string; bolehUbah: boolean }[],
    s: Section,
  ): "tidak" | "lihat" | "ubah" => {
    const izin = p.find((x) => x.section === s);
    if (!izin) return "tidak";
    return izin.bolehUbah ? "ubah" : "lihat";
  };

  // --------- Pengelompokan per divisi (bagan organisasi) ---------
  // Baris matriks hak akses dan daftar user disusun ulang mengikuti DIVISI,
  // bukan urut abjad. Peran/user yang tak masuk divisi mana pun dikumpulkan
  // di grup "Lainnya" agar tidak ada yang hilang dari tabel.
  type Peran = (typeof peran)[number];
  type UserRow = (typeof users)[number];

  const petaPeran = new Map(peran.map((r) => [r.nama, r]));
  const grupPeran: { divisi: string; roles: Peran[] }[] = DIVISI.map((d) => ({
    divisi: d.nama,
    roles: d.peran.map((n) => petaPeran.get(n)).filter((r): r is Peran => Boolean(r)),
  }));
  const dipakaiPeran = new Set(DIVISI.flatMap((d) => d.peran));
  const sisaPeran = peran.filter((r) => !dipakaiPeran.has(r.nama));
  if (sisaPeran.length) grupPeran.push({ divisi: "Lainnya", roles: sisaPeran });
  const grupPeranTampil = grupPeran.filter((g) => g.roles.length > 0);

  // User dikelompokkan menurut divisi peran utamanya (peran pertama —
  // sama dengan peran aktif saat login).
  const idxDivisiUser = (u: UserRow) => {
    const utama = u.roles[0]?.role.nama;
    return utama ? divisiPeran(utama) : -1;
  };
  const grupUser: { divisi: string; anggota: UserRow[] }[] = DIVISI.map((d, i) => ({
    divisi: d.nama,
    anggota: users.filter((u) => idxDivisiUser(u) === i),
  }));
  const sisaUser = users.filter((u) => idxDivisiUser(u) === -1);
  if (sisaUser.length) grupUser.push({ divisi: "Lainnya", anggota: sisaUser });
  const grupUserTampil = grupUser.filter((g) => g.anggota.length > 0);

  const kolomMatriks = 1 + SECTIONS.length;
  const kolomUser = 5 + (bisaKelola ? 1 : 0);

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

          <Tabel
            tinggiMaks={620} kelasBungkus="card tablewrap"
            kolom={[
              { label: "Peran", kelas: "frz frzedge", lebar: 190, minLebar: 190, gaya: { left: 0 } },
              ...SECTIONS.map((s) => ({
                label: SECTION_LABELS[s], rata: "tengah" as const, minLebar: 96,
              })),
            ]}
          >
            {grupPeranTampil.map((g) => (
              <Fragment key={g.divisi}>
                <BarisDivisi nama={g.divisi} kolom={kolomMatriks} />
                {g.roles.map((r) => {
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
              </Fragment>
            ))}
          </Tabel>
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
          <Tabel
            kolom={[
              { label: "Nama" },
              { label: "Email" },
              { label: "Peran" },
              { label: "Akses Proyek" },
              { label: "Status" },
              bisaKelola && { lebar: 74 },
            ]}
          >
            {grupUserTampil.map((g) => (
              <Fragment key={g.divisi}>
                <BarisDivisi nama={g.divisi} kolom={kolomUser} />
                {g.anggota.map((u) => (
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
              </Fragment>
            ))}
          </Tabel>
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
            <Tabel
              tinggiMaks={620}
              kolom={[
                { label: "Waktu", minLebar: 130 },
                { label: "Oleh" },
                { label: "Proyek" },
                { label: "Objek", minLebar: 200 },
                { label: "Aksi" },
                { label: "Perubahan", minLebar: 240 },
              ]}
            >
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
            </Tabel>
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
