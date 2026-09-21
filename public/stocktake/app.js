import {
  createInitialState,
  exportState,
  hasStoredState,
  importState,
  isStateSyncPending,
  loadState,
  markStateSynced,
  saveState,
  supplierCode,
} from './storage.js';
import { canUndoReceipt, orderClipboardText, receiptChange, supplierOrderLink } from './order-workflow.js';

const DAY = 24 * 60 * 60 * 1000;

const seedSuppliers = [
  { id: 'MINOR-FIGURES', name: 'Minor Figures', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'DAIRY-FARMERS', name: 'Dairy Farmers', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'SAMPLE-COFFEE', name: 'Sample Coffee', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'COFFEE-SUPREME', name: 'Coffee Supreme', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'BIOPAK', name: 'BioPak', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'COCA-COLA', name: 'Coca-Cola Europacific', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'ESSENTIAL-INGREDIENT', name: 'Essential Ingredient', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'MONIN', name: 'Monin', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
  { id: 'ARKADIA', name: 'Arkadia', orderingMethod: '', orderDays: '', repContact: '', notes: '' },
];

const seedProducts = [
  { id: 'p-001', name: 'Oat milk', sku: 'JC-0001', supplierId: 'MINOR-FIGURES', par: 48, minimum: 18, current: 14, location: 'Milk fridge', unit: 'L carton' },
  { id: 'p-002', name: 'Full cream milk', sku: 'JC-0002', supplierId: 'DAIRY-FARMERS', par: 72, minimum: 26, current: 38, location: 'Milk fridge', unit: 'L bottle' },
  { id: 'p-003', name: 'House blend coffee', sku: 'JC-0003', supplierId: 'SAMPLE-COFFEE', par: 18, minimum: 6, current: 4, location: 'Coffee shelf', unit: 'kg' },
  { id: 'p-004', name: 'Single origin coffee', sku: 'JC-0004', supplierId: 'SAMPLE-COFFEE', par: 10, minimum: 3, current: 6, location: 'Coffee shelf', unit: 'kg' },
  { id: 'p-005', name: 'Cold brew concentrate', sku: 'JC-0005', supplierId: 'COFFEE-SUPREME', par: 16, minimum: 5, current: 3, location: 'Under bench fridge', unit: 'L bottle' },
  { id: 'p-006', name: 'Takeaway cups · 12 oz', sku: 'JC-0006', supplierId: 'BIOPAK', par: 800, minimum: 240, current: 180, location: 'Dry store · A2', unit: 'cup' },
  { id: 'p-007', name: 'Takeaway lids · 12 oz', sku: 'JC-0007', supplierId: 'BIOPAK', par: 800, minimum: 240, current: 320, location: 'Dry store · A2', unit: 'lid' },
  { id: 'p-008', name: 'Napkins', sku: 'JC-0008', supplierId: 'BIOPAK', par: 1200, minimum: 400, current: 560, location: 'Dry store · B1', unit: 'napkin' },
  { id: 'p-009', name: 'Sparkling water', sku: 'JC-0009', supplierId: 'COCA-COLA', par: 48, minimum: 18, current: 22, location: 'Drinks fridge', unit: 'can' },
  { id: 'p-010', name: 'Cocoa powder', sku: 'JC-0010', supplierId: 'ESSENTIAL-INGREDIENT', par: 6, minimum: 2, current: 1, location: 'Dry store · C4', unit: 'kg' },
  { id: 'p-011', name: 'Vanilla syrup', sku: 'JC-0011', supplierId: 'MONIN', par: 12, minimum: 4, current: 7, location: 'Back bar', unit: 'bottle' },
  { id: 'p-012', name: 'Chai concentrate', sku: 'JC-0012', supplierId: 'ARKADIA', par: 12, minimum: 4, current: 2, location: 'Back bar', unit: 'L carton' },
];

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

function seedUsage() {
  const weekly = [24, 36, 5, 3, 4, 220, 205, 300, 15, 1, 4, 5];
  return seedProducts.flatMap((product, productIndex) =>
    Array.from({ length: 12 }, (_, week) => ({
      id: `u-${productIndex}-${week}`,
      productId: product.id,
      amount: Math.max(0.5, Math.round((weekly[productIndex] * (0.78 + ((week * 13 + productIndex * 7) % 29) / 100)) * 10) / 10),
      recordedAt: isoDaysAgo((11 - week) * 7 + 2),
      source: 'seed',
    })),
  );
}

function makeDemoState() {
  return {
    suppliers: seedSuppliers.map((supplier) => ({ ...supplier })),
    products: seedProducts.map((product) => ({ ...product })),
    usageRecords: seedUsage(),
    stocktakes: [
      { id: 'st-seed-1', type: 'full', label: 'Full stocktake', productCount: 12, completedAt: isoDaysAgo(5) },
      { id: 'st-seed-2', type: 'supplier', label: 'BioPak stocktake', productCount: 3, completedAt: isoDaysAgo(11) },
    ],
  };
}

const startedWithStoredState = hasStoredState();
let state = startedWithStoredState ? loadState() : createInitialState();
let activeRoute = 'dashboard';
let productQuery = '';
let productStatus = 'all';
let productSupplier = 'all';
let showArchivedProducts = false;
let showArchivedSuppliers = false;
let selectedProductIds = new Set();
let selectedOrderProductIds = new Set();
let selectedDeliveryProductIds = new Set();
let selectedInsightProductIds = new Set();
const tableSort = {
  products: { key: 'name', direction: 'asc' },
  suppliers: { key: 'name', direction: 'asc' },
  orders: { key: 'status', direction: 'asc' },
  deliveries: { key: 'orderedAt', direction: 'desc' },
  insights: { key: 'used', direction: 'desc' },
  stocktakes: { key: 'completedAt', direction: 'desc' },
};
let onlineSaveQueue = Promise.resolve();
let onlineStorageAvailable = false;
let onlineUser = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setSaveStatus(stateName, message) {
  const status = $('#save-status');
  if (!status) return;
  status.dataset.state = stateName;
  $('#save-status-text').textContent = message;
}

function persist() {
  saveState(state);
  if (onlineStorageAvailable) void queueOnlineSave();
}

function supplierById(id) {
  return state.suppliers.find((supplier) => supplier.id === id) || null;
}
function isProductActive(product) { return product?.archived !== true && isSupplierActive(supplierById(product?.supplierId)); }
function isSupplierActive(supplier) { return supplier?.archived !== true; }
function activeProducts() { return state.products.filter(isProductActive); }
function activeSuppliers() { return state.suppliers.filter(isSupplierActive); }

function supplierName(product) {
  return supplierById(product.supplierId)?.name || 'Unassigned supplier';
}

function supplierDetails(product) {
  return supplierById(product.supplierId) || {
    id: product.supplierId || 'UNASSIGNED', name: 'Unassigned supplier', orderingMethod: '', orderDays: '', repContact: '', notes: '',
  };
}

function orderDaysLabel(supplier) {
  return supplier.orderDays || 'Any day';
}

function onOrderQuantity(product) {
  const quantity = Number(product.onOrderQuantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function isOnOrder(product) {
  return onOrderQuantity(product) > 0;
}

function onOrderProducts() {
  return state.products
    .filter(isOnOrder)
    .sort((a, b) => supplierName(a).localeCompare(supplierName(b)) || a.name.localeCompare(b.name));
}

function publicState() {
  return JSON.parse(exportState(state));
}

function queueOnlineSave() {
  const snapshot = publicState();
  setSaveStatus('saving', 'Saving online…');
  onlineSaveQueue = onlineSaveQueue
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: snapshot }),
      });
      if (!response.ok) throw new Error('Online save failed.');
      if (exportState(state) === exportState(snapshot)) markStateSynced();
      setSaveStatus('online', 'Saved online');
    })
    .catch(() => setSaveStatus('offline', 'Saved on this device · offline'));
  return onlineSaveQueue;
}

async function initialiseOnlineState() {
  setSaveStatus('connecting', 'Connecting online…');
  try {
    const authResponse = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!authResponse.ok) throw new Error('Authentication is unavailable.');
    const auth = await authResponse.json();
    if (!auth.hasUsers) {
      onlineStorageAvailable = false;
      showAccountGate('setup');
      setSaveStatus('offline', 'Set up staff access');
      return;
    }
    if (!auth.user) {
      onlineStorageAvailable = false;
      showAccountGate('login');
      setSaveStatus('offline', 'Sign in to save online');
      return;
    }
    hideAccountGate();
    onlineUser = auth.user;
    updateAccountButton();
    onlineStorageAvailable = true;
    if (isStateSyncPending()) {
      await queueOnlineSave();
      return;
    }
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Online storage is unavailable.');
    const remote = await response.json();
    if (remote.state) {
      state = importState(JSON.stringify(remote.state));
      saveState(state, window.localStorage, { synced: true });
      renderAll();
      setSaveStatus('online', 'Saved online');
      return;
    }

    // Demo rows are never written into a new shared stockroom. A user's real
    // browser data still wins when it was marked as awaiting synchronisation.
    if (!startedWithStoredState) {
      state = createInitialState();
      renderAll();
    }
    saveState(state);
    await queueOnlineSave();
  } catch (_) {
    onlineStorageAvailable = false;
    setSaveStatus('offline', 'Saved on this device · offline');
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateAccountButton() {
  const button = $('#account-button');
  if (!button || !onlineUser) return;
  button.textContent = onlineUser.username.split(/[._\s-]+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ST';
  button.title = `Signed in as ${onlineUser.username}`;
}

function showAccountGate(mode, error = '') {
  const layer = $('#account-layer');
  layer.hidden = false;
  const setup = mode === 'setup';
  $('#account-card').innerHTML = `
    <p class="kicker">JOSIE COFFEE · STOCKTAKE</p>
    <h2>${setup ? 'Set up your staff account' : 'Sign in to Stocktake'}</h2>
    <p>${setup ? 'Create the first administrator account. It protects the shared stockroom.' : 'Use your staff account to open the shared stockroom.'}</p>
    ${error ? `<p class="account-error">${escapeHtml(error)}</p>` : ''}
    <form id="account-form" class="form-grid">
      ${setup ? '<div class="field full"><label for="account-username">Username</label><input id="account-username" name="username" required minlength="3" maxlength="40" autocomplete="username" placeholder="e.g. josie.manager" /></div><div class="field full"><label for="account-email">Email (optional)</label><input id="account-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" /></div>' : '<div class="field full"><label for="account-identifier">Username or email</label><input id="account-identifier" name="identifier" required maxlength="254" autocomplete="username" /></div>'}
      <div class="field full"><label for="account-password">Password</label><input id="account-password" name="password" type="password" required minlength="10" maxlength="128" autocomplete="${setup ? 'new-password' : 'current-password'}" /></div>
      ${setup ? '<div class="field full"><label for="account-confirm-password">Confirm password</label><input id="account-confirm-password" name="confirmPassword" type="password" required minlength="10" maxlength="128" autocomplete="new-password" /></div>' : ''}
      <div class="field full"><button class="button primary" type="submit">${setup ? 'Create staff account' : 'Sign in'}</button></div>
    </form>`;
  $('#account-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await fetch(`/api/auth/${setup ? 'setup' : 'login'}`, { method: 'POST', body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showAccountGate(mode, result.error || 'We could not complete that request.');
    await initialiseOnlineState();
  });
}

function hideAccountGate() {
  $('#account-layer').hidden = true;
}

function showAccount() {
  if (!onlineUser) return showAccountGate('login');
  modal('Signed in', `You are signed in as ${onlineUser.username}.`, '<p class="modal-intro">Signing out leaves the offline cache on this device, but access to the shared stockroom will be removed.</p>', '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button destructive" data-action="sign-out">Sign out</button>');
}

async function signOut() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (_) { /* Local preview has no account service. */ }
  onlineUser = null;
  onlineStorageAvailable = false;
  closeModal();
  showAccountGate('login');
  setSaveStatus('offline', 'Sign in to save online');
}

