# S04 preparation evidence

This is local preparation, without a remote upload or production deployment.

- `GITHUB_DATA=fallback pnpm build`: passed; 311 emitted files, largest
  `_astro/boot.hRB1lmno.js` 443,551 bytes. Limits enforced: 20,000 files and
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
- `pnpm test:edge`: 2 passed against local Workers Assets (Gallery and
  Catalogue), exercising real WebGL with the explicit software integration
  fixture. Both consoles and securitypolicyviolation lists were empty; model
  and script responses had the exact one-year immutable cache policy.
- `headers-html.txt`, `headers-model.txt`, `headers-script.txt` are actual
  `curl -I` responses from the local Workers preview. These do not establish
  hosted account behavior. `catalogue-csp.png` and `gallery-csp.png` capture
  the enforced-CSP pages.
- Hosted-preview headers, scheduled production run and scheduled API-failure
  deployment remain pending Matt's method/account approval and secret setup.
