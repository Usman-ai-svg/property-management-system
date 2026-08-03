import { redirect } from "next/navigation";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { dataAset } from "@/lib/data/aset";
import { rp, tanggal } from "@/lib/format";
import { Badge, BarisKpi, TabelHead } from "@/components/ui";
import { unitTerpakai } from "@/lib/calc/aset";
import { kpiAset } from "@/lib/tampilan/aset";
import { HapusAset, PenyesuaianAset, TambahAset, UbahAset } from "./editors";
import { Tabel } from "@/components/kartu-tabel";

/** Tanggal untuk <input type="date">: YYYY-MM-DD. */
const isoTanggal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const WARNA_PENYESUAIAN: Record<string, [string, string]> = {
  Hilang: ["var(--rona-merah)", "var(--red)"],
  Rusak: ["var(--rona-amber)", "var(--amber)"],
  "Perbaikan Selesai": ["var(--rona-hijau2)", "var(--green)"],
  "Koreksi Stok": ["var(--rona-biru)", "var(--blue)"],
};

const WARNA_ASET: Record<string, [string, string]> = {
  Tersedia: ["var(--rona-abu)", "var(--muted)"],
  Digunakan: ["var(--rona-teal2)", "var(--teal)"],
  Pemeliharaan: ["var(--rona-amber)", "var(--amber)"],
  Rusak: ["var(--rona-merah)", "var(--red)"],
};

