import { build } from 'esbuild';
await build({
  stdin: { contents: "export { toCanvas } from 'qrcode/lib/browser.js';", resolveDir: process.cwd(), sourcefile: 'qr-entry.js' },
  bundle: true, platform: 'browser', format: 'esm', minify: true,
  outfile: 'public/stocktake/vendor/qrcode.js', legalComments: 'eof',
});
