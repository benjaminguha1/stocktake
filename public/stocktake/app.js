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
let state = startedWithStoredState ? loadState() : makeDemoState();
let activeRoute = 'dashboard';
let productQuery = '';
let productStatus = 'all';
let productSupplier = 'all';
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
  return state.products
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
  const ranked = [...state.products].sort((a, b) => usageFor(a.id, 28) - usageFor(b.id, 28));
  return ranked.slice(0, Math.max(3, Math.ceil(state.products.length * 0.35))).some((item) => item.id === product.id);
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
  const orders = getOrders();
  const low = state.products.filter((product) => productStatusOf(product) !== 'good' && !isOnOrder(product)).length;
  const totalUsage = state.products.reduce((sum, product) => sum + usageFor(product.id, 28), 0);
  const lastTake = [...state.stocktakes].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const days = lastTake ? daysBetween(lastTake.completedAt) : 0;
  const latestFull = state.stocktakes.find((take) => take.type === 'full');
  const fullDays = latestFull ? daysBetween(latestFull.completedAt) : 99;

  $('#metrics').innerHTML = [
    ['PRODUCTS TRACKED', state.products.length, 'Active stock lines', '▦'],
    ['NEED ATTENTION', low, low ? `${orders.length} below minimum` : 'Everything healthy', '↓'],
    ['ORDER TODAY', orders.length, orders.length ? `${new Set(orders.map((item) => item.supplier.id)).size} suppliers` : 'Nothing to order', '↗'],
    ['4-WEEK MOVEMENT', formatNumber(totalUsage), 'Units counted as used', '◔'],
  ].map(([label, value, note, icon]) => `<article class="metric"><div class="metric-label"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${note}</p></article>`).join('');

  $('#order-preview').innerHTML = orders.length
    ? orders.slice(0, 4).map((product) => `<div class="order-preview-row"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</small></div><span class="supplier-chip">${escapeHtml(product.supplier.name)}</span><span class="need">Order ${formatQuantity(product, product.toOrder)}</span>${statusMarkup(product)}</div>`).join('')
    : '<div class="order-preview-empty">Everything is above minimum. No orders are waiting.</div>';

  const mostUsed = [...state.products]
    .map((product) => ({ ...product, used: usageFor(product.id, 28) }))
    .filter((product) => product.used > 0)
    .sort((a, b) => b.used - a.used)
    .slice(0, 4);
  const maximum = mostUsed[0]?.used || 1;
  $('#top-usage').innerHTML = mostUsed.length
    ? mostUsed.map((product, index) => `<div class="usage-row"><span class="usage-rank">0${index + 1}</span><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(supplierName(product))}</small></div><div class="micro-bar"><span style="width:${Math.max(8, product.used / maximum * 100)}%"></span></div><span class="usage-number">${formatQuantity(product, product.used)}</span></div>`).join('')
    : '<div class="order-preview-empty">Stocktakes will build your usage view.</div>';

  $('#days-since-stocktake').textContent = fullDays;
  $('#stocktake-rhythm').textContent = fullDays <= 7 ? '1 / 1 complete' : '0 / 1 complete';
  $('#stocktake-progress').style.width = `${fullDays <= 7 ? 100 : Math.max(0, 100 - (fullDays - 7) * 12)}%`;
  const recs = state.products
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

  $('#product-count').textContent = state.products.length;
  $('#order-count').textContent = orders.length;
  $('#delivery-count').textContent = onOrderProducts().length;
  $('#today-label').textContent = todayLabel();
  void days;
}

function filteredProducts() {
  const query = productQuery.trim().toLowerCase();
  return state.products.filter((product) => {
    const matchesQuery = !query || [product.name, product.sku, product.supplierId, supplierName(product), product.location].some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = productStatus === 'all' || productStatusOf(product) === productStatus;
    const matchesSupplier = productSupplier === 'all' || product.supplierId === productSupplier;
    return matchesQuery && matchesStatus && matchesSupplier;
  });
}