export default async function EquipmentAsset() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehKelola = bolehUbah(pengguna, "aset");
  const bolehSesuaikan = bolehUbah(pengguna, "penyesuaianAset");

  const { aset, penyesuaian, daftarVendor, daftarProyek } = await dataAset(pengguna);

  const angka = kpiAset(aset);

  const kpi: [string, string][] = [
    ["Total Aset", `${angka.jumlahJenis} jenis`],
    ["Milik Sendiri / Sewa", `${angka.milikSendiri} / ${angka.sewa}`],
    ["Perlu Perhatian", String(angka.perluPerhatian)],
    [
      bolehHarga ? "Nilai Aset Sendiri" : "Servis ≤ 30 Hari",
      bolehHarga ? rp(angka.nilaiMilikSendiri) : String(angka.servisDekat),
    ],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Equipment &amp; Asset</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Equipment &amp; Asset</h2>

      <BarisKpi kpi={kpi} />

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Daftar Peralatan · ${aset.length} jenis`}
          keterangan="Aset sewa menampilkan tarif, bukan nilai perolehan."
          aksi={bolehKelola && <TambahAset vendor={daftarVendor} proyek={daftarProyek} />}
        />
        <Tabel
          kolom={[
            { label: "Kode" },
            { label: "Nama", minLebar: 200 },
            { label: "Kategori" },
            { label: "Jumlah", rata: "kanan" },
            { label: "Terpakai / Rusak", rata: "kanan" },
            { label: "Kepemilikan" },
            { label: "Lokasi" },
            { label: "Penanggung Jawab" },
            { label: "Pemakaian", rata: "kanan" },
            { label: "Servis Berikut" },
            bolehHarga && { label: "Nilai / Tarif", rata: "kanan" },
            { label: "Status" },
            (bolehKelola || bolehSesuaikan) && { lebar: 150 },
          ]}
        >
          {aset.map((a) => {
            const servisLewat = a.servisBerikut && a.servisBerikut < new Date();
            return (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.kode}</td>
                <td>
                  <div>{a.nama}</div>
                  {a.merk && (
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.merk}</div>
                  )}
                </td>
                <td style={{ color: "var(--muted)" }}>{a.kategori}</td>
                <td style={{ textAlign: "right" }}>
                  {a.jumlah} {a.satuan}
                </td>
                <td style={{ textAlign: "right" }}>
                  {unitTerpakai(a)}
                  {a.jumlahRusak > 0 ? (
                    <span style={{ color: "var(--red)" }}> / {a.jumlahRusak} rusak</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}> / —</span>
                  )}
                </td>
                <td>
                  {a.kepemilikan === "Sewa" ? (
                    <>
                      <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                        Sewa
                      </span>
                      {a.vendor && (
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                          {a.vendor.nama}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                      Milik Sendiri
                    </span>
                  )}
                </td>
                <td>{a.project?.kode ?? "—"}</td>
                <td style={{ color: "var(--muted)" }}>{a.penanggungJawab ?? "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {a.pemakaian.toLocaleString("id-ID")} {a.satuanPakai}
                </td>
                <td style={{ color: servisLewat ? "var(--red)" : "var(--muted)" }}>
                  {tanggal(a.servisBerikut)}
                  {servisLewat && (
                    <div style={{ fontSize: 10, fontWeight: 600 }}>terlewat</div>
                  )}
                </td>
                {bolehHarga && (
                  <td className="num" style={{ textAlign: "right" }}>
                    {rp(a.nilai)}
                    {a.kepemilikan === "Sewa" && (
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
                        per {a.satuanPakai}
                      </div>
                    )}
                  </td>
                )}
                <td>
                  <Badge nilai={a.status} peta={WARNA_ASET} />
                </td>
                {(bolehKelola || bolehSesuaikan) && (
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {bolehSesuaikan && (
                        <PenyesuaianAset
                          aset={{
                            id: a.id, kode: a.kode, nama: a.nama, satuan: a.satuan,
                            jumlah: a.jumlah, jumlahRusak: a.jumlahRusak,
                          }}
                        />
                      )}
                      {bolehKelola && (
                      <UbahAset
                        aset={{
                          id: a.id, kode: a.kode, nama: a.nama, kategori: a.kategori,
                          merk: a.merk, jumlah: a.jumlah, satuan: a.satuan,
                          kepemilikan: a.kepemilikan, vendorId: a.vendorId,
                          projectId: a.projectId, penanggungJawab: a.penanggungJawab,
                          status: a.status, satuanPakai: a.satuanPakai, pemakaian: a.pemakaian,
                          servisTerakhir: isoTanggal(a.servisTerakhir),
                          servisBerikut: isoTanggal(a.servisBerikut),
                          nilai: a.nilai,
                        }}
                        vendor={daftarVendor}
                        proyek={daftarProyek}
                      />
                      )}
                    {bolehKelola && <HapusAset id={a.id} kode={a.kode} />}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </Tabel>
      </div>

      {/* ---------- riwayat penyesuaian ---------- */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Riwayat Penyesuaian Stok · ${penyesuaian.length} catatan terakhir`}
          keterangan={
            "Kehilangan, kerusakan, perbaikan, dan koreksi opname. Bersifat tetap — " +
            "pencatatan yang salah diperbaiki dengan Koreksi Stok baru, bukan dihapus."
          }
        />
        <Tabel
          tinggiMaks={420}
          kolom={[
            { label: "Tanggal", lebar: 110 },
            { label: "Aset", minLebar: 170 },
            { label: "Jenis" },
            { label: "Banyak", rata: "kanan" },
            { label: "Stok", rata: "kanan" },
            { label: "Rusak", rata: "kanan" },
            { label: "Keterangan", minLebar: 220 },
            { label: "Penanggung Jawab" },
            { label: "Dicatat Oleh" },
          ]}
          kosong="Belum ada penyesuaian stok yang tercatat."
        >
          {penyesuaian.map((r) => (
            <tr key={r.id}>
              <td style={{ color: "var(--muted)" }}>{tanggal(r.tanggal)}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{r.equipment.kode}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{r.equipment.nama}</div>
              </td>
              <td>
                <Badge nilai={r.jenis} peta={WARNA_PENYESUAIAN} />
              </td>
              <td style={{ textAlign: "right" }}>
                {r.banyak > 0 ? `+${r.banyak}` : r.banyak} {r.equipment.satuan}
              </td>
              <td style={{ textAlign: "right", color: "var(--muted)" }}>
                {r.jumlahSebelum} → <b style={{ color: "var(--text)" }}>{r.jumlahSesudah}</b>
              </td>
              <td style={{ textAlign: "right", color: "var(--muted)" }}>
                {r.rusakSebelum} → <b style={{ color: "var(--text)" }}>{r.rusakSesudah}</b>
              </td>
              <td style={{ whiteSpace: "normal" }}>{r.keterangan}</td>
              <td style={{ color: "var(--muted)" }}>{r.penanggungJawab ?? "—"}</td>
              <td style={{ color: "var(--muted)" }}>{r.dicatatOleh}</td>
            </tr>
          ))}
        </Tabel>
      </div>
    </div>
  );
}
