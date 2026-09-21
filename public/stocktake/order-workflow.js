export function supplierOrderLink(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const web = text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/, '');
  if (web) {
    try {
      const url = new URL(web);
      if (url.protocol === 'http:' || url.protocol === 'https:') return { href: url.href, label: 'Open order page' };
    } catch { /* Ignore malformed addresses. */ }
  }

  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) return { href: `mailto:${email}`, label: 'Email supplier' };

  const explicitPhone = text.match(/(?:^|\b)(?:tel(?:ephone)?|phone|call)\s*:?\s*(\+?[\d][\d ()-]{6,}[\d])/i)?.[1];
  if (explicitPhone) {
    const number = explicitPhone.replace(/(?!^)\D/g, '');
    if (/^\+?\d{7,15}$/.test(number)) return { href: `tel:${number}`, label: 'Call supplier' };
  }
  return null;
}

export function orderClipboardText(supplier, lines) {
  const heading = `Order for ${String(supplier?.name || 'supplier').trim()}`;
  const items = lines.map((line) => `${line.name}: ${line.quantity} ${line.unit}${Number(line.quantity) === 1 ? '' : 's'}`);
  return [heading, ...items].join('\n');
}

export function receiptChange(product, actualQuantity, closeRemaining = false) {
  const expected = Number(product.onOrderQuantity || 0);
  const current = Number(product.current || 0);
  if (actualQuantity === '' || actualQuantity === null || actualQuantity === undefined) throw new TypeError('Enter the actual quantity received, including 0 if none arrived.');
  const actual = Number(actualQuantity);
  if (!Number.isFinite(actual) || actual < 0) throw new TypeError('Actual quantity must be zero or greater.');
  const remaining = closeRemaining ? 0 : Math.max(0, expected - actual);
  return { stockBefore: current, stockAfter: current + actual, expectedQuantity: expected, receivedQuantity: actual, remainingQuantity: remaining, onOrderAtBefore: String(product.onOrderAt || ''), onOrderAtAfter: remaining ? String(product.onOrderAt || '') : '' };
}

export function canUndoReceipt(products, undoLines) {
  return undoLines.every((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product && Number(product.current) === line.stockAfter && Number(product.onOrderQuantity || 0) === line.remainingQuantity && String(product.onOrderAt || '') === String(line.onOrderAtAfter || '');
  });
}
