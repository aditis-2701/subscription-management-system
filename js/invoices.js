(() => {
	const content = document.getElementById('invoices-content');
	const table = document.getElementById('invoice-table');
	const dialog = document.getElementById('invoice-dialog');
	const form = document.getElementById('invoice-form');
	const toast = document.getElementById('toast');
	const state = { customers: [], invoices: [], payments: [], editingId: null };
	let toastTimer;

	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
	const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
	const today = () => new Date().toISOString().slice(0, 10);
	const dateText = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—';
	const customerFor = id => state.customers.find(customer => customer.id === id);

	async function request(path, options = {}) {
		const response = await fetch(`/api${path}`, {
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			...options
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
		return result;
	}

	function balance(invoice) {
		const paid = state.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
		return Math.max(0, Math.round((Number(invoice.total) - paid) * 100) / 100);
	}

	function effectiveStatus(invoice) {
		if (!['paid', 'canceled'].includes(invoice.status) && invoice.dueDate < today() && balance(invoice) > 0) return 'overdue';
		return invoice.status;
	}

	function notify(message) {
		toast.textContent = message;
		toast.classList.add('visible');
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
	}

	function render() {
		const search = document.getElementById('invoice-search').value.trim().toLowerCase();
		const filter = document.getElementById('invoice-status-filter').value;
		const visible = state.invoices.filter(invoice => {
			const customer = customerFor(invoice.customerId);
			const searchable = `${invoice.invoiceNumber} ${customer?.name || ''} ${customer?.email || ''}`.toLowerCase();
			const status = effectiveStatus(invoice);
			return (!search || searchable.includes(search)) && (filter === 'all' || status === filter);
		}).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
		const outstanding = state.invoices.filter(invoice => !['paid', 'canceled'].includes(invoice.status)).reduce((sum, invoice) => sum + balance(invoice), 0);
		const overdue = state.invoices.filter(invoice => effectiveStatus(invoice) === 'overdue').length;
		const open = state.invoices.filter(invoice => balance(invoice) > 0 && invoice.status !== 'canceled').length;
		document.getElementById('invoice-summary').textContent = `${visible.length} of ${state.invoices.length} invoices · ${open} with balances`;
		document.getElementById('invoice-metrics').innerHTML = `<article class="metric"><div class="metric-label">Invoices</div><div class="metric-value">${state.invoices.length}</div><div class="metric-foot">All billing records</div></article><article class="metric"><div class="metric-label">Outstanding</div><div class="metric-value">${money(outstanding)}</div><div class="metric-foot">Remaining invoice balance</div></article><article class="metric"><div class="metric-label">Overdue</div><div class="metric-value">${overdue}</div><div class="metric-foot">Past due with balance</div></article><article class="metric"><div class="metric-label">Paid</div><div class="metric-value">${state.invoices.filter(invoice => invoice.status === 'paid' || balance(invoice) === 0).length}</div><div class="metric-foot">Settled invoices</div></article>`;
		content.setAttribute('aria-busy', 'false');

		if (!visible.length) {
			const filtered = search || filter !== 'all';
			table.innerHTML = `<div class="empty-state"><strong>${filtered ? 'No matching invoices' : 'No invoices yet'}</strong>${filtered ? 'Change the search or status filter.' : 'Create an invoice or quote a subscription.'}</div>`;
			return;
		}

		table.innerHTML = `<table><thead><tr><th>Invoice / customer</th><th>Due date</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visible.map(invoice => {
			const customer = customerFor(invoice.customerId);
			const status = effectiveStatus(invoice);
			const actions = [
				`<button class="button-small" data-invoice-action="edit" data-id="${escapeHtml(invoice.id)}">Edit</button>`,
				`<button class="button-small" data-invoice-action="print" data-id="${escapeHtml(invoice.id)}">Print</button>`
			];
			if (invoice.status === 'draft') actions.push(`<button class="button-small" data-invoice-action="confirm" data-id="${escapeHtml(invoice.id)}">Confirm</button>`);
			if (['draft', 'confirmed'].includes(invoice.status)) actions.push(`<button class="button-small" data-invoice-action="send" data-id="${escapeHtml(invoice.id)}">Send</button>`);
			if (!['paid', 'partially_paid', 'canceled'].includes(invoice.status)) actions.push(`<button class="button-small" data-invoice-action="cancel" data-id="${escapeHtml(invoice.id)}">Cancel</button>`);
			actions.push(`<button class="button-small" data-invoice-action="delete" data-id="${escapeHtml(invoice.id)}">Delete</button>`);
			return `<tr><td><span class="cell-title">${escapeHtml(invoice.invoiceNumber)}</span><span class="cell-note">${escapeHtml(customer?.name || 'Unknown customer')}</span></td><td>${dateText(invoice.dueDate)}</td><td>${money(invoice.subtotal)}</td><td>${money(invoice.discount)}</td><td>${money(invoice.tax)}</td><td><strong>${money(invoice.total)}</strong></td><td>${money(balance(invoice))}</td><td><span class="status-pill ${escapeHtml(status)}">${escapeHtml((status || 'draft').replaceAll('_', ' '))}</span></td><td><div class="row-actions">${actions.join('')}</div></td></tr>`;
		}).join('')}</tbody></table>`;
	}

	async function load() {
		content.setAttribute('aria-busy', 'true');
		try {
			const [me, customers, invoices, payments] = await Promise.all([
				request('/me'), request('/customers'), request('/invoices'), request('/payments')
			]);
			state.customers = customers.items || [];
			state.invoices = invoices.items || [];
			state.payments = payments.items || [];
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
			table.innerHTML = '<div class="empty-state"><strong>Could not load invoices</strong>Check your connection and try again.</div>';
			content.setAttribute('aria-busy', 'false');
		}
	}

	function updatePreview() {
		const subtotal = Number(form.elements.subtotal.value || 0);
		const discountRate = Number(form.elements.discountPercent.value || 0);
		const taxRate = Number(form.elements.taxRate.value || 0);
		const discount = Math.round(subtotal * discountRate) / 100;
		const tax = Math.round((subtotal - discount) * taxRate) / 100;
		const total = Math.round((subtotal - discount + tax) * 100) / 100;
		document.getElementById('invoice-preview').innerHTML = `<div class="calculation-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="calculation-line"><span>Discount (${discountRate}%)</span><strong>−${money(discount)}</strong></div><div class="calculation-line"><span>Tax (${taxRate}%)</span><strong>${money(tax)}</strong></div><div class="calculation-line total"><span>Invoice total</span><strong>${money(total)}</strong></div>`;
	}

	function openEditor(invoice = null) {
		if (!state.customers.length) return notify('Add a customer before creating an invoice.');
		state.editingId = invoice?.id || null;
		form.reset();
		document.getElementById('form-error').hidden = true;
		document.getElementById('form-error').textContent = '';
		document.getElementById('dialog-title').textContent = invoice ? `Edit ${invoice.invoiceNumber}` : 'Create invoice';
		form.elements.customerId.innerHTML = state.customers.map(customer => `<option value="${escapeHtml(customer.id)}" ${customer.id === invoice?.customerId ? 'selected' : ''}>${escapeHtml(customer.name)} · ${escapeHtml(customer.email)}</option>`).join('');
		form.elements.subtotal.value = invoice?.subtotal ?? '';
		form.elements.discountPercent.value = invoice?.discountPercent ?? 0;
		form.elements.taxRate.value = invoice?.taxRate ?? 0;
		form.elements.dueDate.value = invoice?.dueDate || today();
		updatePreview();
		dialog.showModal();
		form.elements.subtotal.focus();
	}

	function printInvoice(invoice) {
		const customer = customerFor(invoice.customerId);
		document.getElementById('print-content').innerHTML = `<article class="print-document"><p class="eyebrow">BRIGHTLOOP INVOICE</p><h2>${escapeHtml(invoice.invoiceNumber)}</h2><p>Bill to: <strong>${escapeHtml(customer?.name || 'Customer')}</strong><br>${escapeHtml(customer?.email || '')}</p><p>Due date: ${dateText(invoice.dueDate)}<br>Status: ${escapeHtml(effectiveStatus(invoice))}</p><table><tbody><tr><td>Subtotal</td><td>${money(invoice.subtotal)}</td></tr><tr><td>Discount (${invoice.discountPercent}%)</td><td>−${money(invoice.discount)}</td></tr><tr><td>Tax (${invoice.taxRate}%)</td><td>${money(invoice.tax)}</td></tr></tbody></table><p class="print-total">Total: ${money(invoice.total)}<br>Balance due: ${money(balance(invoice))}</p></article>`;
		document.getElementById('print-dialog').showModal();
	}

	async function save(event) {
		event.preventDefault();
		const submit = form.querySelector('[type="submit"]');
		const error = document.getElementById('form-error');
		submit.disabled = true;
		error.hidden = true;
		try {
			const values = new FormData(form);
			const payload = {
				customerId: values.get('customerId'),
				subtotal: Number(values.get('subtotal')),
				discountPercent: Number(values.get('discountPercent')),
				taxRate: Number(values.get('taxRate')),
				dueDate: values.get('dueDate')
			};
			const id = state.editingId;
			const result = await request(`/invoices${id ? `/${encodeURIComponent(id)}` : ''}`, {
				method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
			});
			dialog.close();
			await load();
			notify(id ? 'Invoice updated.' : `Invoice ${result.item.invoiceNumber} created.`);
		} catch (saveError) {
			error.textContent = saveError.message;
			error.hidden = false;
		} finally {
			submit.disabled = false;
		}
	}

	async function act(action, id) {
		const invoice = state.invoices.find(item => item.id === id);
		if (!invoice) return;
		if (action === 'edit') return openEditor(invoice);
		if (action === 'print') return printInvoice(invoice);
		if (action === 'delete' && !window.confirm(`Delete ${invoice.invoiceNumber}? This cannot be undone.`)) return;
		try {
			if (action === 'delete') {
				await request(`/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
				notify('Invoice deleted.');
			} else {
				const result = await request(`/invoices/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
				notify(result.message);
			}
			await load();
		} catch (error) { notify(error.message); }
	}

	document.getElementById('add-invoice').addEventListener('click', () => openEditor());
	document.getElementById('invoice-search').addEventListener('input', render);
	document.getElementById('invoice-status-filter').addEventListener('change', render);
	table.addEventListener('click', event => {
		const button = event.target.closest('[data-invoice-action]');
		if (button) act(button.dataset.invoiceAction, button.dataset.id);
	});
	form.addEventListener('input', event => {
		if (['subtotal', 'discountPercent', 'taxRate'].includes(event.target.name)) updatePreview();
	});
	form.addEventListener('submit', save);
	document.addEventListener('click', event => {
		if (event.target.closest('[data-close-invoice]')) dialog.close();
		if (event.target.closest('[data-close-print]')) document.getElementById('print-dialog').close();
		if (event.target.closest('#print-invoice-button')) window.print();
		if (event.target.closest('#logout-button')) {
			request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined).finally(() => { window.location.href = 'auth.html?mode=login'; });
		}
	});

	load();
})();
