function normalise(value) {
  return String(value || '').toLocaleUpperCase().replace(/[^A-Z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function usefulTokens(value) {
  return normalise(value).split(' ').filter((token) => token.length > 2 && !/^\d+(?:\.\d+)?$/.test(token));
}

function quantityCandidates(line) {
  return [...String(line).matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

export function matchInvoiceText(text, products) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches = [];
  for (const product of products) {
    const name = normalise(product.name);
    const sku = normalise(product.sku);
    const tokens = usefulTokens(product.name);
    let best = null;
    for (const line of lines) {
      const haystack = normalise(line);
      const exactName = name.length > 2 && haystack.includes(name);
      const exactSku = sku.length > 2 && haystack.includes(sku);
      const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
      const score = exactSku ? 1 : exactName ? .95 : tokens.length ? tokenHits / tokens.length : 0;
      if (score >= .6 && (!best || score > best.score)) best = { line, score };
    }
    if (!best) continue;
    const candidates = quantityCandidates(best.line);
    const expected = Number(product.onOrderQuantity || 0);
    const quantity = candidates.find((value) => expected > 0 && value === expected)
      ?? candidates.find((value) => Number.isInteger(value) && value > 0 && (!expected || value <= expected * 2))
      ?? candidates[0]
      ?? expected;
    if (Number.isFinite(quantity) && quantity >= 0) matches.push({ productId: product.id, quantity, confidence: best.score, sourceLine: best.line });
  }
  return matches;
}

