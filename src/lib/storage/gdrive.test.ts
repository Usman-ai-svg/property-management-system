import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createHash, generateKeyPairSync } from "node:crypto";
import { buatMesinGdrive, konfigDariEnv } from "./gdrive";
import { diGdrive, mesinAktif } from "./index";
import { GagalUnggah } from "@/lib/adaptor/berkas-aturan";

/**
 * Protokol Google Drive diuji tanpa menyentuh Google.
 *
 * `fetch` dan jam disuntik, dan kunci privatnya dibangkitkan sungguhan di sini
 * sehingga penandatanganan JWT RS256 benar-benar berjalan — bukan disamarkan.
 * Yang diperiksa adalah hal-hal yang kalau salah baru ketahuan di produksi:
 * unggahan memakai dua langkah resumable, token dipakai ulang, dan berkas
 * lama di disk tidak menjadi tautan mati setelah pindah mesin.
 */

/** Kunci RSA sungguhan supaya jose benar-benar menandatangani. */
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const KONFIG = {
  clientEmail: "robot@contoh.iam.gserviceaccount.com",
  privateKey,
  folderId: "folder-nanoland",
};

interface Panggilan {
  url: string;
  metode: string;
  headers: Record<string, string>;
  body: unknown;
}

/** fetch palsu yang mencatat tiap panggilan dan menjawab menurut urutan. */
function fetchPalsu(jawaban: ((p: Panggilan) => Response)[]) {
  const jejak: Panggilan[] = [];
  let ke = 0;
  const f = (async (url: string | URL, init?: RequestInit) => {
    const p: Panggilan = {
      url: String(url),
      metode: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    };
    jejak.push(p);
    const buat = jawaban[Math.min(ke++, jawaban.length - 1)];
    return buat(p);
  }) as unknown as typeof globalThis.fetch;
  return { f, jejak };
}

/** ArrayBuffer yang panjangnya persis isi teksnya.
 *  `Buffer.from(s).buffer` mengembalikan seluruh pool internal Node — 64 KB —
 *  bukan byte yang kita maksud. */
