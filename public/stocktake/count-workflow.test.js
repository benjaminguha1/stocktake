import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countDraftSummary,
  createCountDraft,
  draftStorageKey,
  entryValue,
  isLargeCountChange,
  loadCountDraft,
  reconcileCountDraft,
  saveCountDraft,
  sortCountProducts,
  validateCount,
} from './count-workflow.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('validates only explicit non-negative numeric counts', () => {
  assert.deepEqual(validateCount(' 2.5 '), { valid: true, value: 2.5 });
  assert.equal(validateCount('').valid, false);
  assert.equal(validateCount('-1').valid, false);
  assert.equal(validateCount('two').valid, false);
});

test('orders a count by explicit order, then shelf location and product name', () => {
  const products = [
    { id: '3', name: 'Lids', location: 'Shelf 2' },
    { id: '2', name: 'Beans', location: 'Shelf 10' },
    { id: '1', name: 'Cups', location: 'Shelf 2' },
  ];
  assert.deepEqual(sortCountProducts(products).map(({ id }) => id), ['1', '3', '2']);
  assert.deepEqual(sortCountProducts([{ ...products[0], shelfOrder: 2 }, { ...products[1], shelfOrder: 1 }]).map(({ id }) => id), ['2', '3']);
});

test('saves drafts per user and restores decisions without touching shared state', () => {
  const storage = memoryStorage();
  const draft = createCountDraft({ owner: 'Josie', type: 'full', label: 'Full stocktake', products: [{ id: 'p1', name: 'Milk', current: 4, unit: 'bottle' }], now: '2026-09-21T00:00:00.000Z' });
  draft.entries.p1 = { decision: 'out' };
  saveCountDraft(storage, 'Josie', draft, '2026-09-21T01:00:00.000Z');
  assert.equal(loadCountDraft(storage, 'Josie').entries.p1.decision, 'out');
  assert.equal(loadCountDraft(storage, 'Other'), null);
  assert.notEqual(draftStorageKey('Josie'), draftStorageKey('Other'));
});

test('surfaces unavailable draft storage to the caller', () => {
  const storage = { setItem() { throw new Error('quota'); } };
  assert.throws(() => saveCountDraft(storage, 'Josie', { entries: {} }), /quota/);
});

test('requires a fresh decision when recorded stock changes during a draft', () => {
  const draft = createCountDraft({ type: 'full', label: 'Full', products: [{ id: 'a', name: 'Milk', current: 4, unit: 'bottle' }] });
  draft.entries.a = { decision: 'same' };
  assert.deepEqual(reconcileCountDraft(draft, [{ id: 'a', name: 'Milk', current: 6, unit: 'bottle' }]), ['a']);
  assert.equal(draft.entries.a, undefined);
  assert.equal(draft.products[0].recorded, 6);
});

test('summary keeps skipped and removed products out of the completed count', () => {
  const draft = createCountDraft({ type: 'full', label: 'Full', products: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  draft.entries = { a: { decision: 'same' }, b: { decision: 'skipped' }, c: { decision: 'counted', value: 'bad' } };
  assert.deepEqual(countDraftSummary(draft, ['a', 'b']), { total: 3, counted: 1, skipped: 1, pending: 0, removed: 1 });
  assert.equal(entryValue({ decision: 'out' }, 8), 0);
  assert.equal(entryValue({ decision: 'same' }, 8), 8);
});

test('flags materially large adjustments for final review', () => {
  assert.equal(isLargeCountChange(100, 49), true);
  assert.equal(isLargeCountChange(100, 60), false);
  assert.equal(isLargeCountChange(4, 15), true);
});
