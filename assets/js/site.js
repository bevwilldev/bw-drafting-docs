/* ============================================================================
   BW Western Sydney — Drafting Documentation
   Shared chrome (header/footer/sidenav), TOC scroll-spy, drawer, lightbox.

   WHY NAV-AS-DATA, NOT fetch()ed HTML PARTIALS:
   the navigation below is plain data, and the chrome is built in the DOM. That
   means the site works when opened straight off disk (file://) as well as over
   http — a fetch-based include would be blocked by CORS locally and would need
   a server just to look at a page. It also means one edit here updates every
   page's navigation.

   TO ADD A PAGE: add an entry to the relevant SECTIONS[...] items array.
   Paths are ROOT-RELATIVE and are rewritten for the deployed base path by
   `url()` below, so the same files work locally and on GitHub Pages.
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- Site structure ------------------------------------------- */

  var SECTIONS = {
    drafting: {
      title: 'Drafting',
      items: [
        { href: '/drafting/', text: 'Overview' },
        {
          group: 'Custom CAD Interface', items: [
            { href: '/drafting/interface/', text: 'Introduction' },
            { href: '/drafting/interface/installation/', text: 'Installation' },
            { href: '/drafting/interface/using/', text: 'Using the Ribbon' },
            { href: '/drafting/interface/troubleshooting/', text: 'Troubleshooting' }
          ]
        },
        {
          group: 'Drafting Standards', items: [
            { href: '/drafting/standards/', text: 'Overview' },
            { href: '/drafting/standards/wsy/', text: 'WSY Drafting Standards' }
          ]
        },
        {
          group: 'Command Reference', items: [
            { href: '/drafting/commands/', text: 'All Commands' },
            { href: '/drafting/commands/cadastre/', text: 'Cadastre' },
            { href: '/drafting/commands/survey/', text: 'Survey' },
            { href: '/drafting/commands/text/', text: 'Text &amp; Labels' },
            { href: '/drafting/commands/annotation/', text: 'Annotation &amp; Scales' },
            { href: '/drafting/commands/sheeting/', text: 'Sheeting' },
            { href: '/drafting/commands/dimensions/', text: 'Dimensions &amp; Curve Tables' },
            { href: '/drafting/commands/topography/', text: 'Topography &amp; Earthworks' },
            { href: '/drafting/commands/utilities/', text: 'Utilities' }
          ]
        }
      ]
    },
    survey: {
      title: 'Survey',
      items: [
        { href: '/survey/', text: 'Overview' },
        {
          group: 'Works-As-Executed', items: [
            { href: '/survey/wae/', text: 'Introduction' },
            { href: '/survey/wae/import-sheet/', text: 'Import Sheet' },
            { href: '/survey/wae/labels/', text: 'Preset Labels' },
            { href: '/survey/wae/text/', text: 'Horizontal &amp; Vertical Text' },
            { href: '/survey/wae/calculate-grade/', text: 'Calculate Grade' },
            { href: '/survey/wae/add-comment/', text: 'Add Comment' },
            { href: '/survey/wae/modify-text/', text: 'Modify &amp; Flip Text' }
          ]
        },
        {
          group: 'Field Tools', items: [
            { href: '/survey/lot-loader/', text: 'NSW Lot Loader' },
            { href: '/survey/point-cloud/', text: 'Point Cloud Digitizer' }
          ]
        }
      ]
    },
    engineering: {
      title: 'Engineering',
      items: [
        { href: '/engineering/', text: 'Overview' },
        { href: '/engineering/text/', text: 'Text &amp; Leaders' },
        { href: '/engineering/dimensions/', text: 'Dimensions' },
        { href: '/engineering/standards/', text: 'Styles &amp; Scales' },
        { href: '/engineering/plotting/', text: 'Plotting' }
      ]
    },
    onboarding: {
      title: 'Onboarding',
      items: [
        { href: '/onboarding/', text: 'Overview' },
        {
          group: 'BricsCAD', items: [
            { href: '/onboarding/bricscad/', text: 'Introduction to BricsCAD' },
            { href: '/onboarding/bricscad/learning/', text: 'Learning Resources' }
          ]
        },
        { href: '/onboarding/resources/', text: 'Spatial Data Resources' },
        { href: '/onboarding/glossary/', text: 'Glossary' }
      ]
    },
    quality: {
      title: 'Quality',
      items: [
        { href: '/quality/', text: 'Overview' },
        { href: '/quality/checklist/', text: 'Drawing Checklist' }
      ]
    }
  };

  var TOP_NAV = [
    { href: '/onboarding/', text: 'Onboarding' },
    { href: '/drafting/', text: 'Drafting' },
    { href: '/survey/', text: 'Survey' },
    { href: '/engineering/', text: 'Engineering' },
    { href: '/quality/', text: 'Quality' }
  ];

  /* ---------- Base-path handling ---------------------------------------
     On GitHub Pages a project site lives under /<repo>/, and opened from disk
     the pages live under a local folder. `BASE` is derived from this script's
     own src, so root-relative paths above work unchanged in both cases. */

  var BASE = (function () {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = 0; i < all.length; i++) {
        if (/assets\/js\/site\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    if (!s) return '';
    var base = s.src.replace(/assets\/js\/site\.js.*$/, '');
    return base.replace(/\/$/, '');
  })();

  function url(path) {
    if (/^(https?:|mailto:|#)/.test(path)) return path;
    return BASE + path;
  }

  /* Normalise a URL for "is this the current page?" comparison. */
  function normalise(href) {
    var a = document.createElement('a');
    a.href = href;
    var p = a.pathname.replace(/\/index\.html?$/, '/').replace(/\.html?$/, '/');
    if (!/\/$/.test(p)) p += '/';
    return p;
  }
  var HERE = normalise(location.href);

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- Header ---------------------------------------------------- */

  function buildHeader() {
    var host = document.querySelector('[data-header]');
    if (!host) return;

    var logo = el('a', { class: 'logo', href: url('/') }, [
      el('img', { src: url('/assets/img/bw-logo.svg'), alt: '' }),
      el('span', { class: 'logo-text', text: 'Beveridge Williams Western Sydney' })
    ]);

    var nav = el('nav', { class: 'nav', 'aria-label': 'Sections' });
    TOP_NAV.forEach(function (item) {
      var a = el('a', { href: url(item.href), html: item.text });
      // Mark the section active for any page beneath it.
      if (HERE.indexOf(normalise(url(item.href))) === 0) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    var burger = el('button', {
      class: 'icon-btn', id: 'navToggle', type: 'button',
      'aria-label': 'Open section navigation', 'aria-expanded': 'false',
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'
    });

    var theme = el('button', {
      class: 'icon-btn', id: 'themeToggle', type: 'button',
      'aria-label': 'Toggle dark mode', title: 'Toggle dark mode'
    });

    host.className = 'header';
    host.appendChild(el('div', { class: 'header-inner' }, [burger, logo, nav, theme]));
  }

  /* ---------- Sidebar --------------------------------------------------- */

  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

  function buildSidenav() {
    var host = document.querySelector('[data-sidenav]');
    if (!host) return;

    var key = host.getAttribute('data-sidenav');
    var section = SECTIONS[key];
    if (!section) {
      // No section nav on this page (e.g. the home page): drop the column so
      // the content isn't left beside an empty grid track.
      var layout = host.closest('.layout');
      if (layout) layout.classList.add('no-nav');
      host.remove();
      return;
    }

    host.className = 'sidenav';
    host.setAttribute('aria-label', section.title + ' navigation');
    host.appendChild(el('div', { class: 'sidenav-title', text: section.title }));

    section.items.forEach(function (item) {
      if (item.group) {
        var items = el('div', { class: 'nav-items' });
        var openByDefault = false;

        item.items.forEach(function (sub) {
          var a = el('a', { href: url(sub.href), html: sub.text });
          if (normalise(url(sub.href)) === HERE) {
            a.setAttribute('aria-current', 'page');
            openByDefault = true;
          }
          items.appendChild(a);
        });

        var btn = el('button', { type: 'button', html: '<span>' + item.group + '</span>' + CHEV });
        var group = el('div', { class: 'nav-group' }, [btn, items]);

        // Persist by GROUP NAME, not index — reordering the nav then can't
        // restore the wrong panel (a bug in the previous site).
        var storeKey = 'nav:' + key + ':' + item.group;
        var saved = null;
        try { saved = localStorage.getItem(storeKey); } catch (e) {}
        var open = openByDefault || saved === 'open';
        group.setAttribute('data-open', open ? 'true' : 'false');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');

        btn.addEventListener('click', function () {
          var nowOpen = group.getAttribute('data-open') !== 'true';
          group.setAttribute('data-open', nowOpen ? 'true' : 'false');
          btn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
          try { localStorage.setItem(storeKey, nowOpen ? 'open' : 'closed'); } catch (e) {}
        });

        host.appendChild(group);
      } else {
        var link = el('a', { href: url(item.href), html: item.text });
        if (normalise(url(item.href)) === HERE) link.setAttribute('aria-current', 'page');
        host.appendChild(link);
      }
    });
  }

  /* ---------- Footer ---------------------------------------------------- */

  function buildFooter() {
    var host = document.querySelector('[data-footer]');
    if (!host) return;
    host.className = 'footer';
    host.appendChild(el('div', { class: 'footer-inner' }, [
      el('span', { text: 'Drafting documentation — Western Sydney Drafting Department' }),
      el('span', { class: 'copyright', html: '&copy; ' + new Date().getFullYear() + ' Beveridge Williams' })
    ]));
  }

  /* ---------- On-page TOC (scroll-spy) ----------------------------------
     Uses IntersectionObserver rather than a scroll listener: no per-frame
     work, so scrolling stays smooth on long pages. */

  function buildToc() {
    var host = document.querySelector('[data-toc]');
    var content = document.querySelector('.content');
    if (!host || !content) return;

    var heads = content.querySelectorAll('h2, h3');
    var list = el('ul');
    var count = 0;

    Array.prototype.forEach.call(heads, function (h) {
      if (!h.id) {
        h.id = (h.textContent || '').toLowerCase().trim()
          .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
      }
      if (!h.id) return;
      var li = el('li', { class: 'lvl-' + h.tagName[1] }, [
        el('a', { href: '#' + h.id, text: h.textContent })
      ]);
      list.appendChild(li);
      count++;
    });

    if (!count) { host.classList.add('is-empty'); return; }

    host.className = 'toc';
    host.setAttribute('aria-label', 'On this page');
    host.appendChild(el('div', { class: 'toc-title', text: 'On this page' }));
    host.appendChild(list);

    var links = {};
    Array.prototype.forEach.call(host.querySelectorAll('a'), function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });

    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id);
      });
      // Highlight the first heading currently in view, in document order.
      var current = null;
      Array.prototype.some.call(heads, function (h) {
        if (visible.has(h.id)) { current = h.id; return true; }
        return false;
      });
      Object.keys(links).forEach(function (id) {
        links[id].classList.toggle('active', id === current);
      });
    }, { rootMargin: '-' + (parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--header-h'), 10) + 10) + 'px 0px -70% 0px' });

    Array.prototype.forEach.call(heads, function (h) { observer.observe(h); });
  }

  /* ---------- Mobile drawer --------------------------------------------- */

  function initDrawer() {
    var toggle = document.getElementById('navToggle');
    var nav = document.querySelector('.sidenav');
    if (!toggle) return;
    if (!nav) { toggle.style.display = 'none'; return; } // no section nav on this page

    var backdrop = el('div', { class: 'nav-backdrop' });
    document.body.appendChild(backdrop);

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      backdrop.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    backdrop.addEventListener('click', function () { setOpen(false); });
    // Following a link should close the drawer.
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- Theme toggle ---------------------------------------------- */

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';

  function initTheme() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    function current() {
      return document.documentElement.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    function paint() { btn.innerHTML = current() === 'dark' ? SUN : MOON; }
    paint();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      paint();
    });
  }

  /* ---------- Image lightbox -------------------------------------------- */

  function initLightbox() {
    var imgs = document.querySelectorAll('figure img, img.zoomable');
    if (!imgs.length) return;

    var pic = el('img', { alt: '' });
    var cap = el('figcaption');
    var close = el('button', { class: 'lightbox-close', type: 'button', 'aria-label': 'Close', html: '&times;' });
    var box = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true' },
      [close, el('div', {}, [pic, cap])]);
    document.body.appendChild(box);

    function hide() { box.classList.remove('is-open'); }

    Array.prototype.forEach.call(imgs, function (img) {
      img.addEventListener('click', function () {
        pic.src = img.currentSrc || img.src;
        pic.alt = img.alt || '';
        var figcap = img.closest('figure') && img.closest('figure').querySelector('figcaption');
        cap.textContent = figcap ? figcap.textContent : (img.alt || '');
        box.classList.add('is-open');
        close.focus();
      });
    });

    close.addEventListener('click', hide);
    box.addEventListener('click', function (e) { if (e.target === box) hide(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('is-open')) hide();
    });
  }

  /* ---------- Wide tables scroll instead of breaking the layout ---------- */

  function wrapTables() {
    var tables = document.querySelectorAll('.content table');
    Array.prototype.forEach.call(tables, function (t) {
      if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
      var wrap = el('div', { class: 'table-wrap' });
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  /* ---------- Boot ------------------------------------------------------- */

  function boot() {
    buildHeader();
    buildSidenav();
    buildFooter();
    wrapTables();
    buildToc();
    initDrawer();
    initTheme();
    initLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