function ab(teks: string): ArrayBuffer {
  const u = new TextEncoder().encode(teks);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

const jawabToken = (umur = 3600) =>
  new Response(JSON.stringify({ access_token: "token-abc", expires_in: umur }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const jawabMulai = () =>
  new Response(null, { status: 200, headers: { location: "https://unggah.contoh/sesi-1" } });

const jawabSelesai = (id = "berkas-123") =>
  new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("mesin Google Drive", () => {
  it("mengunggah lewat dua langkah resumable, bukan multipart", async () => {
    const { f, jejak } = fetchPalsu([() => jawabToken(), () => jawabMulai(), () => jawabSelesai()]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f });

    const teks = "anggap ini berkas .skp";
    const isi = Buffer.from(teks);
    const hasil = await mesin.simpan(ab(teks), "Rumah Tipe 36.skp");

    assert.equal(jejak.length, 3, "harus: token, mulai sesi, kirim isi");

    const [token, mulai, kirim] = jejak;
    assert.match(token.url, /oauth2\.googleapis\.com/);
    assert.match(mulai.url, /uploadType=resumable/);
    assert.equal(mulai.metode, "POST");
    assert.equal(kirim.url, "https://unggah.contoh/sesi-1");
    assert.equal(kirim.metode, "PUT");

    // Ukuran diumumkan sebelum byte dikirim — itu gunanya resumable.
    assert.equal(mulai.headers["X-Upload-Content-Length"], String(isi.byteLength));
    assert.deepEqual(JSON.parse(mulai.body as string).parents, ["folder-nanoland"]);

    assert.equal(hasil.objectKey, "gdrive:berkas-123");
    assert.equal(hasil.ukuranByte, isi.byteLength);
    assert.equal(hasil.sha256, createHash("sha256").update(isi).digest("hex"));
  });

  it("memakai ulang token selama masih berlaku", async () => {
    const { f, jejak } = fetchPalsu([
      () => jawabToken(), () => jawabMulai(), () => jawabSelesai(),
      () => jawabMulai(), () => jawabSelesai("berkas-456"),
    ]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f });

    await mesin.simpan(ab("a"), "a.pdf");
    await mesin.simpan(ab("b"), "b.pdf");

    const permintaanToken = jejak.filter((p) => p.url.includes("oauth2"));
    assert.equal(permintaanToken.length, 1, "token seharusnya diminta sekali saja");
  });

  it("memperbarui token sebelum kedaluwarsa, bukan sesudahnya", async () => {
    // Token berumur 90 detik. Unggahan besar bisa berjalan lebih lama dari
    // sisa umurnya, jadi ambang pembaruan 60 detik harus memicu token baru.
    let jam = 1_000_000;
    const { f, jejak } = fetchPalsu([
      () => jawabToken(90), () => jawabMulai(), () => jawabSelesai(),
      () => jawabToken(90), () => jawabMulai(), () => jawabSelesai(),
    ]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f, now: () => jam });

    await mesin.simpan(ab("a"), "a.pdf");
    jam += 45_000; // sisa umur 45 detik — di bawah ambang
    await mesin.simpan(ab("b"), "b.pdf");

    assert.equal(jejak.filter((p) => p.url.includes("oauth2")).length, 2);
  });

  it("menjelaskan 403 sebagai folder yang belum dibagikan", async () => {
    const { f } = fetchPalsu([
      () => jawabToken(),
      () =>
        new Response(JSON.stringify({ error: { message: "Insufficient permissions" } }), {
          status: 403,
        }),
    ]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f });

    await assert.rejects(
      () => mesin.simpan(ab("x"), "x.pdf"),
      (e: unknown) => {
        assert.ok(e instanceof GagalUnggah);
        // Penyebab 403 yang paling sering adalah folder belum dibagikan ke
        // service account. Pesannya harus menyebut itu, bukan "akses ditolak".
        assert.match(e.message, /dibagikan ke service account/i);
        return true;
      },
    );
  });

  it("menghapus berkas yang sudah tidak ada bukan kegagalan", async () => {
    const { f } = fetchPalsu([() => jawabToken(), () => new Response(null, { status: 404 })]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f });
    await mesin.hapus("sudah-hilang"); // tidak melempar
  });

  it("mengunduh isi berkas apa adanya", async () => {
    const isi = Buffer.from("isi berkas");
    const { f, jejak } = fetchPalsu([() => jawabToken(), () => new Response(new Uint8Array(isi))]);
    const mesin = buatMesinGdrive(KONFIG, { fetch: f });

    const hasil = await mesin.baca("berkas-123");
    assert.equal(hasil.toString(), "isi berkas");
    assert.match(jejak[1].url, /alt=media/);
  });
});

describe("konfigurasi Google Drive", () => {
  it("mengembalikan baris baru yang ditulis \\n di berkas .env", () => {
    const k = konfigDariEnv({
      GDRIVE_CLIENT_EMAIL: "a@b.c",
      GDRIVE_PRIVATE_KEY: "-----BEGIN-----\\nbaris\\n-----END-----",
      GDRIVE_FOLDER_ID: "f",
    });
    assert.ok(k);
    assert.ok(k.privateKey.includes("\n"), "\\n literal harus jadi baris baru");
    assert.ok(!k.privateKey.includes("\\n"));
  });

  it("null bila konfigurasinya belum lengkap", () => {
    assert.equal(konfigDariEnv({}), null);
    assert.equal(
      konfigDariEnv({ GDRIVE_CLIENT_EMAIL: "a@b.c" }),
      null,
    );
  });
});

describe("pemilihan mesin penyimpanan", () => {
  it("lokal adalah bawaan — demo jalan tanpa kredensial", () => {
    assert.equal(mesinAktif({}), "lokal");
    assert.equal(mesinAktif({ STORAGE_ENGINE: "" }), "lokal");
  });

  it("gdrive dipilih hanya bila diminta eksplisit", () => {
    assert.equal(mesinAktif({ STORAGE_ENGINE: "gdrive" }), "gdrive");
  });

  it("berkas lama di disk tetap dikenali setelah pindah ke Drive", () => {
    // Inilah yang membuat peralihan tidak harus sekali jalan: pembacaan
    // mengikuti awalan kunci, bukan mesin yang sedang dikonfigurasi.
    assert.equal(diGdrive("2026/abc-123.skp"), false);
    assert.equal(diGdrive("gdrive:1AbCdEf"), true);
  });
});
