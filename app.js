const STORE_KEY = 'josieCoffeeStockroom.v1';
const DAY = 24 * 60 * 60 * 1000;

const seedProducts = [
  { id: 'p-001', name: 'Oat milk', sku: 'JC-0001', supplier: 'Minor Figures', par: 48, minimum: 18, current: 14, location: 'Milk fridge', unit: 'L carton' },
  { id: 'p-002', name: 'Full cream milk', sku: 'JC-0002', supplier: 'Dairy Farmers', par: 72, minimum: 26, current: 38, location: 'Milk fridge', unit: 'L bottle' },
  { id: 'p-003', name: 'House blend coffee', sku: 'JC-0003', supplier: 'Sample Coffee', par: 18, minimum: 6, current: 4, location: 'Coffee shelf', unit: 'kg' },
  { id: 'p-004', name: 'Single origin coffee', sku: 'JC-0004', supplier: 'Sample Coffee', par: 10, minimum: 3, current: 6, location: 'Coffee shelf', unit: 'kg' },
  { id: 'p-005', name: 'Cold brew concentrate', sku: 'JC-0005', supplier: 'Coffee Supreme', par: 16, minimum: 5, current: 3, location: 'Under bench fridge', unit: 'L bottle' },
  { id: 'p-006', name: 'Takeaway cups · 12 oz', sku: 'JC-0006', supplier: 'BioPak', par: 800, minimum: 240, current: 180, location: 'Dry store · A2', unit: 'cup' },
  { id: 'p-007', name: 'Takeaway lids · 12 oz', sku: 'JC-0007', supplier: 'BioPak', par: 800, minimum: 240, current: 320, location: 'Dry store · A2', unit: 'lid' },
  { id: 'p-008', name: 'Napkins', sku: 'JC-0008', supplier: 'BioPak', par: 1200, minimum: 400, current: 560, location: 'Dry store · B1', unit: 'napkin' },
  { id: 'p-009', name: 'Sparkling water', sku: 'JC-0009', supplier: 'Coca-Cola Europacific', par: 48, minimum: 18, current: 22, location: 'Drinks fridge', unit: 'can' },
  { id: 'p-010', name: 'Cocoa powder', sku: 'JC-0010', supplier: 'Essential Ingredient', par: 6, minimum: 2, current: 1, location: 'Dry store · C4', unit: 'kg' },
  { id: 'p-011', name: 'Vanilla syrup', sku: 'JC-0011', supplier: 'Monin', par: 12, minimum: 4, current: 7, location: 'Back bar', unit: 'bottle' },
  { id: 'p-012', name: 'Chai concentrate', sku: 'JC-0012', supplier: 'Arkadia', par: 12, minimum: 4, current: 2, location: 'Back bar', unit: 'L carton' },
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

function makeInitialState() {
  return {
    products: seedProducts,
    usageRecords: seedUsage(),
    stocktakes: [
      { id: 'st-seed-1', type: 'full', label: 'Full stocktake', productCount: 12, completedAt: isoDaysAgo(5) },
      { id: 'st-seed-2', type: 'supplier', label: 'BioPak stocktake', productCount: 3, completedAt: isoDaysAgo(11) },
    ],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved?.products?.length) return saved;
  } catch (_) {
    // A fresh, working data set is safer than a broken local cache.
  }
  return makeInitialState();
}

let state = loadState();
let activeRoute = 'dashboard';
let productQuery = '';
let productStatus = 'all';
let productSupplier = 'all';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  const status = productStatusOf(product);
  const labels = { below: ['danger', 'Below minimum'], low: ['warning', 'Getting low'], good: ['success', 'Healthy'] };
  return `<span class="pill ${labels[status][0]}">${labels[status][1]}</span>`;
}

