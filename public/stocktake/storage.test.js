import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  SYNC_PENDING_KEY,
  createInitialState,
  hasStoredState,
  isStateSyncPending,
  loadState,
  markStateSynced,
  saveState,
} from './storage.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('returns an empty, usable state when browser storage has no data', () => {
  const storage = createStorage();

  assert.deepEqual(loadState(storage), createInitialState());
  assert.equal(hasStoredState(storage), false);
});

test('persists a supplier-only stockroom and tracks its pending sync', () => {
  const storage = createStorage();
  const state = {
    suppliers: [
      {
        id: 'BIOROC',
        name: 'Bioroc',
        orderingMethod: 'Email',
        orderDays: 'Monday',
        repContact: 'orders@example.com',
        notes: 'Deliver before noon',
        archived: false,
      },
    ],
    products: [],
    usageRecords: [],
    stocktakes: [],
  };

  saveState(state, storage);

  assert.equal(hasStoredState(storage), true);
  assert.equal(isStateSyncPending(storage), true);
  assert.deepEqual(loadState(storage), state);
  assert.ok(storage.getItem(STORAGE_KEY));

  markStateSynced(storage);
  assert.equal(storage.getItem(SYNC_PENDING_KEY), null);
});

test('keeps ordering details optional and treats an empty order-days value as valid', () => {
  const storage = createStorage();
  const state = {
    suppliers: [{ id: 'BIOROC', name: 'Bioroc' }],
    products: [],
    usageRecords: [],
    stocktakes: [],
  };

  saveState(state, storage, { synced: true });

  assert.deepEqual(loadState(storage).suppliers, [
    {
      id: 'BIOROC',
      name: 'Bioroc',
      orderingMethod: '',
      orderDays: '',
      repContact: '',
      notes: '',
      archived: false,
    },
  ]);
});

test('migrates legacy supplier names to supplier IDs without dropping supplier details', () => {
  const storage = createStorage();
  storage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      suppliers: [
        {
          name: 'Coffee Supreme',
          orderingMethod: 'Portal',
          orderDays: 'Thursday',
          repContact: 'Mia',
          notes: 'Use weekly order template',
        },
      ],
      products: [
        {
          id: 'beans',
          name: 'House Blend',
          supplier: 'Coffee Supreme',
          par: 18,
          minimum: 6,
          current: 4,
          location: 'Coffee shelf',
          unit: 'kg',
        },
      ],
      usageRecords: [{ id: 'usage-1', productId: 'beans', amount: 2 }],
      stocktakes: [{ id: 'take-1', type: 'full' }],
    }),
  );

  const state = loadState(storage);

  assert.deepEqual(state.suppliers, [
    {
      id: 'COFFEE-SUPREME',
      name: 'Coffee Supreme',
      orderingMethod: 'Portal',
      orderDays: 'Thursday',
      repContact: 'Mia',
      notes: 'Use weekly order template',
      archived: false,
    },
  ]);
  assert.equal(state.products[0].supplierId, 'COFFEE-SUPREME');
  assert.equal(state.products[0].archived, false);
  assert.equal(state.usageRecords.length, 1);
  assert.equal(state.stocktakes.length, 1);
});

test('falls back safely when saved JSON is invalid', () => {
  const storage = createStorage();
  storage.setItem(STORAGE_KEY, '{broken');

  assert.equal(hasStoredState(storage), false);
  assert.deepEqual(loadState(storage), createInitialState());
});

test('keeps archived suppliers and products stored for later restoration', () => {
  const storage = createStorage();
  const state = {
    suppliers: [{ id: 'RETIRED', name: 'Retired Supplier', archived: true }],
    products: [{
      id: 'old-line',
      name: 'Retired product',
      sku: 'JC-OLD',
      supplierId: 'RETIRED',
      par: 6,
      minimum: 2,
      current: 0,
      location: 'Archive shelf',
      unit: 'unit',
      archived: true,
    }],
    usageRecords: [{ id: 'old-usage', productId: 'old-line', amount: 2 }],
    stocktakes: [],
  };

  saveState(state, storage, { synced: true });

  const restored = loadState(storage);
  assert.equal(restored.suppliers[0].archived, true);
  assert.equal(restored.products[0].archived, true);
  assert.equal(restored.usageRecords[0].productId, 'old-line');
});
