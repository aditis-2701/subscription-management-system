(() => {
    const content = document.getElementById('payments-content');
    const table = document.getElementById('payment-table');
    const dialog = document.getElementById('payment-dialog');
    const form = document.getElementById('payment-form');
    const toast = document.getElementById('toast');
    const state = { customers: [], invoices: [], payments: [] };
    let toastTimer;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
    const today = () => new Date().toISOString().slice(0, 10);
    const customerFor = id => state.customers.find(customer => customer.id === id);
    const invoiceFor = id => state.invoices.find(invoice => invoice.id === id);

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

    function invoiceBalance(invoice) {
        const paid = state.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
        return Math.max(0, Math.round((Number(invoice.total) - paid) * 100) / 100);
    }

    function notify(message) {
        toast.textContent = message;
        toast.classList.add('visible');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    function render() {
        const search = document.getElementById('payment-search').value.trim().toLowerCase();
        const method = document.getElementById('payment-method-filter').value;
        const from = document.getElementById('payment-from').value;
        const to = document.getElementById('payment-to').value;
        const visible = state.payments.filter(payment => {
            const invoice = invoiceFor(payment.invoiceId);
            const customer = invoice && customerFor(invoice.customerId);
            const searchable = `${invoice?.invoiceNumber || ''} ${customer?.name || ''} ${customer?.email || ''}`.toLowerCase();
            return (!search || searchable.includes(search)) && (!method || payment.method === method) && (!from || payment.date >= from) && (!to || payment.date <= to);
        }).sort((a, b) => b.date.localeCompare(a.date));
        const totalCollected = state.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const outstanding = state.invoices.filter(invoice => invoice.status !== 'canceled').reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
        const openInvoices = state.invoices.filter(invoice => invoice.status !== 'canceled' && invoiceBalance(invoice) > 0);
        document.getElementById('payment-summary').textContent = `${visible.length} of ${state.payments.length} payment records · ${openInvoices.length} invoices with balances`;
        document.getElementById('payment-metrics').innerHTML = `<article class="metric"><div class="metric-label">Total collected</div><div class="metric-value">${money(totalCollected)}</div><div class="metric-foot">Recorded payments</div></article><article class="metric"><div class="metric-label">Outstanding balance</div><div class="metric-value">${money(outstanding)}</div><div class="metric-foot">Across open invoices</div></article><article class="metric"><div class="metric-label">Payment records</div><div class="metric-value">${state.payments.length}</div><div class="metric-foot">All payment methods</div></article><article class="metric"><div class="metric-label">Invoices to collect</div><div class="metric-value">${openInvoices.length}</div><div class="metric-foot">With remaining balances</div></article>`;
        content.setAttribute('aria-busy', 'false');

        if (!visible.length) {
            const filtered = search || method || from || to;
            table.innerHTML = `<div class="empty-state"><strong>${filtered ? 'No matching payments' : 'No payments recorded'}</strong>${filtered ? 'Adjust your filters to see other payments.' : 'Record a payment against an open invoice to begin.'}</div>`;
            return;
        }

        table.innerHTML = `<table><thead><tr><th>Customer / invoice</th><th>Method</th><th>Date</th><th>Amount</th><th>Invoice status</th><th>Remaining balance</th></tr></thead><tbody>${visible.map(payment => {
            const invoice = invoiceFor(payment.invoiceId);
            const customer = invoice && customerFor(invoice.customerId);
            const balance = invoice ? invoiceBalance(invoice) : 0;
            const status = invoice?.status || 'unknown';
            return `<tr><td><span class="cell-title">${escapeHtml(customer?.name || 'Unknown customer')}</span><span class="cell-note">${escapeHtml(invoice?.invoiceNumber || '')}</span></td><td>${escapeHtml(payment.method.replaceAll('_', ' '))}</td><td>${new Date(`${payment.date}T00:00:00`).toLocaleDateString()}</td><td><strong>${money(payment.amount)}</strong></td><td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status.replaceAll('_', ' '))}</span></td><td>${money(balance)}</td></tr>`;
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
            table.innerHTML = '<div class="empty-state"><strong>Could not load payments</strong>Check your connection and try again.</div>';
            content.setAttribute('aria-busy', 'false');
        }
    }

    function updatePreview() {
        const invoice = invoiceFor(form.elements.invoiceId.value);
        if (!invoice) return;
        const outstanding = invoiceBalance(invoice);
        const amount = Number(form.elements.amount.value || 0);
        const remaining = Math.max(0, Math.round((outstanding - amount) * 100) / 100);
        document.getElementById('payment-preview').innerHTML = `<div class="calculation-line"><span>Current balance</span><strong>${money(outstanding)}</strong></div><div class="calculation-line"><span>This payment</span><strong>−${money(amount)}</strong></div><div class="calculation-line total"><span>Balance after payment</span><strong>${money(remaining)}</strong></div>`;
    }

    function openForm() {
        const invoices = state.invoices.filter(invoice => invoice.status !== 'canceled' && invoiceBalance(invoice) > 0);
        if (!invoices.length) return notify('There are no open invoice balances to collect.');
        form.reset();
        document.getElementById('form-error').hidden = true;
        document.getElementById('form-error').textContent = '';
        form.elements.invoiceId.innerHTML = invoices.map(invoice => {
            const customer = customerFor(invoice.customerId);
            return `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoiceNumber)} · ${escapeHtml(customer?.name || 'Customer')} · ${money(invoiceBalance(invoice))} due</option>`;
        }).join('');
        form.elements.amount.max = String(invoiceBalance(invoices[0]));
        form.elements.amount.value = '';
        form.elements.date.value = today();
        updatePreview();
        dialog.showModal();
        form.elements.amount.focus();
    }

    async function save(event) {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        const error = document.getElementById('form-error');
        submit.disabled = true;
        error.hidden = true;
        try {
            const payload = {
                invoiceId: form.elements.invoiceId.value,
                amount: Number(form.elements.amount.value),
                method: form.elements.method.value,
                date: form.elements.date.value
            };
            await request('/payments', { method: 'POST', body: JSON.stringify(payload) });
            dialog.close();
            await load();
            notify('Payment recorded and invoice balance updated.');
        } catch (requestError) {
            error.textContent = requestError.message;
            error.hidden = false;
        } finally {
            submit.disabled = false;
        }
    }

    document.getElementById('add-payment').addEventListener('click', openForm);
    ['payment-search', 'payment-from', 'payment-to'].forEach(id => document.getElementById(id).addEventListener('input', render));
    document.getElementById('payment-method-filter').addEventListener('change', render);
    form.elements.invoiceId.addEventListener('change', () => {
        const invoice = invoiceFor(form.elements.invoiceId.value);
        form.elements.amount.max = invoice ? String(invoiceBalance(invoice)) : '';
        updatePreview();
    });
    form.elements.amount.addEventListener('input', updatePreview);
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
