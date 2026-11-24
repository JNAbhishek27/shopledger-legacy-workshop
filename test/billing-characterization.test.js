'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the same HSN slab and GST as the billed order', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
  const html = invoice.render({ id: 1, date: '23/11/2026', items, coupon: '', total: billed.total });
  assert.match(html, /<td>CGST<\/td><td class="r">₹2\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹2\.50<\/td>/);
});

test('invoice uses the same post-discount taxable amount and total as the billed order', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, taxable: billed.taxable, tax: billed.tax, total: billed.total },
    { subtotal: 600, discount: 60, taxable: 540, tax: 27, total: 567 }
  );
  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].taxable, 540);
});

test('invoice applies configured coupon maximum discount and matches billed totals', () => {
  const items = [{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WHOLESALE15');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'WHOLESALE15' });

  assert.equal(billed.discount, 300);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.discount, 300);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('reconciliation reports billed order figures and invoice figures as matched', () => {
  const order = {
    id: 42,
    date: '23/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    coupon: '',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
