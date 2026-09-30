const assert = require('node:assert/strict');
const model = require('./loan-model.js');
const loans = model.defaults();
const before = JSON.stringify(loans);
assert.ok(loans.every(model.validateLoan));
assert.deepEqual(loans.map(loan => model.progress(loan, model.baseline).elapsed), [7, 31, 9, 4, 0]);
assert.deepEqual(loans.map(loan => model.progress(loan, model.baseline).remaining), [41, 29, 15, 5, 25]);
assert.deepEqual(loans.map(loan => model.summary(loan, model.baseline).payable), [237531, 202266, 150561.53, 18026.26, 62475]);
assert.deepEqual(loans.map(loan => model.summary(loan, model.baseline).principal), [194697, 171817, 135646, 17327.48, 62475]);
assert.deepEqual(loans.map(loan => model.progress(loan, model.baseline).end), ['2030-02-03', '2029-02-05', '2027-12-06', '2027-02-01', '2028-10-02']);
assert.equal(model.monthTotal(loans, '2026-10'), 28919.69);
assert.equal(model.monthTotal(loans, '2027-03'), 25314.44);
assert.equal(model.monthTotal(loans, '2030-02'), 5771);
assert.equal(model.monthTotal(loans, '2030-03'), 0);
assert.equal(model.schedule(loans[0]).at(-1).principal, 5714);
assert.equal(model.schedule(loans[0]).at(-1).interest, 57);
assert.equal(model.schedule(loans[0]).at(-1).estimated, false);
assert.equal(model.summary(loans[0], '2030-01-03').estimated, false);
assert.equal(model.summary(loans[2], '2030-01-03').estimated, false);
assert.equal(model.progress(loans[0], '2026-03-02').elapsed, 0);
assert.equal(model.progress(loans[0], '2026-03-03').elapsed, 1);
assert.equal(model.progress(loans[4], '2026-10-01').elapsed, 0);
assert.equal(model.progress(loans[4], '2026-10-02').elapsed, 1);
assert.equal(model.summary(loans[4], '2026-10-02').principal, 59976);
assert.equal(model.addMonths('2026-01-31', 1), '2026-02-28');
assert.equal(model.addMonths('2028-01-31', 1), '2028-02-29');
for (const loan of loans) {
  const rows = model.schedule(loan);
  assert.equal(rows.at(-1).balance, 0);
  assert.equal(model.round(rows.reduce((sum, row) => sum + row.principal, 0)), loan.principal);
  for (const row of rows) {
    assert.ok(row.balance >= 0 && row.interest >= 0);
    assert.equal(model.round(row.principal + row.interest), row.amount);
    assert.equal(model.summary(loan, row.date).principal, row.balance);
  }
  assert.equal(model.summary(loan, '2031-01-01').payable, 0);
}
assert.equal(JSON.stringify(loans), before);
console.log('Loan model: baseline totals, due dates, month-end clamping, final payments, balances and immutability passed.');