function cleanNumber(value, fallback = 0) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(value);
}

function formatQuantity(product, amount) {
  return `${formatNumber(amount)} ${product.unit}`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function displayDate(iso) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function daysBetween(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));
}

function productStatusOf(product) {
  if (product.current < product.minimum) return 'below';
  if (product.current < product.par * 0.65) return 'low';
  return 'good';
}

function statusMarkup(product) {
  if (isOnOrder(product)) return `<span class="pill info">On order · ${formatQuantity(product, onOrderQuantity(product))}</span>`;
  const status = productStatusOf(product);
  const labels = { below: ['danger', 'Below minimum'], low: ['warning', 'Getting low'], good: ['success', 'Healthy'] };
  return `<span class="pill ${labels[status][0]}">${labels[status][1]}</span>`;
}

function statusSortValue(product) {
  return { below: 0, low: 1, good: 2 }[productStatusOf(product)] ?? 3;
}

function sortRows(rows, table, valueFor) {
  const { key, direction } = tableSort[table];
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = valueFor(left, key);
    const rightValue = valueFor(right, key);
    if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * multiplier;
    return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), undefined, { numeric: true }) * multiplier;
  });
}

function sortableHeader(table, key, label) {
  const sort = tableSort[table];
  const active = sort.key === key;
  return `<button class="sort-button${active ? ' active' : ''}" data-sort-table="${table}" data-sort-key="${key}" type="button">${label}<span aria-hidden="true">${active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>`;
}

function refreshSortButtons() {
  $$('[data-sort-table]').forEach((button) => {
    const sort = tableSort[button.dataset.sortTable];
    const active = sort?.key === button.dataset.sortKey;
    button.classList.toggle('active', active);
    const indicator = button.querySelector('span');
    if (indicator) indicator.textContent = active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
  });
}

function getOrders() {
  return activeProducts()
    .filter((product) => product.current < product.minimum && !isOnOrder(product))
    .map((product) => ({ ...product, supplier: supplierDetails(product), toOrder: Math.max(0, product.par - product.current) }))
    .sort((a, b) => a.supplier.name.localeCompare(b.supplier.name) || a.name.localeCompare(b.name));
}

function usageFor(productId, days = 28) {
  const cutoff = Date.now() - days * DAY;
  return state.usageRecords
    .filter((record) => record.productId === productId && new Date(record.recordedAt).getTime() >= cutoff)
    .reduce((total, record) => total + Number(record.amount || 0), 0);
}

function allTimeUsage(productId) {
  return state.usageRecords
    .filter((record) => record.productId === productId)
    .reduce((total, record) => total + Number(record.amount || 0), 0);
}

function suggestedPar(product) {
  const recent = usageFor(product.id, 28);
  const weekly = recent / 4;
  if (!recent) return product.par;
  const ideal = Math.max(product.minimum * 1.5, weekly * 1.9);
  const rounded = product.unit === 'kg' ? Math.round(ideal * 2) / 2 : Math.ceil(ideal);
  return Math.max(product.minimum + 1, rounded);
}

function isLowUse(product) {
  const products = activeProducts();
  const ranked = [...products].sort((a, b) => usageFor(a.id, 28) - usageFor(b.id, 28));
  return ranked.slice(0, Math.max(3, Math.ceil(products.length * 0.35))).some((item) => item.id === product.id);
}