function getOrders() {
  return state.products
    .filter((product) => product.current < product.minimum)
    .map((product) => ({ ...product, toOrder: Math.max(0, product.par - product.current) }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier) || a.name.localeCompare(b.name));
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
  const low = state.products.filter((product) => productStatusOf(product) !== 'good').length;
  const totalUsage = state.products.reduce((sum, product) => sum + usageFor(product.id, 28), 0);
  const lastTake = [...state.stocktakes].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const days = lastTake ? daysBetween(lastTake.completedAt) : 0;
  const latestFull = state.stocktakes.find((take) => take.type === 'full');
  const fullDays = latestFull ? daysBetween(latestFull.completedAt) : 99;

  $('#metrics').innerHTML = [
    ['PRODUCTS TRACKED', state.products.length, 'Active stock lines', '▦'],
    ['NEED ATTENTION', low, low ? `${orders.length} below minimum` : 'Everything healthy', '↓'],
    ['ORDER TODAY', orders.length, orders.length ? `${new Set(orders.map((item) => item.supplier)).size} suppliers` : 'Nothing to order', '↗'],
    ['4-WEEK MOVEMENT', formatNumber(totalUsage), 'Units counted as used', '◔'],
  ].map(([label, value, note, icon]) => `<article class="metric"><div class="metric-label"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${note}</p></article>`).join('');

  $('#order-preview').innerHTML = orders.length
    ? orders.slice(0, 4).map((product) => `<div class="order-preview-row"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)} · ${escapeHtml(product.location)}</small></div><span class="supplier-chip">${escapeHtml(product.supplier)}</span><span class="need">Order ${formatQuantity(product, product.toOrder)}</span>${statusMarkup(product)}</div>`).join('')
    : '<div class="order-preview-empty">Everything is above minimum. No orders are waiting.</div>';

  const mostUsed = [...state.products]
    .map((product) => ({ ...product, used: usageFor(product.id, 28) }))
    .filter((product) => product.used > 0)
    .sort((a, b) => b.used - a.used)
    .slice(0, 4);
  const maximum = mostUsed[0]?.used || 1;
  $('#top-usage').innerHTML = mostUsed.length
    ? mostUsed.map((product, index) => `<div class="usage-row"><span class="usage-rank">0${index + 1}</span><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.supplier)}</small></div><div class="micro-bar"><span style="width:${Math.max(8, product.used / maximum * 100)}%"></span></div><span class="usage-number">${formatQuantity(product, product.used)}</span></div>`).join('')
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
  $('#today-label').textContent = todayLabel();
  void days;
}

function filteredProducts() {
  const query = productQuery.trim().toLowerCase();
  return state.products.filter((product) => {
    const matchesQuery = !query || [product.name, product.sku, product.supplier, product.location].some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = productStatus === 'all' || productStatusOf(product) === productStatus;
    const matchesSupplier = productSupplier === 'all' || product.supplier === productSupplier;
    return matchesQuery && matchesStatus && matchesSupplier;
  });
}

function renderProducts() {
  const suppliers = [...new Set(state.products.map((product) => product.supplier))].sort();
  const supplierSelect = $('#product-supplier-filter');
  supplierSelect.innerHTML = `<option value="all">All suppliers</option>${suppliers.map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join('')}`;
  supplierSelect.value = productSupplier;
  const products = filteredProducts();
  $('#product-summary').textContent = `${products.length} of ${state.products.length} products`;
  $('#products-table').innerHTML = products.length
    ? products.map((product) => `<tr><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.sku)}</small></td><td>${escapeHtml(product.supplier)}</td><td><span class="cell-subtitle">${escapeHtml(product.location)}</span></td><td><span class="stock-cell">${formatQuantity(product, product.current)}</span></td><td>${formatQuantity(product, product.minimum)}</td><td>${formatQuantity(product, product.par)}</td><td>${statusMarkup(product)}</td><td><button class="row-action" data-action="edit-product" data-product-id="${product.id}" aria-label="Edit ${escapeHtml(product.name)}">•••</button></td></tr>`).join('')
    : '<tr><td colspan="8"><div class="order-preview-empty">No products match those filters.</div></td></tr>';
  $('#products-footer').textContent = 'Stock levels update whenever a stocktake is completed.';
}

