export const COUNT_DRAFT_VERSION = 1;
export const COUNT_DRAFT_PREFIX = 'josieCoffeeStockroom.countDraft.v1';

export function draftStorageKey(user = 'device') {
  const owner = String(user || 'device').trim().toLocaleLowerCase() || 'device';
  return `${COUNT_DRAFT_PREFIX}.${encodeURIComponent(owner)}`;
}

export function validateCount(value) {
  const text = String(value ?? '').trim();
  if (!text) return { valid: false, value: null };
  const number = Number(text);
  return { valid: Number.isFinite(number) && number >= 0, value: number };
}

export function sortCountProducts(products) {
  return [...products].sort((left, right) => {
    const explicitLeft = Number(left.shelfOrder ?? left.countOrder ?? left.stocktakeOrder);
    const explicitRight = Number(right.shelfOrder ?? right.countOrder ?? right.stocktakeOrder);
    const leftHasOrder = Number.isFinite(explicitLeft);
    const rightHasOrder = Number.isFinite(explicitRight);
    if (leftHasOrder || rightHasOrder) {
      if (leftHasOrder && rightHasOrder && explicitLeft !== explicitRight) return explicitLeft - explicitRight;
      if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
    }
    return String(left.location || '').localeCompare(String(right.location || ''), undefined, { numeric: true })
      || String(left.name || '').localeCompare(String(right.name || ''), undefined, { numeric: true });
  });
}

export function createCountDraft({ owner = 'device', type, group = '', label, products, now = new Date().toISOString() }) {
  return {
    version: COUNT_DRAFT_VERSION,
    owner,
    type,
    group,
    label,
    startedAt: now,
    updatedAt: now,
    currentIndex: 0,
    products: sortCountProducts(products).map((product) => ({
      id: String(product.id),
      name: String(product.name || 'Untitled product'),
      sku: String(product.sku || ''),
      location: String(product.location || 'Unassigned location'),
      unit: String(product.unit || 'unit'),
      recorded: Number(product.current) || 0,
    })),
    entries: {},
  };
}

export function isCountDraft(value) {
  return Boolean(value)
    && value.version === COUNT_DRAFT_VERSION
    && typeof value.label === 'string'
    && Array.isArray(value.products)
    && value.products.length > 0
    && value.products.every((product) => product && typeof product.id === 'string')
    && value.entries && typeof value.entries === 'object';
}

export function loadCountDraft(storage, user) {
  try {
    const parsed = JSON.parse(storage.getItem(draftStorageKey(user)) || 'null');
    return isCountDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCountDraft(storage, user, draft, now = new Date().toISOString()) {
  const saved = { ...draft, updatedAt: now };
  storage.setItem(draftStorageKey(user), JSON.stringify(saved));
  return saved;
}

export function removeCountDraft(storage, user) {
  storage.removeItem(draftStorageKey(user));
}

export function entryValue(entry, recorded) {
  if (entry?.decision === 'same') return recorded;
  if (entry?.decision === 'out') return 0;
  if (entry?.decision === 'counted') return validateCount(entry.value).value;
  return null;
}

export function reconcileCountDraft(draft, currentProducts) {
  const currentById = new Map(currentProducts.map((product) => [String(product.id), product]));
  const changedIds = [];
  draft.products.forEach((snapshot) => {
    const current = currentById.get(snapshot.id);
    if (!current || Number(current.current) === Number(snapshot.recorded)) return;
    if (draft.entries[snapshot.id]) changedIds.push(snapshot.id);
    delete draft.entries[snapshot.id];
    snapshot.recorded = Number(current.current) || 0;
    snapshot.name = String(current.name || snapshot.name);
    snapshot.sku = String(current.sku || snapshot.sku);
    snapshot.location = String(current.location || snapshot.location);
    snapshot.unit = String(current.unit || snapshot.unit);
  });
  return changedIds;
}

export function countDraftSummary(draft, currentIds = null) {
  const available = currentIds ? new Set(currentIds) : null;
  const summary = { total: draft.products.length, counted: 0, skipped: 0, pending: 0, removed: 0 };
  draft.products.forEach((product) => {
    if (available && !available.has(product.id)) {
      summary.removed += 1;
      return;
    }
    const decision = draft.entries[product.id]?.decision;
    if (decision === 'skipped') summary.skipped += 1;
    else if (decision === 'same' || decision === 'out' || (decision === 'counted' && validateCount(draft.entries[product.id].value).valid)) summary.counted += 1;
    else summary.pending += 1;
  });
  return summary;
}

export function isLargeCountChange(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return Math.abs(after - before) >= Math.max(10, Math.abs(before) * 0.5);
}

export function countTiming(draft, now = new Date()) {
  const completed = Object.values(draft?.entries || {}).filter((entry) => entry?.decision).length;
  const total = Array.isArray(draft?.products) ? draft.products.length : 0;
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - new Date(draft?.startedAt || now).getTime()) / 1000));
  const averageSeconds = completed ? elapsedSeconds / completed : 0;
  const remainingSeconds = completed ? Math.max(0, Math.round((total - completed) * averageSeconds)) : null;
  return { completed, total, elapsedSeconds, remainingSeconds };
}