function renderProducts() {
  const activeIds = new Set(state.products.map((product) => product.id));
  selectedProductIds = new Set([...selectedProductIds].filter((id) => activeIds.has(id)));
  const supplierSelect = $('#product-supplier-filter');
  supplierSelect.innerHTML = `<option value="all">All suppliers</option>${state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((supplier) => `<option value="${escapeHtml(supplier.id)}">${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}</option>`).join('')}`;
  supplierSelect.value = productSupplier;
  const products = sortRows(filteredProducts(), 'products', (product, key) => ({
    name: product.name, current: product.current, status: statusSortValue(product), supplier: supplierName(product), location: product.location, minimum: product.minimum, par: product.par,
  })[key]);
  const visibleSelected = products.filter((product) => selectedProductIds.has(product.id));
  const selectedCount = selectedProductIds.size;
  $('#product-summary').textContent = `${products.length} of ${state.products.length} products`;
  $('#product-bulk-actions').hidden = selectedCount === 0;
  $('#selected-product-count').textContent = `${selectedCount} selected`;
  const selectAll = $('#select-all-products');
  selectAll.checked = products.length > 0 && visibleSelected.length === products.length;
  selectAll.indeterminate = visibleSelected.length > 0 && visibleSelected.length < products.length;
  $('#products-table').innerHTML = products.length
    ? products.map((product) => `<tr><td class="select-cell"><input type="checkbox" data-product-select data-product-id="${product.id}" ${selectedProductIds.has(product.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(product.name)}" /></td><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.sku)}</small></td><td><span class="stock-cell">${formatQuantity(product, product.current)}</span></td><td>${statusMarkup(product)}</td><td>${escapeHtml(supplierName(product))}<small>${escapeHtml(product.supplierId)}</small></td><td><span class="cell-subtitle">${escapeHtml(product.location)}</span></td><td>${formatQuantity(product, product.minimum)}</td><td>${formatQuantity(product, product.par)}</td><td class="row-actions"><button class="row-action edit-action" data-action="edit-product" data-product-id="${product.id}">Edit</button><button class="row-action delete-action" data-action="confirm-delete-product" data-product-id="${product.id}">Delete</button></td></tr>`).join('')
    : '<tr><td colspan="9"><div class="order-preview-empty">No products match those filters.</div></td></tr>';
  $('#products-footer').textContent = 'Stock levels update whenever a stocktake is completed.';
}

