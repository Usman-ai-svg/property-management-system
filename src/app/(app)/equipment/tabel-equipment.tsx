"use client";

import { PanelTabel } from "@/components/panel-tabel";
import { Badge } from "@/components/ui";
import { rp } from "@/lib/format";
import { JENIS_PENYESUAIAN_ASET, KEPEMILIKAN_ASET, STATUS_ASET, STATUS_PENGGUNAAN } from "@/lib/domain/enums";
import {
  type AlatPilihan, CatatServis, HapusAset, HapusPenggunaan, PenyesuaianAset,
  SelesaikanPenggunaan, TambahAset, TambahPenggunaan, UbahAset,
} from "./editors";

type Pilihan = { id: string; nama: string }[];

const WARNA_ASET: Record<string, [string, string]> = {
  Tersedia: ["var(--rona-abu)", "var(--muted)"],
  Sebagian: ["var(--rona-amber)", "var(--amber)"],
  Digunakan: ["var(--rona-teal2)", "var(--teal)"],
  Rusak: ["var(--rona-merah)", "var(--red)"],
};

const WARNA_PENGGUNAAN: Record<string, [string, string]> = {
  Aktif: ["var(--rona-teal2)", "var(--teal)"],
  Selesai: ["var(--rona-abu)", "var(--muted)"],
};

const WARNA_PENYESUAIAN: Record<string, [string, string]> = {
  Hilang: ["var(--rona-merah)", "var(--red)"],
  Rusak: ["var(--rona-amber)", "var(--amber)"],
  "Perbaikan Selesai": ["var(--rona-hijau2)", "var(--green)"],
  "Koreksi Stok": ["var(--rona-biru)", "var(--blue)"],
};

// ---------------------------------------------------------------------------
// Inventaris (Peralatan / Aset)
// ---------------------------------------------------------------------------

export interface BarisInv {
  id: string;
  kode: string;
  jenis: string;
  nama: string;
  kategori: string;
  merk: string | null;
  satuan: string;
  jumlah: number;
  jumlahRusak: number;
  dipakai: number;
  tersedia: number;
  status: string;
  kepemilikan: string;
  vendorId: string | null;
  vendorNama: string | null;
  nilai: number;
  servisTerakhirIso: string | null;
  servisBerikutIso: string | null;
  servisBerikutLabel: string;
  servisLewat: boolean;
}

