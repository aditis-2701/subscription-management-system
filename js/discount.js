(() => {
	const content = document.getElementById('discount-content');
	const table = document.getElementById('discount-table');
	const dialog = document.getElementById('discount-dialog');
	const form = document.getElementById('discount-form');
	const toast = document.getElementById('toast');
	const state = { products: [], plans: [] };
	let toastTimer;

	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
	const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
	const today = () => new Date().toISOString().slice(0, 10);
	const productFor = id => state.products.find(product => product.id === id);
	const discountState = plan => !Number(plan.discountPercent) ? 'none' : plan.discountExpires && plan.discountExpires < today() ? 'expired' : 'active';

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

	function render() {
		const search = document.getElementById('discount-search').value.trim().toLowerCase();
		const filter = document.getElementById('discount-filter').value;
		const visible = state.plans.filter(plan => {
			const searchable = `${plan.name} ${productFor(plan.productId)?.name || ''}`.toLowerCase();
			return (!search || searchable.includes(search)) && (filter === 'all' || discountState(plan) === filter);
		});
		const active = state.plans.filter(plan => discountState(plan) === 'active').length;
		const expired = state.plans.filter(plan => discountState(plan) === 'expired').length;
		document.getElementById('discount-summary').textContent = `${visible.length} of ${state.plans.length} billing plans`;
		document.getElementById('discount-metrics').innerHTML = `<article class="metric"><div class="metric-label">Active discounts</div><div class="metric-value">${active}</div><div class="metric-foot">Currently valid offers</div></article><article class="metric"><div class="metric-label">Expired discounts</div><div class="metric-value">${expired}</div><div class="metric-foot">Offers to review</div></article><article class="metric"><div class="metric-label">Billing plans</div><div class="metric-value">${state.plans.length}</div><div class="metric-foot">All workspace plans</div></article><article class="metric"><div class="metric-label">Plans without discounts</div><div class="metric-value">${state.plans.length - active - expired}</div><div class="metric-foot">No offer configured</div></article>`;
		content.setAttribute('aria-busy', 'false');

		if (!visible.length) {
			const filtered = search || filter !== 'all';
			table.innerHTML = `<div class="empty-state"><strong>${filtered ? 'No matching billing plans' : 'No billing plans yet'}</strong>${filtered ? 'Change the search or filter to see other plans.' : 'Create a billing plan before setting a discount.'}</div>`;
			return;
		}

		table.innerHTML = `<table><thead><tr><th>Plan / product</th><th>Billing</th><th>List price</th><th>Discount</th><th>Price before tax</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visible.map(plan => {
			const status = discountState(plan);
			const percent = Number(plan.discountPercent || 0);
			const discounted = Math.round(Number(plan.price) * (1 - percent / 100) * 100) / 100;
			const statusLabel = status === 'none' ? 'No discount' : status;
			const expiration = plan.discountExpires ? new Date(`${plan.discountExpires}T00:00:00`).toLocaleDateString() : 'No expiry';
			return `<tr><td><span class="cell-title">${escapeHtml(plan.name)}</span><span class="cell-note">${escapeHtml(productFor(plan.productId)?.name || 'Product removed')}</span></td><td>${escapeHtml(plan.billingInterval)}</td><td>${money(plan.price)}</td><td>${percent ? `${percent}%` : '—'}</td><td><strong>${percent ? money(discounted) : '—'}</strong></td><td>${expiration}</td><td><span class="status-pill ${status === 'none' ? '' : status}">${escapeHtml(statusLabel)}</span></td><td><button class="button-small" data-edit-discount="${escapeHtml(plan.id)}">${percent ? 'Edit discount' : 'Set discount'}</button></td></tr>`;
		}).join('')}</tbody></table>`;
	}

	async function load() {
		content.setAttribute('aria-busy', 'true');
		try {
			const [me, plans, products] = await Promise.all([request('/me'), request('/plans'), request('/products')]);
			state.plans = plans.items || [];
			state.products = products.items || [];
			document.getElementById('user-name').textContent = me.user.name;
			document.getElementById('user-role').textContent = me.user.role;
			document.getElementById('company-name').textContent = me.user.company.toUpperCase();
			document.getElementById('user-initials').textContent = me.user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
			render();
		} catch (error) {
			if (error.message.includes('Sign in')) {
				window.location.href = '../auth.html?mode=login';
				return;
			}
			document.getElementById('page-error').textContent = error.message;
			document.getElementById('page-error').hidden = false;
			table.innerHTML = '<div class="empty-state"><strong>Could not load billing plans</strong>Check your connection and retry.</div>';
			content.setAttribute('aria-busy', 'false');
		}
	}

	function updatePreview() {
		const plan = state.plans.find(item => item.id === form.elements.planId.value);
		if (!plan) return;
		const percent = Number(form.elements.discountPercent.value || 0);
		const discount = Math.round(Number(plan.price) * percent) / 100;
		const total = Math.round((Number(plan.price) - discount) * 100) / 100;
		document.getElementById('discount-preview').innerHTML = `<div class="calculation-line"><span>List price</span><strong>${money(plan.price)}</strong></div><div class="calculation-line"><span>Discount (${percent}%)</span><strong>−${money(discount)}</strong></div><div class="calculation-line total"><span>Price before tax</span><strong>${money(total)}</strong></div>`;
	}

	function openDiscount(plan) {
		form.reset();
		document.getElementById('form-error').hidden = true;
		document.getElementById('form-error').textContent = '';
		document.getElementById('dialog-title').textContent = `Discount · ${plan.name}`;
		form.elements.planId.innerHTML = `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} · ${money(plan.price)} / ${escapeHtml(plan.billingInterval)}</option>`;
		form.elements.discountPercent.value = Number(plan.discountPercent || 0);
		form.elements.discountExpires.value = plan.discountExpires || '';
		updatePreview();
		dialog.showModal();
		form.elements.discountPercent.focus();
	}

	async function save(event) {
		event.preventDefault();
		const plan = state.plans.find(item => item.id === form.elements.planId.value);
		if (!plan) return;
		const submit = form.querySelector('[type="submit"]');
		const error = document.getElementById('form-error');
		submit.disabled = true;
		error.hidden = true;
		try {
			const percent = Number(form.elements.discountPercent.value);
			const expiration = form.elements.discountExpires.value;
			await request(`/plans/${encodeURIComponent(plan.id)}`, {
				method: 'PUT',
				body: JSON.stringify({
					name: plan.name,
					productId: plan.productId,
					price: plan.price,
					billingInterval: plan.billingInterval,
					taxRate: plan.taxRate,
					discountPercent: percent,
					discountExpires: expiration || null
				})
			});
			dialog.close();
			await load();
			notify(percent ? 'Discount updated.' : 'Discount removed.');
		} catch (requestError) {
			error.textContent = requestError.message;
			error.hidden = false;
		} finally {
			submit.disabled = false;
		}
	}

	document.getElementById('discount-search').addEventListener('input', render);
	document.getElementById('discount-filter').addEventListener('change', render);
	table.addEventListener('click', event => {
		const button = event.target.closest('[data-edit-discount]');
		if (!button) return;
		const plan = state.plans.find(item => item.id === button.dataset.editDiscount);
		if (plan) openDiscount(plan);
	});
	form.elements.discountPercent.addEventListener('input', updatePreview);
	form.addEventListener('submit', save);
	document.addEventListener('click', event => {
		if (event.target.closest('[data-close-dialog]')) dialog.close();
		if (event.target.closest('#logout-button')) {
			request('/auth/logout', { method: 'POST', body: '{}' })
				.catch(() => undefined)
				.finally(() => { window.location.href = '../auth.html?mode=login'; });
		}
	});

	load();
})();
