import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

const pause = () => new Promise(resolve => setTimeout(resolve, 30));

test('staff can resume a count, skip an item, receive a shortage, undo and archive', async () => {
  const window = new Window({ url: 'http://stocktake.test/stocktake/index.html', settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
  const document = window.document;
  document.write(await readFile(new URL('./index.html', import.meta.url), 'utf8'));
  const initial = {
    suppliers: [{id:'TEST',name:'Test supplier',orderingMethod:'https://example.com/orders'}],
    products: [
      {id:'a',name:'Beans',sku:'JC-A',supplierId:'TEST',current:4,par:10,minimum:6,unit:'kg',location:'Shelf',shelfOrder:1},
      {id:'b',name:'Cups',sku:'JC-B',supplierId:'TEST',current:2,par:10,minimum:6,unit:'cup',location:'Shelf',shelfOrder:2},
    ], usageRecords:[],stocktakes:[],orderHistory:[],deliveryReceipts:[],
  };
  window.localStorage.setItem('josieCoffeeStockroom.v2', JSON.stringify(initial));
  window.localStorage.setItem('josieCoffeeStockroom.onboarding.v1', 'complete');
  Object.assign(globalThis,{window,document,FormData:window.FormData, localStorage:window.localStorage});
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
  globalThis.fetch = async () => ({ok:false});
  const click = selector => { const el=document.querySelector(selector); assert.ok(el, `Missing ${selector}`); el.click(); };
  const submit = selector => document.querySelector(selector).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const set = (selector,value) => { const el=document.querySelector(selector); assert.ok(el, `Missing ${selector}`); el.value=value; el.dispatchEvent(new window.Event('input',{bubbles:true})); };
  const saved = () => JSON.parse(window.localStorage.getItem('josieCoffeeStockroom.v2'));
  try {
    await import('./app.js'); await pause();
    assert.match(document.querySelector('#staff-handover').textContent,/Still needs counting/);
    click('[data-count-section="Shelf"]'); await pause();
    set('#stocktake-quantity','3'); click('#stocktake-save-exit'); await pause();
    assert.equal(saved().products[0].current,4,'draft must not change live stock');
    click('[data-resume-count-draft]'); await pause();
    assert.equal(document.querySelector('#stocktake-quantity').value,'3');
    click('#stocktake-next');
    assert.equal(document.querySelector('#count-same'), null);
    assert.equal(document.querySelector('#count-out'), null);
    assert.ok(document.querySelector('#count-skip').closest('.modal-footer'));
    click('#count-skip');
    assert.match(document.querySelector('#modal').textContent,/Skipped/);
    click('#confirm-stocktake'); await pause();
    assert.equal(saved().products[0].current,3);
    assert.equal(saved().products[1].current,2);
    assert.deepEqual(saved().stocktakes[0].countedProductIds,['a']);
    assert.deepEqual(saved().stocktakes[0].skippedProductIds,['b']);
    assert.match(document.querySelector('#staff-handover').textContent,/1\/2 checked today/);
    click('[data-order-select][data-product-id="a"]');
    click('[data-action="place-selected-on-order"]');
    set('[name="order-a"]','7'); submit('#order-review-form');
    assert.equal(saved().products[0].onOrderQuantity,7);
    click('[data-delivery-select][data-product-id="a"]');
    click('[data-action="receive-selected-deliveries"]');
    set('[name="actual-a"]','5'); submit('#receipt-review-form');
    assert.equal(saved().products[0].current,8);
    assert.equal(saved().products[0].onOrderQuantity,2);
    click('#undo-receipt');
    assert.equal(saved().products[0].current,3);
    assert.equal(saved().products[0].onOrderQuantity,7);
    assert.equal(saved().deliveryReceipts.length,0);
    click('[data-action="toggle-product-archive"][data-product-id="a"]');
    assert.ok(!saved().products[0].archived,'outstanding order must prevent archive');
    click('[data-action="toggle-product-archive"][data-product-id="b"]');
    assert.equal(saved().products[1].archived,true);
    assert.equal(saved().stocktakes.length,1,'archive preserves history');
    click('#product-archive-toggle');
    click('[data-action="toggle-product-archive"][data-product-id="b"]');
    assert.ok(!saved().products[1].archived,'restore returns product to active inventory');
    click('[data-action="cancel-on-order"][data-product-id="a"]'); click('#confirm-cancel-order');
    click('[data-action="toggle-supplier-archive"][data-supplier-id="TEST"]');
    assert.equal(saved().suppliers[0].archived,true);
    assert.match(document.querySelector('#order-preview').textContent,/No orders/);
    click('#supplier-archive-toggle');
    click('[data-action="toggle-supplier-archive"][data-supplier-id="TEST"]');
    assert.ok(!saved().suppliers[0].archived);
    assert.match(document.querySelector('#order-preview').textContent,/Beans/);
    click('[data-count-section="Shelf"]'); await pause();
    click('#stocktake-next');
    set('#stocktake-quantity','-2'); click('#stocktake-next');
    assert.ok(document.querySelector('#stocktake-quantity'),'negative input must not advance');
    set('#stocktake-quantity','0'); click('#stocktake-next'); click('#confirm-stocktake'); await pause();
    assert.equal(saved().products[0].current,3,'blank entry leaves stock unchanged');
    assert.equal(saved().products[1].current,0,'zero is an explicit count');
    assert.deepEqual(saved().stocktakes[0].skippedProductIds,['a']);
    assert.deepEqual(saved().stocktakes[0].countedProductIds,['b']);
  } finally { await window.happyDOM.close(); }
});