function nextSku() {
  const biggest = state.products.reduce((highest, product) => {
    const match = String(product.sku || '').match(/(\d+)$/);
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  return `JC-${String(biggest + 1).padStart(4, '0')}`;
}

function modal(title, subtitle, body, footer = '') {
  $('#modal').innerHTML = `
    <div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;
  $('#modal-layer').classList.add('open');
  $('#modal-layer').setAttribute('aria-hidden', 'false');
}

function closeModal() {
  $('#modal-layer').classList.remove('open');
  $('#modal-layer').setAttribute('aria-hidden', 'true');
  $('#modal').innerHTML = '';
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

function renderDashboard() {
  const products = activeProducts();
  const orders = getOrders();
  const low = products.filter((product) => productStatusOf(product) !== 'good' && !isOnOrder(product)).length;
  const totalUsage = products.reduce((sum, product) => sum + usageFor(product.id, 28), 0);
  const lastTake = [...state.stocktakes].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const days = lastTake ? daysBetween(lastTake.completedAt) : 0;
  const latestFull = state.stocktakes.find((take) => take.type === 'full' && !take.skippedCount && !take.pendingCount && take.complete !== false);
  const fullDays = latestFull ? daysBetween(latestFull.completedAt) : 99;

  $('#metrics').innerHTML = [
    ['PRODUCTS TRACKED', products.length, 'Active stock lines', '▦'],
    ['NEED ATTENTION', low, low ? `${orders.length} below minimum` : 'Everything healthy', '↓'],
    ['NEEDS ORDERING', orders.length, orders.length ? `${new Set(orders.map((item) => item.supplier.id)).size} suppliers` : 'Nothing to order', '↗'],
    ['4-WEEK MOVEMENT', formatNumber(totalUsage), 'Units counted as used', '◔'],
  ].map(([label, value, note, icon]) => `<article class="metric"><div class="metric-label"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${note}</p></article>`).join('');

  $('#order-preview').innerHTML = orders.length
    ? orders.slice(0, 4).map((product) => `<div class="order-preview-row"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</small></div><span class="supplier-chip">${escapeHtml(product.supplier.name)}</span><span class="need">Order ${formatQuantity(product, product.toOrder)}</span>${statusMarkup(product)}</div>`).join('')
    : '<div class="order-preview-empty">Everything is above minimum. No orders are waiting.</div>';

  const mostUsed = [...products]
    .map((product) => ({ ...product, used: usageFor(product.id, 28) }))
    .filter((product) => product.used > 0)
    .sort((a, b) => b.used - a.used)
    .slice(0, 4);
  const maximum = mostUsed[0]?.used || 1;
  $('#top-usage').innerHTML = mostUsed.length
    ? mostUsed.map((product, index) => `<div class="usage-row"><span class="usage-rank">0${index + 1}</span><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(supplierName(product))}</small></div><div class="micro-bar"><span style="width:${Math.max(8, product.used / maximum * 100)}%"></span></div><span class="usage-number">${formatQuantity(product, product.used)}</span></div>`).join('')
    : '<div class="order-preview-empty">Stocktakes will build your usage view.</div>';

  $('#days-since-stocktake').textContent = latestFull ? fullDays : '—';
  $('#stocktake-rhythm').textContent = fullDays <= 7 ? '1 / 1 complete' : '0 / 1 complete';
  $('#stocktake-progress').style.width = `${fullDays <= 7 ? 100 : Math.max(0, 100 - (fullDays - 7) * 12)}%`;
  const recs = products
    .map((product) => ({ product, suggestion: suggestedPar(product) }))
    .filter(({ product, suggestion }) => Math.abs(suggestion - product.par) >= Math.max(product.unit === 'kg' ? .5 : 2, product.par * .15))
    .sort((a, b) => Math.abs(b.suggestion - b.product.par) - Math.abs(a.suggestion - a.product.par));
  if (recs[0]) {
    const { product, suggestion } = recs[0];
    $('#smart-note-title').textContent = `${escapeHtml(product.name)} has a pattern`;
    $('#smart-note-text').textContent = `Recent usage suggests moving its par from ${formatNumber(product.par)} to ${formatNumber(suggestion)} ${product.unit}${suggestion === 1 ? '' : 's'}.`;
  } else {
    $('#smart-note-title').textContent = 'Your par levels are settling in';
    $('#smart-note-text').textContent = 'Keep completing stocktakes. We will flag a change once the pattern is clear.';
  }

  $('#product-count').textContent = products.length;
  $('#order-count').textContent = orders.length;
  $('#delivery-count').textContent = onOrderProducts().length;
  $('#today-label').textContent = todayLabel();
  const label = $('#check-in-label');
  if (label) label.textContent = `${new Intl.DateTimeFormat('en-AU', { weekday: 'long' }).format(new Date())} CHECK-IN`;
  const health = $('#stocktake-health');
  if (health) {
    health.textContent = !products.length ? 'Add stock first' : !latestFull ? 'No full count yet' : fullDays <= 7 ? 'Up to date' : 'Count due';
    health.className = `pill ${latestFull && fullDays <= 7 ? 'success' : 'neutral'}`;
  }
  renderStaffHandover(products);
  if (typeof renderCountShortcuts === 'function') renderCountShortcuts();
  void days;
}

function renderStaffHandover(products) {
  const node = $('#staff-handover');
  if (!node) return;
  if (!products.length) {
    node.innerHTML = `<p class="kicker">GET STARTED</p><h3>Set up your stockroom</h3><p>Add suppliers, add products with their shelf locations, then count your first section.</p><button class="button primary" data-action="${state.suppliers.length ? 'open-product-form' : 'open-supplier-form'}">${state.suppliers.length ? 'Add a product' : 'Add a supplier'}</button>`;
    return;
  }
  const today = new Date().toDateString();
  const takes = state.stocktakes.filter(take => new Date(take.completedAt).toDateString() === today);
  const sections = [...new Set(products.map(p => p.location))].sort();
  const rows = sections.map(section => {
    const sectionProducts = products.filter(p => p.location === section);
    const matching = takes.filter(take => sectionProducts.some(p => take.countedProductIds?.includes(p.id)));
    const counted = new Set(matching.flatMap(take => take.countedProductIds || []));
    const done = sectionProducts.filter(p => counted.has(p.id)).length;
    const latest = matching.sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
    const time = latest ? new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(new Date(latest.completedAt)) : '';
    return `<li><strong>${escapeHtml(section)}</strong><span>${done === sectionProducts.length ? `Counted today at ${time}` : done ? `${done}/${sectionProducts.length} checked today` : 'Still needs counting'}</span></li>`;
  });
  node.innerHTML = `<p class="kicker">TODAY’S HANDOVER</p><h3>Where the shift left off</h3><ul class="handover-list">${rows.join('')}</ul>`;
}

function filteredProducts() {
  const query = productQuery.trim().toLowerCase();
  return state.products.filter((product) => showArchivedProducts ? !isProductActive(product) : isProductActive(product)).filter((product) => {
    const matchesQuery = !query || [product.name, product.sku, product.supplierId, supplierName(product), product.location].some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = productStatus === 'all' || productStatusOf(product) === productStatus;
    const matchesSupplier = productSupplier === 'all' || product.supplierId === productSupplier;
    return matchesQuery && matchesStatus && matchesSupplier;
  });
}

function renderProducts() {
  const toggle = $('#product-archive-toggle');
  if (toggle) toggle.textContent = showArchivedProducts ? 'Show active products' : 'Show archived products';
  const supplierSelect = $('#product-supplier-filter');
  supplierSelect.innerHTML = `<option value="all">All suppliers</option>${activeSuppliers().slice().sort((a, b) => a.name.localeCompare(b.name)).map((supplier) => `<option value="${escapeHtml(supplier.id)}">${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}</option>`).join('')}`;
  supplierSelect.value = productSupplier;
  const products = sortRows(filteredProducts(), 'products', (product, key) => ({
    name: product.name, current: product.current, status: statusSortValue(product), supplier: supplierName(product), location: product.location, minimum: product.minimum, par: product.par,
  })[key]);
  $('#product-summary').textContent = showArchivedProducts ? `${products.length} archived or supplier-disabled products` : `${products.length} of ${activeProducts().length} active products`;
  $('#products-table').innerHTML = products.length
      ? products.map((product) => { const supplierArchived = !isSupplierActive(supplierById(product.supplierId)); return `<tr><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.sku)}${supplierArchived ? ' · Supplier archived' : ''}</small></td><td><span class="stock-cell">${formatQuantity(product, product.current)}</span></td><td>${statusMarkup(product)}</td><td>${escapeHtml(supplierName(product))}<small>${escapeHtml(product.supplierId)}</small></td><td><span class="cell-subtitle">${escapeHtml(product.location)}</span></td><td>${formatQuantity(product, product.minimum)}</td><td>${formatQuantity(product, product.par)}</td><td class="row-actions"><button class="row-action edit-action" data-action="edit-product" data-product-id="${product.id}">Edit</button>${supplierArchived && product.archived !== true ? '<button class="row-action" type="button" disabled title="Restore the supplier first">Restore supplier first</button>' : `<button class="row-action" data-action="toggle-product-archive" data-product-id="${product.id}">${product.archived === true ? 'Restore' : 'Archive'}</button>`}</td></tr>`; }).join('')
    : '<tr><td colspan="8"><div class="order-preview-empty">No products match those filters.</div></td></tr>';
  $('#products-footer').textContent = 'Stock levels update whenever a stocktake is completed.';
}

function toggleProductArchive(product) {
  if (!product) return;
  const restoring = product.archived === true;
  if (restoring && !isSupplierActive(supplierById(product.supplierId))) return toast('Restore this product’s supplier first.');
  if (!restoring && isOnOrder(product)) return toast('Receive or cancel this order before archiving the product.');
  product.archived = !restoring; persist(); renderAll(); toast(product.archived ? 'Product archived.' : 'Product restored.');
}
function toggleSupplierArchive(supplier) {
  if (!supplier) return;
  const restoring = supplier.archived === true;
  if (!restoring && state.products.some((product) => product.supplierId === supplier.id && isOnOrder(product))) return toast('Receive or cancel outstanding orders before archiving this supplier.');
  supplier.archived = !restoring; persist(); renderAll(); toast(supplier.archived ? 'Supplier archived. Its products are hidden until it is restored.' : 'Supplier restored. Its non-archived products are active again.');
}

function renderStocktakes() {
  const history = sortRows(state.stocktakes, 'stocktakes', (take, key) => ({
    label: take.label, productCount: take.productCount, type: take.type, completedAt: new Date(take.completedAt).getTime(),
  })[key]);
  $('#stocktake-history').innerHTML = history.length
    ? history.map((take) => `<tr><td><span class="product-name">${escapeHtml(take.label)}</span>${take.complete === false ? `<small>${take.skippedCount || 0} skipped · partial count</small>` : ''}</td><td class="stock-cell">${take.productCount}</td><td><span class="pill ${take.type === 'full' && take.complete !== false ? 'success' : 'neutral'}">${take.complete === false ? 'Partial count' : take.type === 'full' ? 'Full count' : take.type === 'supplier' ? 'Supplier' : take.type === 'section' ? 'Section' : 'Quick count'}</span></td><td class="stock-cell">${displayDate(take.completedAt)}</td></tr>`).join('')
    : '<div class="order-preview-empty">Your completed stocktakes will appear here.</div>';
}

function renderOrders() {
  const orders = sortRows(getOrders(), 'orders', (product, key) => ({
    name: product.name, current: product.current, status: statusSortValue(product), toOrder: product.toOrder, supplier: product.supplier.name, location: product.location,
  })[key]);
  const availableIds = new Set(orders.map((product) => product.id));
  selectedOrderProductIds = new Set([...selectedOrderProductIds].filter((id) => availableIds.has(id)));
  const supplierCount = new Set(orders.map((order) => order.supplier.id)).size;
  const totalUnits = orders.reduce((sum, order) => sum + order.toOrder, 0);
  $('#order-summary').innerHTML = `<div><strong>${orders.length}</strong><span>items below minimum</span></div><div><strong>${supplierCount}</strong><span>suppliers to contact</span></div><div><strong>${formatNumber(totalUnits)}</strong><span>units to return to par</span></div>`;
  $('#order-bulk-actions').hidden = selectedOrderProductIds.size === 0;
  $('#selected-order-count').textContent = `${selectedOrderProductIds.size} selected`;
  const history = [...(state.orderHistory || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)).slice(0, 8);
  const historyMarkup = history.length ? `<section class="delivery-history"><h3>Recent orders</h3><div class="history-list">${history.map((entry) => { const lines = Array.isArray(entry.lines) ? entry.lines : []; return `<div class="history-row"><span><strong>${lines.length} product${lines.length === 1 ? '' : 's'}</strong><small>${escapeHtml(entry.note || 'No note')}</small></span><span>${displayDate(entry.sentAt)}<small>${formatNumber(lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0))} units</small></span></div>`; }).join('')}</div></section>` : '';
  if (!orders.length) {
    $('#supplier-orders').innerHTML = `<div class="no-orders"><strong>No orders needed right now.</strong><span>Low-stock products already on order are available in Deliveries.</span></div>${historyMarkup}`;
    return;
  }
  const groups = orders.reduce((result, item) => {
    const existing = result.find((group) => group.supplier.id === item.supplier.id);
    if (existing) existing.items.push(item);
    else result.push({ supplier: item.supplier, items: [item] });
    return result;
  }, []);
  $('#supplier-orders').innerHTML = `${groups.map(({ supplier, items }) => {
    const orderLink = supplierOrderLink(supplier.orderingMethod);
    return `<section class="panel table-panel supplier-order-card"><div class="supplier-order-card__head"><div><h3>${escapeHtml(supplier.name)}</h3><p>${escapeHtml(supplier.orderingMethod || 'No ordering instructions recorded')} · ${escapeHtml(orderDaysLabel(supplier))}</p></div><div class="supplier-order-actions">${orderLink ? `<a class="button secondary compact supplier-order-link" href="${escapeHtml(orderLink.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(orderLink.label)}</a>` : ''}<button class="button secondary compact" data-order-copy data-supplier-id="${escapeHtml(supplier.id)}">Copy supplier order</button></div></div><div class="table-wrap"><table><thead><tr><th class="select-cell"></th><th>Product</th><th>Current</th><th>Status</th><th>Recommended</th><th>Location</th></tr></thead><tbody>${items.map((item) => `<tr><td class="select-cell"><input type="checkbox" data-order-select data-product-id="${item.id}" ${selectedOrderProductIds.has(item.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(item.name)} for ordering" /></td><td data-label="Product"><span class="product-name">${escapeHtml(item.name)}</span><small>${escapeHtml(item.sku)}</small></td><td data-label="Current" class="stock-cell">${formatQuantity(item, item.current)}</td><td data-label="Status">${statusMarkup(item)}</td><td data-label="Recommended" class="stock-cell">${formatQuantity(item, item.toOrder)}</td><td data-label="Location"><span class="cell-subtitle">${escapeHtml(item.location)}</span></td></tr>`).join('')}</tbody></table></div></section>`;
  }).join('')}<div class="table-footer">Copy an order to contact the supplier yourself. Select products to review quantities, copy and send the order, then confirm it was sent.</div>${historyMarkup}`;
}

function renderDeliveries() {
  const deliveries = sortRows(onOrderProducts(), 'deliveries', (product, key) => ({
    name: product.name, current: product.current, status: statusSortValue(product), onOrder: onOrderQuantity(product), supplier: supplierName(product), orderedAt: product.onOrderAt || '',
  })[key]);
  const availableIds = new Set(deliveries.map((product) => product.id));
  selectedDeliveryProductIds = new Set([...selectedDeliveryProductIds].filter((id) => availableIds.has(id)));
  const totalUnits = deliveries.reduce((sum, product) => sum + onOrderQuantity(product), 0);
  const supplierCount = new Set(deliveries.map((product) => product.supplierId)).size;
  $('#delivery-summary').innerHTML = `<div><strong>${deliveries.length}</strong><span>incoming products</span></div><div><strong>${supplierCount}</strong><span>suppliers expected</span></div><div><strong>${formatNumber(totalUnits)}</strong><span>units on order</span></div>`;
  $('#delivery-bulk-actions').hidden = selectedDeliveryProductIds.size === 0;
  $('#selected-delivery-count').textContent = `${selectedDeliveryProductIds.size} selected`;
  const selectAll = $('#select-all-deliveries');
  const selectedVisible = deliveries.filter((product) => selectedDeliveryProductIds.has(product.id));
  selectAll.checked = deliveries.length > 0 && selectedVisible.length === deliveries.length;
  selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < deliveries.length;
  $('#deliveries-table').innerHTML = deliveries.length
    ? deliveries.map((product) => `<tr><td class="select-cell"><input type="checkbox" data-delivery-select data-product-id="${product.id}" ${selectedDeliveryProductIds.has(product.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(product.name)} as received" /></td><td data-label="Product"><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</small></td><td data-label="Current"><span class="stock-cell">${formatQuantity(product, product.current)}</span></td><td data-label="Status">${statusMarkup(product)}</td><td data-label="On order"><span class="stock-cell">${formatQuantity(product, onOrderQuantity(product))}</span></td><td data-label="Supplier">${escapeHtml(supplierName(product))}<small>${escapeHtml(product.supplierId)}</small></td><td data-label="Ordered">${product.onOrderAt ? displayDate(product.onOrderAt) : 'Not recorded'}</td><td class="row-actions"><button class="row-action delete-action" data-action="cancel-on-order" data-product-id="${product.id}">Cancel order</button></td></tr>`).join('')
    : '<tr><td colspan="7"><div class="order-preview-empty">Nothing is currently on order.</div></td></tr>';
  let historyNode = $('#delivery-receipt-history');
  if (!historyNode) {
    historyNode = document.createElement('section');
    historyNode.id = 'delivery-receipt-history';
    historyNode.className = 'delivery-history';
    $('#delivery-bulk-actions').after(historyNode);
  }
  const receipts = [...(state.deliveryReceipts || [])].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)).slice(0, 8);
  historyNode.innerHTML = receipts.length ? `<h3>Recent receipts</h3><div class="history-list">${receipts.map((receipt) => { const lines = Array.isArray(receipt.lines) ? receipt.lines : []; return `<div class="history-row"><span><strong>${lines.length} delivery line${lines.length === 1 ? '' : 's'}</strong><small>${escapeHtml(receipt.note || 'No note')}</small></span><span>${displayDate(receipt.receivedAt)}<small>${formatNumber(lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0))} units received</small></span></div>`; }).join('')}</div>` : '';
}