function renderStocktakes() {
  const history = [...state.stocktakes].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  $('#stocktake-history').innerHTML = history.length
    ? history.slice(0, 8).map((take) => `<div class="history-row"><div><strong>${escapeHtml(take.label)}</strong><small>${take.productCount} product${take.productCount === 1 ? '' : 's'} counted</small></div><span class="history-date">${displayDate(take.completedAt)}</span><span class="pill ${take.type === 'full' ? 'success' : 'neutral'}">${take.type === 'full' ? 'Full count' : take.type === 'supplier' ? 'Supplier' : 'Quick count'}</span></div>`).join('')
    : '<div class="order-preview-empty">Your completed stocktakes will appear here.</div>';
}

function renderOrders() {
  const orders = getOrders();
  const supplierCount = new Set(orders.map((order) => order.supplier)).size;
  const totalUnits = orders.reduce((sum, order) => sum + order.toOrder, 0);
  $('#order-summary').innerHTML = `<div><strong>${orders.length}</strong><span>items below minimum</span></div><div><strong>${supplierCount}</strong><span>suppliers to contact</span></div><div><strong>${formatNumber(totalUnits)}</strong><span>units to return to par</span></div>`;
  if (!orders.length) {
    $('#supplier-orders').innerHTML = '<div class="no-orders"><strong>No orders needed right now.</strong><span>Your active products are all above their minimum levels.</span></div>';
    return;
  }
  const groups = orders.reduce((map, order) => {
    map[order.supplier] = map[order.supplier] || [];
    map[order.supplier].push(order);
    return map;
  }, {});
  $('#supplier-orders').innerHTML = Object.entries(groups).map(([supplier, items]) => `<section class="supplier-order"><div class="supplier-head"><div><h3>${escapeHtml(supplier)}</h3><p>${items.length} line${items.length === 1 ? '' : 's'} ready to order</p></div><span class="supplier-total">${formatNumber(items.reduce((sum, item) => sum + item.toOrder, 0))} units</span></div>${items.map((item) => `<div class="order-item"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)} · ${escapeHtml(item.location)}</small></div><span class="order-optional">Have ${formatQuantity(item, item.current)}</span><span class="order-optional">Par ${formatQuantity(item, item.par)}</span><b>Order ${formatQuantity(item, item.toOrder)}</b></div>`).join('')}</section>`).join('');
}

