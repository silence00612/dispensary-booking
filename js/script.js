document.addEventListener('DOMContentLoaded', () => {

  // ===== Мобильное меню (бургер) =====
  const burgerBtn = document.getElementById('burgerBtn');
  const navbar = document.getElementById('navbar');
  const navOverlay = document.getElementById('navOverlay');

  function closeMenu() {
    burgerBtn.classList.remove('is-active');
    navbar.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function toggleMenu() {
    const isOpen = navbar.classList.toggle('is-open');
    burgerBtn.classList.toggle('is-active', isOpen);
    navOverlay.classList.toggle('is-open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  if (burgerBtn) {
    burgerBtn.addEventListener('click', toggleMenu);
  }
  if (navOverlay) {
    navOverlay.addEventListener('click', closeMenu);
  }

  // Закрываем меню при клике на пункт навигации (мобильная версия)
  document.querySelectorAll('.navbar__link, .navbar__mobile-link, .navbar__mobile-btn').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Закрытие по Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // ===== Подсветка активного пункта меню при прокрутке =====
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.navbar__link');

  function updateActiveLink() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}`) {
        link.classList.add('active');
      }
    });

    // Если в самом верху страницы — подсвечиваем "Главная"
    if (window.scrollY < 200) {
      navLinks.forEach(l => l.classList.remove('active'));
      const homeLink = document.querySelector('.navbar__link[href="#"]');
      if (homeLink) homeLink.classList.add('active');
    }
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  // ===== Маска телефона =====
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let digits = e.target.value.replace(/\D/g, '');
      if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = digits.slice(1);
      }
      digits = digits.slice(0, 10);

      let formatted = '+7';
      if (digits.length > 0) formatted += ` (${digits.slice(0, 3)}`;
      if (digits.length >= 3) formatted += `) `;
      if (digits.length > 3) formatted += digits.slice(3, 6);
      if (digits.length >= 6) formatted += `-`;
      if (digits.length > 6) formatted += digits.slice(6, 8);
      if (digits.length >= 8) formatted += `-`;
      if (digits.length > 8) formatted += digits.slice(8, 10);

      e.target.value = formatted;
    });
  }

});