export function TabelInventaris({
  judul,
  keterangan,
  jenis,
  data,
  vendor,
  bolehKelola,
}: {
  judul: string;
  keterangan: string;
  jenis: string;
  data: BarisInv[];
  vendor: Pilihan;
  bolehKelola: boolean;
}) {
  return (
    <PanelTabel<BarisInv>
      judul={judul}
      keterangan={keterangan}
      aksi={bolehKelola ? <TambahAset vendor={vendor} jenisAwal={jenis} /> : undefined}
      data={data}
      kunci={(a) => a.id}
      cari={(a) => `${a.kode} ${a.nama} ${a.merk ?? ""} ${a.kategori}`}
      petunjukCari="Cari kode, nama, merk, atau kategori…"
      filter={[
        { label: "Kategori", ambil: (a) => a.kategori },
        { label: "Kepemilikan", ambil: (a) => a.kepemilikan, opsi: KEPEMILIKAN_ASET, jenis: "radio" },
        { label: "Status", ambil: (a) => a.status, opsi: STATUS_ASET },
      ]}
      kosong={`Belum ada ${judul.toLowerCase()}.`}
      kolom={[
        { label: "Kode" },
        { label: "Nama", minLebar: 200 },
        { label: "Kategori" },
        { label: "Jumlah", rata: "kanan" },
        { label: "Rusak", rata: "kanan" },
        { label: "Dipakai", rata: "kanan" },
        { label: "Tersedia", rata: "kanan" },
        { label: "Kepemilikan" },
        { label: "Servis Berikut" },
        { label: "Status" },
        bolehKelola && { lebar: 90 },
      ]}
      baris={(a) => (
        <tr>
          <td style={{ fontWeight: 600 }}>{a.kode}</td>
          <td>
            <div>{a.nama}</div>
            {a.merk && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.merk}</div>}
          </td>
          <td style={{ color: "var(--muted)" }}>{a.kategori}</td>
          <td style={{ textAlign: "right" }}>
            {a.jumlah} {a.satuan}
          </td>
          <td style={{ textAlign: "right" }}>
            {a.jumlahRusak > 0 ? (
              <span style={{ color: "var(--red)" }}>{a.jumlahRusak}</span>
            ) : (
              <span style={{ color: "var(--muted)" }}>—</span>
            )}
          </td>
          <td style={{ textAlign: "right", color: a.dipakai > 0 ? "var(--teal)" : "var(--muted)" }}>
            {a.dipakai > 0 ? a.dipakai : "—"}
          </td>
          <td style={{ textAlign: "right", fontWeight: 600 }}>{a.tersedia}</td>
          <td>
            {a.kepemilikan === "Sewa" ? (
              <>
                <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                  Sewa
                </span>
                {a.vendorNama && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{a.vendorNama}</div>
                )}
              </>
            ) : (
              <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                Milik Sendiri
              </span>
            )}
          </td>
          <td style={{ color: a.servisLewat ? "var(--red)" : "var(--muted)" }}>
            {a.servisBerikutLabel}
            {a.servisLewat && <div style={{ fontSize: 10, fontWeight: 600 }}>terlewat</div>}
          </td>
          <td>
            <Badge nilai={a.status} peta={WARNA_ASET} />
          </td>
          {bolehKelola && (
            <td>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <UbahAset
                  aset={{
                    id: a.id, kode: a.kode, jenis: a.jenis, nama: a.nama, kategori: a.kategori,
                    merk: a.merk, jumlah: a.jumlah, satuan: a.satuan, kepemilikan: a.kepemilikan,
                    vendorId: a.vendorId, servisTerakhir: a.servisTerakhirIso,
                    servisBerikut: a.servisBerikutIso, nilai: a.nilai,
                  }}
                  vendor={vendor}
                />
                <HapusAset id={a.id} kode={a.kode} />
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Penggunaan
// ---------------------------------------------------------------------------

export interface BarisPakai {
  id: string;
  alatKode: string;
  alatNama: string;
  satuan: string;
  proyekKode: string;
  jumlah: number;
  mulaiLabel: string;
  selesaiLabel: string | null;
  hari: number;
  tarif: number;
  biaya: number;
  penanggungJawab: string | null;
  status: string;
}

export function TabelPenggunaan({
  data,
  daftarAlat,
  proyek,
  bolehKelola,
  bolehHarga,
}: {
  data: BarisPakai[];
  daftarAlat: AlatPilihan[];
  proyek: Pilihan;
  bolehKelola: boolean;
  bolehHarga: boolean;
}) {
  return (
    <PanelTabel<BarisPakai>
      judul="Penggunaan"
      keterangan="Penempatan alat ke proyek beserta lama pakai, tarif, dan penanggung jawabnya. Satu alat bisa dipakai beberapa proyek sekaligus."
      aksi={bolehKelola ? <TambahPenggunaan daftarAlat={daftarAlat} proyek={proyek} /> : undefined}
      data={data}
      kunci={(p) => p.id}
      cari={(p) => `${p.alatKode} ${p.alatNama} ${p.proyekKode} ${p.penanggungJawab ?? ""}`}
      petunjukCari="Cari alat, proyek, atau penanggung jawab…"
      filter={[
        { label: "Proyek", ambil: (p) => p.proyekKode },
        { label: "Status", ambil: (p) => p.status, opsi: STATUS_PENGGUNAAN, jenis: "radio" },
      ]}
      kosong="Belum ada penggunaan alat yang tercatat."
      kolom={[
        { label: "Alat", minLebar: 170 },
        { label: "Proyek" },
        { label: "Jumlah", rata: "kanan" },
        { label: "Periode", minLebar: 150 },
        { label: "Durasi", rata: "kanan" },
        bolehHarga && { label: "Tarif / hari", rata: "kanan" },
        bolehHarga && { label: "Estimasi Biaya", rata: "kanan" },
        { label: "Penanggung Jawab" },
        { label: "Status" },
        bolehKelola && { lebar: 170 },
      ]}
      baris={(p) => (
        <tr>
          <td>
            <div style={{ fontWeight: 600 }}>{p.alatKode}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.alatNama}</div>
          </td>
          <td>{p.proyekKode}</td>
          <td style={{ textAlign: "right" }}>
            {p.jumlah} {p.satuan}
          </td>
          <td style={{ color: "var(--muted)" }}>
            {p.mulaiLabel}
            {" – "}
            {p.selesaiLabel ?? <span style={{ color: "var(--teal)" }}>berjalan</span>}
          </td>
          <td style={{ textAlign: "right", color: "var(--muted)" }}>{p.hari} hari</td>
          {bolehHarga && (
            <td className="num" style={{ textAlign: "right" }}>
              {p.tarif > 0 ? rp(p.tarif) : <span style={{ color: "var(--muted)" }}>—</span>}
            </td>
          )}
          {bolehHarga && (
            <td className="num" style={{ textAlign: "right" }}>
              {p.biaya > 0 ? rp(p.biaya) : <span style={{ color: "var(--muted)" }}>—</span>}
            </td>
          )}
          <td style={{ color: "var(--muted)" }}>{p.penanggungJawab ?? "—"}</td>
          <td>
            <Badge nilai={p.status} peta={WARNA_PENGGUNAAN} />
          </td>
          {bolehKelola && (
            <td>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {p.status === "Aktif" && (
                  <SelesaikanPenggunaan
                    id={p.id}
                    ringkas={`${p.alatKode} · ${p.jumlah} ${p.satuan} di ${p.proyekKode}`}
                  />
                )}
                <HapusPenggunaan id={p.id} kode={p.alatKode} />
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Riwayat penyesuaian stok
// ---------------------------------------------------------------------------

export interface BarisSesuai {
  id: string;
  tglLabel: string;
  asetKode: string;
  asetNama: string;
  satuan: string;
  jenis: string;
  banyak: number;
  jumlahSebelum: number;
  jumlahSesudah: number;
  rusakSebelum: number;
  rusakSesudah: number;
  keterangan: string;
  penanggungJawab: string | null;
  dicatatOleh: string;
}

export function TabelPenyesuaian({
  data,
  daftarAlat,
  bolehSesuaikan,
}: {
  data: BarisSesuai[];
  daftarAlat: AlatPilihan[];
  bolehSesuaikan: boolean;
}) {
  return (
    <PanelTabel<BarisSesuai>
      judul="Riwayat Penyesuaian Stok"
      keterangan="Kehilangan, kerusakan, perbaikan, dan koreksi opname. Bersifat tetap — pencatatan yang salah diperbaiki dengan Koreksi Stok baru, bukan dihapus."
      aksi={bolehSesuaikan ? <PenyesuaianAset daftarAlat={daftarAlat} /> : undefined}
      data={data}
      kunci={(r) => r.id}
      cari={(r) => `${r.asetKode} ${r.asetNama} ${r.keterangan} ${r.penanggungJawab ?? ""} ${r.dicatatOleh}`}
      petunjukCari="Cari aset, keterangan, atau penanggung jawab…"
      filter={[
        { label: "Jenis", ambil: (r) => r.jenis, opsi: JENIS_PENYESUAIAN_ASET },
        { label: "Aset", ambil: (r) => r.asetKode },
      ]}
      kosong="Belum ada penyesuaian stok yang tercatat."
      kolom={[
        { label: "Tanggal", lebar: 110 },
        { label: "Aset", minLebar: 170 },
        { label: "Jenis" },
        { label: "Jumlah", rata: "kanan" },
        { label: "Stok", rata: "kanan" },
        { label: "Rusak", rata: "kanan" },
        { label: "Keterangan", minLebar: 220 },
        { label: "Penanggung Jawab" },
        { label: "Dicatat Oleh" },
      ]}
      baris={(r) => (
        <tr>
          <td style={{ color: "var(--muted)" }}>{r.tglLabel}</td>
          <td>
            <div style={{ fontWeight: 600 }}>{r.asetKode}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{r.asetNama}</div>
          </td>
          <td>
            <Badge nilai={r.jenis} peta={WARNA_PENYESUAIAN} />
          </td>
          <td style={{ textAlign: "right" }}>
            {r.banyak > 0 ? `+${r.banyak}` : r.banyak} {r.satuan}
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
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Riwayat servis
// ---------------------------------------------------------------------------

export interface BarisServis {
  id: string;
  tglLabel: string;
  asetKode: string;
  asetNama: string;
  servisBerikutLabel: string | null;
  biaya: number;
  catatan: string | null;
  dicatatOleh: string;
}

export function TabelServis({
  data,
  daftarAlat,
  bolehKelola,
  bolehHarga,
}: {
  data: BarisServis[];
  daftarAlat: AlatPilihan[];
  bolehKelola: boolean;
  bolehHarga: boolean;
}) {
  return (
    <PanelTabel<BarisServis>
      judul="Riwayat Servis"
      keterangan="Catatan servis & perawatan alat — kapan, oleh siapa, dan berapa biayanya. Menandai alat sudah diservis dilakukan dari sini, bukan lewat Ubah."
      aksi={bolehKelola ? <CatatServis daftarAlat={daftarAlat} /> : undefined}
      data={data}
      kunci={(s) => s.id}
      cari={(s) => `${s.asetKode} ${s.asetNama} ${s.catatan ?? ""} ${s.dicatatOleh}`}
      petunjukCari="Cari aset, catatan, atau pencatat…"
      filter={[{ label: "Aset", ambil: (s) => s.asetKode }]}
      kosong="Belum ada servis yang tercatat."
      kolom={[
        { label: "Tanggal", lebar: 110 },
        { label: "Aset", minLebar: 170 },
        { label: "Servis Berikut" },
        bolehHarga && { label: "Biaya", rata: "kanan" },
        { label: "Catatan", minLebar: 220 },
        { label: "Dicatat Oleh" },
      ]}
      baris={(s) => (
        <tr>
          <td style={{ color: "var(--muted)" }}>{s.tglLabel}</td>
          <td>
            <div style={{ fontWeight: 600 }}>{s.asetKode}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{s.asetNama}</div>
          </td>
          <td style={{ color: "var(--muted)" }}>{s.servisBerikutLabel ?? "—"}</td>
          {bolehHarga && (
            <td className="num" style={{ textAlign: "right" }}>
              {s.biaya > 0 ? rp(s.biaya) : <span style={{ color: "var(--muted)" }}>—</span>}
            </td>
          )}
          <td style={{ whiteSpace: "normal" }}>{s.catatan ?? "—"}</td>
          <td style={{ color: "var(--muted)" }}>{s.dicatatOleh}</td>
        </tr>
      )}
    />
  );
}
