import { GagalUnggah } from "@/lib/adaptor/berkas-aturan";

/**
 * ANTARMUKA PENYIMPANAN BERKAS.
 *
 * Tiga fungsi yang dipakai seluruh aplikasi — simpan, baca, hapus — dijadikan
 * satu bentuk supaya mesin penyimpanannya bisa diganti tanpa menyentuh halaman.
 * Disk lokal dan Google Drive adalah dua penyedia; keduanya cuma implementasi.
 *
 * ------------------------------------------------------------------------
 * KENAPA ADA DUA BENTUK PENYEDIA
 * ------------------------------------------------------------------------
 * Yang pertama memegang ISI berkas: aplikasi menerima byte, menyimpannya, dan
 * bisa mengembalikannya lagi. Disk lokal dan Drive keduanya begini.
 *
 * Yang kedua cuma memegang ALAMAT. Berkas .skp proyek ini 24-38 MB dan sudah
 * ada di Drive Workspace Nanoland sebelum aplikasi menyentuhnya. Mengunggahnya
 * ulang lewat peramban -> fungsi server -> Drive berarti memindahkan puluhan
 * megabyte dua kali untuk berkas yang sebetulnya sudah ada di tempat tujuan.
 * Penyedia "tautan luar" melewatkan seluruh perjalanan itu: yang dicatat cuma
 * URL-nya.
 *
 * Bedanya dibuat eksplisit lewat `bentuk`, bukan lewat method opsional, supaya
 * pemanggil yang lupa menangani kasus alamat gagal saat tsc — bukan saat ada
 * orang mengklik dokumen dan menerima berkas kosong.
 */

export interface HasilSimpan {
  objectKey: string;
  ukuranByte: number;
  /** Kosong berarti isinya tidak dipegang sistem ini - lihat penyedia tautan. */
  sha256: string;
}

/** Penyedia yang memegang isi berkas. */
export interface PenyediaIsi {
  readonly nama: string;
  readonly bentuk: "isi";
  /** Awalan kunci objek miliknya. Kosong berarti bentuk kunci warisan. */
  readonly awalan: string;
  simpan(data: ArrayBuffer, namaAsli: string): Promise<HasilSimpan>;
  baca(kunci: string): Promise<Buffer>;
  hapus(kunci: string): Promise<void>;
}

/** Penyedia yang cuma memegang alamat berkas milik orang lain. */
export interface PenyediaAlamat {
  readonly nama: string;
  readonly bentuk: "alamat";
  readonly awalan: string;
  catat(alamat: string): HasilSimpan;
  alamat(kunci: string): string;
  hapus(kunci: string): Promise<void>;
}

export type Penyedia = PenyediaIsi | PenyediaAlamat;

export const AWALAN_TAUTAN = "tautan:";

/**
 * Host yang boleh dicatat sebagai tautan luar.
 *
 * Bukan kehati-hatian berlebihan: sebuah tautan yang tersimpan di baris dokumen
 * akan diklik oleh orang yang mengira ia dokumen perusahaan. Tanpa daftar ini,
 * siapa pun yang boleh menambah dokumen bisa menanam alamat mana pun — halaman
 * masuk palsu sekalipun — dan sistem akan menyajikannya dengan nama dokumen
 * resmi. Membatasi ke Workspace Google membuat alamatnya tetap di lingkungan
 * yang sudah dipercaya organisasi.
 */
export const HOST_TAUTAN: readonly string[] = [
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
];

/**
 * Penyedia tautan luar.
 *
 * Tidak menyimpan apa pun. `catat` memvalidasi alamat lalu mengubahnya jadi
 * kunci objek; `alamat` mengembalikannya. `hapus` sengaja tidak melakukan apa-
 * apa: berkasnya milik Drive, dan menghapus baris di aplikasi tidak boleh
 * diam-diam menghapus berkas yang mungkin dipakai orang lain di sana.
 */
export const penyediaTautan: PenyediaAlamat = {
  nama: "tautan",
  bentuk: "alamat",
  awalan: AWALAN_TAUTAN,

  catat(alamat: string): HasilSimpan {
    const bersih = alamat.trim();
    let url: URL;
    try {
      url = new URL(bersih);
    } catch {
      throw new GagalUnggah("Tautan tidak sah. Tempelkan alamat lengkap, termasuk https://.");
    }
    if (url.protocol !== "https:") {
      throw new GagalUnggah("Tautan harus memakai https://.");
    }
    if (!HOST_TAUTAN.includes(url.hostname)) {
      throw new GagalUnggah(
        `Tautan hanya boleh ke ${HOST_TAUTAN.join(", ")} — alamat "${url.hostname}" ditolak.`,
      );
    }
    return {
      objectKey: AWALAN_TAUTAN + url.toString(),
      // Isinya tidak pernah lewat sini, jadi tidak ada ukuran maupun sidik
      // jari. sha256 kosong berarti: sistem ini TIDAK bisa membuktikan berkas
      // di ujung tautan masih sama dengan yang dicatat dulu.
      ukuranByte: 0,
      sha256: "",
    };
  },

  alamat(kunci: string): string {
    return kunci.startsWith(AWALAN_TAUTAN) ? kunci.slice(AWALAN_TAUTAN.length) : kunci;
  },

  async hapus(): Promise<void> {
    return;
  },
};
