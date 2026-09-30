(function (root) {
  'use strict';
  const baseline = '2026-09-30';
  const version = 2;
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const seeds = [
    { id: 'idfc', name: 'IDFC FIRST Bank', type: 'personal', original: 220598, disbursed: '2026-01-30', rate: 11.81, rateSource: 'Schedule-stated; 6.65% flat not used', amount: 5794, finalAmount: 5771, finalPrincipal: 5714, pending: 48, startDate: '2026-03-03', baselinePaid: 7, principal: 194697, fee: null, note: 'Reducing balance. Final principal 5,714; interest 57.' },
    { id: 'axis', name: 'Axis Finance', type: 'personal', original: 303510, disbursed: '', rate: 13, rateSource: 'User-provided; not lender-verified', amount: 6984, finalAmount: 6714, pending: 60, startDate: '2024-03-05', baselinePaid: 31, principal: 171817, fee: null, note: 'Reducing balance; annual rate absent from supplied summary of schedule.' },
    { id: 'plcc', name: 'ICICI - PLCC', type: 'credit', original: 205000, disbursed: '', rate: 16, rateSource: 'Inferred nominal rate; not lender-confirmed', amount: 10037.44, finalAmount: 10037.37, pending: 24, startDate: '2026-01-06', baselinePaid: 9, principal: 135646, approximate: true, fee: 2050, note: 'Principal approximately 1,35,646; exact paise missing. First date is a schedule date, not a confirmed disbursement date.' },
    { id: 'flipkart', name: 'ICICI - Flipkart', type: 'credit', original: 30387, disbursed: '', rate: 16, rateSource: 'Inferred nominal rate; not lender-confirmed', amount: 3605.25, finalAmount: 3605.26, pending: 9, startDate: '2026-06-01', baselinePaid: 4, principal: 17327.48, fee: 299, principalParts: [3374.36, 3419.32, 3464.89, 3511.06, 3557.85], note: 'Five remaining principal/interest rows supplied. First date is a schedule date.' },
    { id: 'bajaj', name: 'Bajaj Finance', type: 'other', original: 62475, disbursed: '2026-08-28', rate: 0, rateSource: 'Schedule-stated current ROI', amount: 2499, finalAmount: 2499, pending: 25, startDate: '2026-10-02', baselinePaid: 0, principal: 62475, fee: null, note: 'Final installment marked ADVEMI. All 25 retained as scheduled; confirm whether an advance was already collected.' }
  ];

  function dateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function today() { return dateString(new Date()); }

  function addMonths(value, months) {
    const source = new Date(`${value}T00:00:00`);
    const target = new Date(source.getFullYear(), source.getMonth() + months, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(source.getDate(), last));
    return dateString(target);
  }

  function dueDate(loan, index) { return addMonths(loan.startDate, index); }

  function progress(loan, asOf) {
    let elapsed = 0;
    while (elapsed < loan.pending && dueDate(loan, elapsed) <= asOf) elapsed++;
    return { elapsed, remaining: loan.pending - elapsed, end: dueDate(loan, loan.pending - 1), next: elapsed < loan.pending ? dueDate(loan, elapsed) : null };
  }

  function payment(loan, index) { return index === loan.pending - 1 ? loan.finalAmount : loan.amount; }

  function modelRate(principal, payments) {
    if (principal <= 0 || round(payments.reduce((sum, amount) => sum + amount, 0)) <= principal) return 0;
    let low = 0, high = 10;
    for (let iteration = 0; iteration < 100; iteration++) {
      const rate = (low + high) / 2;
      const present = payments.reduce((sum, amount, index) => sum + amount / Math.pow(1 + rate, index + 1), 0);
      if (present > principal) low = rate; else high = rate;
    }
    return (low + high) / 2;
  }

  function schedule(loan) {
    const payments = Array.from({ length: loan.pending - loan.baselinePaid }, (_, offset) => payment(loan, loan.baselinePaid + offset));
    const fittedPayments = payments.slice();
    if (loan.finalPrincipal !== undefined && payments.length > 1) {
      fittedPayments.pop();
      fittedPayments[fittedPayments.length - 1] += loan.finalPrincipal;
    }
    const rate = modelRate(loan.principal, fittedPayments);
    let balance = loan.principal;
    return payments.map((amount, offset) => {
      const opening = balance;
      const knownFinal = loan.finalPrincipal !== undefined && offset === payments.length - 1;
      const principal = loan.principalParts ? loan.principalParts[offset] : offset === payments.length - 1 ? balance : loan.finalPrincipal !== undefined && offset === payments.length - 2 ? round(balance - loan.finalPrincipal) : Math.min(balance, round(amount - balance * rate));
      balance = round(Math.max(0, balance - principal));
      return { installment: loan.baselinePaid + offset + 1, date: dueDate(loan, loan.baselinePaid + offset), amount, opening, principal, interest: round(amount - principal), balance, estimated: !!loan.approximate || (!knownFinal && !loan.principalParts && loan.rate !== 0) };
    });
  }

  function summary(loan, asOf) {
    const rows = schedule(loan).filter(row => row.date > asOf);
    const principal = rows.length ? rows[0].opening : 0;
    const payable = round(rows.reduce((sum, row) => sum + row.amount, 0));
    return { ...progress(loan, asOf), rows, principal, payable, interest: round(payable - principal), estimated: rows.length > 0 && (!!loan.approximate || (asOf > baseline && rows.length < loan.pending - loan.baselinePaid && rows[0].estimated)) };
  }

  function monthTotal(loans, month) {
    return round(loans.reduce((sum, loan) => sum + schedule(loan).filter(row => row.date.slice(0, 7) === month).reduce((subtotal, row) => subtotal + row.amount, 0), 0));
  }

  function validateLoan(loan) {
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    return loan && typeof loan.name === 'string' && loan.name.trim().length > 0 && loan.name.length <= 200 &&
      Number.isFinite(loan.amount) && loan.amount > 0 && Number.isFinite(loan.finalAmount) && loan.finalAmount > 0 &&
      Number.isInteger(loan.pending) && loan.pending > 0 && loan.pending <= 600 && validDate(loan.startDate) &&
      Number.isInteger(loan.baselinePaid) && loan.baselinePaid >= 0 && loan.baselinePaid <= loan.pending &&
      loan.baselinePaid === progress(loan, baseline).elapsed &&
      Number.isFinite(loan.principal) && loan.principal >= 0 && Number.isFinite(loan.original) && loan.original > 0 &&
      (!loan.disbursed || validDate(loan.disbursed)) &&
      (loan.finalPrincipal === undefined || (Number.isFinite(loan.finalPrincipal) && loan.finalPrincipal >= 0 && loan.finalPrincipal <= loan.finalAmount && loan.finalPrincipal <= loan.principal)) &&
      (loan.rate === null || (Number.isFinite(loan.rate) && loan.rate >= 0 && loan.rate <= 100)) &&
      (loan.fee === null || (Number.isFinite(loan.fee) && loan.fee >= 0)) &&
      (!loan.principalParts || (Array.isArray(loan.principalParts) && loan.principalParts.length === loan.pending - loan.baselinePaid && loan.principalParts.every(part => Number.isFinite(part) && part >= 0) && round(loan.principalParts.reduce((sum, part) => sum + part, 0)) === loan.principal)) &&
      round(Array.from({ length: loan.pending - loan.baselinePaid }, (_, offset) => payment(loan, loan.baselinePaid + offset)).reduce((sum, amount) => sum + amount, 0)) >= loan.principal;
  }

  function defaults() { return JSON.parse(JSON.stringify(seeds)); }
  const api = { baseline, version, round, today, addMonths, dueDate, progress, payment, schedule, summary, monthTotal, validateLoan, defaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LoanModel = api;
})(globalThis);