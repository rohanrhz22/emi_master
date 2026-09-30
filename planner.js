(function () {
  'use strict';
  const model = window.LoanModel;
  let activeUser = null;
  try { activeUser = localStorage.getItem('emiActiveUser'); } catch (error) {}
  if (document.currentScript.hasAttribute('data-profile-required') && !activeUser) {
    window.location.replace('login.html');
    return;
  }
  const storeKey = activeUser ? 'emiMaster_' + activeUser : 'emiMasterData';
  let loans = [];
  let state = { salary: 55000, otherIncome: 0, expenses: 15000, emergencyFund: 30000 };
  let writable = true;
  let lastToday = model.today();
  let lastCalc = null;
  const money = value => '₹' + model.round(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const element = id => document.getElementById(id);
  const escape = value => { const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML.replace(/"/g, '&quot;'); };
  const dateLabel = value => new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const monthLabel = value => new Date(value.slice(0, 7) + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const asOf = () => element('asOfDate').value;
  const nextMonth = () => model.addMonths(asOf().slice(0, 7) + '-01', 1).slice(0, 7);
  const summaries = () => loans.map(loan => model.summary(loan, asOf()));
  const sum = (items, field) => model.round(items.reduce((total, item) => total + item[field], 0));
  const kpi = (label, value, tone = 'accent') => `<div class="kpi-card ${tone}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;
  const table = (headers, rows) => `<thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;

  function status(message) { element('saveStatus').textContent = message; }

  function persist() {
    if (!writable) { status('Not saved: storage could not be read. Export a backup before reloading.'); return false; }
    try {
      localStorage.setItem(storeKey, JSON.stringify({ version: model.version, baseline: model.baseline, emis: loans, state }));
      status('Saved on this browser · Baseline 30 Sep 2026');
      return true;
    } catch (error) {
      status('Not saved: browser storage unavailable or full. Export a backup.');
      return false;
    }
  }

  function validData(data) {
    return data && data.version === model.version && data.baseline === model.baseline && Array.isArray(data.emis) && data.emis.length <= 100 && data.emis.every(model.validateLoan) && data.state && ['salary', 'otherIncome', 'expenses', 'emergencyFund'].every(key => Number.isFinite(data.state[key]) && data.state[key] >= 0);
  }

  function load() {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === model.version) {
          if (!validData(data)) throw new Error('Invalid saved data');
          loans = data.emis;
          state = data.state;
          status('Saved on this browser · Baseline 30 Sep 2026');
        } else {
          if (!localStorage.getItem(storeKey + '_beforeSeptember2026')) localStorage.setItem(storeKey + '_beforeSeptember2026', raw);
          loans = model.defaults();
          for (const key of Object.keys(state)) if (Number.isFinite(data.state?.[key]) && data.state[key] >= 0) state[key] = data.state[key];
          persist();
          status('September records saved · Previous records backed up on this browser');
        }
      } else { loans = model.defaults(); persist(); }
    } catch (error) {
      writable = false;
      loans = model.defaults();
      status('Saved data could not be loaded. Showing unsaved September records; original storage unchanged.');
    }
    for (const key of Object.keys(state)) if (element(key)) element(key).value = state[key];
  }

  function readIncome() {
    for (const key of ['salary', 'otherIncome', 'expenses', 'emergencyFund']) state[key] = Math.max(0, Number(element(key).value) || 0);
  }

  function refreshDateCalculations() {
    if (!asOf() || asOf() < model.baseline) element('asOfDate').value = model.baseline;
    render();
  }

  function followToday() {
    element('asOfDate').disabled = element('followToday').checked;
    if (element('followToday').checked) element('asOfDate').value = model.today() < model.baseline ? model.baseline : model.today();
    refreshDateCalculations();
  }

  function refreshClock() {
    const current = model.today();
    if (current !== lastToday && element('followToday').checked) followToday();
    lastToday = current;
  }

  function switchTab(name, button) {
    document.querySelectorAll('.tab-content, .tab').forEach(node => node.classList.remove('active'));
    element('tab-' + name).classList.add('active');
    (button || document.querySelector(`.tab[onclick*="'${name}'"]`))?.classList.add('active');
  }

  function runAnalysis() { readIncome(); persist(); render(); switchTab('dashboard'); }

  function renderLoans() {
    element('noEmi').style.display = loans.length ? 'none' : 'block';
    element('emiList').innerHTML = loans.map((loan, index) => {
      const info = model.summary(loan, asOf());
      const baselineCount = loan.baselinePaid;
      return `<div class="emi-item"><div class="emi-item-info"><div class="emi-item-icon"><i class="fas ${loan.type === 'credit' ? 'fa-credit-card' : 'fa-building-columns'}"></i></div><div>
        <div class="emi-item-name">${escape(loan.name)}</div>
        <div class="emi-item-details">${baselineCount} recorded at baseline · ${Math.max(0, info.elapsed - baselineCount)} scheduled elapsed since · ${info.remaining} left</div>
        <div class="emi-item-details">${info.next ? 'Next ' + dateLabel(info.next) : 'Schedule complete'} · Final ${dateLabel(info.end)}</div>
        <div class="emi-item-details">Principal ${info.estimated ? '≈ ' : ''}${money(info.principal)} · ${loan.rate === null ? 'Rate unknown' : loan.rate + '% p.a.'} (${escape(loan.rateSource)})</div>
        </div></div><div style="display:flex;align-items:center;gap:16px"><div class="emi-item-amount">${info.next ? money(info.rows[0]?.amount || 0) : money(0)}</div><div class="emi-item-actions">
        <button class="btn-edit" title="Edit ${escape(loan.name)}" aria-label="Edit ${escape(loan.name)}" onclick="editEmi(${index})"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" title="Delete ${escape(loan.name)}" aria-label="Delete ${escape(loan.name)}" onclick="deleteEmi(${index})"><i class="fas fa-trash"></i></button></div></div></div>`;
    }).join('');
  }

  function renderOverview() {
    const info = summaries();
    const monthly = model.monthTotal(loans, nextMonth());
    const income = state.salary + state.otherIncome;
    const free = model.round(income - monthly - state.expenses);
    const approx = info.some(item => item.estimated) ? '≈ ' : '';
    element('kpiGrid').innerHTML = kpi('Income', money(income), 'good') + kpi(monthLabel(nextMonth()) + ' EMIs', money(monthly), 'bad') + kpi('Living expenses', money(state.expenses), 'warn') + kpi('Next-month free cash', money(free), free < 0 ? 'bad' : 'good');
    element('emiProgressGrid').innerHTML = kpi('As of', dateLabel(asOf())) + kpi('Scheduled installments left', sum(info, 'remaining'), 'warn') + kpi('Principal outstanding', approx + money(sum(info, 'principal')), 'bad') + kpi('Remaining payments', money(sum(info, 'payable')));
    if (element('quickSummary')) element('quickSummary').innerHTML = `<div class="summary-chip"><span>${monthLabel(nextMonth())} EMIs</span><strong>${money(monthly)}</strong></div><div class="summary-chip"><span>Active schedules</span><strong>${info.filter(item => item.remaining > 0).length}</strong></div><div class="summary-chip"><span>Principal</span><strong>${approx}${money(sum(info, 'principal'))}</strong></div>`;
    const segments = [{ label: 'EMIs', value: monthly, color: '#dc3545' }, { label: 'Expenses', value: state.expenses, color: '#d18b00' }, { label: 'Free cash', value: Math.max(0, free), color: '#15976b' }];
    drawDonut('donutChart', 'donutLegend', segments);
    element('emiBarChart').innerHTML = bars(loans.map(loan => ({ label: loan.name, value: model.monthTotal([loan], nextMonth()) })));
    element('healthAlert').innerHTML = `<div class="alert-box ${free < 0 ? 'danger' : 'info'}">${income > 0 ? Math.round(monthly / income * 100) + '% of income scheduled for EMIs next month.' : 'Income not entered.'} ${free < 0 ? 'Projected cash shortfall: ' + money(-free) + '.' : ''}</div>`;
  }

  function bars(items) {
    const maximum = Math.max(1, ...items.map(item => item.value));
    return items.map(item => `<div class="projection-row"><span>${escape(item.label)}</span><div class="projection-track"><div style="width:${Math.max(0, item.value / maximum * 100)}%"></div></div><strong>${money(item.value)}</strong></div>`).join('');
  }

  function drawDonut(svgId, legendId, segments) {
    const total = segments.reduce((value, segment) => value + segment.value, 0) || 1;
    let offset = 0;
    element(svgId).innerHTML = segments.map(segment => {
      const share = segment.value / total * 100;
      const circle = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${segment.color}" stroke-width="5" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}" transform="rotate(-90 21 21)"/>`;
      offset += share;
      return circle;
    }).join('');
    element(legendId).innerHTML = segments.map(segment => `<div class="legend-item"><span class="legend-dot" style="background:${segment.color}"></span>${segment.label}: ${money(segment.value)}</div>`).join('');
  }

  function futureMonths() {
    const last = loans.reduce((latest, loan) => model.progress(loan, asOf()).end > latest ? model.progress(loan, asOf()).end : latest, asOf());
    const months = [];
    for (let date = asOf().slice(0, 7) + '-01'; date.slice(0, 7) <= last.slice(0, 7); date = model.addMonths(date, 1)) months.push(date);
    return months;
  }

  function renderTimeline() {
    const active = loans.filter(loan => model.progress(loan, asOf()).remaining).sort((first, second) => model.progress(first, asOf()).end.localeCompare(model.progress(second, asOf()).end));
    element('timelineView').innerHTML = active.length ? active.map(loan => `<div class="tl-item"><div class="tl-date">${dateLabel(model.progress(loan, asOf()).end)}</div><div class="tl-text">${escape(loan.name)} · Final payment ${money(loan.finalAmount)}</div><span class="tl-badge freed">${money(loan.amount)}/month released after completion</span></div>`).join('') : '<p>All schedules complete.</p>';
    const rows = futureMonths().map(date => {
      const amounts = loans.map(loan => model.round(model.schedule(loan).filter(row => row.date > asOf() && row.date.slice(0, 7) === date.slice(0, 7)).reduce((total, row) => total + row.amount, 0)));
      const total = model.round(amounts.reduce((value, amount) => value + amount, 0));
      if (!total) return '';
      return `<tr><td>${monthLabel(date)}${date.slice(0, 7) === asOf().slice(0, 7) ? ' (remaining)' : ''}</td>${amounts.map(amount => `<td class="num">${money(amount)}</td>`).join('')}<td class="num"><strong>${money(total)}</strong></td></tr>`;
    }).join('');
    element('monthlyPayments').innerHTML = table(['Month', ...loans.map(loan => escape(loan.name)), 'Total'], rows || '<tr><td>No future scheduled payments.</td></tr>');
    element('cashGrowthChart').innerHTML = bars(futureMonths().filter(date => date.slice(0, 7) >= nextMonth()).map(date => ({ label: monthLabel(date), value: state.salary + state.otherIncome - state.expenses - model.monthTotal(loans, date.slice(0, 7)) })));
  }

  function generateDetails() {
    const info = summaries();
    const approximate = info.some(item => item.estimated) ? '≈ ' : '';
    element('detailKpis').innerHTML = kpi('Remaining scheduled payments', money(sum(info, 'payable'))) + kpi('Principal', approximate + money(sum(info, 'principal')), 'good') + kpi('Future interest', approximate + money(sum(info, 'interest')), 'bad');
    element('detailsTable').innerHTML = table(['Loan / source notes', 'Original financed', 'Disbursement', 'First / final due', 'Rate basis', 'Principal left', 'Interest left', 'Payments left', 'Processing fee, before tax'], loans.map((loan, index) => {
      const item = info[index];
      const approx = item.estimated ? '≈ ' : '';
      return `<tr><td><strong>${escape(loan.name)}</strong><br>${escape(loan.note)}</td><td class="num">${money(loan.original)}</td><td>${loan.disbursed ? dateLabel(loan.disbursed) : 'Not confirmed'}</td><td>${dateLabel(loan.startDate)}<br>${dateLabel(item.end)}</td><td>${loan.rate === null ? 'Unknown' : loan.rate + '%'}<br>${escape(loan.rateSource)}</td><td class="num">${approx}${money(item.principal)}</td><td class="num">${approx}${money(item.interest)}</td><td class="num">${money(item.payable)}<br>${item.remaining} installments</td><td>${loan.fee === null ? 'Unknown' : money(loan.fee)}</td></tr>`;
    }).join(''));
  }

  function generateBalanceReduction() {
    const select = element('balanceLoanSelect');
    const previous = select.value;
    select.innerHTML = '<option value="__all__">All loans</option>' + loans.map((loan, index) => `<option value="${index}">${escape(loan.name)}</option>`).join('');
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    renderBalanceChart();
  }

  function renderBalanceChart() {
    const key = element('balanceLoanSelect').value;
    const selected = key === '__all__' ? loans : [loans[Number(key)]].filter(Boolean);
    const rows = selected.flatMap(loan => model.summary(loan, asOf()).rows.map(row => ({ ...row, name: loan.name }))).sort((first, second) => first.date.localeCompare(second.date));
    element('balanceTable').innerHTML = table(['Due date', 'Loan', '#', 'Payment', 'Principal', 'Interest', 'Loan balance', 'Breakdown basis'], rows.map(row => `<tr><td>${dateLabel(row.date)}</td><td>${escape(row.name)}</td><td>${row.installment}</td><td class="num">${money(row.amount)}</td><td class="num">${money(row.principal)}</td><td class="num">${money(row.interest)}</td><td class="num">${money(row.balance)}</td><td>${row.estimated ? 'Model estimate' : 'Supplied summary'}</td></tr>`).join(''));
    const points = [{ label: 'As of ' + dateLabel(asOf()), value: sum(selected.map(loan => model.summary(loan, asOf())), 'principal') }, ...futureMonths().map(date => {
      const next = model.addMonths(date, 1);
      const end = new Date(next + 'T00:00:00'); end.setDate(0);
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      return { label: monthLabel(date) + ' end', value: sum(selected.map(loan => model.summary(loan, endDate)), 'principal') };
    })];
    element('balanceChartArea').innerHTML = bars(points);
    element('totalDebtChart').innerHTML = bars(loans.map(loan => ({ label: loan.name, value: model.summary(loan, asOf()).principal })));
  }

  function generateStrategy() {
    const active = loans.filter(loan => model.progress(loan, asOf()).remaining);
    element('strategyCards').innerHTML = `<div class="tip-card"><h4>Rate priority, indicative</h4><ul class="tip-list">${[...active].sort((first, second) => (second.rate || 0) - (first.rate || 0)).map(loan => `<li>${escape(loan.name)}: ${loan.rate === null ? 'unknown' : loan.rate + '%'} · ${escape(loan.rateSource)}</li>`).join('')}</ul></div><div class="tip-card"><h4>Foreclosure details outstanding</h4><p>Charges, lock-in period, part-payment limits, GST, accrued interest and lender quotes are not supplied. Fixed/floating status, payment history and day-count rules remain unconfirmed. No exact foreclosure savings are available.</p></div>`;
    element('prepayResult').innerHTML = '';
  }

  function simulatePrepay() {
    const extra = Number(element('prepayAmount').value);
    if (!Number.isFinite(extra) || extra <= 0) { alert('Enter a positive extra monthly payment.'); return; }
    element('prepayResult').innerHTML = '<div class="alert-box info">Exact savings unavailable: prepayment terms and full lender schedules are missing. Extra monthly budget entered: ' + money(extra) + '. Obtain lender foreclosure quotes before choosing a loan.</div>';
  }

  function render() { renderLoans(); renderOverview(); renderTimeline(); generateDetails(); generateBalanceReduction(); generateStrategy(); }

  function openAddModal() { editEmi(-1); }

  function editEmi(index) {
    const loan = loans[index] || { name: '', amount: '', pending: '', startDate: model.addMonths(model.baseline, 1), rate: '', type: 'personal', original: '', principal: '', finalAmount: '', disbursed: '', fee: '' };
    element('modalTitle').textContent = index < 0 ? 'Add loan' : 'Edit saved loan';
    const fields = { emiName: 'name', emiAmount: 'amount', emiPending: 'pending', emiStartDate: 'startDate', emiRate: 'rate', emiType: 'type', emiOriginal: 'original', emiPrincipal: 'principal', emiFinal: 'finalAmount', emiDisbursed: 'disbursed', emiFee: 'fee' };
    for (const [id, field] of Object.entries(fields)) element(id).value = loan[field] ?? '';
    element('editIndex').value = index;
    element('emiModal').classList.add('show');
  }

  function closeModal() { element('emiModal').classList.remove('show'); }

  function saveEmi() {
    const index = Number(element('editIndex').value);
    const old = loans[index];
    const loan = { ...old, name: element('emiName').value.trim(), amount: Number(element('emiAmount').value), pending: Number(element('emiPending').value), startDate: element('emiStartDate').value, rate: element('emiRate').value === '' ? null : Number(element('emiRate').value), type: element('emiType').value, original: Number(element('emiOriginal').value), principal: Number(element('emiPrincipal').value), finalAmount: Number(element('emiFinal').value || element('emiAmount').value), disbursed: element('emiDisbursed').value, fee: element('emiFee').value === '' ? null : Number(element('emiFee').value) };
    if (!loan.startDate || !Number.isInteger(loan.pending) || loan.pending < 1 || loan.pending > 600 || element('emiPrincipal').value === '') { alert('Enter a first due date, 1-600 installments and the baseline principal.'); return; }
    loan.baselinePaid = model.progress(loan, model.baseline).elapsed;
    const changed = !old || ['amount', 'pending', 'startDate', 'rate', 'principal', 'finalAmount'].some(key => loan[key] !== old[key]);
    if (changed) { delete loan.principalParts; delete loan.finalPrincipal; loan.approximate = true; loan.rateSource = 'User-entered; not lender-verified'; loan.note = 'User-edited baseline. Monthly principal/interest split estimated.'; }
    if (!model.validateLoan(loan)) { alert('Check amounts, dates and tenure. Baseline principal cannot exceed the remaining payments.'); return; }
    if (changed && old && !confirm('Replace the financial baseline for this loan? Supplied monthly breakdowns will become model estimates.')) return;
    if (index >= 0) loans[index] = loan; else loans.push(loan);
    persist(); render(); closeModal();
  }

  function deleteEmi(index) { if (confirm('Delete ' + loans[index].name + ' from this browser?')) { loans.splice(index, 1); persist(); render(); } }

  function download(data, name) {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportData() { download(JSON.stringify({ version: model.version, baseline: model.baseline, emis: loans, state }, null, 2), 'emi-planner-backup.json'); }
  function exportPrevious() {
    const previous = localStorage.getItem(storeKey + '_beforeSeptember2026');
    if (previous) download(previous, 'emi-before-september-2026.json'); else alert('No previous records were migrated in this browser.');
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('File too large');
      const data = JSON.parse(await file.text());
      if (!validData(data)) throw new Error('Not a valid September-baseline planner backup');
      if (!confirm('Replace this profile with the imported backup?')) return;
      loans = data.emis; state = data.state;
      for (const key of Object.keys(state)) if (element(key)) element(key).value = state[key];
      writable = true; persist(); render();
    } catch (error) { alert('Import failed: ' + error.message); }
    finally { event.target.value = ''; }
  }

  function calculateEmi() {
    const principal = Number(element('calcPrincipal').value), rate = Number(element('calcRate').value), months = Number(element('calcTenure').value);
    if (principal <= 0 || !Number.isFinite(principal) || rate < 0 || !Number.isFinite(rate) || !Number.isInteger(months) || months < 1 || months > 600) { alert('Enter a positive principal, non-negative rate and 1-600 months.'); return; }
    const monthlyRate = rate / 1200;
    const amount = model.round(monthlyRate ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months);
    let balance = principal;
    const rows = [];
    for (let index = 0; index < months; index++) {
      const interest = model.round(balance * monthlyRate);
      const payment = index === months - 1 ? model.round(balance + interest) : Math.min(amount, model.round(balance + interest));
      const paidPrincipal = model.round(payment - interest);
      balance = model.round(Math.max(0, balance - paidPrincipal));
      rows.push({ amount: payment, principal: paidPrincipal, interest, balance });
    }
    lastCalc = { principal, rate, months, amount, finalAmount: rows.at(-1).amount };
    element('calcResult').style.display = 'block';
    element('calcKpis').innerHTML = kpi('Monthly EMI', money(amount)) + kpi('Principal', money(principal), 'good') + kpi('Interest', money(sum(rows, 'interest')), 'bad') + kpi('Total payments', money(sum(rows, 'amount')));
    drawDonut('calcDonut', 'calcLegend', [{ label: 'Principal', value: principal, color: '#15976b' }, { label: 'Interest', value: sum(rows, 'interest'), color: '#dc3545' }]);
    element('calcAmortTable').innerHTML = table(['Installment', 'Principal', 'Interest', 'Balance'], rows.map((row, index) => `<tr><td>${index + 1}</td><td>${money(row.principal)}</td><td>${money(row.interest)}</td><td>${money(row.balance)}</td></tr>`).join(''));
  }

  function addCalcAsEmi() {
    if (!lastCalc) return;
    openAddModal();
    element('emiAmount').value = lastCalc.amount; element('emiPending').value = lastCalc.months;
    element('emiRate').value = lastCalc.rate; element('emiOriginal').value = lastCalc.principal;
    element('emiPrincipal').value = lastCalc.principal; element('emiFinal').value = lastCalc.finalAmount;
  }

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const button = element('themeToggle');
    if (button) { button.innerHTML = `<i class="fas fa-${dark ? 'sun' : 'moon'}"></i>`; button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
    try { localStorage.setItem('emiTheme', dark ? 'dark' : 'light'); } catch (error) {}
  }
  function toggleTheme() { applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark'); }
  function toggleMobileMenu() { element('mobileMenu').classList.toggle('open'); }
  function closeMobileMenu() { element('mobileMenu').classList.remove('open'); }
  function logout() { localStorage.removeItem('emiActiveUser'); window.location.href = 'login.html'; }

  Object.assign(window, { switchTab, runAnalysis, refreshDateCalculations, followToday, renderBalanceChart, openAddModal, editEmi, closeModal, saveEmi, deleteEmi, exportData, exportPrevious, importData, calculateEmi, addCalcAsEmi, simulatePrepay, toggleTheme, toggleMobileMenu, closeMobileMenu, logout });

  element('asOfDate')?.closest('.form-group').remove();
  const app = document.querySelector('.app-container');
  const tabs = document.querySelector('.tabs');
  const controls = document.createElement('section');
  controls.className = 'date-controls';
  controls.innerHTML = `<div class="form-group"><label for="asOfDate">Analysis date</label><input type="date" id="asOfDate" min="${model.baseline}" onchange="refreshDateCalculations()"></div><label class="follow-toggle"><input id="followToday" type="checkbox" checked onchange="followToday()"> Follow today's date</label><span>Saved baseline: 30 Sep 2026</span>`;
  app.insertBefore(controls, tabs);
  if (!element('saveStatus')) controls.insertAdjacentHTML('afterend', '<p id="saveStatus" class="save-status" role="status"></p>');
  if (!element('importFile')) controls.insertAdjacentHTML('beforebegin', '<div class="quick-actions"><button class="btn btn-outline" onclick="exportData()"><i class="fas fa-download"></i> Export</button><button class="btn btn-outline" onclick="document.getElementById(\'importFile\').click()"><i class="fas fa-upload"></i> Import</button><input type="file" id="importFile" accept="application/json" hidden onchange="importData(event)"></div>');
  document.querySelector('.quick-actions').insertAdjacentHTML('beforeend', '<button class="btn btn-outline" onclick="exportPrevious()" title="Download records from before the September update"><i class="fas fa-clock-rotate-left"></i> Previous backup</button>');
  tabs.insertAdjacentHTML('afterend', '<p class="data-note">Baseline from your supplied summary, not independently verified documents. Future progress assumes on-time payments; elapsed dates do not confirm payment. PLCC principal is approximate. Taxes, penalties and foreclosure charges are excluded. Bajaj ADVEMI collection is unconfirmed.</p>');
  element('tab-timeline').insertAdjacentHTML('afterbegin', '<div class="chart-container"><h3 class="chart-title">Monthly payments remaining</h3><div class="table-scroll"><table class="data-table" id="monthlyPayments"></table></div></div>');
  if (!element('emiProgressGrid')) element('kpiGrid').insertAdjacentHTML('afterend', '<div class="dash-grid" id="emiProgressGrid"></div>');
  const startField = '<div class="form-group"><label for="emiStartDate">First installment due date</label><input type="date" id="emiStartDate"></div>';
  if (!element('emiStartDate')) element('editIndex').insertAdjacentHTML('beforebegin', startField);
  element('emiStartDate').previousElementSibling.textContent = 'First installment due date';
  element('emiPending').previousElementSibling.textContent = 'Original total installments';
  element('editIndex').insertAdjacentHTML('beforebegin', '<div class="form-group"><label for="emiOriginal">Original financed amount (₹)</label><input type="number" min="0.01" step="0.01" id="emiOriginal"></div><div class="form-group"><label for="emiPrincipal">Principal at 30 Sep 2026 (₹)</label><input type="number" min="0" step="0.01" id="emiPrincipal"></div><div class="form-group"><label for="emiFinal">Final installment (₹)</label><input type="number" min="0.01" step="0.01" id="emiFinal"></div><div class="form-group"><label for="emiDisbursed">Disbursement date, if confirmed</label><input type="date" id="emiDisbursed"></div><div class="form-group"><label for="emiFee">Processing fee before tax, if known (₹)</label><input type="number" min="0" step="0.01" id="emiFee"></div>');
  document.querySelectorAll('.data-table').forEach(node => node.parentElement.classList.add('table-scroll'));
  element('tab-balance').querySelector('.chart-title').insertAdjacentHTML('afterend', '<p class="data-note">Monthly splits are estimates except supplied Flipkart, Bajaj and IDFC final rows. Estimated splits fit the baseline principal, remaining payments and any known final principal, not a verified lender rate.</p>');
  element('prepaySection').querySelector('.chart-title').textContent = 'Prepayment planning';
  element('prepaySection').querySelector('p').textContent = 'Lender foreclosure and part-payment terms: not provided.';
  element('prepayAmount').disabled = true;
  element('prepayAmount').value = '';
  element('prepayAmount').placeholder = 'Awaiting lender terms';
  const prepayButton = element('prepaySection').querySelector('button');
  prepayButton.disabled = true;
  prepayButton.title = 'Lender charges and part-payment terms are required';
  prepayButton.innerHTML = '<i class="fas fa-lock"></i> Terms required';
  element('totalDebtChart').closest('.chart-container').querySelector('.chart-title').textContent = 'Current principal by loan';
  element('calcAmortTable').closest('.chart-container').querySelector('.chart-title').textContent = 'Monthly amortization estimate';
  for (const key of ['salary', 'otherIncome', 'expenses', 'emergencyFund']) element(key).addEventListener('change', () => { readIncome(); persist(); render(); });
  element('emiModal').addEventListener('click', event => { if (event.target === element('emiModal')) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  document.addEventListener('visibilitychange', refreshClock);
  window.addEventListener('focus', refreshClock);
  setInterval(refreshClock, 30000);
  let dark = false;
  try { dark = localStorage.getItem('emiTheme') === 'dark'; } catch (error) {}
  applyTheme(dark);
  load();
  followToday();
})();