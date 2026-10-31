(() => {
    const content = document.getElementById('products-content');
    const productTable = document.getElementById('product-table');
    const planTable = document.getElementById('plan-table');
    const dialog = document.getElementById('record-dialog');
    const form = document.getElementById('record-form');
    const fields = document.getElementById('dialog-fields');
    const preview = document.getElementById('price-preview');
    const toast = document.getElementById('toast');
    const state = { products: [], plans: [], editing: null };
    let toastTimer;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
    const productFor = id => state.products.find(product => product.id === id);

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
        const productSearch = document.getElementById('product-search').value.trim().toLowerCase();
        const planSearch = document.getElementById('plan-search').value.trim().toLowerCase();
        const products = state.products.filter(product => `${product.name} ${product.description || ''} ${(product.variants || []).map(item => item.name || item).join(' ')} ${(product.addons || []).map(item => item.name || item).join(' ')}`.toLowerCase().includes(productSearch));
        const plans = state.plans.filter(plan => `${plan.name} ${plan.billingInterval} ${productFor(plan.productId)?.name || ''}`.toLowerCase().includes(planSearch));
        document.getElementById('catalog-summary').textContent = `${state.products.length} products · ${state.plans.length} billing plans`;
        document.getElementById('catalog-metrics').innerHTML = `<article class="metric"><div class="metric-label">Products</div><div class="metric-value">${state.products.length}</div><div class="metric-foot">Catalog items</div></article><article class="metric"><div class="metric-label">Billing plans</div><div class="metric-value">${state.plans.length}</div><div class="metric-foot">Recurring options</div></article><article class="metric"><div class="metric-label">Variants</div><div class="metric-value">${state.products.reduce((sum, product) => sum + (product.variants || []).length, 0)}</div><div class="metric-foot">Priced product options</div></article><article class="metric"><div class="metric-label">Add-ons</div><div class="metric-value">${state.products.reduce((sum, product) => sum + (product.addons || []).length, 0)}</div><div class="metric-foot">Additional services</div></article>`;
        content.setAttribute('aria-busy', 'false');

        productTable.innerHTML = products.length ? `<table><thead><tr><th>Product</th><th>Variants</th><th>Add-ons</th><th>Actions</th></tr></thead><tbody>${products.map(product => `<tr><td><span class="cell-title">${escapeHtml(product.name)}</span><span class="cell-note">${escapeHtml(product.description || '')}</span></td><td>${(product.variants || []).map(option => `${escapeHtml(option.name || option)}${option.priceDelta ? ` (+${money(option.priceDelta)})` : ''}`).join(', ') || '—'}</td><td>${(product.addons || []).map(option => `${escapeHtml(option.name || option)}${option.price ? ` (+${money(option.price)})` : ''}`).join(', ') || '—'}</td><td><div class="row-actions"><button class="button-small" data-edit-product="${escapeHtml(product.id)}">Edit</button><button class="button-small" data-delete-product="${escapeHtml(product.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><strong>${productSearch ? 'No matching products' : 'No products yet'}</strong>${productSearch ? 'Try another search.' : 'Add a product to create billing plans.'}</div>`;

        planTable.innerHTML = plans.length ? `<table><thead><tr><th>Plan / product</th><th>Billing</th><th>Price</th><th>Tax</th><th>Discount</th><th>Actions</th></tr></thead><tbody>${plans.map(plan => `<tr><td><span class="cell-title">${escapeHtml(plan.name)}</span><span class="cell-note">${escapeHtml(productFor(plan.productId)?.name || 'Product removed')}</span></td><td>${escapeHtml(plan.billingInterval)}</td><td><strong>${money(plan.price)}</strong></td><td>${Number(plan.taxRate || 0)}%</td><td>${Number(plan.discountPercent || 0)}%${plan.discountExpires ? `<span class="cell-note">Until ${new Date(`${plan.discountExpires}T00:00:00`).toLocaleDateString()}</span>` : ''}</td><td><div class="row-actions"><button class="button-small" data-edit-plan="${escapeHtml(plan.id)}">Edit</button><button class="button-small" data-delete-plan="${escapeHtml(plan.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><strong>${planSearch ? 'No matching plans' : 'No billing plans yet'}</strong>${planSearch ? 'Try another search.' : 'Create a plan for a product.'}</div>`;
    }

    async function load() {
        content.setAttribute('aria-busy', 'true');
        try {
            const [me, products, plans] = await Promise.all([request('/me'), request('/products'), request('/plans')]);
            state.products = products.items || [];
            state.plans = plans.items || [];
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
            productTable.innerHTML = '<div class="empty-state"><strong>Could not load catalog</strong>Check your connection and try again.</div>';
            planTable.innerHTML = '';
            content.setAttribute('aria-busy', 'false');
        }
    }

    function field(name, label, value = '', type = 'text', options = {}) {
        return `<div class="field${options.full ? ' full' : ''}"><label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.max !== undefined ? `max="${options.max}"` : ''} ${options.step ? `step="${options.step}"` : ''} ${options.required === false ? '' : 'required'} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}></label></div>`;
    }

    function select(name, label, choices, value) {
        return `<div class="field"><label>${escapeHtml(label)}<select name="${escapeHtml(name)}" required>${choices.map(choice => `<option value="${escapeHtml(choice.value)}" ${String(value) === String(choice.value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}</select></label></div>`;
    }

    function productForm(product = {}) {
        return field('name', 'Product name', product.name || '') + field('description', 'Description', product.description || '', 'text', { required: false }) + field('variantsText', 'Variants (name:price adjustment)', (product.variants || []).map(item => `${item.name || item}${item.priceDelta ? `:${item.priceDelta}` : ''}`).join(', '), 'text', { full: true, required: false, placeholder: 'Standard:0, Pro:25' }) + field('addonsText', 'Add-ons (name:price)', (product.addons || []).map(item => `${item.name || item}${item.price ? `:${item.price}` : ''}`).join(', '), 'text', { full: true, required: false, placeholder: 'Extra seats:10, Priority support:15' });
    }

    function planForm(plan = {}) {
        const productChoices = state.products.map(product => ({ value: product.id, label: product.name }));
        const intervals = ['weekly', 'monthly', 'quarterly', 'yearly'].map(interval => ({ value: interval, label: interval }));
        return select('productId', 'Product', productChoices, plan.productId || productChoices[0]?.value || '') + field('name', 'Plan name', plan.name || '') + field('price', 'Recurring price', plan.price ?? '', 'number', { min: 0, step: '0.01' }) + select('billingInterval', 'Billing interval', intervals, plan.billingInterval || 'monthly') + field('taxRate', 'Tax rate (%)', plan.taxRate ?? 0, 'number', { min: 0, max: 100, step: '0.01' }) + field('discountPercent', 'Discount (%)', plan.discountPercent ?? 0, 'number', { min: 0, max: 100, step: '0.01' }) + field('discountExpires', 'Discount expires', plan.discountExpires || '', 'date', { required: false });
    }

    function previewPlan() {
        const subtotal = Number(form.elements.price.value || 0);
        const discountRate = Number(form.elements.discountPercent.value || 0);
        const taxRate = Number(form.elements.taxRate.value || 0);
        const discount = Math.round(subtotal * discountRate) / 100;
        const tax = Math.round((subtotal - discount) * taxRate) / 100;
        const total = Math.round((subtotal - discount + tax) * 100) / 100;
        preview.innerHTML = `<div class="calculation-line"><span>Recurring price</span><strong>${money(subtotal)}</strong></div><div class="calculation-line"><span>Discount (${discountRate}%)</span><strong>−${money(discount)}</strong></div><div class="calculation-line"><span>Tax (${taxRate}%)</span><strong>${money(tax)}</strong></div><div class="calculation-line total"><span>Estimated total</span><strong>${money(total)}</strong></div>`;
    }

    function openEditor(type, record = null) {
        if (type === 'plans' && !state.products.length) return notify('Add a product before creating a billing plan.');
        const editing = Boolean(record);
        state.editing = { type, id: record?.id || null };
        document.getElementById('dialog-eyebrow').textContent = editing ? 'EDIT CATALOG' : 'NEW CATALOG ITEM';
        document.getElementById('dialog-title').textContent = `${editing ? 'Edit' : 'Add'} ${type === 'products' ? 'product' : 'billing plan'}`;
        document.getElementById('form-error').hidden = true;
        form.dataset.type = type;
        fields.innerHTML = type === 'products' ? productForm(record || {}) : planForm(record || {});
        preview.hidden = type !== 'plans';
        if (type === 'plans') previewPlan();
        dialog.showModal();
        fields.querySelector('input, select')?.focus();
    }

    function parseOptions(text, key) {
        return text.split(',').map(part => {
            const colon = part.lastIndexOf(':');
            const name = (colon < 0 ? part : part.slice(0, colon)).trim();
            const amount = colon < 0 ? 0 : Number(part.slice(colon + 1).trim());
            if (name && (!Number.isFinite(amount) || amount < 0)) throw new Error(`Enter a valid non-negative price for ${name}.`);
            return name ? { name, [key]: amount } : null;
        }).filter(Boolean);
    }

    function getPayload(type, values) {
        const payload = Object.fromEntries(values.entries());
        if (type === 'products') {
            payload.variants = parseOptions(payload.variantsText, 'priceDelta');
            payload.addons = parseOptions(payload.addonsText, 'price');
            delete payload.variantsText;
            delete payload.addonsText;
        } else {
            ['price', 'taxRate', 'discountPercent'].forEach(key => { payload[key] = Number(payload[key]); });
            if (!payload.discountExpires) payload.discountExpires = null;
        }
        delete payload.id;
        return payload;
    }

    async function save(event) {
        event.preventDefault();
        const { type, id } = state.editing;
        const submit = form.querySelector('[type="submit"]');
        const error = document.getElementById('form-error');
        submit.disabled = true;
        error.hidden = true;
        try {
            await request(`/${type}${id ? `/${encodeURIComponent(id)}` : ''}`, {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(getPayload(type, new FormData(form)))
            });
            dialog.close();
            await load();
            notify(id ? 'Catalog record updated.' : 'Catalog record created.');
        } catch (saveError) {
            error.textContent = saveError.message;
            error.hidden = false;
        } finally {
            submit.disabled = false;
        }
    }

    async function remove(type, id) {
        const record = state[type].find(item => item.id === id);
        if (!record || !window.confirm(`Delete ${record.name}? This cannot be undone.`)) return;
        try {
            await request(`/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await load();
            notify('Catalog record deleted.');
        } catch (error) { notify(error.message); }
    }

    document.getElementById('add-product').addEventListener('click', () => openEditor('products'));
    document.querySelectorAll('[data-action="add-product"]').forEach(button => button.addEventListener('click', () => openEditor('products')));
    document.querySelectorAll('[data-action="add-plan"]').forEach(button => button.addEventListener('click', () => openEditor('plans')));
    document.getElementById('product-search').addEventListener('input', render);
    document.getElementById('plan-search').addEventListener('input', render);
    productTable.addEventListener('click', event => {
        const edit = event.target.closest('[data-edit-product]');
        const removeButton = event.target.closest('[data-delete-product]');
        if (edit) openEditor('products', state.products.find(product => product.id === edit.dataset.editProduct));
        if (removeButton) remove('products', removeButton.dataset.deleteProduct);
    });
    planTable.addEventListener('click', event => {
        const edit = event.target.closest('[data-edit-plan]');
        const removeButton = event.target.closest('[data-delete-plan]');
        if (edit) openEditor('plans', state.plans.find(plan => plan.id === edit.dataset.editPlan));
        if (removeButton) remove('plans', removeButton.dataset.deletePlan);
    });
    form.addEventListener('input', event => {
        if (form.dataset.type === 'plans' && ['price', 'discountPercent', 'taxRate'].includes(event.target.name)) previewPlan();
    });
    form.addEventListener('submit', save);
    document.addEventListener('click', event => {
        if (event.target.closest('[data-close-dialog]')) dialog.close();
        if (event.target.closest('#logout-button')) {
            request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined).finally(() => { window.location.href = 'auth.html?mode=login'; });
        }
    });

    load();
})();
