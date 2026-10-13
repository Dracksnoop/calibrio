

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

  // ==========================================================================
  // Sending an inquiry — shared by the Investment form and the homepage letter form.
  // The note is posted in the background to the site's mail script. Where that script
  // cannot run (a static host or preview), the note is handed to the visitor's own
  // email app instead, so nobody is ever left on an error page.
  // ==========================================================================
  const INQUIRY_EMAIL = 'thyzfoto@gmail.com';

  // The same answers as an email draft: one "Label: answer" line per field, then the message.
  function inquiryMailto(form) {
    const value = (name) => { const el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ''; };
    const rows = [];
    let details = '';
    form.querySelectorAll('.field').forEach((field) => {
      const control = field.querySelector('input[name]:not([name^="_"]), textarea[name]');
      if (!control || !control.value.trim()) return;
      if (control.name === 'details') { details = control.value.trim(); return; }
      const labelEl = field.querySelector('label, .field-label');
      let label = labelEl ? labelEl.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim() : control.name;
      label = (label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()).replace(/[?:]$/, '');
      rows.push(label + ': ' + control.value.trim());
    });
    const name = value('fullName');
    const subject = (value('_subject') || 'New wedding inquiry — Thyzfoto') + (name ? ' — ' + name : '');
    const body = 'Dear Uriel,\n\n' + rows.join('\n') + (details ? '\n\n' + details : '') + '\n';
    return 'mailto:' + (form.dataset.mailto || INQUIRY_EMAIL) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  // Resolves { sent: true, next } when the mail script took the note (it answers by
  // redirecting to the thank-you page), otherwise { sent: false, mailto }.
  function sendInquiry(form) {
    const endpoint = form.getAttribute('action');
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 20000) : null;
    const post = endpoint
      ? fetch(endpoint, { method: 'POST', body: new URLSearchParams(new FormData(form)), signal: ctl ? ctl.signal : undefined })
      : Promise.reject(new Error('no endpoint'));
    return post
      .then((res) => {
        if (res.ok && /\/thank-you\/?(\?|#|$)/.test(res.url)) return { sent: true, next: res.url };
        throw new Error('not sent');
      })
      .catch(() => ({ sent: false, mailto: inquiryMailto(form) }))
      .then((result) => { if (timer) clearTimeout(timer); return result; });
  }

  window.ThyzInquiry = { send: sendInquiry, email: INQUIRY_EMAIL };

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

    // The Investment form sends in the background. (The homepage letter form shares the
    // validation above but has its own submit handler and success panel.)
    if (!form.classList.contains('approach-form')) {
      const status = document.createElement('p');
      status.className = 'form-status';
      status.setAttribute('role', 'status');
      status.hidden = true;
      const foot = form.querySelector('.form-foot');
      if (foot) foot.insertAdjacentElement('afterend', status); else form.appendChild(status);

      let sending = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (sending) return;
        fields.forEach((f) => { f.dataset.touched = 'true'; });
        if (!validate()) return;

        sending = true;
        status.hidden = true;
        const label = submit ? submit.innerHTML : '';
        if (submit) { submit.disabled = true; submit.style.cursor = 'progress'; submit.textContent = 'Sending…'; }

        sendInquiry(form).then((result) => {
          if (result.sent) { window.location.href = result.next; return; }

          // This host could not send it: hand the note to the visitor's email app and say so.
          sending = false;
          if (submit) submit.innerHTML = label;
          validate();
          const open = document.createElement('a');
          open.href = result.mailto;
          open.textContent = 'open it here';
          const address = document.createElement('a');
          address.href = 'mailto:' + INQUIRY_EMAIL;
          address.textContent = INQUIRY_EMAIL;
          status.textContent = '';
          status.append(
            'This page couldn’t send your note directly, so it is waiting in your email app, ready to go. ' +
            'Press send there and it will reach me. If no email app opened, ', open, ' or write to ', address, '.');
          status.hidden = false;
          window.location.href = result.mailto;
        });
      });
    }
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