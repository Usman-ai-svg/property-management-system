/**
 * Tabel dan kartu-berisi-tabel — pola yang paling sering dipakai di aplikasi ini.
 *
 * Ada 34 tabel tersebar di halaman-halaman `app/`. Semuanya menuliskan sendiri
 * rangkaian `<div className="tablewrap"><table><thead><tr><th>…`, dan yang
 * paling rawan bukan panjangnya melainkan `colSpan` pada baris "belum ada
 * data": angkanya ditulis tangan sementara jumlah kolom di atasnya bisa
 * berubah — apalagi kolom yang muncul-hilang mengikuti hak akses. Di sini
 * `colSpan` dihitung dari definisi kolom sehingga tidak bisa lagi meleset.
 *
 * Sengaja dibagi dua lapis:
 *
 * - `Tabel` — hanya bagian tabelnya. Dipakai oleh tabel yang bersarang di
 *   dalam panel detail atau di dalam percabangan hak akses, yang pembungkus
 *   luarnya memang berbeda-beda dan tidak perlu diseragamkan.
 * - `KartuTabel` — kartu lengkap dengan kepala dan tombol aksi. Dipakai oleh
 *   tabel utama sebuah halaman.
 *
 * Keduanya menghasilkan markup yang sama persis dengan yang ditulis tangan
 * sebelumnya, jadi tampilannya tidak berubah.
 */

/** Satu kolom tabel. Dipakai untuk membangun `<th>` sekaligus menghitung colSpan. */
export interface Kolom {
  /** Isi `<th>`. Boleh dikosongkan untuk kolom tombol aksi. */
  label?: React.ReactNode;
  /** Perataan isi header. Kolom angka umumnya "kanan". */
  rata?: "kanan" | "tengah";
  /** Lebar tetap, dalam piksel. */
  lebar?: number;
  /** Lebar minimum, dalam piksel. Dipakai kolom berisi bar progres. */
  minLebar?: number;
  /** Kelas CSS kolom, mis. "frz frzedge" untuk kolom yang dibekukan di kiri. */
  kelas?: string;
  /** Gaya tambahan bila kolom butuh sesuatu di luar tiga pengatur di atas. */
  gaya?: React.CSSProperties;
}

/**
 * Kolom boleh bernilai palsu supaya pemanggil bisa menulis
 * `bolehHarga && { label: "Nilai" }` tanpa merusak perhitungan colSpan.
 */
export type KolomOpsional = Kolom | false | null | undefined;

function gayaKolom(k: Kolom): React.CSSProperties | undefined {
  const gaya: React.CSSProperties = { ...k.gaya };
  if (k.rata) gaya.textAlign = k.rata === "kanan" ? "right" : "center";
  if (k.lebar != null) gaya.width = k.lebar;
  if (k.minLebar != null) gaya.minWidth = k.minLebar;
  return Object.keys(gaya).length ? gaya : undefined;
}

/** Benar bila `children` sama sekali tidak berisi baris yang akan tampil. */
function kosongkah(children: React.ReactNode): boolean {
  const isi = Array.isArray(children) ? children.flat(Infinity) : [children];
  return !isi.some((n) => n !== null && n !== undefined && typeof n !== "boolean");
}

export function Tabel({
  kolom,
  kosong,
  tinggiMaks,
  gayaBungkus,
  kelasBungkus = "tablewrap",
  children,
}: {
  kolom: KolomOpsional[];
  /**
   * Ditampilkan sebagai satu baris membentang penuh ketika tidak ada baris
   * sama sekali. Bila tidak diisi, tabel kosong dibiarkan kosong.
   */
  kosong?: React.ReactNode;
  /** Tinggi maksimum area gulir, dalam piksel. */
  tinggiMaks?: number;
  gayaBungkus?: React.CSSProperties;
  /** Diisi "card tablewrap" bila tabel sekaligus menjadi kartunya sendiri. */
  kelasBungkus?: string;
  /** Baris-baris `<tr>` isi tabel. */
  children?: React.ReactNode;
}) {
  const kolomAktif = kolom.filter((k): k is Kolom => Boolean(k));

  return (
    <div
      className={kelasBungkus}
      style={{
        ...(tinggiMaks != null && { maxHeight: tinggiMaks, overflowY: "auto" }),
        ...gayaBungkus,
      }}
    >
      <table>
        {/* Tabel label–nilai tidak berkepala; `kolom` dibiarkan kosong. */}
        {kolomAktif.length > 0 && (
          <thead>
            <tr>
              {kolomAktif.map((k, i) => (
                <th key={i} className={k.kelas} style={gayaKolom(k)}>
                  {k.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {kosongkah(children) ? (
            kosong ? (
              <tr>
                <td
                  colSpan={kolomAktif.length}
                  style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}
                >
                  {kosong}
                </td>
              </tr>
            ) : null
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function KartuTabel({
  judul,
  keterangan,
  aksi,
  atas,
  gayaKartu,
  ...tabel
}: {
  /** Judul kartu. Bila kosong, kepala kartu tidak dirender sama sekali. */
  judul?: string;
  keterangan?: string;
  /** Tombol di kanan kepala kartu, mis. tombol Tambah. */
  aksi?: React.ReactNode;
  /** Jarak ke elemen di atasnya, dalam piksel. */
  atas?: number;
  gayaKartu?: React.CSSProperties;
} & React.ComponentProps<typeof Tabel>) {
  return (
    <div
      className="card"
      style={{ overflow: "hidden", ...(atas != null && { marginTop: atas }), ...gayaKartu }}
    >
      {judul && <KepalaTabel judul={judul} keterangan={keterangan} aksi={aksi} />}
      <Tabel {...tabel} />
    </div>
  );
}

/**
 * Kepala kartu tabel: judul dan keterangan di kiri, tombol di kanan.
 *
 * Isinya sama dengan `TabelHead` di ui.tsx — ditulis ulang di sini supaya
 * berkas ini tidak ikut menyeret ikon lucide dari ui.tsx saat dipindahkan.
 */
function KepalaTabel({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <div>
        <div className="eyebrow">{judul}</div>
        {keterangan && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{keterangan}</div>
        )}
      </div>
      {aksi}
    </div>
  );
}
