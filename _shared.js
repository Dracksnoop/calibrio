

(function () {
  'use strict';

  const lockScroll = () => { document.body.style.overflow = 'hidden'; };
  const unlockScroll = () => { document.body.style.overflow = ''; };

  const nav = document.querySelector('.nav');
  const burger = document.querySelector('.nav-burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  let menuOpen = false;

  // Pages that start with a dark hero use the transparent "dark" bar. It only reads over
  // that hero, so past it (and whenever the phone menu is open) fall back to the light bar.
  const darkHero = nav && nav.classList.contains('dark') ? document.querySelector('.hero, .thanks-hero') : null;
  const syncNavTheme = () => {
    if (!darkHero) return;
    const overHero = darkHero.getBoundingClientRect().bottom > nav.offsetHeight;
    nav.classList.toggle('dark', overHero && !menuOpen);
  };

  if (nav) {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80 || menuOpen) {
          nav.classList.remove('hidden');
        } else if (y > lastY + 6) {
          nav.classList.add('hidden');
        } else if (y < lastY - 6) {
          nav.classList.remove('hidden');
        }
        lastY = y;
        syncNavTheme();
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncNavTheme);
    syncNavTheme();
  }

  if (burger && mobileMenu) {
    const setMenu = (open) => {
      menuOpen = open;
      burger.classList.toggle('open', open);
      mobileMenu.classList.toggle('open', open);
      if (nav) {
        nav.classList.toggle('menu-open', open);
        if (open) nav.classList.remove('hidden');
      }
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      syncNavTheme();
    };
    burger.addEventListener('click', () => setMenu(!menuOpen));
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
    // Rotating / resizing past the phone layout must not leave the page scroll-locked.
    const desktop = window.matchMedia('(min-width: 861px)');
    const onDesktop = (e) => { if (e.matches && menuOpen) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else if (desktop.addListener) desktop.addListener(onDesktop);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -64px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }

  const form = document.querySelector('form.inquire-form');
  if (form) {
    const submit = form.querySelector('[type="submit"]');
    const choiceGroups = form.querySelectorAll('[data-choice-group]');

    choiceGroups.forEach((group) => {
      const name = group.dataset.choiceGroup;
      const hidden = form.querySelector(`input[type="hidden"][name="${name}"]`);
      group.querySelectorAll('button.choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const wasPressed = btn.getAttribute('aria-pressed') === 'true';
          group.querySelectorAll('button.choice').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          if (!wasPressed) {
            btn.setAttribute('aria-pressed', 'true');
            if (hidden) hidden.value = btn.dataset.value || btn.textContent.trim();
          } else {
            if (hidden) hidden.value = '';
          }
          validate();
        });
      });
    });

    const fields = form.querySelectorAll('.field [required]');
    fields.forEach((f) => f.addEventListener('input', validate));

    function validate() {
      let valid = true;
      fields.forEach((f) => {
        const ok = f.value.trim().length > 0;
        f.closest('.field').classList.toggle('invalid', !ok && f.dataset.touched === 'true');
        if (!ok) valid = false;
      });
      form.querySelectorAll('input[type="hidden"][data-required]').forEach((h) => {
        if (!h.value) valid = false;
      });
      if (submit) {
        submit.disabled = !valid;
        submit.style.opacity = valid ? '1' : '0.6';
        submit.style.cursor = valid ? 'pointer' : 'not-allowed';
        submit.style.background = valid ? 'var(--carmine)' : 'var(--smoke)';
      }
      return valid;
    }
    fields.forEach((f) => f.addEventListener('blur', () => { f.dataset.touched = 'true'; validate(); }));

    validate();
  }

  const yr = document.querySelectorAll('[data-year]');
  yr.forEach((el) => { el.textContent = new Date().getFullYear(); });

  // ==========================================================================
  // Photo lightbox for [data-lightbox] grids: shows the full photograph uncropped,
  // with prev / next, arrow keys, Escape and swipe.
  // ==========================================================================
  function initLightbox() {
    let box = null, imgEl = null, countEl = null, closeBtn = null;
    let items = [];
    let index = 0;
    let lastFocus = null;

    const icon = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';

    function build() {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Photo viewer');
      box.innerHTML =
        '<button type="button" class="lightbox-btn lightbox-close" aria-label="Close photo viewer">' + icon('M6 6l12 12M18 6L6 18') + '</button>' +
        '<button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous photo">' + icon('M15 5l-7 7 7 7') + '</button>' +
        '<figure class="lightbox-figure"><img class="lightbox-img" alt=""></figure>' +
        '<button type="button" class="lightbox-btn lightbox-next" aria-label="Next photo">' + icon('M9 5l7 7-7 7') + '</button>' +
        '<div class="lightbox-count" aria-live="polite"></div>';
      document.body.appendChild(box);

      imgEl = box.querySelector('.lightbox-img');
      countEl = box.querySelector('.lightbox-count');
      closeBtn = box.querySelector('.lightbox-close');

      closeBtn.addEventListener('click', close);
      box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
      box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
      // A click on the dark backdrop (anything that is not the photo or a button) closes.
      box.addEventListener('click', (e) => {
        if (e.target === imgEl || e.target.closest('.lightbox-btn')) return;
        close();
      });

      let startX = 0, startY = 0, tracking = false;
      box.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { tracking = false; return; }
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
      }, { passive: true });

      document.addEventListener('keydown', (e) => {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') show(index + 1);
        else if (e.key === 'ArrowLeft') show(index - 1);
        else if (e.key === 'Tab') {
          // keep focus on the viewer's own buttons
          const btns = Array.from(box.querySelectorAll('.lightbox-btn'));
          const at = btns.indexOf(document.activeElement);
          e.preventDefault();
          btns[(at + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        }
      });
    }

    function show(i) {
      index = (i + items.length) % items.length;
      const link = items[index];
      const thumb = link.querySelector('img');
      const src = link.getAttribute('href');
      imgEl.classList.add('is-loading');
      const pre = new Image();
      pre.onload = pre.onerror = () => {
        if (items[index] !== link) return; // user already moved on
        imgEl.src = src;
        imgEl.alt = thumb ? thumb.alt : '';
        imgEl.classList.remove('is-loading');
      };
      pre.src = src;
      countEl.textContent = (index + 1) + ' / ' + items.length;
      // warm the neighbours so swiping feels instant
      [1, -1].forEach((d) => { new Image().src = items[(index + d + items.length) % items.length].getAttribute('href'); });
    }

    function open(grid, link) {
      if (!box) build();
      items = Array.from(grid.querySelectorAll('a[href]'));
      lastFocus = link;
      show(Math.max(0, items.indexOf(link)));
      box.classList.add('is-open');
      lockScroll();
      closeBtn.focus({ preventScroll: true });
    }

    function close() {
      if (!box.classList.contains('is-open')) return;
      box.classList.remove('is-open');
      unlockScroll();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    // Delegated, so it covers every [data-lightbox] grid on the page.
    document.addEventListener('click', (e) => {
      const link = e.target.closest ? e.target.closest('[data-lightbox] a[href]') : null;
      if (!link) return;
      // let modified clicks (new tab etc.) behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      open(link.closest('[data-lightbox]'), link);
    });
  }

  // ==========================================================================
  // 1. Scroll-To-Top Button Controller
  // ==========================================================================
  function initScrollToTop() {
    let topBtn = document.getElementById('scrollToTopBtn');
    if (!topBtn) {
      topBtn = document.createElement('button');
      topBtn.type = 'button';
      topBtn.className = 'scroll-to-top-btn';
      topBtn.id = 'scrollToTopBtn';
      topBtn.setAttribute('aria-label', 'Scroll back to top');
      topBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
      document.body.appendChild(topBtn);
    }

    const onScrollTop = () => {
      if (window.scrollY > 300) {
        topBtn.classList.add('is-visible');
      } else {
        topBtn.classList.remove('is-visible');
      }
    };

    window.addEventListener('scroll', onScrollTop, { passive: true });
    onScrollTop();

    topBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initLightbox();
      initScrollToTop();
    });
  } else {
    initLightbox();
    initScrollToTop();
  }

})();