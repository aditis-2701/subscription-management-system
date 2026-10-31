(() => {
	const slides = Array.from(document.querySelectorAll('.slide'));
	const dots = Array.from(document.querySelectorAll('.slider-dots .dot'));
	const modal = document.getElementById('roleModal');
	const modalTitle = document.getElementById('modalTitle');
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let activeSlide = 0;
	let modalMode = 'login';
	let previousFocus = null;
	let slideTimer = null;

	async function apiRequest(path, options = {}) {
		const response = await fetch(`/api${path}`, {
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			...options
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.message || 'The request failed.');
		return data;
	}

	function showSlide(index) {
		if (!slides.length) return;

		activeSlide = (Number(index) + slides.length) % slides.length;
		slides.forEach((slide, slideIndex) => {
			const isActive = slideIndex === activeSlide;
			slide.classList.toggle('active', isActive);
			slide.setAttribute('aria-hidden', String(!isActive));
		});
		dots.forEach((dot, dotIndex) => {
			const isActive = dotIndex === activeSlide;
			dot.classList.toggle('active', isActive);
			dot.setAttribute('aria-pressed', String(isActive));
		});
	}

	function startSlideTimer() {
		window.clearInterval(slideTimer);
		if (!reducedMotion.matches && slides.length > 1) {
			slideTimer = window.setInterval(() => showSlide(activeSlide + 1), 6000);
		}
	}

	function openModal(mode) {
		if (!modal) return;

		modalMode = mode === 'register' ? 'register' : 'login';
		previousFocus = document.activeElement;
		if (modalTitle) {
			modalTitle.textContent = modalMode === 'register'
				? 'Create your Brightloop account'
				: 'Welcome back to Brightloop';
		}
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		modal.querySelector('.close-btn')?.focus();
	}

	function closeModal() {
		if (!modal) return;

		modal.style.display = 'none';
		modal.setAttribute('aria-hidden', 'true');
		previousFocus?.focus();
	}

	function selectRole(role) {
		const roleSlugs = {
			admin: 'admin',
			administrator: 'admin',
			employee: 'manager',
			staff: 'manager',
			customer: 'customer'
		};
		const selectedRole = roleSlugs[String(role).toLowerCase()];
		if (!selectedRole) return;

		const params = new URLSearchParams({ mode: modalMode, role: selectedRole });
		window.location.href = `auth.html?${params.toString()}`;
	}

	window.showSlide = showSlide;
	window.openModal = openModal;
	window.closeModal = closeModal;
	window.selectRole = selectRole;
	window.apiRequest = apiRequest;

	dots.forEach((dot, index) => {
		dot.setAttribute('role', 'button');
		dot.setAttribute('tabindex', '0');
		dot.setAttribute('aria-label', `Show slide ${index + 1}`);
		dot.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				showSlide(index);
			}
		});
	});

	document.querySelectorAll('.role-option').forEach(option => {
		option.setAttribute('role', 'button');
		option.setAttribute('tabindex', '0');
		option.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				option.click();
			}
		});
	});

	modal?.addEventListener('click', event => {
		if (event.target === modal) closeModal();
	});

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && modal?.getAttribute('aria-hidden') === 'false') closeModal();
	});

	document.querySelector('.hero')?.addEventListener('mouseenter', () => window.clearInterval(slideTimer));
	document.querySelector('.hero')?.addEventListener('mouseleave', startSlideTimer);
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) window.clearInterval(slideTimer);
		else startSlideTimer();
	});
	reducedMotion.addEventListener?.('change', startSlideTimer);

	showSlide(0);
	startSlideTimer();
})();