function placeSelectedOnOrder() {
  const orders = getOrders().filter((product) => selectedOrderProductIds.has(product.id));
  if (!orders.length) return toast('Select one or more products before placing an order.');
  const orderSuppliers = [...new Map(orders.map((order) => [order.supplier.id, order.supplier])).values()];
  modal('Review, copy and send your order', 'Adjust the quantities first. Then copy each supplier order, send it through your usual supplier channel, and confirm below. This app does not send orders.', `
    <form id="order-review-form" class="order-review-list">
      ${orders.map((order) => `<label class="order-review-row"><span><strong>${escapeHtml(order.name)}</strong><small>${escapeHtml(order.supplier.name)} · Recommended ${formatQuantity(order, order.toOrder)}</small></span><span class="order-review-input"><span>Order</span><input type="number" name="order-${order.id}" min="0" step="0.1" value="${order.toOrder}" aria-label="Order quantity for ${escapeHtml(order.name)}" /></span></label>`).join('')}
      <div class="review-copy-actions"><span>Copy after adjusting quantities</span>${orderSuppliers.map((supplier) => `<button class="button secondary compact" type="button" data-review-order-copy data-supplier-id="${escapeHtml(supplier.id)}">Copy ${escapeHtml(supplier.name)} order</button>`).join('')}</div>
      <label class="order-note-field">Order note (optional)<textarea name="note" maxlength="500" placeholder="Reference number, delivery date or other detail"></textarea></label>
    </form>
  `, '<button class="button secondary" data-action="close-modal">Back to order list</button><button class="button primary" form="order-review-form" type="submit">I’ve sent this order</button>');
  $('#order-review-form').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-review-order-copy]');
    if (!button) return;
    const supplier = supplierById(button.dataset.supplierId);
    const values = new FormData(event.currentTarget);
    const lines = orders.filter((order) => order.supplier.id === supplier?.id).map((order) => ({ name: order.name, quantity: Number(values.get(`order-${order.id}`)), unit: order.unit }));
    if (!lines.length || lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) return toast('Enter each order quantity before copying.');
    try {
      await navigator.clipboard.writeText(orderClipboardText(supplier, lines));
      toast(`Reviewed order for ${supplier.name} copied. Send it through your usual supplier channel.`);
    } catch {
      toast('Copy was blocked by this browser. Select and copy the order details manually.');
    }
  });
  $('#order-review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const reviewedOrders = orders.map((order) => ({ ...order, toOrder: Number(values.get(`order-${order.id}`)) }));
    if (reviewedOrders.some((order) => !Number.isFinite(order.toOrder) || order.toOrder <= 0)) return toast('Each product needs an order quantity greater than zero.');
    const orderedAt = new Date().toISOString();
    reviewedOrders.forEach((order) => {
      const product = state.products.find((item) => item.id === order.id);
      product.onOrderQuantity = order.toOrder;
      product.onOrderAt = orderedAt;
    });
    state.orderHistory ||= [];
    state.orderHistory.push({ id: `order-${Date.now()}`, sentAt: orderedAt, note: String(values.get('note') || '').trim(), lines: reviewedOrders.map((order) => ({ productId: order.id, name: order.name, supplierId: order.supplier.id, quantity: order.toOrder })) });
    selectedOrderProductIds.clear();
    persist(); renderAll(); closeModal(); setRoute('deliveries');
    toast(`${reviewedOrders.length} product${reviewedOrders.length === 1 ? '' : 's'} recorded as sent and on order.`);
  });
}

