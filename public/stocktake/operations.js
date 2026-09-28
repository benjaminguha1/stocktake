const DAY = 24 * 60 * 60 * 1000;

function ageInDays(value, now) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / DAY)) : 0;
}

export function dailyTasks(state, { now = new Date(), activeProducts = state.products || [] } = {}) {
  const tasks = [];
  const latestFull = [...(state.stocktakes || [])]
    .filter((take) => take.type === 'full' && take.complete !== false)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  if (activeProducts.length && (!latestFull || ageInDays(latestFull.completedAt, now) >= 7)) {
    tasks.push({ id: 'system-stocktake', title: 'Complete the weekly stocktake', assignedTo: 'Today’s team', route: 'stocktake', kind: 'system' });
  }
  const incoming = activeProducts.filter((product) => Number(product.onOrderQuantity || 0) > 0);
  if (incoming.length) tasks.push({ id: 'system-deliveries', title: `Receive ${incoming.length} incoming product${incoming.length === 1 ? '' : 's'}`, assignedTo: 'Today’s team', route: 'deliveries', kind: 'system' });
  const orders = activeProducts.filter((product) => Number(product.current || 0) < Number(product.minimum || 0) && Number(product.onOrderQuantity || 0) <= 0);
  if (orders.length) tasks.push({ id: 'system-orders', title: `Order ${orders.length} low-stock product${orders.length === 1 ? '' : 's'}`, assignedTo: 'Today’s team', route: 'orders', kind: 'system' });
  const today = now.toISOString().slice(0, 10);
  for (const task of state.tasks || []) {
    if (task.completedAt || (task.dueDate && task.dueDate > today)) continue;
    tasks.push({ ...task, kind: 'manual' });
  }
  return tasks;
}

export function managerExceptions(state, { now = new Date(), activeProducts = state.products || [] } = {}) {
  const items = [];
  for (const product of activeProducts) {
    const onOrder = Number(product.onOrderQuantity || 0);
    if (onOrder > 0 && ageInDays(product.onOrderAt, now) >= 7) items.push({ id: `late-${product.id}`, type: 'Overdue delivery', title: product.name, detail: `${onOrder} ${product.unit || 'units'} have been on order for ${ageInDays(product.onOrderAt, now)} days.`, route: 'deliveries', severity: 'high' });
  }
  for (const take of state.stocktakes || []) {
    if (Number(take.skippedCount || 0) > 0) items.push({ id: `skipped-${take.id}`, type: 'Incomplete count', title: take.label || 'Stocktake', detail: `${take.skippedCount} product${take.skippedCount === 1 ? '' : 's'} skipped on ${new Date(take.completedAt).toLocaleDateString('en-AU')}.`, route: 'stocktake', severity: 'medium' });
    for (const change of take.adjustments || []) {
      if (change.large) items.push({ id: `change-${take.id}-${change.productId}`, type: 'Large stock change', title: change.name, detail: `Changed from ${change.before} to ${change.after} ${change.unit || 'units'}.`, route: 'stocktake', severity: 'high' });
    }
  }
  for (const receipt of state.deliveryReceipts || []) {
    for (const line of receipt.lines || []) {
      if (Number(line.remainingQuantity || 0) > 0) items.push({ id: `short-${receipt.id}-${line.productId}`, type: 'Delivery shortage', title: line.name, detail: `${line.remainingQuantity} ${line.unit || 'units'} still outstanding.`, route: 'deliveries', severity: 'medium', attachment: receipt.attachment || null });
    }
  }
  for (const issue of state.issues || []) {
    if (!issue.resolvedAt) items.push({ id: issue.id, type: issue.type || 'Staff report', title: issue.title || 'Stock issue', detail: issue.note || 'No note supplied.', route: 'exceptions', severity: issue.severity || 'medium', attachment: issue.attachment || null, manual: true });
  }
  return items;
}

