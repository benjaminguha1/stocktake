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

test('rejects a noisy row without a product-specific word', () => {
  const products = [
    { id: 'skim', name: 'Skim Milk Bladder', sku: 'SKIM', onOrderQuantity: 0 },
    { id: 'gold', name: 'Gold Milk Bladder', sku: 'GOLD', onOrderQuantity: 0 },
  ];
  const matches = matchInvoiceTexts([
    'unreadable table',
    'unreadable table',
    'Milk Bladder 3 22.00',
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

test('matches Sonoma Banana Loaf to Banana Bread and ignores the product code', () => {
  const products = [
    { id: 'banana', name: 'Banana Bread', sku: 'JC-0049', supplierName: 'Sonoma', onOrderQuantity: 0 },
    { id: 'bread', name: 'Bread', sku: 'JC-0024', supplierName: 'Tuga', onOrderQuantity: 0 },
  ];
  const matches = matchInvoiceTexts([
    'Sonoma Baking Company Tax Invoice',
    '30000 Banana Loaf 4 $26.34 $10.54 $105.36',
    'unreadable table',
  ], products);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].productId, 'banana');
  assert.equal(matches[0].quantity, 4);
  assert.equal(matches[0].quantitySource, 'integer');
});

test('reads a weighted meat quantity before its price and total', () => {
  const products = [{ id: 'ham', name: 'Ham', sku: 'JC-0037', onOrderQuantity: 0 }];
  const matches = matchInvoiceTexts([
    'unreadable table',
    'Shrink wrap ham 8.46 24.49 0% 207.19',
    'unreadable table',
  ], products);
  assert.equal(matches[0].quantity, 8.46);
  assert.equal(matches[0].quantitySource, 'decimal');
});

test('reads integer quantities across the larger Provedores invoice', () => {
  const products = [
    { id: 'almond', name: 'Almond Milk', sku: 'JC-0014', onOrderQuantity: 0 },
    { id: 'oat', name: 'Oat Milk', sku: 'JC-0015', onOrderQuantity: 0 },
    { id: 'soy', name: 'Soy Milk', sku: 'JC-0016', onOrderQuantity: 0 },
    { id: 'cheese', name: 'Sliced Cheddar Cheese', sku: 'JC-0017', onOrderQuantity: 0 },
    { id: 'gold', name: 'Gold Milk Bladder', sku: 'JC-0042', onOrderQuantity: 0 },
  ];
  const text = [
    'MIMLALD MLKLB MILK Lab Almond 1L x 8 3.000 28.80 CTN 86.40',
    'MIMLOAT MLKLB MILK Lab Oat 1L x 8 3.000 24.00 CTN 72.00',
    'SOYBOY SOYBO MILK Soy Boy Happy Happy 1L x 6 2.000 20.65 CTN 41.30',
    "CHTASLB BEGA CHEESE Bega Tasty Sliced 90's 1.5kg (8) 1.000 30.94 PKT 30.94",
    'RFMILKGOLD RIVFR MILK Riverina Fresh Gold 2lt x 6 1.000 27.95 CTN 27.95',
    'RFMILKGOLDB RIVFR MILK Riverina Fresh Bladder Gold 10lt 6.000 23.00 EA 138.00',
  ].join('\n');
  const matches = matchInvoiceText(text, products);
  assert.deepEqual(Object.fromEntries(matches.map((match) => [match.productId, match.quantity])), {
    almond: 3, oat: 3, soy: 2, cheese: 1, gold: 6,
  });
});
