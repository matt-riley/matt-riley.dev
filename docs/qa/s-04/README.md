# S04 preparation evidence

This is local preparation, without a remote upload or production deployment.

- `GITHUB_DATA=fallback pnpm build`: passed; 304 emitted files, largest
  `_astro/boot.DEvyA9pB.js` 443,551 bytes. Limits enforced: 20,000 files and
  26,214,400 bytes per file. This count will refresh with later upstream assets.
- Build emitted two exact inline-script CSP hashes, external styles and fonts,
  and one content-hashed production copy of each stable source model.
- Two CPU artifact tests validate actual source/emitted model identity and
  authorize every inline script in every emitted HTML page. No browser opens
  for these tests.
- `wrangler versions upload --dry-run --preview-alias s04-review --outdir
  /tmp/touch-s04-upload`: passed locally; asset-only metadata 0.37 KiB. This did
  not upload a remote version or verify account preview URLs.
- Wrangler 4.154.0's bundled workerd accepts compatibility date 2026-10-30;
  2026-11-12 was rejected locally. The config uses the supported updated date.
- Browser CSP tests, local edge response evidence, hosted-preview headers,
  scheduled production run and scheduled API-failure deployment are pending.
  Acceptance criteria remain unchecked until their stated evidence exists.
