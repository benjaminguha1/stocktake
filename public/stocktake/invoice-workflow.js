function normalise(value) {
  return String(value || '').toLocaleUpperCase()
    .replace(/[^A-Z0-9.]+/g, ' ')
    .replace(/\b(?:LOAF|LOAVES)\b/g, 'BREAD')
    .replace(/\s+/g, ' ').trim();
}

function usefulTokens(value) {
  return normalise(value).split(' ').filter((token) => token.length > 2 && !/^\d+(?:\.\d+)?$/.test(token));
}

function quantityCandidates(line) {
  return [...String(line).matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/g)]
    .map((match) => {
      const raw = match[1];
      const decimalPart = raw.match(/[.,](\d+)$/)?.[1] || '';
      const before = String(line).slice(Math.max(0, match.index - 9), match.index + (match[0].length - raw.length));
      const packSize = /(?:\bX|×)\s*$/i.test(before) || /\d+\s*(?:ML|L|KG|G)\s*(?:X|×)\s*$/i.test(before);
      let value = Number(raw.replace(',', '.'));
      // Some OCR passes drop the decimal point from invoice quantities such as
      // 2.000. Treat a compact trailing-000 token as a quantity, not 2,000 units.
      if (!decimalPart && /^\d000$/.test(raw)) value /= 1000;
      const itemCode = !decimalPart && value >= 1000;
      return { value, raw, decimals: decimalPart.length, packSize, itemCode };
    })
    .filter((candidate) => Number.isFinite(candidate.value) && candidate.value >= 0);
}

function chooseQuantity(line, expected) {
  const candidates = quantityCandidates(line);
  const usable = candidates.filter((candidate) => !candidate.packSize && !candidate.itemCode);
  const expectedMatch = usable.find((candidate) => expected > 0 && candidate.value === expected);
  if (expectedMatch) return { quantity: expectedMatch.value, quantitySource: 'expected' };
  // Wholesale invoices normally print QTY with three decimal places, while
  // pack sizes are in the description and prices use two decimal places.
  const quantityColumn = usable.find((candidate) => candidate.decimals === 3);
  if (quantityColumn) return { quantity: quantityColumn.value, quantitySource: 'column' };
  const integer = usable.find((candidate) => Number.isInteger(candidate.value) && candidate.value > 0 && candidate.value <= 999 && (!expected || candidate.value <= expected * 2));
  if (integer) return { quantity: integer.value, quantitySource: 'integer' };
  const measured = usable.find((candidate) => candidate.decimals > 0 && candidate.decimals <= 2 && candidate.value > 0 && candidate.value <= 999);
  if (measured) return { quantity: measured.value, quantitySource: 'decimal' };
  const fallback = usable[0];
  return fallback ? { quantity: fallback.value, quantitySource: 'guess' } : { quantity: expected, quantitySource: expected > 0 ? 'expected' : 'guess' };
}

export function matchInvoiceText(text, products) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tokenFrequency = new Map();
  for (const product of products) {
    for (const token of new Set(usefulTokens(product.name))) tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
  }
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
      const hasDistinctiveToken = tokens.length < 2
        || haystack.includes(tokens[0])
        || tokens.some((token) => (tokenFrequency.get(token) || 0) === 1 && haystack.includes(token));
      if (!exactSku && !hasDistinctiveToken) continue;
      if (score >= .6 && (!best || score > best.score)) best = { line, score };
    }
    if (!best) continue;
    const expected = Number(product.onOrderQuantity || 0);
    const { quantity, quantitySource } = chooseQuantity(best.line, expected);
    if (Number.isFinite(quantity) && quantity >= 0) matches.push({ productId: product.id, quantity, confidence: best.score, quantitySource, sourceLine: best.line });
  }
  // One OCR row can loosely resemble several stock products (for example,
  // "Milk ... Bladder Gold" also shares words with "Skim Milk Bladder").
  // Keep the strongest product match for that row unless two products match
  // equally well, which covers OCR occasionally joining adjacent rows.
  return matches.filter((match) => {
    const line = normalise(match.sourceLine);
    const competitors = matches.filter((candidate) => normalise(candidate.sourceLine) === line);
    const strongest = Math.max(...competitors.map((candidate) => candidate.confidence));
    return match.confidence >= strongest - .1;
  });
}

export function matchInvoiceTexts(texts, products) {
  const combined = normalise(texts.join('\n'));
  const namedSuppliers = [...new Set(products.map((product) => normalise(product.supplierName)).filter((name) => name.length >= 4))];
  const detectedSuppliers = namedSuppliers.filter((name) => combined.includes(name));
  const relevantProducts = detectedSuppliers.length
    ? products.filter((product) => detectedSuppliers.includes(normalise(product.supplierName)))
    : products;
  const passes = texts.map((text) => matchInvoiceText(text, relevantProducts));
  return relevantProducts.flatMap((product) => {
    const candidates = passes.flatMap((matches) => matches.filter((match) => match.productId === product.id));
    if (!candidates.length) return [];
    const reliable = candidates.filter((candidate) => candidate.quantitySource === 'column' || candidate.quantitySource === 'expected');
    const pool = reliable.length ? reliable : candidates;
    const groups = new Map();
    for (const candidate of pool) {
      const key = String(candidate.quantity);
      const group = groups.get(key) || { quantity: candidate.quantity, votes: 0, confidence: 0, candidate };
      group.votes += 1;
      group.confidence = Math.max(group.confidence, candidate.confidence);
      if (candidate.quantitySource === 'expected') group.confidence += .08;
      groups.set(key, group);
    }
    const best = [...groups.values()].sort((left, right) => right.votes - left.votes || right.confidence - left.confidence)[0];
    const expected = Number(product.onOrderQuantity || 0);
    // A clean quantity-column read is useful even when only one enhancement
    // keeps a faint product line. Require agreement only for guessed numbers.
    if (texts.length > 1 && best.votes < 2 && expected <= 0 && best.candidate.quantitySource === 'guess') return [];
    return [{ ...best.candidate, quantity: best.quantity, passesAgreed: best.votes, confidence: Math.min(1, best.confidence + (best.votes > 1 ? .05 : 0)) }];
  });
}
