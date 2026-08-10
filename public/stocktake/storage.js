export const STORAGE_KEY = 'josieCoffeeStockroom.v2';
export const LEGACY_STORAGE_KEY = 'josieCoffeeStockroom.v1';
export const SYNC_PENDING_KEY = 'josieCoffeeStockroom.sync-pending';

export function createInitialState() {
  return {
    suppliers: [],
    products: [],
    usageRecords: [],
    stocktakes: [],
  };
}

function cleanNumber(value, fallback = 0) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function supplierCode(value) {
  return (
    String(value || 'SUPPLIER')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'SUPPLIER'
  );
}

function uniqueSupplierId(value, usedIds) {
  const base = supplierCode(value);
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  usedIds.add(id);
  return id;
}

export function normaliseState(value) {
  if (!value || !Array.isArray(value.products)) return createInitialState();

  const suppliers = [];
  const usedIds = new Set();
  const addSupplier = (candidate = {}) => {
    const name =
      String(
        candidate.name || candidate.supplier || candidate.id || 'Unassigned supplier',
      ).trim() || 'Unassigned supplier';
    const requestedId = supplierCode(candidate.id || name);
    const existing = suppliers.find(
      (supplier) =>
        supplier.id === requestedId ||
        supplier.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing) return existing;

    const supplier = {
      id: uniqueSupplierId(requestedId, usedIds),
      name,
      orderingMethod: String(candidate.orderingMethod || candidate.orderMethod || '').trim(),
      orderDays: String(candidate.orderDays || '').trim(),
      repContact: String(candidate.repContact || '').trim(),
      notes: String(candidate.notes || '').trim(),
      archived: Boolean(candidate.archived),
    };
    suppliers.push(supplier);
    return supplier;
  };

  (Array.isArray(value.suppliers) ? value.suppliers : []).forEach(addSupplier);
  const products = value.products.map((product, index) => {
    const supplied = String(product.supplierId || product.supplier || '').trim();
    const supplier =
      suppliers.find(
        (item) =>
          item.id === supplierCode(supplied) ||
          item.name.toLocaleLowerCase() === supplied.toLocaleLowerCase(),
      ) ||
      addSupplier({
        id: supplied || `SUPPLIER-${index + 1}`,
        name: product.supplier || supplied || 'Unassigned supplier',
      });

    return {
      id: String(product.id || `p-import-${index + 1}`),
      name: String(product.name || 'Untitled product').trim(),
      sku: String(product.sku || `JC-IMPORT-${index + 1}`).trim().toUpperCase(),
      supplierId: supplier.id,
      par: cleanNumber(product.par),
      minimum: cleanNumber(product.minimum),
      current: cleanNumber(product.current),
      location: String(product.location || 'Unassigned location').trim(),
      unit: String(product.unit || 'unit').trim(),
      archived: Boolean(product.archived),
    };
  });

  return {
    suppliers,
    products,
    usageRecords: Array.isArray(value.usageRecords) ? value.usageRecords : [],
    stocktakes: Array.isArray(value.stocktakes) ? value.stocktakes : [],
  };
}

function storedValue(storage) {
  const current = storage.getItem(STORAGE_KEY);
  if (current !== null) return current;
  return storage.getItem(LEGACY_STORAGE_KEY);
}

export function hasStoredState(storage = window.localStorage) {
  try {
    const value = storedValue(storage);
    if (!value) return false;
    const parsed = JSON.parse(value);
    return Boolean(parsed) && Array.isArray(parsed.products);
  } catch {
    return false;
  }
}

export function loadState(storage = window.localStorage) {
  try {
    const value = storedValue(storage);
    if (value) return normaliseState(JSON.parse(value));
  } catch {
    return createInitialState();
  }

  return createInitialState();
}

export function saveState(
  state,
  storage = window.localStorage,
  { synced = false } = {},
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normaliseState(state)));
  if (synced) {
    storage.removeItem(SYNC_PENDING_KEY);
  } else {
    storage.setItem(SYNC_PENDING_KEY, new Date().toISOString());
  }
}

export function isStateSyncPending(storage = window.localStorage) {
  return storage.getItem(SYNC_PENDING_KEY) !== null;
}

export function markStateSynced(storage = window.localStorage) {
  storage.removeItem(SYNC_PENDING_KEY);
}

export function exportState(state) {
  return JSON.stringify(normaliseState(state));
}

export function importState(json) {
  return normaliseState(JSON.parse(json));
}