function renderInsights() {
  const days = Number($('#insight-range').value || 28);
  const usage = state.products.map((product) => ({ ...product, used: usageFor(product.id, days), recent: usageFor(product.id, Math.max(7, days / 2)) }));
  const total = usage.reduce((sum, product) => sum + product.used, 0);
  const dataPoints = state.usageRecords.filter((record) => new Date(record.recordedAt).getTime() >= Date.now() - days * DAY).length;
  const recommendations = usage.map((product) => ({ product, suggested: suggestedPar(product) })).filter(({ product, suggested }) => Math.abs(suggested - product.par) >= Math.max(product.unit === 'kg' ? .5 : 2, product.par * .15));
  $('#insight-metrics').innerHTML = [
    ['RECORDED USAGE', formatNumber(total), `Across the last ${days / 7} weeks`, '◔'],
    ['ACTIVE PATTERNS', usage.filter((product) => product.used > 0).length, 'Products with movement', '⌁'],
    ['RECOMMENDATIONS', recommendations.length, 'Potential par-level changes', '✦'],
    ['DATA POINTS', dataPoints, 'Stocktake movements stored', '▦'],
  ].map(([label, value, note, icon]) => `<article class="metric"><div class="metric-label"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${note}</p></article>`).join('');
  const chartData = [...usage].sort((a, b) => b.used - a.used).slice(0, 8);
  const chartMax = chartData[0]?.used || 1;
  $('#usage-chart').innerHTML = chartData.map((product) => `<div class="bar-group"><span class="bar-value">${formatNumber(product.used / (days / 7))}</span><div class="bar" style="height:${Math.max(4, product.used / chartMax * 100)}%" title="${escapeHtml(product.name)}"></div><span class="bar-label">${escapeHtml(product.name)}</span></div>`).join('');
  $('#recommendations').innerHTML = recommendations.length
    ? recommendations.slice(0, 4).map(({ product, suggested }) => `<article class="recommendation-item"><strong>${escapeHtml(product.name)}</strong><p>${formatQuantity(product, usageFor(product.id, 28))} used in the last 4 weeks. Its current par is ${formatQuantity(product, product.par)}.</p><span class="rec-action">Suggest par: ${formatQuantity(product, suggested)} ${suggested > product.par ? '↑' : '↓'}</span></article>`).join('')
    : '<p class="recommendation-empty">More stocktakes will make recommendations more precise. Nothing needs changing just yet.</p>';
  $('#usage-table').innerHTML = usage.sort((a, b) => b.used - a.used).map((product) => {
    const firstHalf = usageFor(product.id, Math.max(7, days / 2));
    const totalForTrend = product.used || 0;
    const oldHalf = Math.max(0, totalForTrend - firstHalf);
    const trend = firstHalf > oldHalf * 1.15 ? ['up', '↑ Increasing'] : firstHalf < oldHalf * .85 ? ['down', '↓ Easing'] : ['stable', '→ Steady'];
    return `<tr><td><span class="product-name">${escapeHtml(product.name)}</span><small>${escapeHtml(product.supplier)}</small></td><td class="stock-cell">${formatQuantity(product, product.current)}</td><td>${formatQuantity(product, usageFor(product.id, 28))}</td><td>${formatQuantity(product, totalForTrend / (days / 7))}</td><td><span class="trend ${trend[0]}">${trend[1]}</span></td><td class="stock-cell">${formatQuantity(product, suggestedPar(product))}</td></tr>`;
  }).join('');
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderStocktakes();
  renderOrders();
  renderInsights();
}