function renderStocktakes() {
  const history = sortRows(state.stocktakes, 'stocktakes', (take, key) => ({
    label: take.label, productCount: take.productCount, type: take.type, completedAt: new Date(take.completedAt).getTime(),
  })[key]);
  $('#stocktake-history').innerHTML = history.length
    ? history.map((take) => `<tr><td><span class="product-name">${escapeHtml(take.label)}</span></td><td class="stock-cell">${take.productCount}</td><td><span class="pill ${take.type === 'full' ? 'success' : 'neutral'}">${take.type === 'full' ? 'Full count' : take.type === 'supplier' ? 'Supplier' : take.type === 'section' ? 'Section' : 'Quick count'}</span></td><td class="stock-cell">${displayDate(take.completedAt)}</td></tr>`).join('')
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
  if (!orders.length) {
    $('#supplier-orders').innerHTML = '<div class="no-orders"><strong>No orders needed right now.</strong><span>Low-stock products already on order are available in Deliveries.</span></div>';
    return;
  }
  $('#supplier-orders').innerHTML = `<section class="panel table-panel"><div class="table-wrap"><table><thead><tr><th class="select-cell"></th><th>${sortableHeader('orders', 'name', 'Product')}</th><th>${sortableHeader('orders', 'current', 'Current stock')}</th><th>${sortableHeader('orders', 'status', 'Status')}</th><th>${sortableHeader('orders', 'toOrder', 'Recommended')}</th><th>${sortableHeader('orders', 'supplier', 'Supplier')}</th><th>${sortableHeader('orders', 'location', 'Location')}</th></tr></thead><tbody>${orders.map((item) => `<tr><td class="select-cell"><input type="checkbox" data-order-select data-product-id="${item.id}" ${selectedOrderProductIds.has(item.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(item.name)} for ordering" /></td><td><span class="product-name">${escapeHtml(item.name)}</span><small>${escapeHtml(item.sku)}</small></td><td class="stock-cell">${formatQuantity(item, item.current)}</td><td>${statusMarkup(item)}</td><td class="stock-cell">${formatQuantity(item, item.toOrder)}</td><td>${escapeHtml(item.supplier.name)}<small>${escapeHtml(item.supplier.id)} · ${escapeHtml(orderDaysLabel(item.supplier))}</small></td><td><span class="cell-subtitle">${escapeHtml(item.location)}</span></td></tr>`).join('')}</tbody></table></div><div class="table-footer">Select items, then place the recommended quantity on order.</div></section>`;
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
    ? deliveries.map((product) => `<tr><td class="select-cell"><input type="checkbox" data-delivery-select data-product-id="${product.id}" ${selectedDeliveryProductIds.has(product.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(product.name)} as received" /></td><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</small></td><td><span class="stock-cell">${formatQuantity(product, product.current)}</span></td><td>${statusMarkup(product)}</td><td><span class="stock-cell">${formatQuantity(product, onOrderQuantity(product))}</span></td><td>${escapeHtml(supplierName(product))}<small>${escapeHtml(product.supplierId)}</small></td><td>${product.onOrderAt ? displayDate(product.onOrderAt) : 'Not recorded'}</td><td class="row-actions"><button class="row-action delete-action" data-action="cancel-on-order" data-product-id="${product.id}">Cancel order</button></td></tr>`).join('')
    : '<tr><td colspan="7"><div class="order-preview-empty">Nothing is currently on order.</div></td></tr>';
}

function placeSelectedOnOrder() {
  const orders = getOrders().filter((product) => selectedOrderProductIds.has(product.id));
  if (!orders.length) return toast('Select one or more products before placing an order.');
  const orderedAt = new Date().toISOString();
  orders.forEach((order) => {
    const product = state.products.find((item) => item.id === order.id);
    product.onOrderQuantity = order.toOrder;
    product.onOrderAt = orderedAt;
  });
  selectedOrderProductIds.clear();
  persist(); renderAll(); setRoute('deliveries');
  toast(`${orders.length} product${orders.length === 1 ? '' : 's'} marked as on order.`);
}

function receiveSelectedDeliveries() {
  const deliveries = onOrderProducts().filter((product) => selectedDeliveryProductIds.has(product.id));
  if (!deliveries.length) return toast('Select one or more incoming products to receive.');
  const unitsReceived = deliveries.reduce((total, product) => total + onOrderQuantity(product), 0);
  deliveries.forEach((product) => {
    product.current = cleanNumber(product.current) + onOrderQuantity(product);
    product.onOrderQuantity = 0;
    product.onOrderAt = '';
  });
  selectedDeliveryProductIds.clear();
  persist(); renderAll();
  toast(`${deliveries.length} delivery line${deliveries.length === 1 ? '' : 's'} received · ${formatNumber(unitsReceived)} units added to stock.`);
}

function cancelOnOrder(product) {
  if (!product || !isOnOrder(product)) return;
  product.onOrderQuantity = 0;
  product.onOrderAt = '';
  selectedDeliveryProductIds.delete(product.id);
  persist(); renderAll();
  toast('The incoming order was cancelled. The product is back on the order list if it is below minimum.');
}

function renderSuppliers() {
  const suppliers = sortRows(state.suppliers, 'suppliers', (supplier, key) => ({
    name: supplier.name, orderingMethod: supplier.orderingMethod || '', orderDays: orderDaysLabel(supplier), contact: supplier.repContact || '', products: state.products.filter((product) => product.supplierId === supplier.id).length,
  })[key]);
  $('#supplier-summary').textContent = `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} in your order book`;
  $('#suppliers-table').innerHTML = suppliers.length
    ? suppliers.map((supplier) => {
      const productCount = state.products.filter((product) => product.supplierId === supplier.id).length;
      return `<tr><td><span class="product-name">${escapeHtml(supplier.name)}</span><small>${escapeHtml(supplier.id)}</small></td><td>${escapeHtml(supplier.orderingMethod || 'Not recorded')}</td><td>${escapeHtml(orderDaysLabel(supplier))}</td><td>${escapeHtml(supplier.repContact || 'Not recorded')}</td><td class="stock-cell">${productCount}</td><td><span class="cell-subtitle">${escapeHtml(supplier.notes || '—')}</span></td><td class="row-actions"><button class="row-action edit-action" data-action="edit-supplier" data-supplier-id="${escapeHtml(supplier.id)}">Edit</button></td></tr>`;
    }).join('')
    : '<tr><td colspan="7"><div class="order-preview-empty">Add a supplier before adding its products.</div></td></tr>';
}

function renderInsights() {
  const days = Number($('#insight-range').value || 28);
  const usage = state.products.map((product) => ({ ...product, used: usageFor(product.id, days), recent: usageFor(product.id, Math.max(7, days / 2)) }));
  if (!selectedInsightProductIds.size && usage.length) {
    [...usage].sort((a, b) => b.used - a.used).slice(0, 5).forEach((product) => selectedInsightProductIds.add(product.id));
  }
  selectedInsightProductIds = new Set([...selectedInsightProductIds].filter((id) => usage.some((product) => product.id === id)));
  const total = usage.reduce((sum, product) => sum + product.used, 0);
  const dataPoints = state.usageRecords.filter((record) => new Date(record.recordedAt).getTime() >= Date.now() - days * DAY).length;
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
  const labels = {
    dashboard: ['STOCKTAKE', 'Good morning, Josie.'], products: ['INVENTORY', 'Product library'], suppliers: ['SUPPLIERS', 'Your ordering contacts.'], stocktake: ['COUNTING', 'Keep the shelves honest.'], orders: ['PURCHASING', 'Ready to order.'], deliveries: ['DELIVERIES', 'Incoming stock.'], insights: ['INSIGHTS', 'Learn your rhythm.'],
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
  if (!state.suppliers.length) {
    setRoute('suppliers');
    return toast('Add a supplier before adding products.');
  }
  const item = product || { name: '', sku: nextSku(), supplierId: state.suppliers[0].id, par: '', minimum: '', current: '', location: '', unit: '' };
  modal(product ? 'Edit product' : 'Add product', product ? 'Update its stock settings or location.' : 'Create a product line. A SKU is assigned automatically.', `
    <form id="product-form" class="form-grid">
      <div class="field full"><label for="product-name">Product name</label><input id="product-name" name="name" value="${escapeHtml(item.name)}" required maxlength="90" placeholder="e.g. House blend coffee" /></div>
      <div class="field"><label for="product-sku">Product SKU</label><input id="product-sku" name="sku" value="${escapeHtml(item.sku)}" required maxlength="32" /><p class="input-note">Auto-generated; you can replace it if needed.</p></div>
      <div class="field"><label for="product-supplier">Supplier</label><select id="product-supplier" name="supplierId" required>${state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((supplier) => `<option value="${escapeHtml(supplier.id)}" ${supplier.id === item.supplierId ? 'selected' : ''}>${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}</option>`).join('')}</select><p class="input-note">Suppliers are managed in the supplier book.</p></div>
      <div class="field"><label for="product-par">Par level</label><input id="product-par" name="par" value="${item.par}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-minimum">Minimum level</label><input id="product-minimum" name="minimum" value="${item.minimum}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-current">Current stock</label><input id="product-current" name="current" value="${item.current}" type="number" min="0" step="0.1" required /></div>
      <div class="field"><label for="product-unit">Unit</label><input id="product-unit" name="unit" value="${escapeHtml(item.unit)}" required maxlength="32" placeholder="e.g. carton, kg, cup" /></div>
      <div class="field full"><label for="product-location">Location</label><input id="product-location" name="location" value="${escapeHtml(item.location)}" required maxlength="80" placeholder="e.g. Dry store · A2" /></div>
    </form>
  `, `<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" form="product-form" type="submit">${product ? 'Save changes' : 'Add product'}</button>`);
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
    if (values.minimum > values.par) return toast('Minimum level should not be higher than par level.');
    if (product) Object.assign(product, values);
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

function startStocktake(type = 'full', group = '') {
  const supplier = supplierById(group);
  const eligible = state.products.filter((product) => type === 'full' || (type === 'low' ? isLowUse(product) : type === 'supplier' ? product.supplierId === group : product.location === group));
  const labels = { full: 'Full stocktake', low: 'Low-use item stocktake', supplier: `${supplier?.name || group} stocktake`, section: `${group} stocktake` };
  if (!eligible.length) {
    toast('There are no products in this stocktake.');
    return;
  }

  let currentIndex = 0;
  const counts = new Map();

  modal(labels[type], 'Count one product at a time. Leave a value blank to keep the recorded stock.', `
    <div class="mobile-stocktake">
      <div class="stocktake-step-meta"><span id="stocktake-step-label"></span><span id="stocktake-step-progress"></span></div>
      <div class="stocktake-step-bar"><span id="stocktake-step-bar"></span></div>
      <div id="stocktake-step"></div>
    </div>
  `, `<button class="button secondary" data-action="close-modal">Cancel</button><button class="button secondary" id="stocktake-back" type="button">Back</button><button class="button primary" id="stocktake-next" type="button">Next</button>`);

  function saveCurrentValue() {
    const input = $('#stocktake-quantity');
    if (input) counts.set(eligible[currentIndex].id, input.value);
  }

  function renderStep() {
    const product = eligible[currentIndex];
    const value = counts.get(product.id) ?? '';
    $('#stocktake-step-label').textContent = `Product ${currentIndex + 1} of ${eligible.length}`;
    $('#stocktake-step-progress').textContent = `${Math.round(((currentIndex + 1) / eligible.length) * 100)}% complete`;
    $('#stocktake-step-bar').style.width = `${((currentIndex + 1) / eligible.length) * 100}%`;
    $('#stocktake-step').innerHTML = `
      <div class="mobile-count-card">
        <p class="kicker">COUNT THIS ITEM</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="mobile-count-detail">${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</p>
        <div class="mobile-count-current"><span>Current stock</span><strong>${formatQuantity(product, product.current)}</strong></div>
        <label class="mobile-count-input-label" for="stocktake-quantity">New stock</label>
        <input id="stocktake-quantity" class="mobile-count-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Type count" value="${escapeHtml(value)}" aria-label="New stock count for ${escapeHtml(product.name)}" />
        <div class="stocktake-keypad" id="stocktake-keypad" aria-label="Number keypad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => `<button type="button" data-key="${key}" aria-label="${key === 'backspace' ? 'Delete last digit' : key}">${key === 'backspace' ? '⌫' : key}</button>`).join('')}
        </div>
        <p class="mobile-count-note">Leave blank to keep the current stock level.</p>
      </div>`;
    $('#stocktake-back').disabled = currentIndex === 0;
    $('#stocktake-next').textContent = currentIndex === eligible.length - 1 ? 'Complete stocktake' : 'Next';

    $('#stocktake-quantity').addEventListener('input', saveCurrentValue);
    $('#stocktake-keypad').addEventListener('click', (event) => {
      const button = event.target.closest('[data-key]');
      if (!button) return;
      const input = $('#stocktake-quantity');
      const key = button.dataset.key;
      let nextValue = input.value;
      if (key === 'backspace') nextValue = nextValue.slice(0, -1);
      else if (key === '.' && !nextValue.includes('.')) nextValue = nextValue ? `${nextValue}.` : '0.';
      else if (key !== '.') nextValue += key;
      input.value = nextValue;
      saveCurrentValue();
    });
  }

  function completeStocktake() {
    eligible.forEach((product) => {
      const rawValue = counts.get(product.id) ?? '';
      const before = product.current;
      const after = rawValue.trim() === '' ? before : cleanNumber(rawValue, before);
      const consumed = Math.max(0, before - after);
      product.current = after;
      if (consumed > 0) state.usageRecords.push({ id: `u-${Date.now()}-${product.id}`, productId: product.id, amount: consumed, recordedAt: new Date().toISOString(), source: 'stocktake' });
    });
    state.stocktakes.unshift({ id: `st-${Date.now()}`, type, label: labels[type], productCount: eligible.length, completedAt: new Date().toISOString() });
    persist(); renderAll(); closeModal(); setRoute('dashboard'); toast('Stocktake complete. Levels and usage have been saved.');
  }

  $('#stocktake-back').addEventListener('click', () => {
    saveCurrentValue();
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderStep();
    }
  });
  $('#stocktake-next').addEventListener('click', () => {
    saveCurrentValue();
    const value = counts.get(eligible[currentIndex].id) ?? '';
    if (value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      toast('Enter a valid stock quantity.');
      return;
    }
    if (currentIndex < eligible.length - 1) {
      currentIndex += 1;
      renderStep();
      return;
    }
    completeStocktake();
  });
  renderStep();
}

function chooseSupplierTake() {
  const suppliers = state.suppliers.filter((supplier) => state.products.some((product) => product.supplierId === supplier.id)).sort((a, b) => a.name.localeCompare(b.name));
  if (!suppliers.length) return toast('Add products to a supplier before starting this stocktake.');
  modal('Stocktake by supplier', 'Choose the delivery group you want to count.', `<div class="field"><label for="take-supplier">Supplier</label><select id="take-supplier">${suppliers.map((supplier) => `<option value="${escapeHtml(supplier.id)}">${escapeHtml(supplier.name)} · ${escapeHtml(supplier.id)}</option>`).join('')}</select></div>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" id="continue-supplier-take">Continue</button>');
  $('#continue-supplier-take').addEventListener('click', () => startStocktake('supplier', $('#take-supplier').value));
}

function chooseSectionTake() {
  const sections = [...new Set(state.products.map((product) => product.location))].sort();
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
  const rows = state.products.map((product) => ({ 'Product name': product.name, SKU: product.sku, 'Supplier ID': product.supplierId, Supplier: supplierName(product), '4-week usage': usageFor(product.id, 28), '12-week usage': usageFor(product.id, 84), 'Suggested par': suggestedPar(product), 'Current par': product.par, Unit: product.unit }));
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
    'open-supplier-form': () => supplierForm(),
    'edit-supplier': () => supplierForm(supplier),
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
