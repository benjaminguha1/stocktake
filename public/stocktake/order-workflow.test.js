import assert from 'node:assert/strict';
import test from 'node:test';

import { canUndoReceipt, orderClipboardText, receiptChange, supplierOrderLink } from './order-workflow.js';

test('only creates conservative supplier links', () => {
  assert.deepEqual(supplierOrderLink('Order at https://orders.example.com/new.'), { href: 'https://orders.example.com/new', label: 'Open order page' });
  assert.deepEqual(supplierOrderLink('Email orders@example.com'), { href: 'mailto:orders@example.com', label: 'Email supplier' });
  assert.deepEqual(supplierOrderLink('Call +61 412 345 678'), { href: 'tel:+61412345678', label: 'Call supplier' });
  assert.equal(supplierOrderLink('javascript:alert(1)'), null);
  assert.equal(supplierOrderLink('Ask Mia in person'), null);
});

test('keeps a shortage on order unless the reviewer closes it', () => {
  const product = { current: 4, onOrderQuantity: 10, onOrderAt: '2026-09-20T00:00:00.000Z' };
  assert.deepEqual(receiptChange(product, 7), { stockBefore: 4, stockAfter: 11, expectedQuantity: 10, receivedQuantity: 7, remainingQuantity: 3, onOrderAtBefore: '2026-09-20T00:00:00.000Z', onOrderAtAfter: '2026-09-20T00:00:00.000Z' });
  assert.equal(receiptChange(product, 7, true).remainingQuantity, 0);
  assert.throws(() => receiptChange(product, ''), /Enter the actual quantity/);
  assert.equal(receiptChange(product, '0').receivedQuantity, 0);
});

test('guarded undo rejects a later product change', () => {
  const undo = [{ productId: 'milk', stockAfter: 11, remainingQuantity: 3, onOrderAtAfter: 'ordered-at' }];
  assert.equal(canUndoReceipt([{ id: 'milk', current: 11, onOrderQuantity: 3, onOrderAt: 'ordered-at' }], undo), true);
  assert.equal(canUndoReceipt([{ id: 'milk', current: 12, onOrderQuantity: 3, onOrderAt: 'ordered-at' }], undo), false);
  assert.equal(canUndoReceipt([{ id: 'milk', current: 11, onOrderQuantity: 3, onOrderAt: 'changed-later' }], undo), false);
});

test('builds a readable supplier order for copying', () => {
  assert.equal(orderClipboardText({ name: 'Milk Co' }, [{ name: 'Oat milk', quantity: 4, unit: 'carton' }]), 'Order for Milk Co\nOat milk: 4 cartons');
});