function setRoute(route) {
  activeRoute = route;
  $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === route));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  const labels = {
    dashboard: ['STOCKTAKE', 'Good morning, Josie.'], products: ['INVENTORY', 'Product library'], stocktake: ['COUNTING', 'Keep the shelves honest.'], orders: ['PURCHASING', 'Ready to order.'], insights: ['INSIGHTS', 'Learn your rhythm.'],
  };
  $('#page-eyebrow').textContent = labels[route][0];
  $('#page-title').textContent = labels[route][1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function productForm(product) {
  const item = product || { name: '', sku: nextSku(), supplier: '', par: '', minimum: '', current: '', location: '', unit: '' };
  modal(product ? 'Edit product' : 'Add product', product ? 'Update its stock settings or location.' : 'Create a product line. A SKU is assigned automatically.', `
    <form id="product-form" class="form-grid">
      <div class="field full"><label for="product-name">Product name</label><input id="product-name" name="name" value="${escapeHtml(item.name)}" required maxlength="90" placeholder="e.g. House blend coffee" /></div>
      <div class="field"><label for="product-sku">Product SKU</label><input id="product-sku" name="sku" value="${escapeHtml(item.sku)}" required maxlength="32" /><p class="input-note">Auto-generated; you can replace it if needed.</p></div>
      <div class="field"><label for="product-supplier">Supplier</label><input id="product-supplier" name="supplier" value="${escapeHtml(item.supplier)}" required maxlength="80" placeholder="e.g. BioPak" /></div>
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
      name: String(form.get('name')).trim(), sku, supplier: String(form.get('supplier')).trim(), location: String(form.get('location')).trim(), unit: String(form.get('unit')).trim(),
      par: cleanNumber(form.get('par')), minimum: cleanNumber(form.get('minimum')), current: cleanNumber(form.get('current')),
    };
    if (values.minimum > values.par) return toast('Minimum level should not be higher than par level.');
    if (product) Object.assign(product, values);
    else state.products.push({ id: `p-${Date.now().toString(36)}`, ...values });
    persist(); renderAll(); closeModal(); toast(product ? 'Product updated.' : 'Product added to stockroom.');
  });
}

function startStocktake(type = 'full', supplier = '') {
  const eligible = state.products.filter((product) => type === 'full' || (type === 'low' ? isLowUse(product) : product.supplier === supplier));
  const labels = { full: 'Full stocktake', low: 'Low-use item stocktake', supplier: `${supplier} stocktake` };
  modal(labels[type], `${eligible.length} product${eligible.length === 1 ? '' : 's'} to count. Leave a field unchanged to keep the recorded level.`, `
    <div class="count-summary"><strong>Count today’s stock</strong><span>${eligible.length} lines</span></div>
    <input class="count-search" id="count-search" type="search" placeholder="Find a product to count" />
    <form id="stocktake-form"><div class="count-list" id="count-list">${eligible.map((product) => `<label class="count-row" data-count-name="${escapeHtml(`${product.name} ${product.sku} ${product.location}`.toLowerCase())}"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.location)} · Recorded ${formatQuantity(product, product.current)}</small></span><input type="number" step="0.1" min="0" name="count-${product.id}" value="${product.current}" aria-label="Count for ${escapeHtml(product.name)}" /></label>`).join('')}</div></form>
  `, `<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" form="stocktake-form" type="submit">Complete stocktake</button>`);
  $('#count-search').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    $$('#count-list .count-row').forEach((row) => { row.hidden = !row.dataset.countName.includes(query); });
  });
  $('#stocktake-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    eligible.forEach((product) => {
      const before = product.current;
      const after = cleanNumber(values.get(`count-${product.id}`), before);
      const consumed = Math.max(0, before - after);
      product.current = after;
      if (consumed > 0) state.usageRecords.push({ id: `u-${Date.now()}-${product.id}`, productId: product.id, amount: consumed, recordedAt: new Date().toISOString(), source: 'stocktake' });
    });
    state.stocktakes.unshift({ id: `st-${Date.now()}`, type, label: labels[type], productCount: eligible.length, completedAt: new Date().toISOString() });
    persist(); renderAll(); closeModal(); setRoute('dashboard'); toast('Stocktake complete. Levels and usage have been saved.');
  });
}

function chooseSupplierTake() {
  const suppliers = [...new Set(state.products.map((product) => product.supplier))].sort();
  modal('Stocktake by supplier', 'Choose the delivery group you want to count.', `<div class="field"><label for="take-supplier">Supplier</label><select id="take-supplier">${suppliers.map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join('')}</select></div>`, '<button class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" id="continue-supplier-take">Continue</button>');
  $('#continue-supplier-take').addEventListener('click', () => startStocktake('supplier', $('#take-supplier').value));
}

