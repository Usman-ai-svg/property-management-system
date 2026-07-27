import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat, bolehUbah, filterProyek } from "@/lib/auth/rbac";
import { rp, tanggal } from "@/lib/format";
import { Badge, TabelHead } from "@/components/ui";
import { unitTerpakai } from "@/lib/calc/aset";
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

  const aset = await prisma.equipment.findMany({
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, kategori: true, merk: true,
      jumlah: true, jumlahRusak: true, satuan: true, kepemilikan: true, status: true,
      satuanPakai: true, pemakaian: true, nilai: true,
      servisTerakhir: true, servisBerikut: true, penanggungJawab: true,
      vendorId: true, projectId: true,
      vendor: { select: { nama: true } },
      project: { select: { kode: true } },
    },
  });

  // Riwayat penyesuaian terbaru — kehilangan, kerusakan, dan koreksi opname.
  // Ditampilkan sebagai tabel tersendiri karena inilah jawaban atas "kenapa
  // stoknya berkurang", yang tidak terbaca dari daftar aset saja.
  const penyesuaian = await prisma.equipmentAdjustment.findMany({
    orderBy: { tanggal: "desc" },
    take: 50,
    select: {
      id: true, tanggal: true, jenis: true, banyak: true,
      jumlahSebelum: true, jumlahSesudah: true,
      rusakSebelum: true, rusakSesudah: true,
      keterangan: true, penanggungJawab: true, dicatatOleh: true,
      equipment: { select: { kode: true, nama: true, satuan: true } },
    },
  });

  // Pilihan untuk formulir. Vendor tidak dibatasi proyek karena satu vendor
  // bisa menyewakan alat ke proyek mana pun.
  const [daftarVendor, daftarProyek] = bolehKelola
    ? await Promise.all([
        prisma.vendor.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
        prisma.project.findMany({
          where: filterProyek(pengguna),
          orderBy: { kode: "asc" },
          select: { id: true, nama: true },
        }),
      ])
    : [[], []];

  const milikSendiri = aset.filter((a) => a.kepemilikan === "Milik Sendiri");
  const perluPerhatian = aset.filter((a) => a.status === "Rusak" || a.status === "Pemeliharaan").length;
  const nilaiAset = milikSendiri.reduce((s, a) => s + a.nilai, 0);

  // Servis yang jatuh tempo dalam 30 hari ke depan, atau sudah terlewat.
  const ambang = new Date(Date.now() + 30 * 864e5);
  const servisDekat = aset.filter((a) => a.servisBerikut && a.servisBerikut <= ambang).length;

  const kpi: [string, string][] = [
    ["Total Aset", `${aset.length} jenis`],
    ["Milik Sendiri / Sewa", `${milikSendiri.length} / ${aset.length - milikSendiri.length}`],
    ["Perlu Perhatian", String(perluPerhatian)],
    [bolehHarga ? "Nilai Aset Sendiri" : "Servis ≤ 30 Hari", bolehHarga ? rp(nilaiAset) : String(servisDekat)],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Equipment &amp; Asset</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Equipment &amp; Asset</h2>

      <div className="grid grid4" style={{ marginTop: 16 }}>
        {kpi.map(([label, nilai]) => (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v" style={{ fontSize: 15 }}>{nilai}</div>
          </div>
        ))}
      </div>

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
