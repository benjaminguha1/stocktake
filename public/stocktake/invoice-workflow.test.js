import test from 'node:test';
import assert from 'node:assert/strict';
import { matchInvoiceText } from './invoice-workflow.js';

test('matches invoice descriptions and prefers the expected delivery quantity', () => {
  const products = [
    { id: 'oat', name: 'Oat milk', sku: 'JC-0001', onOrderQuantity: 12 },
    { id: 'cups', name: 'Takeaway cups 12oz', sku: 'CUP-12', onOrderQuantity: 4 },
  ];
  const text = 'INVOICE 2031\nOat Milk 12 3.50 42.00\nCUP-12 Takeaway Cups 4 55.00 220.00';
  assert.deepEqual(matchInvoiceText(text, products).map(({ productId, quantity }) => ({ productId, quantity })), [{ productId: 'oat', quantity: 12 }, { productId: 'cups', quantity: 4 }]);
});

