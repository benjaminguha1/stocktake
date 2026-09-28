import test from 'node:test';
import assert from 'node:assert/strict';
import { matchInvoiceText, matchInvoiceTexts } from './invoice-workflow.js';

test('matches invoice descriptions and prefers the expected delivery quantity', () => {
  const products = [
    { id: 'oat', name: 'Oat milk', sku: 'JC-0001', onOrderQuantity: 12 },
    { id: 'cups', name: 'Takeaway cups 12oz', sku: 'CUP-12', onOrderQuantity: 4 },
  ];
  const text = 'INVOICE 2031\nOat Milk 12 3.50 42.00\nCUP-12 Takeaway Cups 4 55.00 220.00';
  assert.deepEqual(matchInvoiceText(text, products).map(({ productId, quantity }) => ({ productId, quantity })), [{ productId: 'oat', quantity: 12 }, { productId: 'cups', quantity: 4 }]);
});

test('uses the QTY column instead of the carton pack size on photographed invoices', () => {
  const products = [{ id: 'oat', name: 'Oat milk', sku: 'MILKOAT', onOrderQuantity: 0 }];
  const text = 'MILKOAT MLKLB MILK Lab Oat 1L x 8 2.000 24.00 CTN 48.00';
  const [match] = matchInvoiceText(text, products);
  assert.equal(match.quantity, 2);
  assert.equal(match.quantitySource, 'column');
});

test('combines slower OCR passes and favours consistent quantity-column readings', () => {
  const products = [{ id: 'oat', name: 'Oat milk', sku: 'MILKOAT', onOrderQuantity: 0 }];
  const texts = [
    'MILKOAT MILK Lab Oat 1L x 8 2.000 24.00 CTN 48.00',
    'MILKOAT MILK Lab Oat 1L x 8 2.000 24.00 CTN 48.00',
    'MILKOAT MILK Lab Oat 1L x 8 8 24.00 CTN 48.00',
  ];
  const [match] = matchInvoiceTexts(texts, products);
  assert.equal(match.quantity, 2);
  assert.equal(match.passesAgreed, 2);
});

test('does not assign one Gold Milk invoice row to a looser Skim Milk match', () => {
  const products = [
    { id: 'gold', name: 'Gold Milk Bladder', sku: 'GOLD', onOrderQuantity: 0 },
    { id: 'skim', name: 'Skim Milk Bladder', sku: 'SKIM', onOrderQuantity: 0 },
  ];
  const matches = matchInvoiceText('RFMILKGOLDB RIVFR MILK Riverina Fresh Bladder Gold 10lt 4.000 23.00 EA 92.00', products);
  assert.deepEqual(matches.map((match) => match.productId), ['gold']);
  assert.equal(matches[0].quantity, 4);
});

test('requires a product-specific word when a shared description is split across OCR lines', () => {
  const products = [
    { id: 'gold', name: 'Gold Milk Bladder', sku: 'GOLD', onOrderQuantity: 0 },
    { id: 'skim', name: 'Skim Milk Bladder', sku: 'SKIM', onOrderQuantity: 0 },
  ];
  const matches = matchInvoiceText('RFMILKGOLDB RIVFR\nMILK Riverina Fresh Bladder\nGold 10lt 4.000 23.00 EA 92.00', products);
  assert.ok(!matches.some((match) => match.productId === 'skim'));
});

test('requires agreement before adding a guessed quantity from a noisy photo', () => {
  const products = [{ id: 'skim', name: 'Skim Milk Bladder', sku: 'SKIM', onOrderQuantity: 0 }];
  const matches = matchInvoiceTexts([
    'unreadable table',
    'unreadable table',
    'SKIM Milk Bladder 3 22.00',
  ], products);
  assert.deepEqual(matches, []);
});

test('keeps a strong quantity-column read when only one enhancement preserves a faint row', () => {
  const products = [{ id: 'oat', name: 'Oat Milk', sku: 'MILKOAT', onOrderQuantity: 0 }];
  const matches = matchInvoiceTexts([
    'unreadable table',
    'MILKOAT MILK Lab Oat 1L x 8 2.000 24.00 CTN 48.00',
    'unreadable table',
  ], products);
  assert.equal(matches[0].quantity, 2);
  assert.equal(matches[0].passesAgreed, 1);
});
