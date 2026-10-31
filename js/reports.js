(() => {
	const content = document.getElementById('reports-content');
	const chart = document.getElementById('revenue-chart');
	const table = document.getElementById('report-table');
	const state = { customers: [], invoices: [], payments: [], subscriptions: [], report: null };

	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
	const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
	const dateText = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—';

	async function request(path, options = {}) {
		const response = await fetch(`/api${path}`, {
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			...options
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.message || 'The report could not be loaded.');
		return result;
	}

	function monthRange(from, to) {
		const months = [];
		let current = from.slice(0, 7);
		const final = to.slice(0, 7);
		while (current <= final) {
			months.push(current);
			const [year, month] = current.split('-').map(Number);
			current = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
		}
		return months;
	}

	function paymentsInRange() {
		return state.payments.filter(payment => payment.date >= state.report.from && payment.date <= state.report.to).sort((a, b) => b.date.localeCompare(a.date));
	}

	function invoiceBalance(invoice) {
		const paid = state.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
		return Math.max(0, Math.round((Number(invoice.total) - paid) * 100) / 100);
	}

	function renderChart() {
		const revenue = new Map((state.report.revenue || []).map(item => [item.month, Number(item.amount)]));
		const months = monthRange(state.report.from, state.report.to);
		const max = Math.max(1, ...months.map(month => revenue.get(month) || 0));
		chart.innerHTML = months.map(month => {
			const amount = revenue.get(month) || 0;
			const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
			return `<div class="chart-column"><span class="chart-value">${amount ? money(amount) : ''}</span><div class="chart-track"><div class="chart-bar" style="height:${amount ? Math.max(3, amount / max * 100) : 0}%"></div></div><span class="chart-label">${escapeHtml(label)}</span></div>`;
		}).join('');
	}

	function renderTable() {
		const payments = paymentsInRange();
		if (!payments.length) {
			table.innerHTML = '<div class="empty-state"><strong>No payments in this range</strong>Try a wider date range or record a payment.</div>';
			return;
		}
		table.innerHTML = `<table><thead><tr><th>Customer / invoice</th><th>Method</th><th>Date</th><th>Amount</th><th>Invoice status</th><th>Balance</th></tr></thead><tbody>${payments.map(payment => {
			const invoice = state.invoices.find(item => item.id === payment.invoiceId);
			const customer = invoice && state.customers.find(item => item.id === invoice.customerId);
			return `<tr><td><span class="cell-title">${escapeHtml(customer?.name || 'Unknown customer')}</span><span class="cell-note">${escapeHtml(invoice?.invoiceNumber || '')}</span></td><td>${escapeHtml(payment.method.replaceAll('_', ' '))}</td><td>${dateText(payment.date)}</td><td><strong>${money(payment.amount)}</strong></td><td><span class="status-pill ${escapeHtml(invoice?.status || '')}">${escapeHtml((invoice?.status || 'unknown').replaceAll('_', ' '))}</span></td><td>${invoice ? money(invoiceBalance(invoice)) : '—'}</td></tr>`;
		}).join('')}</tbody></table>`;
	}

	function render() {
		const report = state.report;
		const activeSubscriptions = state.subscriptions.filter(subscription => ['active', 'trialing'].includes(subscription.status)).length;
		document.getElementById('report-summary').textContent = `Collected revenue from ${dateText(report.from)} through ${dateText(report.to)}`;
		document.getElementById('report-metrics').innerHTML = `<article class="metric"><div class="metric-label">Collected revenue</div><div class="metric-value">${money(report.collected)}</div><div class="metric-foot">For selected date range</div></article><article class="metric"><div class="metric-label">Payments</div><div class="metric-value">${paymentsInRange().length}</div><div class="metric-foot">Records in this range</div></article><article class="metric"><div class="metric-label">Active subscriptions</div><div class="metric-value">${activeSubscriptions}</div><div class="metric-foot">Active or trialing</div></article><article class="metric"><div class="metric-label">Leakage findings</div><div class="metric-value">${report.findings}</div><div class="metric-foot">Current detective alerts</div></article>`;
		content.setAttribute('aria-busy', 'false');
		renderChart();
		renderTable();
	}

	async function load(from, to) {
		content.setAttribute('aria-busy', 'true');
		document.getElementById('page-error').hidden = true;
		const range = new URLSearchParams({ from, to });
		try {
			const [me, report, payments, invoices, customers, subscriptions] = await Promise.all([
				request('/me'), request(`/reports?${range}`), request('/payments'), request('/invoices'), request('/customers'), request('/subscriptions')
			]);
			state.report = report;
			state.payments = payments.items || [];
			state.invoices = invoices.items || [];
			state.customers = customers.items || [];
			state.subscriptions = subscriptions.items || [];
			document.getElementById('user-name').textContent = me.user.name;
			document.getElementById('user-role').textContent = me.user.role;
			document.getElementById('company-name').textContent = me.user.company.toUpperCase();
			document.getElementById('user-initials').textContent = me.user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
			render();
		} catch (error) {
			if (error.message.includes('Sign in')) {
				window.location.href = 'auth.html?mode=login';
				return;
			}
			document.getElementById('page-error').textContent = error.message;
			document.getElementById('page-error').hidden = false;
			content.setAttribute('aria-busy', 'false');
		}
	}

	function downloadCsv() {
		const rows = [['Date', 'Customer', 'Invoice', 'Method', 'Amount', 'Invoice status', 'Balance']];
		paymentsInRange().forEach(payment => {
			const invoice = state.invoices.find(item => item.id === payment.invoiceId);
			const customer = invoice && state.customers.find(item => item.id === invoice.customerId);
			rows.push([payment.date, customer?.name || '', invoice?.invoiceNumber || '', payment.method, payment.amount, invoice?.status || '', invoice ? invoiceBalance(invoice) : '']);
		});
		const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `brightloop-report-${state.report.from}-to-${state.report.to}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	const currentDate = new Date();
	const today = currentDate.toISOString().slice(0, 10);
	const firstDay = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
	document.getElementById('report-from').value = firstDay;
	document.getElementById('report-to').value = today;
	document.getElementById('report-filters').addEventListener('submit', event => {
		event.preventDefault();
		const from = document.getElementById('report-from').value;
		const to = document.getElementById('report-to').value;
		if (from > to) {
			const error = document.getElementById('page-error');
			error.textContent = 'The start date must be on or before the end date.';
			error.hidden = false;
			return;
		}
		load(from, to);
	});
	document.getElementById('export-report').addEventListener('click', downloadCsv);
	document.getElementById('logout-button').addEventListener('click', () => {
		request('/auth/logout', { method: 'POST', body: '{}' })
			.catch(() => undefined)
			.finally(() => { window.location.href = 'auth.html?mode=login'; });
	});

	load(firstDay, today);
})();