function receiveSelectedDeliveries() {
  const deliveries = onOrderProducts().filter((product) => selectedDeliveryProductIds.has(product.id));
  if (!deliveries.length) return toast('Select one or more incoming products to receive.');
  modal('Review received quantities', 'Enter what actually arrived. Any shortage stays on order unless you explicitly close the remaining quantity.', `<form id="receipt-review-form" class="order-review-list">${deliveries.map((product) => `<div class="order-review-row receipt-review-row"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(supplierName(product))} · Expected ${formatQuantity(product, onOrderQuantity(product))}</small></span><div class="receipt-review-controls"><label class="order-review-input"><span>Actually received</span><input type="number" name="actual-${product.id}" min="0" step="0.1" value="${onOrderQuantity(product)}" required aria-label="Actual quantity received for ${escapeHtml(product.name)}" /></label><label class="close-remainder"><input type="checkbox" name="close-${product.id}" /> Close any remaining quantity</label></div></div>`).join('')}<label class="order-note-field">Receipt note (optional)<textarea name="note" maxlength="500" placeholder="Delivery docket, shortages or damaged stock"></textarea></label></form>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" form="receipt-review-form" type="submit">Confirm received quantities</button>');
  $('#receipt-review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    let lines;
    try {
      lines = deliveries.map((product) => ({ product, ...receiptChange(product, values.get(`actual-${product.id}`), values.has(`close-${product.id}`)) }));
    } catch (error) {
      return toast(error.message);
    }
    const receivedAt = new Date().toISOString();
    const receipt = { id: `receipt-${Date.now()}`, receivedAt, note: String(values.get('note') || '').trim(), lines: lines.map(({ product, ...line }) => ({ productId: product.id, name: product.name, supplierId: product.supplierId, closedRemaining: values.has(`close-${product.id}`), ...line })) };
    lines.forEach(({ product, stockAfter, remainingQuantity, onOrderAtAfter }) => {
      product.current = stockAfter;
      product.onOrderQuantity = remainingQuantity;
      product.onOrderAt = onOrderAtAfter;
    });
    state.deliveryReceipts ||= [];
    state.deliveryReceipts.push(receipt);
    selectedDeliveryProductIds.clear();
    persist(); renderAll();
    const unitsReceived = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
    modal('Delivery saved', '', `<div class="receipt-confirm"><strong>${formatNumber(unitsReceived)} units added to stock.</strong><br />Short quantities remain in Deliveries unless you chose to close them.</div>`, `<button class="button secondary" data-action="close-modal">Done</button><button class="button primary" id="undo-receipt">Undo receipt</button>`);
    $('#undo-receipt').addEventListener('click', () => {
      if (!canUndoReceipt(state.products, receipt.lines)) return toast('This receipt can’t be undone because one of its products changed afterwards.');
      receipt.lines.forEach((line) => {
        const product = state.products.find((item) => item.id === line.productId);
        product.current = line.stockBefore;
        product.onOrderQuantity = line.expectedQuantity;
        product.onOrderAt = line.onOrderAtBefore;
      });
      state.deliveryReceipts = state.deliveryReceipts.filter((item) => item.id !== receipt.id);
      persist(); renderAll(); closeModal(); toast('Receipt undone. Stock and incoming quantities were restored.');
    });
  });
}

function cancelOnOrder(product) {
  if (!product || !isOnOrder(product)) return;
  modal('Cancel incoming order?', `${product.name} has ${formatQuantity(product, onOrderQuantity(product))} recorded as incoming.`, '<p class="modal-intro">Cancelling removes the outstanding quantity. If the product is below minimum it will return to the order list.</p>', '<button class="button secondary" data-action="close-modal">Keep order</button><button class="button destructive" id="confirm-cancel-order">Cancel incoming order</button>');
  $('#confirm-cancel-order').addEventListener('click', () => {
    product.onOrderQuantity = 0;
    product.onOrderAt = '';
    selectedDeliveryProductIds.delete(product.id);
    persist(); renderAll(); closeModal();
    toast('The incoming order was cancelled.');
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-order-copy]');
  if (!button) return;
  const supplier = supplierById(button.dataset.supplierId);
  if (!supplier) return;
  const lines = getOrders()
    .filter((product) => product.supplier.id === supplier.id)
    .map((product) => ({ name: product.name, quantity: product.toOrder, unit: product.unit }));
  try {
    await navigator.clipboard.writeText(orderClipboardText(supplier, lines));
    toast(`Order for ${supplier.name} copied. Send it using your usual supplier channel.`);
  } catch {
    toast('Copy was blocked by this browser. Select and copy the order details manually.');
  }
});

function renderSuppliers() {
  const archiveToggle = $('#supplier-archive-toggle');
  if (archiveToggle) archiveToggle.textContent = showArchivedSuppliers ? 'Show active suppliers' : 'Show archived suppliers';
  const suppliers = sortRows(state.suppliers.filter((supplier) => showArchivedSuppliers ? supplier.archived === true : isSupplierActive(supplier)), 'suppliers', (supplier, key) => ({
    name: supplier.name, orderingMethod: supplier.orderingMethod || '', orderDays: orderDaysLabel(supplier), contact: supplier.repContact || '', products: state.products.filter((product) => product.supplierId === supplier.id).length,
  })[key]);
  $('#supplier-summary').textContent = `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} in your order book`;
  $('#suppliers-table').innerHTML = suppliers.length
    ? suppliers.map((supplier) => {
      const productCount = state.products.filter((product) => product.supplierId === supplier.id).length;
      return `<tr><td><span class="product-name">${escapeHtml(supplier.name)}</span><small>${escapeHtml(supplier.id)}</small></td><td>${escapeHtml(supplier.orderingMethod || 'Not recorded')}</td><td>${escapeHtml(orderDaysLabel(supplier))}</td><td>${escapeHtml(supplier.repContact || 'Not recorded')}</td><td class="stock-cell">${productCount}</td><td><span class="cell-subtitle">${escapeHtml(supplier.notes || '—')}</span></td><td class="row-actions"><button class="row-action edit-action" data-action="edit-supplier" data-supplier-id="${escapeHtml(supplier.id)}">Edit</button><button class="row-action" data-action="toggle-supplier-archive" data-supplier-id="${escapeHtml(supplier.id)}">${isSupplierActive(supplier) ? 'Archive' : 'Restore'}</button></td></tr>`;
    }).join('')
    : '<tr><td colspan="7"><div class="order-preview-empty">Add a supplier before adding its products.</div></td></tr>';
}

function renderInsights() {
  const days = Number($('#insight-range').value || 28);
  const usage = activeProducts().map((product) => ({ ...product, used: usageFor(product.id, days), recent: usageFor(product.id, Math.max(7, days / 2)) }));
  if (!selectedInsightProductIds.size && usage.length) {
    [...usage].sort((a, b) => b.used - a.used).slice(0, 5).forEach((product) => selectedInsightProductIds.add(product.id));
  }
  selectedInsightProductIds = new Set([...selectedInsightProductIds].filter((id) => usage.some((product) => product.id === id)));
  const total = usage.reduce((sum, product) => sum + product.used, 0);
  const activeIds = new Set(activeProducts().map(product => product.id));
  const dataPoints = state.usageRecords.filter((record) => activeIds.has(record.productId) && new Date(record.recordedAt).getTime() >= Date.now() - days * DAY).length;
  const recommendations = usage.map((product) => ({ product, suggested: suggestedPar(product) })).filter(({ product, suggested }) => Math.abs(suggested - product.par) >= Math.max(product.unit === 'kg' ? .5 : 2, product.par * .15));
  $('#insight-metrics').innerHTML = [
    ['RECORDED USAGE', formatNumber(total), `Across the last ${days / 7} weeks`, '◔'],
    ['ACTIVE PATTERNS', usage.filter((product) => product.used > 0).length, 'Products with movement', '⌁'],
    ['RECOMMENDATIONS', recommendations.length, 'Potential par-level changes', '✦'],
    ['DATA POINTS', dataPoints, 'Stocktake movements stored', '▦'],
  ].map(([label, value, note, icon]) => `<article class="metric"><div class="metric-label"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${note}</p></article>`).join('');
  const chartData = usage.filter((product) => selectedInsightProductIds.has(product.id));
  const chartMax = Math.max(1, ...chartData.map((product) => product.used));
  $('#usage-chart').innerHTML = chartData.length
    ? chartData.map((product) => `<div class="bar-group"><span class="bar-value">${formatNumber(product.used / (days / 7))}</span><div class="bar" style="height:${Math.max(4, product.used / chartMax * 100)}%" title="${escapeHtml(product.name)}"></div><span class="bar-label">${escapeHtml(product.name)}</span></div>`).join('')
    : '<div class="chart-empty">Choose one or more products below to graph their usage.</div>';
  $('#recommendations').innerHTML = recommendations.length
    ? recommendations.slice(0, 4).map(({ product, suggested }) => `<article class="recommendation-item"><strong>${escapeHtml(product.name)}</strong><p>${formatQuantity(product, usageFor(product.id, 28))} used in the last 4 weeks. Its current par is ${formatQuantity(product, product.par)}.</p><span class="rec-action">Suggest par: ${formatQuantity(product, suggested)} ${suggested > product.par ? '↑' : '↓'}</span></article>`).join('')
    : '<p class="recommendation-empty">More stocktakes will make recommendations more precise. Nothing needs changing just yet.</p>';
  const insightRows = usage.map((product) => {
    const firstHalf = usageFor(product.id, Math.max(7, days / 2));
    const totalForTrend = product.used || 0;
    const oldHalf = Math.max(0, totalForTrend - firstHalf);
    const trend = firstHalf > oldHalf * 1.15 ? ['up', '↑ Increasing'] : firstHalf < oldHalf * .85 ? ['down', '↓ Easing'] : ['stable', '→ Steady'];
    return { product, trend, weekly: totalForTrend / (days / 7) };
  });
  const sortedInsightRows = sortRows(insightRows, 'insights', (row, key) => ({
    name: row.product.name, current: row.product.current, status: statusSortValue(row.product), used: row.product.used, weekly: row.weekly, trend: row.trend[1], suggested: suggestedPar(row.product),
  })[key]);
  $('#usage-table').innerHTML = sortedInsightRows.map(({ product, trend, weekly }) => `<tr><td class="select-cell"><input type="checkbox" data-insight-select data-product-id="${product.id}" ${selectedInsightProductIds.has(product.id) ? 'checked' : ''} aria-label="Graph usage for ${escapeHtml(product.name)}" /></td><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(supplierName(product))}</small></td><td class="stock-cell">${formatQuantity(product, product.current)}</td><td>${statusMarkup(product)}</td><td>${formatQuantity(product, product.used)}</td><td>${formatQuantity(product, weekly)}</td><td><span class="trend ${trend[0]}">${trend[1]}</span></td><td class="stock-cell">${formatQuantity(product, suggestedPar(product))}</td></tr>`).join('');
}

function renderAll() {
  const productToolbar = $('.view[data-view="products"] .toolbar');
  if (productToolbar && !$('#product-archive-toggle')) productToolbar.insertAdjacentHTML('beforeend', '<button class="text-button" id="product-archive-toggle" type="button">Show archived products</button>');
  const supplierToolbar = $('.view[data-view="suppliers"] .toolbar');
  if (supplierToolbar && !$('#supplier-archive-toggle')) supplierToolbar.insertAdjacentHTML('beforeend', '<button class="text-button" id="supplier-archive-toggle" type="button">Show archived suppliers</button>');
  renderDashboard();
  renderProducts();
  renderSuppliers();
  renderStocktakes();
  renderOrders();
  renderDeliveries();
  renderInsights();
  refreshSortButtons();
}

function setRoute(route) {
  activeRoute = route;
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === route));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  const secondaryNavigation = $('.secondary-nav');
  if (secondaryNavigation && ['products', 'suppliers', 'insights'].includes(route)) secondaryNavigation.open = true;
  const labels = {
    dashboard: ['STOCKTAKE', 'Ready for your shift.'], products: ['INVENTORY', 'Product library'], suppliers: ['SUPPLIERS', 'Your ordering contacts.'], stocktake: ['COUNTING', 'Keep the shelves honest.'], orders: ['PURCHASING', 'Ready to order.'], deliveries: ['DELIVERIES', 'Incoming stock.'], insights: ['INSIGHTS', 'Learn your rhythm.'],
  };
  $('#page-eyebrow').textContent = labels[route][0];
  $('#page-title').textContent = labels[route][1];
  $('#main-navigation')?.classList.remove('mobile-open');
  const menuToggle = $('.mobile-menu-toggle');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const navigation = $('#main-navigation');
  const menuToggle = $('.mobile-menu-toggle');
  if (!navigation || !menuToggle) return;
  const isOpen = navigation.classList.toggle('mobile-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
}

function productForm(product) {
  const availableSuppliers = state.suppliers.filter((supplier) => isSupplierActive(supplier) || supplier.id === product?.supplierId);
  if (!availableSuppliers.length) {
    setRoute('suppliers');
    return toast(state.suppliers.length ? 'Restore a supplier before adding products.' : 'Add a supplier before adding products.');
  }
  const item = product || { name: '', sku: nextSku(), supplierId: availableSuppliers[0].id, par: '', minimum: '', current: '', location: '', unit: '', shelfOrder: '' };
  modal(product ? 'Edit product' : 'Add product', product ? 'Update its stock settings or location.' : 'Create a product line. A SKU is assigned automatically.', `
    <form id="product-form" class="form-grid">
      <div class="field full"><label for="product-name">Product name</label><input id="product-name" name="name" value="${escapeHtml(item.name)}" required maxlength="90" placeholder="e.g. House blend coffee" /></div>
      <div class="field"><label for="product-sku">Product SKU</label><input id="product-sku" name="sku" value="${escapeHtml(item.sku)}" required maxlength="32" /><p class="input-note">Auto-generated; you can replace it if needed.</p></div>
      <div class="field"><label for="product-supplier">Supplier</label><select id="product-supplier" name="supplierId" required>${availableSuppliers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((supplier) => `<option value="${escapeHtml(supplier.id)}" ${supplier.id === item.supplierId ? 'selected' : ''}>${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}${isSupplierActive(supplier) ? '' : ' (archived)'}</option>`).join('')}</select><p class="input-note">New products can only use active suppliers.</p></div>
      <div class="field"><label for="product-par">Par level</label><input id="product-par" name="par" value="${item.par}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-minimum">Minimum level</label><input id="product-minimum" name="minimum" value="${item.minimum}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-current">Current stock</label><input id="product-current" name="current" value="${item.current}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-unit">Unit</label><input id="product-unit" name="unit" value="${escapeHtml(item.unit)}" required maxlength="32" placeholder="e.g. carton, kg, cup" /></div>
      <div class="field"><label for="product-location">Location</label><input id="product-location" name="location" value="${escapeHtml(item.location)}" required maxlength="80" placeholder="e.g. Dry store · A2" /></div>
      <div class="field"><label for="product-shelf-order">Shelf count order</label><input id="product-shelf-order" name="shelfOrder" value="${Number.isFinite(item.shelfOrder) ? item.shelfOrder : ''}" type="number" min="0" step="1" placeholder="Optional" /><p class="input-note">Lower numbers appear first while counting a shelf.</p></div>
    </form>
  `, `${product ? '<button class="button destructive editor-delete" id="delete-product-from-editor" type="button">Delete product</button>' : ''}<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" form="product-form" type="submit">${product ? 'Save changes' : 'Add product'}</button>`);
  if (product) $('#delete-product-from-editor').addEventListener('click', () => confirmDeleteProducts([product.id]));
  $('#product-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sku = String(form.get('sku')).trim().toUpperCase();
    const duplicate = state.products.find((candidate) => candidate.sku.toUpperCase() === sku && candidate.id !== product?.id);
    if (duplicate) return toast(`SKU ${sku} is already in use.`);
    const values = {
      name: String(form.get('name')).trim(), sku, supplierId: String(form.get('supplierId')).trim(), location: String(form.get('location')).trim(), unit: String(form.get('unit')).trim(),
      par: cleanNumber(form.get('par')), minimum: cleanNumber(form.get('minimum')), current: cleanNumber(form.get('current')),
    };
    const shelfOrder = String(form.get('shelfOrder') || '').trim();
    if (shelfOrder) values.shelfOrder = cleanNumber(shelfOrder);
    if (values.minimum > values.par) return toast('Minimum level should not be higher than par level.');
    if (product) {
      Object.assign(product, values);
      if (!shelfOrder) delete product.shelfOrder;
    }
    else state.products.push({ id: `p-${Date.now().toString(36)}`, ...values });
    persist(); renderAll(); closeModal(); toast(product ? 'Product updated.' : 'Product added to stockroom.');
  });
}

function supplierForm(supplier) {
  const item = supplier || { id: '', name: '', orderingMethod: '', orderDays: '', repContact: '', notes: '' };
  modal(supplier ? 'Edit supplier' : 'Add supplier', supplier ? 'Update the supplier details. Only its code and name are required.' : 'Supplier codes link products, bulk uploads and orders. Only code and name are required.', `
    <form id="supplier-form" class="form-grid">
      <div class="field"><label for="supplier-id">Supplier code</label><input id="supplier-id" name="id" value="${escapeHtml(item.id)}" required maxlength="32" ${supplier ? 'readonly' : ''} placeholder="e.g. BIOPAK" /><p class="input-note">Required · use this code in product bulk uploads.</p></div>
      <div class="field"><label for="supplier-name">Supplier name</label><input id="supplier-name" name="name" value="${escapeHtml(item.name)}" required maxlength="80" placeholder="e.g. BioPak" /></div>
      <div class="field full"><label for="supplier-ordering-method">How ordering takes place</label><input id="supplier-ordering-method" name="orderingMethod" value="${escapeHtml(item.orderingMethod)}" maxlength="160" placeholder="e.g. Email: hello@email.com, Order through Ordermentum" /></div>
      <div class="field"><label for="supplier-order-days">Days ordered</label><input id="supplier-order-days" name="orderDays" value="${escapeHtml(item.orderDays)}" maxlength="80" placeholder="e.g. M, TH or M, T, W, TH, F" /><p class="input-note">Optional · leave blank when you can order on any day.</p></div>
      <div class="field"><label for="supplier-rep-contact">Delivery issue contact</label><input id="supplier-rep-contact" name="repContact" value="${escapeHtml(item.repContact)}" maxlength="160" placeholder="Name · phone · email" /></div>
      <div class="field full"><label for="supplier-notes">Notes</label><textarea id="supplier-notes" name="notes" rows="3" maxlength="500" placeholder="Anything staff should know before ordering or receiving a delivery.">${escapeHtml(item.notes)}</textarea></div>
    </form>
  `, `<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" form="supplier-form" type="submit">${supplier ? 'Save changes' : 'Add supplier'}</button>`);
  $('#supplier-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requestedCode = String(form.get('id')).trim();
    const name = String(form.get('name')).trim();
    if (!requestedCode || !name) return toast('Supplier code and name are required.');
    const id = supplier ? supplier.id : supplierCode(requestedCode);
    if (!supplier && state.suppliers.some((candidate) => candidate.id === id)) return toast(`Supplier ID ${id} is already in use.`);
    const values = {
      id,
      name,
      orderingMethod: String(form.get('orderingMethod')).trim(),
      orderDays: String(form.get('orderDays')).trim(),
      repContact: String(form.get('repContact')).trim(),
      notes: String(form.get('notes')).trim(),
    };
    if (supplier) Object.assign(supplier, values);
    else state.suppliers.push(values);
    persist(); renderAll(); closeModal(); toast(supplier ? 'Supplier updated.' : 'Supplier added to the order book.');
  });
}

