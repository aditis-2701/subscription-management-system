(() => {
	const content = document.getElementById('subscriptions-content');
	const table = document.getElementById('subscription-table');
	const dialog = document.getElementById('subscription-dialog');
	const form = document.getElementById('subscription-form');
	const toast = document.getElementById('toast');
	const state = { customers: [], products: [], plans: [], subscriptions: [], editingId: null };
	let toastTimer;

	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
	const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
	const dateText = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—';
	const productFor = id => state.products.find(product => product.id === id);
	const planFor = id => state.plans.find(plan => plan.id === id);
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

	function notify(message) {
		toast.textContent = message;
		toast.classList.add('visible');
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
	}

	function statusCell(status) {
		return `<span class="status-pill ${escapeHtml(status || '')}">${escapeHtml((status || 'quoted').replaceAll('_', ' '))}</span>`;
	}

	function render() {
		const search = document.getElementById('subscription-search').value.trim().toLowerCase();
		const filter = document.getElementById('subscription-status-filter').value;
		const visible = state.subscriptions.filter(subscription => {
			const searchable = `${customerFor(subscription.customerId)?.name || subscription.customerName || ''} ${subscription.planName || ''}`.toLowerCase();
			return (!search || searchable.includes(search)) && (filter === 'all' || subscription.status === filter);
		}).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
		const active = state.subscriptions.filter(subscription => subscription.status === 'active').length;
		const quoted = state.subscriptions.filter(subscription => subscription.status === 'quoted').length;
		const recurring = state.subscriptions.filter(subscription => subscription.status === 'active').reduce((sum, subscription) => sum + Number(subscription.total), 0);
		document.getElementById('subscription-summary').textContent = `${visible.length} of ${state.subscriptions.length} subscriptions · ${quoted} quotes awaiting review`;
		document.getElementById('subscription-metrics').innerHTML = `<article class="metric"><div class="metric-label">Active subscriptions</div><div class="metric-value">${active}</div><div class="metric-foot">Currently active</div></article><article class="metric"><div class="metric-label">Open quotes</div><div class="metric-value">${quoted}</div><div class="metric-foot">Awaiting confirmation</div></article><article class="metric"><div class="metric-label">Recurring value</div><div class="metric-value">${money(recurring)}</div><div class="metric-foot">Active plan totals</div></article><article class="metric"><div class="metric-label">All subscriptions</div><div class="metric-value">${state.subscriptions.length}</div><div class="metric-foot">Across this workspace</div></article>`;
		content.setAttribute('aria-busy', 'false');

		if (!visible.length) {
			const filtered = search || filter !== 'all';
			table.innerHTML = `<div class="empty-state"><strong>${filtered ? 'No matching subscriptions' : 'No subscriptions yet'}</strong>${filtered ? 'Adjust your search or status filter.' : 'Create a quote from a customer and billing plan.'}</div>`;
			return;
		}

		table.innerHTML = `<table><thead><tr><th>Customer / plan</th><th>Starts</th><th>Billing</th><th>Recurring total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visible.map(subscription => `<tr><td><span class="cell-title">${escapeHtml(customerFor(subscription.customerId)?.name || subscription.customerName || 'Customer')}</span><span class="cell-note">${escapeHtml(subscription.planName || '')}${subscription.variantName ? ` · ${escapeHtml(subscription.variantName)}` : ''}${subscription.addonName ? ` · ${escapeHtml(subscription.addonName)}` : ''}</span></td><td>${dateText(subscription.startDate)}</td><td>${escapeHtml(planFor(subscription.planId)?.billingInterval || '—')}</td><td><strong>${money(subscription.total)}</strong></td><td>${statusCell(subscription.status)}</td><td><div class="row-actions"><button class="button-small" data-edit-subscription="${escapeHtml(subscription.id)}">Update status</button><button class="button-small" data-delete-subscription="${escapeHtml(subscription.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
	}

	async function load() {
		content.setAttribute('aria-busy', 'true');
		try {
			const [me, customers, products, plans, subscriptions] = await Promise.all([
				request('/me'), request('/customers'), request('/products'), request('/plans'), request('/subscriptions')
			]);
			state.customers = customers.items || [];
			state.products = products.items || [];
			state.plans = plans.items || [];
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
			table.innerHTML = '<div class="empty-state"><strong>Could not load subscriptions</strong>Check your connection and try again.</div>';
			content.setAttribute('aria-busy', 'false');
		}
	}

	function updateOptions() {
		const plan = planFor(form.elements.planId.value);
		const product = productFor(plan?.productId);
		const variant = form.elements.variantName;
		const addon = form.elements.addonName;
		const previousVariant = variant.value;
		const previousAddon = addon.value;
		variant.innerHTML = `<option value="">No variant</option>${(product?.variants || []).map(option => `<option value="${escapeHtml(option.name)}" data-extra="${Number(option.priceDelta || 0)}">${escapeHtml(option.name)}${option.priceDelta ? ` · +${money(option.priceDelta)}` : ''}</option>`).join('')}`;
		addon.innerHTML = `<option value="">No add-on</option>${(product?.addons || []).map(option => `<option value="${escapeHtml(option.name)}" data-extra="${Number(option.price || 0)}">${escapeHtml(option.name)}${option.price ? ` · +${money(option.price)}` : ''}</option>`).join('')}`;
		if ([...variant.options].some(option => option.value === previousVariant)) variant.value = previousVariant;
		if ([...addon.options].some(option => option.value === previousAddon)) addon.value = previousAddon;
		updatePreview();
	}

	function updatePreview() {
		const plan = planFor(form.elements.planId.value);
		if (!plan) return;
		const variantExtra = Number(form.elements.variantName.selectedOptions[0]?.dataset.extra || 0);
		const addonExtra = Number(form.elements.addonName.selectedOptions[0]?.dataset.extra || 0);
		const subtotal = Number(plan.price) + variantExtra + addonExtra;
		const enteredDiscount = form.elements.discountPercent.value;
		const expired = plan.discountExpires && plan.discountExpires < new Date().toISOString().slice(0, 10);
		const discountRate = enteredDiscount === '' ? (expired ? 0 : Number(plan.discountPercent || 0)) : Number(enteredDiscount);
		const discount = Math.round(subtotal * discountRate) / 100;
		const tax = Math.round((subtotal - discount) * Number(plan.taxRate || 0)) / 100;
		const total = Math.round((subtotal - discount + tax) * 100) / 100;
		document.getElementById('subscription-preview').innerHTML = `<div class="calculation-line"><span>Plan and options</span><strong>${money(subtotal)}</strong></div><div class="calculation-line"><span>Discount (${discountRate}%)</span><strong>−${money(discount)}</strong></div><div class="calculation-line"><span>Tax (${plan.taxRate || 0}%)</span><strong>${money(tax)}</strong></div><div class="calculation-line total"><span>Estimated recurring total</span><strong>${money(total)}</strong></div>`;
	}

	function openEditor(subscription = null) {
		if (!state.customers.length) return notify('Add a customer before creating a subscription.');
		if (!state.plans.length) return notify('Add a billing plan before creating a subscription.');
		state.editingId = subscription?.id || null;
		form.reset();
		document.getElementById('form-error').hidden = true;
		document.getElementById('form-error').textContent = '';
		document.getElementById('dialog-title').textContent = subscription ? 'Update subscription status' : 'Create subscription quote';
		form.elements.customerId.innerHTML = state.customers.map(customer => `<option value="${escapeHtml(customer.id)}" ${customer.id === subscription?.customerId ? 'selected' : ''}>${escapeHtml(customer.name)} · ${escapeHtml(customer.email)}</option>`).join('');
		form.elements.planId.innerHTML = state.plans.map(plan => `<option value="${escapeHtml(plan.id)}" ${plan.id === subscription?.planId ? 'selected' : ''} data-price="${plan.price}" data-tax="${plan.taxRate || 0}" data-discount="${plan.discountPercent || 0}" data-product-id="${escapeHtml(plan.productId)}">${escapeHtml(plan.name)} · ${money(plan.price)} / ${escapeHtml(plan.billingInterval)}</option>`).join('');
		form.elements.startDate.value = subscription?.startDate || new Date().toISOString().slice(0, 10);
		form.elements.discountPercent.value = subscription?.discountPercent ?? '';
		form.elements.status.value = subscription?.status || 'quoted';
		form.elements.customerId.disabled = Boolean(subscription);
		form.elements.planId.disabled = Boolean(subscription);
		form.elements.variantName.disabled = Boolean(subscription);
		form.elements.addonName.disabled = Boolean(subscription);
		form.elements.startDate.disabled = Boolean(subscription);
		form.elements.discountPercent.disabled = Boolean(subscription);
		updateOptions();
		if (subscription) {
			form.elements.variantName.value = subscription.variantName || '';
			form.elements.addonName.value = subscription.addonName || '';
		}
		dialog.showModal();
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
				customerId: form.elements.customerId.value,
				planId: form.elements.planId.value,
				variantName: form.elements.variantName.value,
				addonName: form.elements.addonName.value,
				startDate: form.elements.startDate.value,
				status: form.elements.status.value
			};
			if (form.elements.discountPercent.value !== '') payload.discountPercent = Number(form.elements.discountPercent.value);
			const id = state.editingId;
			const result = await request(`/subscriptions${id ? `/${encodeURIComponent(id)}` : ''}`, {
				method: id ? 'PUT' : 'POST',
				body: JSON.stringify(payload)
			});
			dialog.close();
			await load();
			notify(id ? 'Subscription status updated.' : `Quote created. Invoice ${result.item.id ? 'generated' : 'created'}.`);
		} catch (error) {
			document.getElementById('form-error').textContent = error.message;
			document.getElementById('form-error').hidden = false;
		} finally {
			submit.disabled = false;
			[form.elements.customerId, form.elements.planId, form.elements.variantName, form.elements.addonName, form.elements.startDate, form.elements.discountPercent].forEach(field => { field.disabled = false; });
		}
	}

	async function remove(id) {
		const subscription = state.subscriptions.find(item => item.id === id);
		if (!subscription || !window.confirm(`Delete the ${subscription.planName} subscription? This cannot be undone.`)) return;
		try {
			await request(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
			await load();
			notify('Subscription deleted.');
		} catch (error) { notify(error.message); }
	}

	document.getElementById('create-quote').addEventListener('click', () => openEditor());
	document.getElementById('subscription-search').addEventListener('input', render);
	document.getElementById('subscription-status-filter').addEventListener('change', render);
	table.addEventListener('click', event => {
		const edit = event.target.closest('[data-edit-subscription]');
		const deleteButton = event.target.closest('[data-delete-subscription]');
		if (edit) openEditor(state.subscriptions.find(item => item.id === edit.dataset.editSubscription));
		if (deleteButton) remove(deleteButton.dataset.deleteSubscription);
	});
	form.elements.planId.addEventListener('change', updateOptions);
	form.elements.variantName.addEventListener('change', updatePreview);
	form.elements.addonName.addEventListener('change', updatePreview);
	form.elements.discountPercent.addEventListener('input', updatePreview);
	form.addEventListener('submit', save);
	document.addEventListener('click', event => {
		if (event.target.closest('[data-close-dialog]')) dialog.close();
		if (event.target.closest('#logout-button')) {
			request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined).finally(() => { window.location.href = 'auth.html?mode=login'; });
		}
	});

	load();
})();
