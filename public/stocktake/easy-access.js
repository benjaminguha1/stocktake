const trigger = document.querySelector('.easy-access-trigger');
if (trigger) {
  const dialog = document.createElement('dialog');
  dialog.id = 'easy-access-dialog';
  dialog.className = 'easy-access-dialog';
  dialog.setAttribute('aria-labelledby', 'easy-access-title');
  trigger.setAttribute('aria-controls', dialog.id);
  dialog.innerHTML = `<form method="dialog"><button class="easy-access-close" aria-label="Close">×</button></form><h2 id="easy-access-title">Easy access</h2><p>Keep Stocktake close at hand for the next shift.</p><p class="easy-access-url"></p><div class="easy-access-actions"><button type="button" id="copy-stocktake-link">Copy this page link</button><button type="button" id="print-stockroom-qr">Print stockroom QR</button></div><p id="copy-stocktake-status" role="status"></p><h3>Add to your home screen</h3><p>On iPhone, tap Share then Add to Home Screen. On Android, open the browser menu and tap Add to Home screen.</p>`;
  document.body.append(dialog);
  const pageUrl = `${location.origin}${location.pathname}`;
  dialog.querySelector('.easy-access-url').textContent = pageUrl;
  trigger.addEventListener('click', () => { dialog.querySelector('#copy-stocktake-status').textContent = ''; dialog.showModal(); });
  dialog.querySelector('#copy-stocktake-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pageUrl); dialog.querySelector('#copy-stocktake-status').textContent = 'Link copied.'; }
    catch (_) { dialog.querySelector('#copy-stocktake-status').textContent = 'Copy was blocked. Select the link above and copy it manually.'; }
  });
  dialog.querySelector('#print-stockroom-qr').addEventListener('click', async () => {
    const print = window.open('', '_blank');
    if (!print) return;
    print.opener = null;
    print.document.write('<title>Josie Coffee Stocktake</title><main><h1>Josie Coffee Stocktake</h1><p>Scan to open Stocktake on your phone.</p><p id="stocktake-url"></p><canvas id="stocktake-qr" width="260" height="260" aria-label="QR code for Stocktake"></canvas></main>');
    print.document.close();
    print.document.querySelector('#stocktake-url').textContent = pageUrl;
    try { const { toCanvas } = await import('./vendor/qrcode.js'); await toCanvas(print.document.querySelector('#stocktake-qr'), pageUrl, { width: 260, margin: 2 }); } catch (_) { print.document.querySelector('#stocktake-qr').insertAdjacentHTML('afterend', '<p>QR code unavailable. Use the link above.</p>'); }
    print.focus(); print.print();
  });
}