function confirmDeleteProducts(productIds) {
  const ids = new Set(productIds);
  const products = state.products.filter((product) => ids.has(product.id));
  if (!products.length) return toast('Those products are no longer available.');
  const names = products.slice(0, 3).map((product) => escapeHtml(product.name)).join(', ');
  const more = products.length > 3 ? ` and ${products.length - 3} more` : '';
  const title = products.length === 1 ? 'Delete this product?' : `Delete ${products.length} products?`;
  modal(title, 'This cannot be undone.', `<p class="modal-intro"><strong>${names}${more}</strong> will be removed from your product library. Their stored usage records will also be removed; past stocktake summaries will remain.</p>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button destructive" id="confirm-product-deletion">Delete permanently</button>');
  $('#confirm-product-deletion').addEventListener('click', () => {
    state.products = state.products.filter((product) => !ids.has(product.id));
    state.usageRecords = state.usageRecords.filter((record) => !ids.has(record.productId));
    selectedProductIds = new Set([...selectedProductIds].filter((id) => !ids.has(id)));
    persist(); renderAll(); closeModal(); toast(`${products.length} product${products.length === 1 ? '' : 's'} deleted.`);
  });
}

function countDraftOwner() {
  return onlineUser?.id || onlineUser?.username || 'this-device';
}

function activeCountProducts() {
  return activeProducts().filter((product) => !supplierById(product.supplierId)?.archived);
}

async function renderCountShortcuts() {
  const workflow = await import('./count-workflow.js');
  const draft = workflow.loadCountDraft(window.localStorage, countDraftOwner());
  const stocktakeOptions = $('#section-count-shortcuts');
  let stocktakeResumeSlot = $('#stocktake-resume-slot');
  if (stocktakeOptions && !stocktakeResumeSlot) {
    stocktakeOptions.insertAdjacentHTML('beforebegin', '<div class="resume-count-slot" id="stocktake-resume-slot"></div>');
    stocktakeResumeSlot = $('#stocktake-resume-slot');
  }
  [$('#resume-count-slot'), stocktakeResumeSlot].filter(Boolean).forEach((resumeSlot) => {
    resumeSlot.innerHTML = draft
      ? `<div class="count-resume-card"><span><strong>Continue ${escapeHtml(draft.label)}</strong><small>${workflow.countDraftSummary(draft).counted} counted · saved ${displayDate(draft.updatedAt)}</small></span><span class="count-resume-actions"><button class="button secondary" data-discard-count-draft type="button">Restart</button><button class="button primary" data-resume-count-draft type="button">Resume</button></span></div>`
      : resumeSlot.id === 'resume-count-slot' ? '<p class="kicker">YOUR NEXT COUNT</p><h3>Ready when you are</h3><p class="muted">Start a count to keep today’s stock accurate.</p>' : '';
    resumeSlot.querySelector('[data-resume-count-draft]')?.addEventListener('click', () => startStocktake(draft.type, draft.group, { resume: true }));
    resumeSlot.querySelector('[data-discard-count-draft]')?.addEventListener('click', () => startStocktake(draft.type, draft.group, { restart: true }));
  });
  const shortcutSlot = $('#section-count-shortcuts');
  if (shortcutSlot) {
    const sections = [...new Set(activeCountProducts().map((product) => product.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    shortcutSlot.querySelector('.count-shortcut-list')?.remove();
    if (sections.length) shortcutSlot.insertAdjacentHTML('beforeend', `<div class="count-shortcut-list">${sections.map((section) => `<button class="button secondary" type="button" data-count-section="${escapeHtml(section)}">${escapeHtml(section)} · ${activeCountProducts().filter((product) => product.location === section).length}</button>`).join('')}</div>`);
    shortcutSlot.querySelectorAll('[data-count-section]').forEach((button) => button.addEventListener('click', () => startStocktake('section', button.dataset.countSection)));
  }
}
window.renderCountShortcuts = renderCountShortcuts;

async function startStocktake(type = 'full', group = '', options = {}) {
  const workflow = await import('./count-workflow.js');
  const owner = countDraftOwner();
  const supplier = supplierById(group);
  const eligible = activeCountProducts().filter((product) => type === 'full' || (type === 'low' ? isLowUse(product) : type === 'supplier' ? product.supplierId === group : product.location === group));
  const labels = { full: 'Full stocktake', low: 'Low-use item stocktake', supplier: `${supplier?.name || group} stocktake`, section: `${group} stocktake` };
  let draft = workflow.loadCountDraft(window.localStorage, owner);

  if (draft && !options.resume && !options.restart) {
    const summary = workflow.countDraftSummary(draft);
    modal('Continue saved stocktake?', `${escapeHtml(draft.label)} was last saved ${displayDate(draft.updatedAt)}.`, `<div class="count-review-summary"><strong>${summary.counted} counted</strong> · ${summary.skipped} skipped · ${summary.pending} still to review</div><p class="modal-intro">Resume where you stopped, or restart with ${escapeHtml(labels[type])}.</p>`, '<button class="button secondary" data-action="close-modal">Keep for later</button><button class="button secondary" id="restart-stocktake" type="button">Restart</button><button class="button primary" id="resume-stocktake" type="button">Resume saved</button>');
    $('#resume-stocktake').addEventListener('click', () => startStocktake(draft.type, draft.group, { resume: true }));
    $('#restart-stocktake').addEventListener('click', () => startStocktake(type, group, { restart: true }));
    return;
  }
  if (options.restart && draft) {
    workflow.removeCountDraft(window.localStorage, owner);
    draft = null;
  }
  if (!options.resume || !draft) {
    if (!eligible.length) return toast('There are no active products in this stocktake.');
    draft = workflow.createCountDraft({ owner, type, group, label: labels[type], products: eligible });
    try {
      draft = workflow.saveCountDraft(window.localStorage, owner, draft);
    } catch (_) {
      toast('This device cannot save a stocktake draft. Check browser storage and try again.');
      return;
    }
  }

  let draftSaveFailed = false;
  const changedOnResume = workflow.reconcileCountDraft(draft, activeCountProducts());

  let currentIndex = Math.min(Math.max(0, Number(draft.currentIndex) || 0), draft.products.length - 1);
  modal(escapeHtml(draft.label), 'Every choice is saved on this device as you go.', `
    <div class="mobile-stocktake">
      <div class="stocktake-step-meta"><span id="stocktake-step-label"></span><span id="stocktake-step-progress"></span></div>
      <div class="stocktake-step-bar"><span id="stocktake-step-bar"></span></div>
      <div class="count-jump"><select id="stocktake-jump" aria-label="Jump to a product"></select><button class="button secondary" id="stocktake-jump-button" type="button">Jump</button></div>
      <div id="stocktake-step"></div>
    </div>
  `, '<button class="button secondary" id="stocktake-save-exit" type="button">Save and exit</button><button class="button secondary" id="stocktake-back" type="button">Back</button><button class="button secondary" id="count-skip" type="button">Skip</button><button class="button primary" id="stocktake-next" type="button">Next</button>');

  function saveDraft() {
    draft.currentIndex = currentIndex;
    try {
      draft = workflow.saveCountDraft(window.localStorage, owner, draft);
      draftSaveFailed = false;
      void renderCountShortcuts();
      return true;
    } catch (_) {
      if (!draftSaveFailed) toast('Draft autosave is unavailable on this device. Your shared stock has not changed.');
      draftSaveFailed = true;
      return false;
    }
  }

  function setDecision(decision, value = undefined) {
    const product = draft.products[currentIndex];
    draft.entries[product.id] = { decision, ...(value === undefined ? {} : { value }), updatedAt: new Date().toISOString() };
    saveDraft();
  }

  function renderStep() {
    const product = draft.products[currentIndex];
    const liveProduct = activeCountProducts().find((item) => item.id === product.id);
    const entry = draft.entries[product.id] || {};
    const summary = workflow.countDraftSummary(draft, activeCountProducts().map((item) => item.id));
    $('#stocktake-step-label').textContent = `Product ${currentIndex + 1} of ${draft.products.length}`;
    $('#stocktake-step-progress').textContent = `${summary.counted} counted · ${summary.skipped} skipped`;
    $('#stocktake-step-bar').style.width = `${(summary.counted / draft.products.length) * 100}%`;
    $('#stocktake-jump').innerHTML = draft.products.map((item, index) => {
      const decision = draft.entries[item.id]?.decision;
      const marker = decision === 'skipped' ? '○' : decision ? '✓' : '·';
      return `<option value="${index}" ${index === currentIndex ? 'selected' : ''}>${marker} ${index + 1}. ${escapeHtml(item.location)} · ${escapeHtml(item.name)}</option>`;
    }).join('');
    if (!liveProduct) {
      $('#stocktake-step').innerHTML = `<div class="mobile-count-card"><p class="kicker count-missing">PRODUCT REMOVED</p><h3>${escapeHtml(product.name)}</h3><p class="mobile-count-detail">${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</p><p class="mobile-count-note">This product is no longer in the shared product list. It will be recorded as skipped.</p><button class="button secondary" id="skip-removed-product" type="button">Skip removed product</button></div>`;
      $('#skip-removed-product').addEventListener('click', () => { setDecision('skipped'); renderStep(); });
    } else {
      const value = entry.decision === 'counted' ? entry.value ?? '' : entry.decision === 'out' ? '0' : entry.decision === 'same' ? String(product.recorded) : '';
      $('#stocktake-step').innerHTML = `
        <div class="mobile-count-card">
          <p class="kicker">COUNT THIS ITEM</p><h3>${escapeHtml(product.name)}</h3>
          <p class="mobile-count-detail">${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</p>
          <div class="mobile-count-current"><span>Recorded stock</span><strong>${formatNumber(product.recorded)} ${escapeHtml(product.unit)}</strong></div>
          <label class="mobile-count-input-label" for="stocktake-quantity">Counted quantity</label>
          <input id="stocktake-quantity" class="mobile-count-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Type count" value="${escapeHtml(value)}" aria-label="Counted ${escapeHtml(product.unit)} for ${escapeHtml(product.name)}" />
          <span class="count-unit">${escapeHtml(product.unit)}</span>
          <div class="stocktake-keypad" id="stocktake-keypad" aria-label="Number keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => `<button type="button" data-key="${key}" aria-label="${key === 'backspace' ? 'Delete last digit' : key}">${key === 'backspace' ? '⌫' : key}</button>`).join('')}</div>
          <p class="mobile-count-note">Leave blank to skip. Enter 0 for no stock.</p>
        </div>`;
      const input = $('#stocktake-quantity');
      const saveInput = () => setDecision(input.value.trim() === '' ? 'skipped' : 'counted', input.value);
      input.addEventListener('input', saveInput);
      $('#stocktake-keypad').addEventListener('click', (event) => {
        const button = event.target.closest('[data-key]');
        if (!button) return;
        const key = button.dataset.key;
        let nextValue = input.value;
        if (key === 'backspace') nextValue = nextValue.slice(0, -1);
        else if (key === '.' && !nextValue.includes('.')) nextValue = nextValue ? `${nextValue}.` : '0.';
        else if (key !== '.') nextValue += key;
        input.value = nextValue;
        saveInput();
      });
    }
    $('#stocktake-back').disabled = currentIndex === 0;
    $('#stocktake-next').textContent = currentIndex === draft.products.length - 1 ? 'Review' : 'Next';
  }

  function reviewStocktake() {
    const currentProducts = activeCountProducts();
    const changedIds = workflow.reconcileCountDraft(draft, currentProducts);
    if (changedIds.length) {
      currentIndex = draft.products.findIndex((product) => product.id === changedIds[0]);
      saveDraft(); renderStep();
      toast(`${changedIds.length} recorded level${changedIds.length === 1 ? ' changed' : 's changed'} while this draft was open. Count ${changedIds.length === 1 ? 'it' : 'them'} again.`);
      return;
    }
    draft.products.forEach(product => {
      const entry = draft.entries[product.id];
      if (!entry || (entry.decision === 'counted' && String(entry.value ?? '').trim() === '')) draft.entries[product.id] = { decision: 'skipped' };
    });
    saveDraft();
    const summary = workflow.countDraftSummary(draft, currentProducts.map((item) => item.id));
    if (summary.pending) {
      const firstPending = draft.products.findIndex((product) => {
        const entry = draft.entries[product.id];
        return !entry || (entry.decision === 'counted' && !workflow.validateCount(entry.value).valid);
      });
      currentIndex = Math.max(0, firstPending); saveDraft(); renderStep();
      toast(`Choose a count option for ${summary.pending} remaining product${summary.pending === 1 ? '' : 's'}.`);
      return;
    }
    const reviewRows = draft.products.map((product) => {
      const entry = draft.entries[product.id];
      const live = currentProducts.find((item) => item.id === product.id);
      const after = workflow.entryValue(entry, product.recorded);
      const skipped = entry?.decision === 'skipped' || !live;
      const large = !skipped && workflow.isLargeCountChange(Number(live.current), after);
      const result = skipped ? 'Skipped' : `${formatNumber(after)} ${product.unit}`;
      return `<div class="count-review-row ${large ? 'large' : ''}"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.location)} · recorded ${formatNumber(product.recorded)} ${escapeHtml(product.unit)}${large ? ' · Large change' : ''}${!live ? ' · Product removed' : ''}</small></span><b>${escapeHtml(result)}</b></div>`;
    }).join('');
    const skippedOrUnavailable = draft.products.filter((product) => draft.entries[product.id]?.decision === 'skipped' || !currentProducts.some((item) => item.id === product.id)).length;
    modal('Review before saving', `${summary.counted} counted · ${skippedOrUnavailable} skipped or unavailable`, `<div class="count-review-summary">Only explicitly counted products will update stock. Large changes are highlighted.</div><div class="count-review-list">${reviewRows}</div>`, '<button class="button secondary" id="back-to-count" type="button">Back to count</button><button class="button primary" id="confirm-stocktake" type="button">Confirm and save</button>');
    $('#back-to-count').addEventListener('click', () => startStocktake(draft.type, draft.group, { resume: true }));
    $('#confirm-stocktake').addEventListener('click', completeStocktake);
  }

  function completeStocktake() {
    const changedIds = workflow.reconcileCountDraft(draft, activeCountProducts());
    if (changedIds.length) {
      currentIndex = draft.products.findIndex((product) => product.id === changedIds[0]);
      saveDraft();
      toast(`${changedIds.length} recorded level${changedIds.length === 1 ? ' changed' : 's changed'} during review. Count ${changedIds.length === 1 ? 'it' : 'them'} again.`);
      startStocktake(draft.type, draft.group, { resume: true });
      return;
    }
    const completedAt = new Date().toISOString();
    const countedProductIds = [];
    const skippedProductIds = [];
    const removedProductIds = [];
    const previousStock = new Map();
    const usageRecordStart = state.usageRecords.length;
    draft.products.forEach((snapshot) => {
      const entry = draft.entries[snapshot.id];
      const product = activeCountProducts().find((item) => item.id === snapshot.id);
      if (!product) { removedProductIds.push(snapshot.id); return; }
      if (entry?.decision === 'skipped') { skippedProductIds.push(snapshot.id); return; }
      const after = workflow.entryValue(entry, snapshot.recorded);
      if (after === null) return;
      countedProductIds.push(snapshot.id);
      const before = Number(product.current) || 0;
      previousStock.set(product.id, before);
      if (entry.decision !== 'same') product.current = after;
      const consumed = Math.max(0, before - after);
      if (entry.decision !== 'same' && consumed > 0) state.usageRecords.push({ id: `u-${Date.now()}-${product.id}`, productId: product.id, amount: consumed, recordedAt: completedAt, source: 'stocktake' });
    });
    const skippedCount = skippedProductIds.length + removedProductIds.length;
    state.stocktakes.unshift({ id: `st-${Date.now()}`, type: draft.type, group: draft.group, section: draft.type === 'section' ? draft.group : '', label: draft.label, productCount: countedProductIds.length, countedProductIds, skippedProductIds, removedProductIds, skippedCount, pendingCount: 0, complete: skippedCount === 0, startedAt: draft.startedAt, completedAt, completedBy: onlineUser?.username || '', locations: [...new Set(draft.products.map((product) => product.location))] });
    try {
      persist();
    } catch (_) {
      state.stocktakes.shift();
      state.usageRecords.splice(usageRecordStart);
      previousStock.forEach((current, productId) => { const product = state.products.find((item) => item.id === productId); if (product) product.current = current; });
      toast('The stocktake could not be saved. Your draft is still safe on this device.');
      return;
    }
    try {
      workflow.removeCountDraft(window.localStorage, owner);
    } catch (_) {
      toast('Stock was saved, but this device could not clear its finished draft.');
    }
    renderAll(); void renderCountShortcuts(); closeModal(); setRoute('dashboard');
    toast(`Stocktake complete. ${countedProductIds.length} counted${skippedProductIds.length + removedProductIds.length ? ` · ${skippedProductIds.length + removedProductIds.length} skipped` : ''}.`);
  }

  $('#stocktake-save-exit').addEventListener('click', () => { if (saveDraft()) { closeModal(); toast('Stocktake saved on this device.'); } });
  $('#stocktake-back').addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; saveDraft(); renderStep(); } });
  $('#stocktake-next').addEventListener('click', () => {
    const entry = draft.entries[draft.products[currentIndex].id];
    if (entry?.decision === 'counted' && String(entry.value ?? '').trim() !== '' && !workflow.validateCount(entry.value).valid) return toast('Enter a valid quantity, or leave blank to skip.');
    if (!entry || (entry.decision === 'counted' && String(entry.value ?? '').trim() === '')) setDecision('skipped');
    if (currentIndex < draft.products.length - 1) { currentIndex += 1; saveDraft(); renderStep(); } else reviewStocktake();
  });
  $('#count-skip').addEventListener('click', () => {
    setDecision('skipped');
    if (currentIndex < draft.products.length - 1) { currentIndex += 1; saveDraft(); renderStep(); } else reviewStocktake();
  });
  $('#stocktake-jump-button').addEventListener('click', () => { currentIndex = Number($('#stocktake-jump').value); saveDraft(); renderStep(); });
  if (changedOnResume.length) {
    currentIndex = draft.products.findIndex((product) => product.id === changedOnResume[0]);
    saveDraft();
    toast(`${changedOnResume.length} recorded level${changedOnResume.length === 1 ? ' changed' : 's changed'} since this draft was saved. Count ${changedOnResume.length === 1 ? 'it' : 'them'} again.`);
  }
  renderStep();
}

function chooseSupplierTake() {
  const suppliers = state.suppliers.filter((supplier) => !supplier.archived && activeCountProducts().some((product) => product.supplierId === supplier.id)).sort((a, b) => a.name.localeCompare(b.name));
  if (!suppliers.length) return toast('Add products to a supplier before starting this stocktake.');
  modal('Stocktake by supplier', 'Choose the delivery group you want to count.', `<div class="field"><label for="take-supplier">Supplier</label><select id="take-supplier">${suppliers.map((supplier) => `<option value="${escapeHtml(supplier.id)}">${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}</option>`).join('')}</select></div>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" id="continue-supplier-take">Continue</button>');
  $('#continue-supplier-take').addEventListener('click', () => startStocktake('supplier', $('#take-supplier').value));
}

function chooseSectionTake() {
  const sections = [...new Set(activeCountProducts().map((product) => product.location))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  modal('Stocktake by section', 'Choose the area you want to count.', `<div class="field"><label for="take-section">Section</label><select id="take-section">${sections.map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`).join('')}</select></div>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" id="continue-section-take">Continue</button>');
  $('#continue-section-take').addEventListener('click', () => startStocktake('section', $('#take-section').value));
}

function toRows(products) {
  return products.map((product) => ({
    'Product name': product.name,
    'Product SKU': product.sku,
    'Supplier ID': product.supplierId,
    'Supplier name': supplierName(product),
    'Par level': product.par,
    'Minimum level': product.minimum,
    'Current stock': product.current,
    'On order quantity': onOrderQuantity(product),
    'Ordered at': product.onOrderAt || '',
    Location: product.location,
    Unit: product.unit,
  }));
}

function downloadSheet(rows, sheetName, filename) {
  if (window.XLSX) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = Object.keys(rows[0] || {}).map((key) => ({ wch: Math.max(14, key.length + 3) }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetName);
    XLSX.writeFile(book, filename);
    return;
  }
  const headers = Object.keys(rows[0] || {});
  const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header] ?? '').replaceAll('"', '""')))].map((line) => line.map((cell) => `"${cell}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename.replace(/\.xlsx$/, '.csv'); link.click(); URL.revokeObjectURL(link.href);
  toast('Excel support is still loading; a CSV template was downloaded instead.');
}

function downloadTemplate() {
  downloadSheet([{ 'Product name': 'Example product', 'Product SKU': '', 'Supplier ID': 'BIOPAK', 'Par level': 24, 'Minimum level': 8, 'Current stock': 12, Location: 'Dry store · A1', Unit: 'unit' }], 'Products', 'Josie_Coffee_Product_Import_Template.xlsx');
}

function downloadProducts() {
  downloadSheet(toRows(state.products), 'Products', `Josie_Coffee_Products_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadOrders() {
  const rows = getOrders().map((product) => ({ 'Supplier ID': product.supplier.id, Supplier: product.supplier.name, 'Ordering method': product.supplier.orderingMethod, 'Order days': orderDaysLabel(product.supplier), 'Delivery contact': product.supplier.repContact, 'Product name': product.name, SKU: product.sku, 'Current stock': product.current, 'Minimum level': product.minimum, 'Par level': product.par, 'Order quantity': product.toOrder, Unit: product.unit, Location: product.location }));
  if (!rows.length) return toast('There are no products below minimum to download.');
  downloadSheet(rows, 'Order list', `Josie_Coffee_Order_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadUsage() {
  const rows = activeProducts().map((product) => ({ 'Product name': product.name, SKU: product.sku, 'Supplier ID': product.supplierId, Supplier: supplierName(product), '4-week usage': usageFor(product.id, 28), '12-week usage': usageFor(product.id, 84), 'Suggested par': suggestedPar(product), 'Current par': product.par, Unit: product.unit }));
  downloadSheet(rows, 'Usage insights', `Josie_Coffee_Usage_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function normaliseHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueAt(row, keys) {
  const indexed = Object.fromEntries(Object.entries(row).map(([key, value]) => [normaliseHeader(key), value]));
  for (const key of keys) if (indexed[normaliseHeader(key)] !== undefined && indexed[normaliseHeader(key)] !== '') return indexed[normaliseHeader(key)];
  return '';
}

function importRows(rows) {
  let added = 0; let updated = 0; let skipped = 0;
  const unknownSupplierIds = new Set();
  rows.forEach((row) => {
    const name = String(valueAt(row, ['Product name', 'Product', 'Name'])).trim();
    if (!name) { skipped += 1; return; }
    const skuInput = String(valueAt(row, ['Product SKU', 'SKU'])).trim().toUpperCase();
    const existing = state.products.find((product) => product.sku.toUpperCase() === skuInput && skuInput);
    const supplierInput = String(valueAt(row, ['Supplier ID', 'Supplier'])).trim();
    const supplier = state.suppliers.find((candidate) => candidate.id === supplierCode(supplierInput) || candidate.name.toLowerCase() === supplierInput.toLowerCase());
    if (!supplier) {
      unknownSupplierIds.add(supplierInput || 'blank supplier ID');
      skipped += 1;
      return;
    }
    const product = {
      name,
      sku: skuInput || (existing?.sku || nextSku()),
      supplierId: supplier.id,
      par: cleanNumber(valueAt(row, ['Par level', 'Par'])),
      minimum: cleanNumber(valueAt(row, ['Minimum level', 'Minimum', 'Min level'])),
      current: cleanNumber(valueAt(row, ['Current stock', 'Current', 'Stock'])),
      location: String(valueAt(row, ['Location'])).trim() || 'Unassigned location',
      unit: String(valueAt(row, ['Unit', 'Units'])).trim() || 'unit',
    };
    if (existing) { Object.assign(existing, product); updated += 1; }
    else { state.products.push({ id: `p-${Date.now().toString(36)}-${added}`, ...product }); added += 1; }
  });
  persist(); renderAll();
  const supplierNote = unknownSupplierIds.size ? `<br />Skipped rows with unknown supplier IDs: ${escapeHtml([...unknownSupplierIds].join(', '))}. Add those suppliers first, then upload again.` : '';
  modal('Upload complete', 'Your stockroom has been updated.', `<div class="upload-result"><strong>${added} added · ${updated} updated</strong><br />${skipped ? `${skipped} row${skipped === 1 ? '' : 's'} skipped.` : 'Every populated row was imported.'}${supplierNote}</div><p class="modal-intro" style="margin-top:16px">Use <b>Supplier ID</b> in product sheets. Imported SKUs update existing products; blank SKUs are generated automatically.</p>`, '<button class="button primary" data-action="close-modal">Done</button>');
}

function importSuppliers(rows) {
  let added = 0; let updated = 0; let skipped = 0;
  rows.forEach((row) => {
    const name = String(valueAt(row, ['Supplier name', 'Supplier', 'Name'])).trim();
    const suppliedId = String(valueAt(row, ['Supplier ID', 'ID'])).trim();
    if (!name || !suppliedId) { skipped += 1; return; }
    const id = supplierCode(suppliedId);
    const existing = state.suppliers.find((supplier) => supplier.id === id);
    const values = {
      id,
      name,
      orderingMethod: String(valueAt(row, ['How ordering takes place', 'Ordering method', 'Order method'])).trim(),
      orderDays: String(valueAt(row, ['Days ordered', 'Order days'])).trim(),
      repContact: String(valueAt(row, ['Rep contact and details for delivery issues', 'Rep contact', 'Delivery contact'])).trim(),
      notes: String(valueAt(row, ['Notes'])).trim(),
    };
    if (existing) { Object.assign(existing, values); updated += 1; }
    else { state.suppliers.push(values); added += 1; }
  });
  persist(); renderAll();
  modal('Supplier upload complete', 'Your supplier book has been updated.', `<div class="upload-result"><strong>${added} added · ${updated} updated</strong><br />${skipped ? `${skipped} row${skipped === 1 ? '' : 's'} without a supplier name and code skipped.` : 'Every populated row was imported.'}</div><p class="modal-intro" style="margin-top:16px">Supplier codes are stable references for product uploads and order lists.</p>`, '<button class="button primary" data-action="close-modal">Done</button>');
}

function toSupplierRows() {
  return state.suppliers.map((supplier) => ({
    'Supplier name': supplier.name,
    'Supplier ID': supplier.id,
    'How ordering takes place': supplier.orderingMethod,
    'Days ordered': supplier.orderDays,
    'Rep contact and details for delivery issues': supplier.repContact,
    Notes: supplier.notes,
  }));
}

function downloadSupplierTemplate() {
  downloadSheet([{ 'Supplier name': 'Example supplier', 'Supplier ID': 'EXAMPLE-SUPPLIER', 'How ordering takes place': 'Email: hello@example.com', 'Days ordered': 'M, TH', 'Rep contact and details for delivery issues': 'Alex · 0400 000 000 · delivery@example.com', Notes: 'Example delivery note' }], 'Suppliers', 'Josie_Coffee_Supplier_Import_Template.xlsx');
}

function downloadSuppliers() {
  downloadSheet(toSupplierRows(), 'Suppliers', `Josie_Coffee_Suppliers_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function readSpreadsheet(file, onRows, message) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      let rows = [];
      if (window.XLSX) {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        const text = new TextDecoder().decode(event.target.result);
        const [header, ...lines] = text.trim().split(/\r?\n/);
        const headings = header.split(',').map((value) => value.replace(/^"|"$/g, '').trim());
        rows = lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [headings[index], value.replace(/^"|"$/g, '').trim()])));
      }
      if (!rows.length) return toast(message);
      onRows(rows);
    } catch (error) {
      toast('We could not read that sheet. Try the supplied template.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleUpload(file) {
  readSpreadsheet(file, importRows, 'That sheet does not contain any product rows.');
}

function handleSupplierUpload(file) {
  readSpreadsheet(file, importSuppliers, 'That sheet does not contain any supplier rows.');
}

function showHelp() {
  modal('A quick guide', 'Your stockroom is built for the full café rhythm.', `<ul class="help-list"><li><b>Suppliers</b> are their own records. Give each one a stable ID, order instructions, preferred days and delivery contacts.</li><li><b>Products</b> link to a supplier ID, so spreadsheet imports only need that short code.</li><li><b>Stocktakes</b> update stock levels. When a level falls, the difference is saved as usage data.</li><li><b>Online storage</b> follows CoffeeCalc’s model: a shared database when deployed, plus this browser as an offline cache.</li></ul>`, '<button class="button primary" data-action="close-modal">Got it</button>');
}

document.addEventListener('click', (event) => {
  const route = event.target.closest('[data-route]');
  if (route) { setRoute(route.dataset.route); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const product = state.products.find((item) => item.id === action.dataset.productId);
  const supplier = supplierById(action.dataset.supplierId);
  const actions = {
    'close-modal': closeModal,
    'open-product-form': () => productForm(),
    'edit-product': () => productForm(product),
    'toggle-product-archive': () => toggleProductArchive(product),
    'open-supplier-form': () => supplierForm(),
    'edit-supplier': () => supplierForm(supplier),
    'toggle-supplier-archive': () => toggleSupplierArchive(supplier),
    'confirm-delete-product': () => confirmDeleteProducts(product ? [product.id] : []),
    'confirm-delete-selected': () => confirmDeleteProducts([...selectedProductIds]),
    'place-selected-on-order': placeSelectedOnOrder,
    'receive-selected-deliveries': receiveSelectedDeliveries,
    'cancel-on-order': () => cancelOnOrder(product),
    'start-stocktake': () => startStocktake(action.dataset.takeType || 'full'),
    'choose-section-take': chooseSectionTake,
    'choose-supplier-take': chooseSupplierTake,
    'download-template': downloadTemplate,
    'download-products': downloadProducts,
    'download-supplier-template': downloadSupplierTemplate,
    'download-suppliers': downloadSuppliers,
    'download-orders': downloadOrders,
    'download-usage': downloadUsage,
    'print-orders': () => window.print(),
    'show-help': showHelp,
    'show-account': showAccount,
    'sign-out': signOut,
    'toggle-mobile-menu': toggleMobileMenu,
    'show-notifications': () => toast(getOrders().length ? `${getOrders().length} products need an order today.` : 'No stock alerts right now.'),
  };
  actions[action.dataset.action]?.();
});

$('#modal-layer').addEventListener('click', (event) => { if (event.target.id === 'modal-layer') closeModal(); });
$('#product-search').addEventListener('input', (event) => { productQuery = event.target.value; renderProducts(); });
$('#product-status-filter').addEventListener('change', (event) => { productStatus = event.target.value; renderProducts(); });
$('#product-supplier-filter').addEventListener('change', (event) => { productSupplier = event.target.value; renderProducts(); });
document.addEventListener('click', (event) => {
  if (event.target.id === 'product-archive-toggle') { showArchivedProducts = !showArchivedProducts; renderProducts(); }
  if (event.target.id === 'supplier-archive-toggle') { showArchivedSuppliers = !showArchivedSuppliers; renderSuppliers(); }
});
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-product-select]')) {
    if (target.checked) selectedProductIds.add(target.dataset.productId);
    else selectedProductIds.delete(target.dataset.productId);
    renderProducts();
  }
  if (target.id === 'select-all-products') {
    const visibleIds = filteredProducts().map((product) => product.id);
    visibleIds.forEach((id) => target.checked ? selectedProductIds.add(id) : selectedProductIds.delete(id));
    renderProducts();
  }
  if (target.matches('[data-order-select]')) {
    if (target.checked) selectedOrderProductIds.add(target.dataset.productId);
    else selectedOrderProductIds.delete(target.dataset.productId);
    renderOrders();
  }
  if (target.matches('[data-delivery-select]')) {
    if (target.checked) selectedDeliveryProductIds.add(target.dataset.productId);
    else selectedDeliveryProductIds.delete(target.dataset.productId);
    renderDeliveries();
  }
  if (target.matches('[data-insight-select]')) {
    if (target.checked) selectedInsightProductIds.add(target.dataset.productId);
    else selectedInsightProductIds.delete(target.dataset.productId);
    renderInsights();
  }
  if (target.id === 'select-all-deliveries') {
    onOrderProducts().forEach((product) => target.checked ? selectedDeliveryProductIds.add(product.id) : selectedDeliveryProductIds.delete(product.id));
    renderDeliveries();
  }
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sort-table]');
  if (!button) return;
  const sort = tableSort[button.dataset.sortTable];
  if (!sort) return;
  sort.direction = sort.key === button.dataset.sortKey && sort.direction === 'asc' ? 'desc' : 'asc';
  sort.key = button.dataset.sortKey;
  renderAll();
});
$('#insight-range').addEventListener('change', renderInsights);
$('#bulk-upload').addEventListener('change', (event) => { handleUpload(event.target.files[0]); event.target.value = ''; });
$('#supplier-upload').addEventListener('change', (event) => { handleSupplierUpload(event.target.files[0]); event.target.value = ''; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('#modal-layer').classList.contains('open')) closeModal(); });

renderAll();
setRoute(activeRoute);
void initialiseOnlineState();