function toRows(products) {
  return products.map((product) => ({
    'Product name': product.name,
    'Product SKU': product.sku,
    Supplier: product.supplier,
    'Par level': product.par,
    'Minimum level': product.minimum,
    'Current stock': product.current,
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
  downloadSheet([{ 'Product name': 'Example product', 'Product SKU': '', Supplier: 'Example supplier', 'Par level': 24, 'Minimum level': 8, 'Current stock': 12, Location: 'Dry store · A1', Unit: 'unit' }], 'Products', 'Josie_Coffee_Product_Import_Template.xlsx');
}

function downloadProducts() {
  downloadSheet(toRows(state.products), 'Products', `Josie_Coffee_Products_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadOrders() {
  const rows = getOrders().map((product) => ({ Supplier: product.supplier, 'Product name': product.name, SKU: product.sku, 'Current stock': product.current, 'Minimum level': product.minimum, 'Par level': product.par, 'Order quantity': product.toOrder, Unit: product.unit, Location: product.location }));
  if (!rows.length) return toast('There are no products below minimum to download.');
  downloadSheet(rows, 'Order list', `Josie_Coffee_Order_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadUsage() {
  const rows = state.products.map((product) => ({ 'Product name': product.name, SKU: product.sku, Supplier: product.supplier, '4-week usage': usageFor(product.id, 28), '12-week usage': usageFor(product.id, 84), 'Suggested par': suggestedPar(product), 'Current par': product.par, Unit: product.unit }));
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
  rows.forEach((row) => {
    const name = String(valueAt(row, ['Product name', 'Product', 'Name'])).trim();
    if (!name) { skipped += 1; return; }
    const skuInput = String(valueAt(row, ['Product SKU', 'SKU'])).trim().toUpperCase();
    const existing = state.products.find((product) => product.sku.toUpperCase() === skuInput && skuInput);
    const product = {
      name,
      sku: skuInput || (existing?.sku || nextSku()),
      supplier: String(valueAt(row, ['Supplier'])).trim() || 'Unassigned supplier',
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
  modal('Upload complete', 'Your stockroom has been updated.', `<div class="upload-result"><strong>${added} added · ${updated} updated</strong><br />${skipped ? `${skipped} blank row${skipped === 1 ? '' : 's'} skipped.` : 'Every populated row was imported.'}</div><p class="modal-intro" style="margin-top:16px">Imported SKUs update existing products; blank SKUs are generated automatically.</p>`, '<button class="button primary" data-action="close-modal">Done</button>');
}

function handleUpload(file) {
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
      if (!rows.length) return toast('That sheet does not contain any product rows.');
      importRows(rows);
    } catch (error) {
      toast('We could not read that sheet. Try the supplied template.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showHelp() {
  modal('A quick guide', 'Everything in this first version is stored in this browser.', `<ul class="help-list"><li><b>Products</b> are stored with auto-generated SKUs, suppliers, locations and stock rules.</li><li><b>Stocktakes</b> update stock levels. When a level falls, the difference is saved as usage data.</li><li><b>Order list</b> groups only below-minimum products by supplier and calculates the quantity needed to reach par.</li><li><b>Insights</b> keeps using the history in this browser to make par-level suggestions over time.</li></ul>`, '<button class="button primary" data-action="close-modal">Got it</button>');
}

document.addEventListener('click', (event) => {
  const route = event.target.closest('[data-route]');
  if (route) { setRoute(route.dataset.route); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const product = state.products.find((item) => item.id === action.dataset.productId);
  const actions = {
    'close-modal': closeModal,
    'open-product-form': () => productForm(),
    'edit-product': () => productForm(product),
    'start-stocktake': () => startStocktake(action.dataset.takeType || 'full'),
    'choose-supplier-take': chooseSupplierTake,
    'download-template': downloadTemplate,
    'download-products': downloadProducts,
    'download-orders': downloadOrders,
    'download-usage': downloadUsage,
    'print-orders': () => window.print(),
    'show-help': showHelp,
    'show-notifications': () => toast(getOrders().length ? `${getOrders().length} products need an order today.` : 'No stock alerts right now.'),
  };
  actions[action.dataset.action]?.();
});

$('#modal-layer').addEventListener('click', (event) => { if (event.target.id === 'modal-layer') closeModal(); });
$('#product-search').addEventListener('input', (event) => { productQuery = event.target.value; renderProducts(); });
$('#product-status-filter').addEventListener('change', (event) => { productStatus = event.target.value; renderProducts(); });
$('#product-supplier-filter').addEventListener('change', (event) => { productSupplier = event.target.value; renderProducts(); });
$('#insight-range').addEventListener('change', renderInsights);
$('#bulk-upload').addEventListener('change', (event) => { handleUpload(event.target.files[0]); event.target.value = ''; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('#modal-layer').classList.contains('open')) closeModal(); });

renderAll();
setRoute(activeRoute);
