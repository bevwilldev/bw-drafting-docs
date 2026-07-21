/* ============================================================================
   Western Sydney Hub — Beveridge Williams
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
    'getting-started': {
      title: 'Getting Started',
      items: [
        { href: '/getting-started/', text: 'Installation' }
      ]
    },
    drafting: {
      title: 'Drafting',
      items: [
        { href: '/drafting/', text: 'Overview' },
        {
          group: 'Custom CAD Interface', items: [
            { href: '/drafting/interface/', text: 'Introduction' },
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
        /* The command reference is no longer a drafting sub-section — it is a
           shared, suite-wide library at /commands/. This is the way in from
           here; the full panel list lives in the `commands` section below. */
        { href: '/commands/drafting/cadastre/', text: 'Drafting Commands' }
      ]
    },
    /* The shared command library. Grouped by ribbon TAB, then by the panels
       each tab actually ships — read off the .cui ribbon definitions, not
       invented here, so the navigation matches what people see in BricsCAD.
       Every tab also gets a "No ribbon button" page: a large part of the suite
       is command-line only and would otherwise have nowhere to live. */
    commands: {
      title: 'Command Reference',
      items: [
        { href: '/commands/', text: 'All Commands' },
        {
          group: 'WSY Drafting', items: [
            { href: '/commands/drafting/cadastre/', text: 'Cadastre' },
            { href: '/commands/drafting/survey/', text: 'Survey' },
            { href: '/commands/drafting/occupations/', text: 'Occupations' },
            { href: '/commands/drafting/topography/', text: 'Topography' },
            { href: '/commands/drafting/setout/', text: 'Setout &amp; Ident' },
            { href: '/commands/drafting/text/', text: 'Text' },
            { href: '/commands/drafting/sheeting/', text: 'Sheeting' },
            { href: '/commands/drafting/annotation/', text: 'Annotation' },
            { href: '/commands/drafting/qa/', text: 'QA' },
            { href: '/commands/drafting/command-line/', text: 'No ribbon button' }
          ]
        },
        {
          group: 'BW Engineering', items: [
            { href: '/commands/engineering/standards/', text: 'Standards' },
            { href: '/commands/engineering/annotation/', text: 'Annotation' },
            { href: '/commands/engineering/plotting/', text: 'Plotting' },
            { href: '/commands/engineering/open/', text: 'Open' },
            { href: '/commands/engineering/toolbox/', text: 'Toolbox' }
          ]
        },
        {
          group: 'WSY WAE', items: [
            { href: '/commands/wae/sheeting/', text: 'Sheeting' },
            { href: '/commands/wae/annotations/', text: 'Annotations' }
          ]
        },
        {
          group: 'WSY Tools', items: [
            { href: '/commands/tools/tools/', text: 'Tools' },
            { href: '/commands/tools/command-line/', text: 'No ribbon button' }
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
        { href: '/tools/', text: 'Office Tools' }
      ]
    },
    tools: {
      title: 'Office Tools',
      items: [
        { href: '/tools/', text: 'Overview' },
        { href: '/tools/lot-loader/', text: 'NSW Lot Loader' },
        { href: '/tools/point-cloud/', text: 'Point Cloud Digitizer' }
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
    videos: {
      title: 'Video Guides',
      items: [
        { href: '/videos/', text: 'Watch the guides' }
      ]
    },
    quality: {
      title: 'Quality',
      items: [
        { href: '/quality/', text: 'Overview' },
        { href: '/quality/checklist/', text: 'Drawing Checklist' }
      ]
    },
    about: {
      title: 'About',
      items: [
        { href: '/about/', text: 'About this Hub' }
      ]
    }
  };

  /* Ordered by how the site is actually used, not by how it grew:
       entry point   — Getting Started (the CTA; nothing works before it)
       daily lookup  — Commands, Videos ("how do I do X again?")
       disciplines   — Drafting, Survey, Engineering, Tools
       process       — Quality
       once, at the start — Onboarding
     Onboarding sat third for historical reasons despite being the thing most
     people read exactly once. */
  var TOP_NAV = [
    { href: '/getting-started/', text: 'Getting Started', cta: true },
    { href: '/commands/', text: 'Commands' },
    { href: '/videos/', text: 'Videos' },
    { href: '/drafting/', text: 'Drafting' },
    { href: '/survey/', text: 'Survey' },
    { href: '/engineering/', text: 'Engineering' },
    { href: '/tools/', text: 'Tools' },
    { href: '/quality/', text: 'Quality' },
    { href: '/onboarding/', text: 'Onboarding' }
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

  /* The logo is inlined rather than <img src="bw-logo.svg">, because page CSS
     cannot reach inside an <img>-referenced SVG — the monogram would stay black
     and disappear against the dark background. Inlined, its currentColor fills
     inherit .logo's colour, so it tracks the site's own theme TOGGLE, not just
     the OS preference an internal media query could see.
     Artwork is duplicated from assets/img/bw-logo.svg (still used as the
     favicon); if the mark ever changes, update both. */
  var LOGO_SVG =
    '<svg class="logo-mark" viewBox="0 0 724.67 626.09" xmlns="http://www.w3.org/2000/svg"' +
    ' aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="bwLogoClipA"><path d="M 0,707.883 H 841.89 V 0 H 0 Z"/></clipPath>' +
    '<clipPath id="bwLogoClipB"><path d="M 0,707.883 H 841.89 V 0 H 0 Z"/></clipPath></defs>' +
    '<g transform="matrix(1.3333 0 0 -1.3333 -314.09 742.15)">' +
    '<g transform="translate(81.898 -80.561)">' +
    '<path fill="currentColor" transform="translate(9.5004 -10.013)" d="m667.9 647.16-24.097-301h-45.519l-1e-3 -20.668 43.869 4e-3 -11.839-147.88-67.603-2e-3 -14.998 234.78-15.059-234.78-67.618-2e-3 -37.524 469.55 56.329 0.021 18.758-234.78 11.253 234.76h67.624l11.279-234.76 18.804 234.78z" clip-path="url(#bwLogoClipB)"/>' +
    '<path fill="currentColor" d="m651.64 315.48 1.655 20.669h43.868v-20.669z"/>' +
    '<path transform="matrix(.99946 0 0 .99994 9.5741 -9.9875)" d="m237.52 631.43c-2.8798 1.1e-4 -5.2124-2.3418-5.2084-5.2156 4e-3 -2.8738 2.3342-5.1999 5.207-5.2049 3.3316-2e-3 8.5162-9e-3 11.03-0.0117 10.721-0.0922 16.718-10.446 13.784-18.986l-73.528-226.29c-4.8456-14.995-19.036-23.262-30.165-24.224-1.1111-0.10097-2.2246-0.1395-3.3353-0.11188-1.7304 0.0461-3.4079 0.0189-5.7328 0.0134-3.0461 0.0944-5.403-2.3476-5.403-5.2292-4e-3 -2.8748 2.3324-5.2148 5.2148-5.2148h188.72c49.733-0.21187 89.154 36.269 96.386 83.924l1.0463 8.5778c3.099 33.031-19.356 58.409-47.118 63.522l-10.897 2.0918c15.514 6.2486 41.226 19.496 57.084 29.795 14.506 8.855 23.318 28.495 23.028 43.35-0.63477 32.528-26.478 59.212-59.543 59.213zm80.86-10.369c22.062-4e-3 44.602 0.0365 54.617 0.0405 10.015 4e-3 11.819-0.0433 12.65-0.13462 23.444-2.6503 34.791-23.178 33.314-40.046-0.10114-1.118-0.21226-2.3185-0.31294-3.436-3.3486-41.545-39.772-74.645-81.454-74.195-21.711-0.013-44.651-0.0295-66.821-0.0358 11.65 35.893 23.686 73.205 35.058 108.25 1.7903 5.5194 6.9119 9.5036 12.949 9.5611zm-15.906-269.68-55.559-7e-3c-1.7472-0.0535-4.2246 0.36643-5.7392 0.90042-9.8513 3.0863-15.32 13.747-12.101 23.64 12.65 38.932 25.233 77.966 37.884 116.9 24.75-0.0158 49.944 2e-3 73.556-0.0668 24.53-0.62635 50.828-20.218 49.034-57.228-1.6805-48.441-41.881-83.78-87.075-84.137z" clip-path="url(#bwLogoClipA)" fill="var(--brand-mark)"/>' +
    '</g></g></svg>';

  function buildHeader() {
    var host = document.querySelector('[data-header]');
    if (!host) return;

    var logo = el('a', { class: 'logo', href: url('/'), html: LOGO_SVG }, []);
    logo.appendChild(
      el('span', { class: 'logo-text', text: 'Beveridge Williams Western Sydney' })
    );

    var nav = el('nav', { class: 'nav', 'aria-label': 'Sections' });
    TOP_NAV.forEach(function (item) {
      var a = el('a', { href: url(item.href), html: item.text });
      if (item.cta) a.className = 'nav-cta';   // stands out as the entry point
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

    host.className = 'sidenav';
    host.setAttribute('aria-label', section ? section.title + ' navigation' : 'Site navigation');

    /* Below 1000px the header nav is hidden — seven links plus the logo and
       toggles cannot fit a phone without overflowing the page sideways. The
       top-level sections are repeated here instead, so the drawer is the single
       place navigation lives on small screens. Hidden by CSS on desktop. */
    var top = el('div', { class: 'sidenav-sections' });
    top.appendChild(el('div', { class: 'sidenav-title', text: 'Sections' }));
    TOP_NAV.forEach(function (item) {
      var a = el('a', { href: url(item.href), html: item.text });
      if (HERE.indexOf(normalise(url(item.href))) === 0) a.setAttribute('aria-current', 'page');
      top.appendChild(a);
    });
    host.appendChild(top);

    if (!section) {
      // Home page: no section nav, so the aside is drawer-only. The grid drops
      // to two columns and CSS hides the aside entirely above the breakpoint.
      host.classList.add('is-drawer-only');
      var layout = host.closest('.layout');
      if (layout) layout.classList.add('no-nav');
      return;
    }

    host.appendChild(el('div', { class: 'sidenav-title', text: section.title }));

    section.items.forEach(function (item) {
      if (item.group) {
        // The inner wrapper is what the 0fr -> 1fr open animation clips
        // against; without it the panel cannot animate to its true height.
        var inner = el('div', { class: 'nav-items-inner' });
        var items = el('div', { class: 'nav-items' }, [inner]);
        var openByDefault = false;

        item.items.forEach(function (sub) {
          var a = el('a', { href: url(sub.href), html: sub.text });
          if (normalise(url(sub.href)) === HERE) {
            a.setAttribute('aria-current', 'page');
            openByDefault = true;
          }
          inner.appendChild(a);
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
      el('span', {
        html: 'Built and maintained by the <a href="' + url('/about/') +
              '">Western Sydney Drafting department</a>'
      }),
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
    if (!toggle || !nav) return;

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
    /* Dark is the site's default, so an unset attribute means dark — NOT
       "ask the OS". Reading prefers-color-scheme here would report 'light' on a
       light-themed machine while the page rendered dark, which put the wrong
       icon in the header and made the first click appear to do nothing. */
    function current() {
      return document.documentElement.getAttribute('data-theme') || 'dark';
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

  /* ---------- Command filter ---------------------------------------------
     The reference documents ~70 commands across eight panel pages, so the
     alphabetical index is the place people actually look one up. Filtering it
     in the page beats Ctrl-F, which only searches whichever page you guessed.

     Matches on both the command name and its description, so "curve" finds
     CURVETABLE and also DIMLAB ("numbered curve label bubbles"). */

  function initFilter() {
    var input = document.querySelector('input[data-filters]');
    if (!input) return;
    var table = document.getElementById(input.getAttribute('data-filters'));
    if (!table) return;

    var wrap = input.closest('.cmd-filter');
    var count = document.querySelector('[data-filter-count]');
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);

    // Cache the searchable text and pristine markup once, rather than reading
    // textContent for every row on every keystroke.
    var items = rows.map(function (row) {
      return {
        row: row,
        hay: (row.textContent || '').toLowerCase(),
        cells: Array.prototype.map.call(row.cells, function (c) { return c.innerHTML; })
      };
    });

    function clearMarks(item) {
      Array.prototype.forEach.call(item.row.cells, function (cell, i) {
        if (cell.innerHTML !== item.cells[i]) cell.innerHTML = item.cells[i];
      });
    }

    // Highlight only in text nodes, so we never corrupt the <a>/<code> markup.
    function mark(item, term) {
      Array.prototype.forEach.call(item.row.cells, function (cell) {
        var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
        var texts = [], n;
        while ((n = walker.nextNode())) texts.push(n);
        texts.forEach(function (node) {
          var at = node.nodeValue.toLowerCase().indexOf(term);
          if (at < 0) return;
          var span = el('span', { class: 'cmd-filter-hit' });
          var hit = node.splitText(at);
          hit.splitText(term.length);
          hit.parentNode.replaceChild(span, hit);
          span.appendChild(hit);
        });
      });
    }

    function apply() {
      var term = input.value.trim().toLowerCase();
      var shown = 0;

      items.forEach(function (item) {
        clearMarks(item);
        var hit = !term || item.hay.indexOf(term) !== -1;
        item.row.hidden = !hit;
        if (hit) {
          shown++;
          if (term) mark(item, term);
        }
      });

      if (!count) return;
      if (!term) {
        count.textContent = '';
      } else if (shown) {
        count.textContent = shown + ' of ' + items.length +
          (shown === 1 ? ' command matches' : ' commands match');
      } else {
        count.textContent = 'No command matches “' + input.value.trim() + '”.';
      }
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
    });

    if (wrap) wrap.classList.add('is-ready');
    if (input.value) apply();   // browsers restore search inputs on back-nav
  }

  /* ---------- Home command search ----------------------------------------
     The reason someone opens this site is usually "what does X do again?".
     Making them land, find the reference, then filter is three steps for one
     question — this answers it from the front door.

     Data comes from assets/js/commands.js, generated off the same alphabetical
     index the reference renders (scripts/gen_command_data.py), so the two can
     never disagree. If that file is missing the widget stays hidden and the
     hero buttons still work. */

  function initCommandSearch() {
    var wrap = document.querySelector('[data-cmd-search]');
    if (!wrap) return;
    var data = window.WSY_COMMANDS;
    if (!data || !data.length) return;      // no data: leave it hidden

    wrap.hidden = false;
    var input = wrap.querySelector('input');
    var out = wrap.querySelector('.cmd-search-out');
    var active = -1, results = [];

    function esc(s) {
      return s.replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    /* Highlight the match inside already-escaped text. */
    function mark(s, term) {
      var at = s.toLowerCase().indexOf(term);
      if (at < 0) return esc(s);
      return esc(s.slice(0, at)) + '<span class="cmd-search-hit">' +
             esc(s.slice(at, at + term.length)) + '</span>' + esc(s.slice(at + term.length));
    }

    function close() { out.className = 'cmd-search-out'; out.innerHTML = ''; active = -1; results = []; }

    function render(term) {
      if (!term) return close();

      // Name matches first, and prefix matches above those — typing "AUTO"
      // should put AUTODIM at the top, not a description that mentions it.
      var scored = [];
      data.forEach(function (c) {
        var n = c.n.toLowerCase(), d = c.d.toLowerCase();
        var rank = n.indexOf(term) === 0 ? 0 : n.indexOf(term) > 0 ? 1 : d.indexOf(term) > -1 ? 2 : -1;
        if (rank > -1) scored.push({ c: c, rank: rank });
      });
      scored.sort(function (a, b) { return a.rank - b.rank || a.c.n.localeCompare(b.c.n); });
      results = scored.slice(0, 8).map(function (s) { return s.c; });

      if (!results.length) {
        out.className = 'cmd-search-out is-open';
        out.innerHTML = '<div class="cmd-search-empty">No command matches ' +
                        '“' + esc(input.value.trim()) + '”.</div>';
        return;
      }
      out.className = 'cmd-search-out is-open';
      out.innerHTML = results.map(function (c) {
        return '<a href="' + url(c.u) + '" role="option">' +
               '<span class="n">' + mark(c.n, term) + '</span>' +
               '<span class="d">' + mark(c.d, term) + '</span>' +
               '<span class="p">' + esc(c.p) + '</span></a>';
      }).join('');
      active = -1;
    }

    function move(step) {
      var links = out.querySelectorAll('a');
      if (!links.length) return;
      if (active > -1 && links[active]) links[active].classList.remove('is-active');
      active = (active + step + links.length) % links.length;
      links[active].classList.add('is-active');
      links[active].scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', function () { render(input.value.trim().toLowerCase()); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        var links = out.querySelectorAll('a');
        // Enter with nothing highlighted takes the top hit — the common case is
        // type three letters and go.
        var target = active > -1 ? links[active] : links[0];
        if (target) { e.preventDefault(); target.click(); }
      } else if (e.key === 'Escape') {
        if (out.className.indexOf('is-open') > -1) { close(); } else { input.value = ''; }
      }
    });

    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    input.addEventListener('focus', function () { render(input.value.trim().toLowerCase()); });

    // "/" focuses the search, the convention on every docs site that has one.
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ---------- Breadcrumb -------------------------------------------------
     Interior pages opened cold — from a ribbon Help button, or a shared deep
     link — gave no clue where you were in the set, and the top of every page
     was a bare <h1> over white. This derives the trail from SECTIONS, which is
     already the single source of truth for navigation, so it cannot drift.
     Also the only route back to the home page from a subpage. */

  function buildCrumbs() {
    var host = document.querySelector('[data-sidenav]');
    var content = document.querySelector('.content');
    var h1 = content && content.querySelector('h1');
    if (!host || !h1) return;

    var key = host.getAttribute('data-sidenav');
    var section = SECTIONS[key];
    if (!section) return;                     // home page: no trail to draw

    var trail = [{ href: '/', text: 'Home' }];
    var sectionRoot = '/' + key + '/';
    trail.push({ href: sectionRoot, text: section.title });

    // Walk the section for the group holding this page, so three-deep pages
    // read Home / Drafting / Commands rather than skipping a level.
    section.items.forEach(function (item) {
      if (!item.group) return;
      item.items.forEach(function (sub) {
        if (normalise(url(sub.href)) === HERE) trail.push({ group: item.group });
      });
    });

    var nav = el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
    trail.forEach(function (step, i) {
      if (i) nav.appendChild(el('span', { class: 'sep', text: '/', 'aria-hidden': 'true' }));
      if (step.group) {
        nav.appendChild(el('span', { class: 'here', text: step.group }));
      } else if (normalise(url(step.href)) === HERE) {
        nav.appendChild(el('span', { class: 'here', text: step.text }));
      } else {
        nav.appendChild(el('a', { href: url(step.href), text: step.text }));
      }
    });

    content.insertBefore(nav, h1);
  }

  /* ---------- Header scroll cue ------------------------------------------
     The header is translucent and sits flush against the content, so at a
     glance there was nothing to say the page had been scrolled. A shadow
     appears once you leave the top. Passive listener + rAF: no layout thrash. */

  function initScrollCue() {
    var header = document.querySelector('.header');
    if (!header) return;
    var ticking = false;

    var bar = el('div', { class: 'progress' });
    header.appendChild(bar);

    function update() {
      var y = window.pageYOffset;
      header.classList.toggle('is-scrolled', y > 8);

      // Scrollable distance can be 0 on short pages — don't divide by it.
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--progress', max > 0 ? Math.min(y / max, 1) : 0);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Boot ------------------------------------------------------- */

  function boot() {
    buildHeader();
    buildSidenav();
    buildCrumbs();
    buildFooter();
    wrapTables();
    buildToc();
    initDrawer();
    initTheme();
    initLightbox();
    initFilter();
    initCommandSearch();
    initScrollCue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
