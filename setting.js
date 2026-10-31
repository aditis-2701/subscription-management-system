<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>Brightloop | Settings</title>
    <link rel="stylesheet" href="css/dashboard.css">
    <script src="setting.js" defer></script>
</head>
<body class="dashboard-body">
    <div class="app-shell">
        <aside class="sidebar" aria-label="Main navigation">
            <a class="brand" href="dashboard.html"><span class="brand-mark">B</span><span>brightloop</span></a>
            <p class="sidebar-label">WORKSPACE</p>
            <nav class="side-nav">
                <a class="nav-item" href="dashboard.html"><span class="nav-symbol">O</span>Overview</a>
                <a class="nav-item" href="customers.html"><span class="nav-symbol">C</span>Customers</a>
                <a class="nav-item" href="products.html"><span class="nav-symbol">P</span>Products &amp; plans</a>
                <a class="nav-item" href="subscriptions.html"><span class="nav-symbol">S</span>Subscriptions</a>
                <a class="nav-item" href="invoices.html"><span class="nav-symbol">I</span>Invoices</a>
                <a class="nav-item" href="payments.html"><span class="nav-symbol">$</span>Payments</a>
                <a class="nav-item" href="reports.html"><span class="nav-symbol">R</span>Reports</a>
            </nav>
            <div class="sidebar-bottom">
                <p class="sidebar-label">ACCOUNT</p>
                <a class="side-link" href="setting.html" aria-current="page">Settings</a>
                <a class="side-link" href="index.html">Back to website</a>
                <button class="side-link" id="logout-button" type="button">Sign out</button>
            </div>
        </aside>

        <main class="main-panel">
            <header class="topbar">
                <div><p class="eyebrow" id="company-name">BUSINESS WORKSPACE</p><h1>Settings</h1></div>
                <div class="account-chip"><span class="avatar" id="user-initials">BL</span><span><strong id="user-name">Loading account</strong><small id="user-role">Workspace</small></span></div>
            </header>
            <section id="settings-content" aria-live="polite" aria-busy="true">
                <div class="view-heading"><div><h2>Account profile</h2><p>Update your profile and business workspace details.</p></div></div>
                <div class="panel">
                    <form id="profile-form">
                        <div class="dialog-fields">
                            <div class="field"><label for="profile-name">Name</label><input id="profile-name" name="name" type="text" minlength="2" autocomplete="name" required></div>
                            <div class="field"><label for="profile-company">Company</label><input id="profile-company" name="company" type="text" autocomplete="organization" required></div>
                            <div class="field"><label for="profile-email">Email</label><input id="profile-email" name="email" type="email" readonly aria-readonly="true"></div>
                            <div class="field"><label for="profile-role">Role</label><input id="profile-role" name="role" type="text" readonly aria-readonly="true"></div>
                            <div class="field"><label for="profile-phone">Phone</label><input id="profile-phone" name="phone" type="tel" autocomplete="tel" maxlength="40"></div>
                        </div>
                        <p class="form-error" id="form-error" role="alert" hidden></p>
                        <footer class="dialog-actions"><button class="button-primary" id="save-profile" type="submit">Save profile</button></footer>
                    </form>
                </div>
                <p class="form-error" id="page-error" role="alert" hidden></p>
            </section>
        </main>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>
</html>
