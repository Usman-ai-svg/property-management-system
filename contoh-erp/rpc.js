/**
 * Pembantu pemanggil Supabase RPC — vanilla JS, tanpa pustaka.
 *
 * ERP tujuan memakai satu index.html + vanilla JS, jadi berkas ini sengaja
 * tidak bergantung pada apa pun: cukup `fetch` bawaan browser. Tidak ada
 * @supabase/supabase-js, tidak ada bundler, tidak ada langkah kompilasi.
 *
 * Yang dijawab berkas ini hanya SATU hal: bagaimana memanggil fungsi RPC
 * Postgres dan memperlakukan galatnya dengan benar. Daftar fungsi yang harus
 * tersedia ada di KONTRAK-RPC.md — 77 aksi tulis beserta izin yang menjaganya.
 *
 * ------------------------------------------------------------------------
 * YANG TIDAK BOLEH DILAKUKAN DI SINI
 * ------------------------------------------------------------------------
 * Jangan menaruh pemeriksaan izin di berkas ini, atau di mana pun di sisi
 * browser. Siapa pun bisa membuka devtools dan memanggil `rpc()` sendiri
 * dengan argumen apa pun. Tombol yang tidak digambar tidak menahan apa pun.
 *
 * Penjagaan yang sesungguhnya ada di dalam fungsi Postgres-nya:
 * `SECURITY DEFINER`, dengan pemeriksaan izin di baris pertama fungsi. Yang
 * di sini murni demi kenyamanan tampilan — menyembunyikan tombol yang memang
 * akan ditolak server, supaya pengguna tidak menekan sesuatu yang sia-sia.
 */

/** Galat yang datang dari Postgres, lengkap dengan kode aslinya. */
export class GagalRpc extends Error {
  constructor(pesan, { kode = null, detail = null, status = 0 } = {}) {
    super(pesan);
    this.name = "GagalRpc";
    this.kode = kode;
    this.detail = detail;
    this.status = status;
  }
}

/**
 * Buat pemanggil RPC yang terikat pada satu proyek Supabase.
 *
 * `token` berupa fungsi, bukan nilai — token akses berumur pendek dan
 * diperbarui diam-diam oleh lapisan identitas. Menyimpannya sebagai nilai
 * membuat pemanggilan pertama setelah pembaruan memakai token kedaluwarsa.
 */
export function buatKlienRpc({ url, anonKey, token = () => null }) {
  if (!url || !anonKey) {
    throw new Error("buatKlienRpc butuh url dan anonKey proyek Supabase.");
  }
  const asal = url.replace(/\/+$/, "");

  /**
   * Panggil satu fungsi RPC.
   *
   * @param {string} nama   nama fungsi Postgres, mis. "pm_simpan_fase"
   * @param {object} argumen  parameter bernama; kirim {} bila tak ada
   * @returns {Promise<any>} nilai balik fungsi, sudah di-parse dari JSON
   */
  async function rpc(nama, argumen = {}) {
    const akses = await token();
    const r = await fetch(`${asal}/rest/v1/rpc/${nama}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        // Tanpa token, Postgres melihat peran `anon` dan RLS menolaknya —
        // itu memang yang diinginkan untuk permintaan tanpa sesi.
        Authorization: `Bearer ${akses ?? anonKey}`,
      },
      body: JSON.stringify(argumen),
    });

    const teks = await r.text();
    let isi = null;
    try {
      isi = teks ? JSON.parse(teks) : null;
    } catch {
      // Jawaban bukan JSON hanya terjadi saat ada yang salah di lapisan
      // jaringan atau gateway. Teksnya dipakai apa adanya sebagai pesan.
      if (!r.ok) throw new GagalRpc(teks.slice(0, 200), { status: r.status });
      return null;
    }

    if (!r.ok) {
      // PostgREST menaruh galat Postgres di message/code/details. Kode 42501
      // adalah penolakan izin — dibedakan supaya tampilan bisa berkata
      // "Anda tidak berhak" alih-alih "terjadi kesalahan".
      throw new GagalRpc(isi?.message ?? "Permintaan ditolak.", {
        kode: isi?.code ?? null,
        detail: isi?.details ?? null,
        status: r.status,
      });
    }
    return isi;
  }

  return { rpc };
}

/** Benar bila galatnya penolakan izin, bukan kesalahan lain. */
export const ditolakIzin = (e) =>
  e instanceof GagalRpc && (e.kode === "42501" || e.status === 403);
