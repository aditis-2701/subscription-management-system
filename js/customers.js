(() => {
    const content = document.getElementById('customer-content');
    const tableWrap = document.getElementById('customer-table-wrap');
    const dialog = document.getElementById('customer-dialog');
    const form = document.getElementById('customer-form');
    const toast = document.getElementById('toast');
    const state = { customers: [], subscriptions: [] };
    let toastTimer;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

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

    function customerSubscriptions(customerId) {
        return state.subscriptions.filter(subscription => subscription.customerId === customerId && ['active', 'trialing'].includes(subscription.status)).length;
    }

    function render() {
        const search = document.getElementById('customer-search').value.trim().toLowerCase();
        const status = document.getElementById('customer-status').value;
        const visibleCustomers = state.customers.filter(customer => {
            const searchable = `${customer.name} ${customer.company || ''} ${customer.email} ${customer.phone || ''}`.toLowerCase();
            return (!search || searchable.includes(search)) && (!status || customer.status === status);
        });

        document.getElementById('customer-summary').textContent = `${visibleCustomers.length} of ${state.customers.length} customer${state.customers.length === 1 ? '' : 's'} · ${state.subscriptions.filter(subscription => ['active', 'trialing'].includes(subscription.status)).length} active subscriptions`;
        content.setAttribute('aria-busy', 'false');

        if (!visibleCustomers.length) {
            const hasFilters = search || status;
            tableWrap.innerHTML = `<div class="empty-state"><strong>${hasFilters ? 'No matching customers' : 'No customers yet'}</strong>${hasFilters ? 'Try changing your search or status filter.' : 'Add your first customer to start tracking subscriptions.'}</div>`;
            return;
        }

        tableWrap.innerHTML = `<table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Active plans</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visibleCustomers.map(customer => `<tr><td><span class="cell-title">${escapeHtml(customer.name)}</span><span class="cell-note">${escapeHtml(customer.company || 'No company')}</span></td><td>${escapeHtml(customer.email)}</td><td>${escapeHtml(customer.phone || '—')}</td><td>${customerSubscriptions(customer.id)}</td><td><span class="status-pill ${escapeHtml(customer.status || 'active')}">${escapeHtml(customer.status || 'active')}</span></td><td><div class="row-actions"><button class="button-small" type="button" data-action="edit" data-id="${escapeHtml(customer.id)}">Edit</button><button class="button-small" type="button" data-action="delete" data-id="${escapeHtml(customer.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
    }

    async function load() {
        content.setAttribute('aria-busy', 'true');
        try {
            const [me, customers, subscriptions] = await Promise.all([
                request('/me'),
                request('/customers'),
                request('/subscriptions')
            ]);
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
            tableWrap.innerHTML = '<div class="empty-state"><strong>Could not load customers</strong>Check your connection and try again.</div>';
            content.setAttribute('aria-busy', 'false');
        }
    }

    function openForm(customer = null) {
        form.reset();
        document.getElementById('form-error').hidden = true;
        document.getElementById('form-error').textContent = '';
        document.getElementById('dialog-title').textContent = customer ? 'Edit customer' : 'Add customer';
        document.getElementById('dialog-eyebrow').textContent = customer ? 'EDIT RECORD' : 'NEW RECORD';
        form.elements.id.value = customer?.id || '';
        form.elements.name.value = customer?.name || '';
        form.elements.email.value = customer?.email || '';
        form.elements.company.value = customer?.company || '';
        form.elements.phone.value = customer?.phone || '';
        form.elements.status.value = customer?.status || 'active';
        dialog.showModal();
        form.elements.name.focus();
    }

    async function save(event) {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        const error = document.getElementById('form-error');
        submit.disabled = true;
        error.hidden = true;
        try {
            const values = new FormData(form);
            const id = values.get('id');
            const payload = {
                name: values.get('name').trim(),
                email: values.get('email').trim(),
                company: values.get('company').trim(),
                phone: values.get('phone').trim(),
                status: values.get('status')
            };
            await request(`/customers${id ? `/${encodeURIComponent(id)}` : ''}`, {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            dialog.close();
            await load();
            notify(id ? 'Customer updated.' : 'Customer added.');
        } catch (requestError) {
            error.textContent = requestError.message;
            error.hidden = false;
        } finally {
            submit.disabled = false;
        }
    }

    async function remove(id) {
        const customer = state.customers.find(record => record.id === id);
        if (!customer || !window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
        try {
            await request(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await load();
            notify('Customer deleted.');
        } catch (error) {
            notify(error.message);
        }
    }

    document.getElementById('add-customer').addEventListener('click', () => openForm());
    document.getElementById('customer-search').addEventListener('input', render);
    document.getElementById('customer-status').addEventListener('change', render);
    tableWrap.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const customer = state.customers.find(record => record.id === button.dataset.id);
        if (button.dataset.action === 'edit' && customer) openForm(customer);
        if (button.dataset.action === 'delete') remove(button.dataset.id);
    });
    form.addEventListener('submit', save);
    document.addEventListener('click', event => {
        if (event.target.closest('[data-close-dialog]')) dialog.close();
        if (event.target.closest('#logout-button')) {
            request('/auth/logout', { method: 'POST', body: '{}' })
                .catch(() => undefined)
                .finally(() => { window.location.href = 'auth.html?mode=login'; });
        }
    });

    load();
})();
