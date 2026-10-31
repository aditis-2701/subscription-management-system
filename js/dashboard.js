(() => {
			const content = document.getElementById('app-content');
			const dialog = document.getElementById('record-dialog');
			const form = document.getElementById('record-form');
			const fields = document.getElementById('dialog-fields');
			const preview = document.getElementById('calculation-preview');
			const toast = document.getElementById('toast');
			const state = {
				view: 'overview', user: null, overview: null, customers: [], products: [], plans: [],
				subscriptions: [], invoices: [], payments: [], findings: [], report: null, editing: null
			};
			const titles = {
				overview: 'Overview', catalog: 'Products & plans', subscriptions: 'Subscriptions',
				invoices: 'Invoices', payments: 'Payments', reports: 'Reports', operations: 'Operations'
			};
			let toastTimer;

			const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
				'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
			})[character]);
			const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
			const dateText = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—';

			async function request(path, options = {}) {
				if (window.apiRequest) return window.apiRequest(path, options);
				const response = await fetch(`/api${path}`, {
					credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
				return result;
			}

			function notify(message) {
				toast.textContent = message;
				toast.classList.add('visible');
				window.clearTimeout(toastTimer);
				toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
			}

			async function loadData(from, to) {
				const today = new Date();
				const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
				const end = today.toISOString().slice(0, 10);
				const range = new URLSearchParams({ from: from || start, to: to || end });
				const [me, overview, customers, products, plans, subscriptions, invoices, payments, detective, report] = await Promise.all([
					request('/me'), request('/overview'), request('/customers'), request('/products'), request('/plans'),
					request('/subscriptions'), request('/invoices'), request('/payments'), request('/detective'), request(`/reports?${range}`)
				]);
				state.user = me.user;
				state.overview = overview;
				state.customers = customers.items || [];
				state.products = products.items || [];
				state.plans = plans.items || [];
				state.subscriptions = subscriptions.items || [];
				state.invoices = invoices.items || [];
				state.payments = payments.items || [];
				state.findings = detective.findings || [];
				state.report = report;
				document.getElementById('user-name').textContent = state.user.name;
				document.getElementById('user-role').textContent = state.user.role;
				document.getElementById('company-name').textContent = state.user.company.toUpperCase();
				document.getElementById('user-initials').textContent = state.user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
				const alertCount = document.getElementById('alert-count');
				alertCount.textContent = state.findings.length;
				alertCount.hidden = !state.findings.length;
			}

			function heading(title, description, action, actionLabel = 'Add record') {
				return `<div class="view-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${action ? `<div class="view-actions"><button class="button-primary" data-action="${action}">${escapeHtml(actionLabel)}</button></div>` : ''}</div>`;
			}

			function emptyState(title, message, action) {
				return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}${action ? `<div style="margin-top:14px"><button class="button-secondary" data-action="${action}">Add first record</button></div>` : ''}</div>`;
			}

			function statusCell(status) {
				const value = status || 'active';
				return `<span class="status-pill ${escapeHtml(value)}">${escapeHtml(value.replaceAll('_', ' '))}</span>`;
			}

			function table(rows, columns, options = {}) {
				if (!rows.length) return emptyState(options.emptyTitle || 'Nothing here yet', options.emptyMessage || 'Add a record to get started.', options.emptyAction);
				const statuses = [...new Set(rows.map(row => row.status).filter(Boolean))];
				return `<div class="panel"><div class="table-tools"><input type="search" data-table-search placeholder="${escapeHtml(options.placeholder || 'Search records')}" aria-label="${escapeHtml(options.placeholder || 'Search records')}">${statuses.length ? `<select data-table-status aria-label="Filter by status"><option value="">All statuses</option>${statuses.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value.replaceAll('_', ' '))}</option>`).join('')}</select>` : ''}</div><div class="table-wrap"><table><thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr data-status="${escapeHtml(row.status || '')}" data-search="${escapeHtml(JSON.stringify(row).toLowerCase())}">${row.cells}</tr>`).join('')}</tbody></table></div></div>`;
			}

			function customerFor(id) { return state.customers.find(customer => customer.id === id); }
			function planFor(id) { return state.plans.find(plan => plan.id === id); }
			function productFor(id) { return state.products.find(product => product.id === id); }
			function balance(invoice) {
				const paid = state.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
				return Math.max(0, Math.round((invoice.total - paid) * 100) / 100);
			}

			function actions(collection, record) {
				const editLabel = collection === 'subscriptions' ? 'Update status' : 'Edit';
				let output = `<button class="button-small" data-action="edit" data-collection="${collection}" data-id="${escapeHtml(record.id)}">${editLabel}</button>`;
				if (collection === 'invoices') {
					output += `<button class="button-small" data-action="print" data-id="${escapeHtml(record.id)}">Print</button>`;
					if (['draft', 'confirmed'].includes(record.status)) output += `<button class="button-small" data-action="invoice-send" data-id="${escapeHtml(record.id)}">Send</button>`;
					if (record.status === 'draft') output += `<button class="button-small" data-action="invoice-confirm" data-id="${escapeHtml(record.id)}">Confirm</button>`;
					if (!['paid', 'partially_paid', 'canceled'].includes(record.status)) output += `<button class="button-small" data-action="invoice-cancel" data-id="${escapeHtml(record.id)}">Cancel</button>`;
				}
				if (collection !== 'payments') output += `<button class="button-small" data-action="delete" data-collection="${collection}" data-id="${escapeHtml(record.id)}">Delete</button>`;
				return `<div class="row-actions">${output}</div>`;
			}

			function invoiceRows(invoices) {
				return invoices.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(invoice => {
					const customer = customerFor(invoice.customerId);
					return { ...invoice, cells: `<td><span class="cell-title">${escapeHtml(invoice.invoiceNumber)}</span><span class="cell-note">${escapeHtml(customer?.name || 'Unknown customer')}</span></td><td>${dateText(invoice.dueDate)}</td><td>${money(invoice.subtotal)}</td><td>${money(invoice.discount)}</td><td>${money(invoice.tax)}</td><td><strong>${money(invoice.total)}</strong></td><td>${statusCell(invoice.status)}</td><td>${actions('invoices', invoice)}</td>` };
				});
			}

			function paymentRows(payments) {
				return payments.slice().sort((a, b) => b.date.localeCompare(a.date)).map(payment => {
					const invoice = state.invoices.find(item => item.id === payment.invoiceId);
					return { ...payment, cells: `<td><span class="cell-title">${escapeHtml(customerFor(invoice?.customerId)?.name || 'Unknown customer')}</span><span class="cell-note">${escapeHtml(invoice?.invoiceNumber || '')}</span></td><td>${escapeHtml(payment.method)}</td><td>${dateText(payment.date)}</td><td><strong>${money(payment.amount)}</strong></td><td>${statusCell(payment.status)}</td>` };
				});
			}

			function renderFindings(findings) {
				if (!findings.length) return emptyState('All clear', 'No revenue leakage findings for this workspace.');
				return `<div class="finding-list">${findings.map(finding => `<article class="finding"><span class="finding-dot ${escapeHtml(finding.severity)}"></span><div><strong>${escapeHtml(finding.title)}</strong><p>${escapeHtml(finding.detail)}</p></div><span class="severity">${escapeHtml(finding.severity)}</span></article>`).join('')}</div>`;
			}

			function renderOverview() {
				const stats = state.overview;
				const values = state.report.revenue || [];
				const max = Math.max(1, ...values.map(item => item.amount));
				const chart = values.length ? `<div class="chart">${values.map(item => `<div class="chart-column"><span class="chart-value">${item.amount ? money(item.amount) : ''}</span><div class="chart-track"><div class="chart-bar" style="height:${Math.max(3, item.amount / max * 100)}%"></div></div><span class="chart-label">${escapeHtml(item.month.slice(5))}</span></div>`).join('')}</div>` : emptyState('No payments in this period', 'Record a payment to build your revenue report.', 'add-payment');
				return `${heading('Business at a glance', 'Live totals from your workspace records.', 'add-customer', 'Add customer')}<div class="metric-grid"><article class="metric"><div class="metric-label">Revenue collected this month</div><div class="metric-value">${money(stats.revenue)}</div><div class="metric-foot">Recorded payment total</div></article><article class="metric"><div class="metric-label">Customers</div><div class="metric-value">${stats.customers}</div><div class="metric-foot">Across this workspace</div></article><article class="metric"><div class="metric-label">Active subscriptions</div><div class="metric-value">${stats.activeSubscriptions}</div><div class="metric-foot">Currently active</div></article><article class="metric"><div class="metric-label">Outstanding balance</div><div class="metric-value">${money(stats.outstanding)}</div><div class="metric-foot">Open invoice balances</div></article></div><div class="overview-grid"><section class="panel"><header class="panel-header"><h3>Revenue, last 12 months</h3><a href="#reports" data-view-link="reports">View report</a></header>${chart}</section><section class="panel"><header class="panel-header"><h3>Revenue leakage detective</h3><a href="#operations" data-view-link="operations">${state.findings.length} findings</a></header>${renderFindings(state.findings.slice(0, 4))}</section><section class="panel"><header class="panel-header"><h3>Recent invoices</h3><a href="#invoices" data-view-link="invoices">View all</a></header>${table(invoiceRows(stats.recentInvoices || []), ['Invoice / customer', 'Due date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Actions'])}</section><section class="panel"><header class="panel-header"><h3>Needs attention</h3><a href="#operations" data-view-link="operations">Operations</a></header><div class="operations-summary">${state.findings.length ? `${state.findings.length} item${state.findings.length === 1 ? '' : 's'} need review.` : 'No revenue leakage issues detected.'}</div><div class="panel-body"><button class="button-secondary" data-action="add-invoice">Create invoice</button><button class="button-secondary" data-action="add-payment">Record payment</button></div></section></div>`;
			}

			function renderCatalog() {
				const products = state.products.map(product => ({
					...product,
					cells: `<td><span class="cell-title">${escapeHtml(product.name)}</span><span class="cell-note">${escapeHtml(product.description || '')}</span></td><td>${(product.variants || []).map(option => `${escapeHtml(option.name || option)}${option.priceDelta ? ` (+${money(option.priceDelta)})` : ''}`).join(', ') || '—'}</td><td>${(product.addons || []).map(option => `${escapeHtml(option.name || option)}${option.price ? ` (+${money(option.price)})` : ''}`).join(', ') || '—'}</td><td>${actions('products', product)}</td>`
				}));
				const plans = state.plans.map(plan => ({
					...plan,
					cells: `<td><span class="cell-title">${escapeHtml(plan.name)}</span><span class="cell-note">${escapeHtml(productFor(plan.productId)?.name || 'Product removed')}</span></td><td>${escapeHtml(plan.billingInterval)}</td><td><strong>${money(plan.price)}</strong></td><td>${Number(plan.taxRate || 0)}%</td><td>${Number(plan.discountPercent || 0)}%${plan.discountExpires ? `<span class="cell-note">Until ${dateText(plan.discountExpires)}</span>` : ''}</td><td>${actions('plans', plan)}</td>`
				}));
				return `${heading('Products & plans', 'Set products, priced options, add-ons and billing terms.', 'add-product', 'Add product')}<section class="panel" style="margin-bottom:16px"><header class="panel-header"><h3>Products</h3><button class="button-secondary" data-action="add-product">New product</button></header>${table(products, ['Product', 'Variants', 'Add-ons', 'Actions'], { emptyTitle: 'No products', emptyMessage: 'Create a product before its billing plan.', emptyAction: 'add-product' })}</section><section class="panel"><header class="panel-header"><h3>Billing plans</h3><button class="button-secondary" data-action="add-plan">New plan</button></header>${table(plans, ['Plan / product', 'Billing', 'Price', 'Tax', 'Discount', 'Actions'], { emptyTitle: 'No plans', emptyMessage: 'Create a plan for a product.', emptyAction: 'add-plan' })}</section>`;
			}

			function renderSubscriptions() {
				const rows = state.subscriptions.map(subscription => ({
					...subscription,
					cells: `<td><span class="cell-title">${escapeHtml(customerFor(subscription.customerId)?.name || subscription.customerName)}</span><span class="cell-note">${escapeHtml(subscription.planName)}</span></td><td>${dateText(subscription.startDate)}</td><td>${escapeHtml(planFor(subscription.planId)?.billingInterval || '—')}</td><td><strong>${money(subscription.total)}</strong></td><td>${statusCell(subscription.status)}</td><td>${actions('subscriptions', subscription)}</td>`
				}));
				return `${heading('Subscription book', 'Create quotes and track customer subscriptions.', 'add-subscription', 'Create quote')}${table(rows, ['Customer / plan', 'Starts', 'Billing', 'Recurring total', 'Status', 'Actions'], { placeholder: 'Search customer or plan', emptyTitle: 'No subscriptions', emptyMessage: 'Create a quote from a customer and plan.', emptyAction: 'add-subscription' })}`;
			}

			function renderInvoices() {
				return `${heading('Invoice register', 'Review calculated totals and manage invoice actions.', 'add-invoice', 'Create invoice')}${table(invoiceRows(state.invoices), ['Invoice / customer', 'Due date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Actions'], { placeholder: 'Search invoice or customer', emptyTitle: 'No invoices', emptyMessage: 'Create an invoice or quote a subscription.', emptyAction: 'add-invoice' })}`;
			}

			function renderPayments() {
				return `${heading('Payment ledger', 'Record collections and reconcile outstanding balances.', 'add-payment', 'Record payment')}${table(paymentRows(state.payments), ['Customer / invoice', 'Method', 'Date', 'Amount', 'Status'], { placeholder: 'Search payments', emptyTitle: 'No payments', emptyMessage: 'Record a payment against an open invoice.', emptyAction: 'add-payment' })}`;
			}

			function renderOperations() {
				const pending = state.invoices.filter(invoice => !['paid', 'canceled'].includes(invoice.status));
				return `${heading('Operations desk', 'Review billing issues and pending invoices.')}<section class="panel"><header class="panel-header"><h3>Revenue leakage detective</h3><span>${state.findings.length} findings</span></header><div class="operations-summary">Checks cover invoice coverage, duplicates, calculations, payment totals, overdue balances and expired discounts.</div>${renderFindings(state.findings)}</section><section class="panel" style="margin-top:14px"><header class="panel-header"><h3>Pending invoices</h3></header>${table(invoiceRows(pending), ['Invoice / customer', 'Due date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Actions'], { emptyTitle: 'No pending invoices', emptyMessage: 'There are no open invoices.' })}</section>`;
			}

			function renderReports() {
				const report = state.report;
				const values = report.revenue || [];
				const max = Math.max(1, ...values.map(item => item.amount));
				const chart = values.length ? `<div class="chart">${values.map(item => `<div class="chart-column"><span class="chart-value">${money(item.amount)}</span><div class="chart-track"><div class="chart-bar" style="height:${Math.max(3, item.amount / max * 100)}%"></div></div><span class="chart-label">${escapeHtml(item.month)}</span></div>`).join('')}</div>` : emptyState('No results', 'No payments match this date range.');
				const payments = paymentRows(state.payments.filter(payment => payment.date >= report.from && payment.date <= report.to));
				return `${heading('Revenue reports', 'Filter collected revenue by date and inspect payment activity.')}<section class="panel"><header class="panel-header"><h3>Report filters</h3><form class="report-filters" id="report-filters"><label>From<input type="date" name="from" value="${escapeHtml(report.from)}" required></label><label>To<input type="date" name="to" value="${escapeHtml(report.to)}" required></label><button class="button-primary" type="submit">Apply filters</button></form></header><div class="metric-grid" style="padding:14px 14px 0"><article class="metric"><div class="metric-label">Collected in range</div><div class="metric-value">${money(report.collected)}</div></article><article class="metric"><div class="metric-label">Payment records</div><div class="metric-value">${report.payments}</div></article><article class="metric"><div class="metric-label">Open subscriptions</div><div class="metric-value">${state.subscriptions.filter(item => ['active', 'trialing'].includes(item.status)).length}</div></article><article class="metric"><div class="metric-label">Leakage findings</div><div class="metric-value">${report.findings}</div></article></div>${chart}</section><section class="panel" style="margin-top:14px"><header class="panel-header"><h3>Payments in range</h3></header>${table(payments, ['Customer / invoice', 'Method', 'Date', 'Amount', 'Status'])}</section>`;
			}

			const renderers = {
				overview: renderOverview, catalog: renderCatalog, subscriptions: renderSubscriptions,
				invoices: renderInvoices, payments: renderPayments, reports: renderReports, operations: renderOperations
			};

			function render() {
				document.getElementById('page-title').textContent = titles[state.view] || 'Overview';
				document.querySelectorAll('button.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
				content.innerHTML = renderers[state.view]();
				content.setAttribute('aria-busy', 'false');
			}

			function inputField(name, label, value = '', type = 'text', options = {}) {
				return `<div class="field${options.full ? ' full' : ''}"><label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.step ? `step="${options.step}"` : ''} ${options.required === false ? '' : 'required'} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}></label></div>`;
			}

			function selectField(name, label, choices, value = '', required = true) {
				return `<div class="field"><label>${escapeHtml(label)}<select name="${escapeHtml(name)}" ${required ? 'required' : ''}>${choices.map(choice => `<option value="${escapeHtml(choice.value)}" ${String(value) === String(choice.value) ? 'selected' : ''} ${choice.data || ''}>${escapeHtml(choice.label)}</option>`).join('')}</select></label></div>`;
			}

			function statusField(value, statuses) {
				return selectField('status', 'Status', statuses.map(status => ({ value: status, label: status.replaceAll('_', ' ') })), value);
			}

			function formMarkup(type, item = {}) {
				const customers = state.customers.map(customer => ({ value: customer.id, label: `${customer.name} · ${customer.email}` }));
				const products = state.products.map(product => ({ value: product.id, label: product.name }));
				const plans = state.plans.map(plan => {
					const expired = plan.discountExpires && plan.discountExpires < new Date().toISOString().slice(0, 10);
					return { value: plan.id, label: `${plan.name} · ${money(plan.price)} / ${plan.billingInterval}`, data: `data-price="${plan.price}" data-tax="${plan.taxRate || 0}" data-discount="${expired ? 0 : plan.discountPercent || 0}" data-product-id="${plan.productId}"` };
				});
				const openInvoices = state.invoices.filter(invoice => balance(invoice) > 0 && invoice.status !== 'canceled').map(invoice => ({ value: invoice.id, label: `${invoice.invoiceNumber} · ${customerFor(invoice.customerId)?.name || 'Customer'} · ${money(balance(invoice))} due`, data: `data-balance="${balance(invoice)}"` }));

				if (type === 'customers') return inputField('name', 'Customer name', item.name) + inputField('email', 'Email address', item.email, 'email') + inputField('company', 'Company', item.company || '', 'text', { required: false }) + inputField('phone', 'Phone', item.phone || '', 'tel', { required: false }) + statusField(item.status || 'active', ['active', 'inactive']);
				if (type === 'products') return inputField('name', 'Product name', item.name) + inputField('description', 'Description', item.description || '', 'text', { required: false }) + inputField('variantsText', 'Variants (name:price adjustment)', (item.variants || []).map(option => `${option.name || option}${option.priceDelta ? `:${option.priceDelta}` : ''}`).join(', '), 'text', { full: true, required: false, placeholder: 'Standard:0, Pro:25' }) + inputField('addonsText', 'Add-ons (name:price)', (item.addons || []).map(option => `${option.name || option}${option.price ? `:${option.price}` : ''}`).join(', '), 'text', { full: true, required: false, placeholder: 'Extra seats:10, Support:15' });
				if (type === 'plans') return selectField('productId', 'Product', products, item.productId || '') + inputField('name', 'Plan name', item.name) + inputField('price', 'Recurring price', item.price ?? '', 'number', { min: 0, step: '0.01' }) + selectField('billingInterval', 'Billing interval', ['monthly', 'quarterly', 'yearly', 'weekly'].map(value => ({ value, label: value })), item.billingInterval || 'monthly') + inputField('taxRate', 'Tax rate (%)', item.taxRate ?? 0, 'number', { min: 0, step: '0.01' }) + inputField('discountPercent', 'Discount (%)', item.discountPercent ?? 0, 'number', { min: 0, step: '0.01' }) + inputField('discountExpires', 'Discount expires', item.discountExpires || '', 'date', { required: false });
				if (type === 'subscriptions') {
					const planProduct = productFor(planFor(item.planId)?.productId);
					const variants = [{ value: '', label: 'No variant' }, ...(planProduct?.variants || []).map(option => ({ value: option.name, label: `${option.name}${option.priceDelta ? ` · +${money(option.priceDelta)}` : ''}`, data: `data-extra="${option.priceDelta || 0}"` }))];
					const addons = [{ value: '', label: 'No add-on' }, ...(planProduct?.addons || []).map(option => ({ value: option.name, label: `${option.name}${option.price ? ` · +${money(option.price)}` : ''}`, data: `data-extra="${option.price || 0}"` }))];
					return selectField('customerId', 'Customer', customers, item.customerId || '') + selectField('planId', 'Billing plan', plans, item.planId || '') + selectField('variantName', 'Variant', variants, item.variantName || '', false) + selectField('addonName', 'Add-on', addons, item.addonName || '', false) + inputField('startDate', 'Start date', item.startDate || new Date().toISOString().slice(0, 10), 'date') + inputField('discountPercent', 'Discount override (%)', item.discountPercent ?? '', 'number', { min: 0, step: '0.01', required: false }) + statusField(item.status || 'quoted', ['quoted', 'trialing', 'active', 'paused', 'canceled']);
				}
				if (type === 'invoices') return selectField('customerId', 'Customer', customers, item.customerId || '') + inputField('subtotal', 'Subtotal', item.subtotal ?? '', 'number', { min: 0, step: '0.01' }) + inputField('discountPercent', 'Discount (%)', item.discountPercent ?? 0, 'number', { min: 0, step: '0.01' }) + inputField('taxRate', 'Tax rate (%)', item.taxRate ?? 0, 'number', { min: 0, step: '0.01' }) + inputField('dueDate', 'Due date', item.dueDate || new Date().toISOString().slice(0, 10), 'date');
				if (type === 'payments') return selectField('invoiceId', 'Invoice', openInvoices, item.invoiceId || '') + inputField('amount', 'Payment amount', item.amount ?? '', 'number', { min: 0.01, step: '0.01' }) + selectField('method', 'Payment method', ['bank_transfer', 'card', 'cash', 'check', 'other'].map(value => ({ value, label: value.replaceAll('_', ' ') })), item.method || 'bank_transfer') + inputField('date', 'Payment date', item.date || new Date().toISOString().slice(0, 10), 'date');
				return '';
			}

			function openForm(type, item = null) {
				if (type === 'plans' && !state.products.length) return notify('Add a product before creating a plan.');
				if (['subscriptions', 'invoices'].includes(type) && !state.customers.length) return notify('Add a customer first.');
				if (type === 'subscriptions' && !state.plans.length) return notify('Add a billing plan first.');
				if (type === 'payments' && !state.invoices.some(invoice => balance(invoice) > 0)) return notify('There are no open invoice balances to collect.');
				state.editing = item ? { type, id: item.id } : null;
				document.getElementById('dialog-eyebrow').textContent = item ? 'EDIT RECORD' : 'NEW RECORD';
				document.getElementById('dialog-title').textContent = `${item ? 'Edit' : 'Add'} ${type === 'subscriptions' ? 'subscription' : type.slice(0, -1)}`;
				document.getElementById('form-error').hidden = true;
				fields.innerHTML = formMarkup(type, item || {});
				form.dataset.type = type;
				preview.hidden = !['subscriptions', 'invoices'].includes(type);
				preview.innerHTML = '';
				if (type === 'subscriptions') updateSubscriptionOptions();
				dialog.showModal();
				if (['subscriptions', 'invoices'].includes(type)) updatePreview();
			}

			function updateSubscriptionOptions() {
				const plan = form.elements.planId?.selectedOptions[0];
				const product = productFor(plan?.dataset.productId);
				const variantSelect = form.elements.variantName;
				const addonSelect = form.elements.addonName;
				const previousVariant = variantSelect?.value;
				const previousAddon = addonSelect?.value;
				if (variantSelect) {
					variantSelect.innerHTML = `<option value="">No variant</option>${(product?.variants || []).map(option => `<option value="${escapeHtml(option.name)}" data-extra="${Number(option.priceDelta || 0)}">${escapeHtml(option.name)}${option.priceDelta ? ` · +${money(option.priceDelta)}` : ''}</option>`).join('')}`;
					if ([...variantSelect.options].some(option => option.value === previousVariant)) variantSelect.value = previousVariant;
				}
				if (addonSelect) {
					addonSelect.innerHTML = `<option value="">No add-on</option>${(product?.addons || []).map(option => `<option value="${escapeHtml(option.name)}" data-extra="${Number(option.price || 0)}">${escapeHtml(option.name)}${option.price ? ` · +${money(option.price)}` : ''}</option>`).join('')}`;
					if ([...addonSelect.options].some(option => option.value === previousAddon)) addonSelect.value = previousAddon;
				}
			}

			function updatePreview() {
				const type = form.dataset.type;
				const values = new FormData(form);
				let subtotal = Number(values.get('subtotal') || 0);
				let discountPercent = Number(values.get('discountPercent') || 0);
				let taxRate = Number(values.get('taxRate') || 0);
				if (type === 'subscriptions') {
					const plan = form.elements.planId?.selectedOptions[0];
					subtotal = Number(plan?.dataset.price || 0) + Number(form.elements.variantName?.selectedOptions[0]?.dataset.extra || 0) + Number(form.elements.addonName?.selectedOptions[0]?.dataset.extra || 0);
					if (!values.get('discountPercent')) discountPercent = Number(plan?.dataset.discount || 0);
					taxRate = Number(plan?.dataset.tax || 0);
				}
				const discount = Math.round(subtotal * discountPercent) / 100;
				const tax = Math.round((subtotal - discount) * taxRate) / 100;
				const total = Math.round((subtotal - discount + tax) * 100) / 100;
				preview.innerHTML = `<div class="calculation-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="calculation-line"><span>Discount (${discountPercent}%)</span><strong>−${money(discount)}</strong></div><div class="calculation-line"><span>Tax (${taxRate}%)</span><strong>${money(tax)}</strong></div><div class="calculation-line total"><span>Total</span><strong>${money(total)}</strong></div>`;
				preview.hidden = false;
			}

			function payloadFor(type, values) {
				const payload = Object.fromEntries(values.entries());
				delete payload.id;
				if (type === 'products') {
					const parseOptions = (text, priceKey) => text.split(',').map(part => {
						const separator = part.lastIndexOf(':');
						const name = (separator < 0 ? part : part.slice(0, separator)).trim();
						const price = separator < 0 ? 0 : Number(part.slice(separator + 1).trim());
						if (name && (!Number.isFinite(price) || price < 0)) throw new Error(`Enter a valid non-negative price for ${name}.`);
						return name ? { name, [priceKey]: price } : null;
					}).filter(Boolean);
					payload.variants = parseOptions(payload.variantsText, 'priceDelta');
					payload.addons = parseOptions(payload.addonsText, 'price');
					delete payload.variantsText;
					delete payload.addonsText;
				}
				['price', 'taxRate', 'discountPercent', 'subtotal', 'amount'].forEach(key => {
					if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]);
				});
				if (type === 'subscriptions' && payload.discountPercent === '') delete payload.discountPercent;
				if (type === 'plans' && !payload.discountExpires) payload.discountExpires = null;
				return payload;
			}

			async function saveRecord(event) {
				event.preventDefault();
				const type = form.dataset.type;
				const id = state.editing?.id;
				const submit = form.querySelector('[type="submit"]');
				const error = document.getElementById('form-error');
				submit.disabled = true;
				error.hidden = true;
				try {
					await request(`/${type}${id ? `/${encodeURIComponent(id)}` : ''}`, {
						method: id ? 'PUT' : 'POST', body: JSON.stringify(payloadFor(type, new FormData(form)))
					});
					dialog.close();
					await refresh();
					notify(id ? 'Record updated.' : type === 'subscriptions' ? 'Quote created with a draft invoice.' : 'Record created.');
				} catch (requestError) {
					error.textContent = requestError.message;
					error.hidden = false;
				} finally {
					submit.disabled = false;
				}
			}

			function applyTableFilters(event) {
				const panel = event.target.closest('.panel');
				if (!panel) return;
				const search = panel.querySelector('[data-table-search]')?.value.toLowerCase() || '';
				const status = panel.querySelector('[data-table-status]')?.value || '';
				panel.querySelectorAll('tbody tr').forEach(row => {
					row.hidden = (!!search && !row.dataset.search.includes(search)) || (!!status && row.dataset.status !== status);
				});
			}

			function printInvoice(invoice) {
				const customer = customerFor(invoice.customerId);
				document.getElementById('print-content').innerHTML = `<article class="print-document"><p class="eyebrow">BRIGHTLOOP INVOICE</p><h2>${escapeHtml(invoice.invoiceNumber)}</h2><p>Bill to: <strong>${escapeHtml(customer?.name || 'Customer')}</strong><br>${escapeHtml(customer?.email || '')}</p><p>Due date: ${dateText(invoice.dueDate)}<br>Status: ${escapeHtml(invoice.status)}</p><table><tbody><tr><td>Subtotal</td><td>${money(invoice.subtotal)}</td></tr><tr><td>Discount (${invoice.discountPercent}%)</td><td>−${money(invoice.discount)}</td></tr><tr><td>Tax (${invoice.taxRate}%)</td><td>${money(invoice.tax)}</td></tr></tbody></table><p class="print-total">Total due: ${money(invoice.total)}</p></article>`;
				document.getElementById('print-dialog').showModal();
			}

			async function deleteRecord(collection, id) {
				if (!window.confirm('Delete this record? This cannot be undone.')) return;
				try {
					await request(`/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
					await refresh();
					notify('Record deleted.');
				} catch (error) { notify(error.message); }
			}

			async function handleAction(event) {
				const button = event.target.closest('[data-action]');
				if (!button) return;
				const action = button.dataset.action;
				const addTypes = { customer: 'customers', product: 'products', plan: 'plans', subscription: 'subscriptions', invoice: 'invoices', payment: 'payments' };
				if (action.startsWith('add-')) return openForm(addTypes[action.slice(4)]);
				if (action === 'edit') {
					const record = state[button.dataset.collection].find(item => item.id === button.dataset.id);
					if (record) openForm(button.dataset.collection, record);
				} else if (action === 'delete') {
					await deleteRecord(button.dataset.collection, button.dataset.id);
				} else if (action.startsWith('invoice-')) {
					const operation = action.slice('invoice-'.length);
					try {
						const result = await request(`/invoices/${encodeURIComponent(button.dataset.id)}/${operation}`, { method: 'POST' });
						await refresh();
						notify(result.message || `Invoice ${operation}ed.`);
					} catch (error) { notify(error.message); }
				} else if (action === 'print') {
					const invoice = state.invoices.find(item => item.id === button.dataset.id);
					if (invoice) printInvoice(invoice);
				}
			}

			async function refresh(from, to) {
				content.setAttribute('aria-busy', 'true');
				try {
					await loadData(from, to);
					render();
				} catch (error) {
					if (error.message.includes('Sign in')) {
						window.location.href = 'auth.html?mode=login';
						return;
					}
					content.innerHTML = `<div class="panel empty-state"><strong>Could not load the workspace</strong>${escapeHtml(error.message)}<div style="margin-top:12px"><button class="button-secondary" data-action="retry">Try again</button></div></div>`;
				} finally {
					content.setAttribute('aria-busy', 'false');
				}
			}

			document.querySelectorAll('button.nav-item[data-view]').forEach(button => button.addEventListener('click', () => {
				state.view = button.dataset.view;
				render();
			}));

			document.addEventListener('click', async event => {
				const viewLink = event.target.closest('[data-view-link]');
				if (viewLink) {
					event.preventDefault();
					state.view = viewLink.dataset.viewLink;
					render();
					return;
				}
				if (event.target.closest('[data-close-dialog]')) dialog.close();
				if (event.target.closest('[data-close-print]')) document.getElementById('print-dialog').close();
				if (event.target.closest('#print-button')) window.print();
				if (event.target.closest('#logout-button')) {
					request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined).finally(() => { window.location.href = 'auth.html?mode=login'; });
					return;
				}
				if (event.target.closest('[data-action="retry"]')) return refresh();
				await handleAction(event);
			});

			content.addEventListener('input', event => {
				if (event.target.matches('[data-table-search]')) applyTableFilters(event);
				if (form.dataset.type === 'invoices' && ['subtotal', 'discountPercent', 'taxRate'].includes(event.target.name)) updatePreview();
				if (form.dataset.type === 'subscriptions' && event.target.name === 'discountPercent') updatePreview();
			});
			content.addEventListener('change', event => {
				if (event.target.matches('[data-table-status]')) applyTableFilters(event);
			});
			fields.addEventListener('change', event => {
				if (form.dataset.type === 'subscriptions' && event.target.name === 'planId') updateSubscriptionOptions();
				if (form.dataset.type === 'subscriptions' && ['planId', 'variantName', 'addonName', 'discountPercent'].includes(event.target.name)) updatePreview();
			});
			form.addEventListener('input', event => {
				if (form.dataset.type === 'invoices' && ['subtotal', 'discountPercent', 'taxRate'].includes(event.target.name)) updatePreview();
			});
			form.addEventListener('submit', saveRecord);
			content.addEventListener('submit', async event => {
				if (event.target.id !== 'report-filters') return;
				event.preventDefault();
				const values = new FormData(event.target);
				await refresh(values.get('from'), values.get('to'));
				state.view = 'reports';
				render();
			});

			refresh();
		})();
        
