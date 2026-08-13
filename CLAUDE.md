# Panduan Kerja — Nanoland Management System

## Alur eksplorasi kode: GRAPH DULU, baru grep/read

Untuk **setiap** tugas yang menyentuh kode (menjawab pertanyaan, menelusuri,
refactor, memetakan dampak), **mulai dengan tool `codebase-memory` graph** sebelum
Grep/Read/Glob manual. Ini menghemat kredit — satu query graph menggantikan
puluhan panggilan grep+baca.

Urutan yang diharapkan:

1. `mcp__codebase-memory-mcp__search_graph` — temukan fungsi/kelas/route/variabel
   (mode `query` BM25 untuk pencarian bahasa natural, `name_pattern` untuk regex).
2. `mcp__codebase-memory-mcp__query_graph` — Cypher untuk pertanyaan hubungan:
   "siapa pemanggil X" (`CALLS`), "di mana kolom/simbol Y dipakai", blast-radius
   sebuah refactor. **Wajib** dipakai untuk memetakan dampak SEBELUM mengedit.
3. `mcp__codebase-memory-mcp__get_code_snippet` — baca sumber tepat via
   `qualified_name` (dari hasil search_graph).
4. `mcp__codebase-memory-mcp__get_architecture` — struktur, cluster, layer.

Baru gunakan Grep/Read/Glob untuk: berkas non-kode (config, .sql, .md, .prisma),
membaca satu berkas secara penuh, atau saat sebuah simbol belum terindeks.

### Caveat penting

Graph mengikuti **HEAD yang sudah di-commit**. Ia belum melihat suntingan yang
belum di-commit, jadi selama mengedit anggap graph tertinggal; setelah `git commit`
graph otomatis ter-reindex dan bisa diverifikasi ulang. (Terbukti akurat & segar:
edge `CALLS` cocok 100%, simbol baru muncul, yang dihapus hilang.)

Tool read-only graph (`search_graph`, `query_graph`, `get_code_snippet`,
`get_architecture`, `search_code`, `index_status`, `list_projects`, `detect_changes`)
sudah masuk allowlist `.claude/settings.local.json` — panggil tanpa ragu.

## Perintah proyek

- `npm run typecheck` — `tsc --noEmit` (wajib bersih sebelum selesai).
- `npm run test` — unit test (`node --test`).
- `npm run db:reset` — hapus DB, push skema, generate, seed ulang (SQLite demo).
- `npm run skema:postgres` — regenerasi `schema.postgres.prisma` + `enum-postgres.sql`
  dari `enums.ts` (jalankan bila enum/skema berubah).
- Login demo: password semua akun `nanoland2026`.
