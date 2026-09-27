import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTasks, managerExceptions } from './operations.js';

test('builds today tasks from stock conditions and manual assignments', () => {
  const now = new Date('2026-09-28T10:00:00Z');
  const products = [{ id: 'milk', name: 'Milk', current: 2, minimum: 5, onOrderQuantity: 0 }];
  const state = { products, stocktakes: [], tasks: [{ id: 'clean', title: 'Clean shelf', assignedTo: 'Sam', dueDate: '2026-09-28' }] };
  const tasks = dailyTasks(state, { now, activeProducts: products });
  assert.deepEqual(tasks.map((task) => task.id), ['system-stocktake', 'system-orders', 'clean']);
});

test('collects overdue, skipped, large-change, shortage and staff exceptions', () => {
  const now = new Date('2026-09-28T10:00:00Z');
  const products = [{ id: 'cups', name: 'Cups', unit: 'sleeves', onOrderQuantity: 4, onOrderAt: '2026-09-10T00:00:00Z' }];
  const state = {
    products,
    stocktakes: [{ id: 'take', label: 'Dry store', completedAt: '2026-09-27T00:00:00Z', skippedCount: 1, adjustments: [{ productId: 'cups', name: 'Cups', unit: 'sleeves', before: 20, after: 2, large: true }] }],
    deliveryReceipts: [{ id: 'receipt', lines: [{ productId: 'cups', name: 'Cups', unit: 'sleeves', remainingQuantity: 2 }] }],
    issues: [{ id: 'issue', title: 'Damaged cups', note: 'One box crushed' }],
  };
  assert.deepEqual(managerExceptions(state, { now, activeProducts: products }).map((item) => item.type), ['Overdue delivery', 'Incomplete count', 'Large stock change', 'Delivery shortage', 'Staff report']);
});

