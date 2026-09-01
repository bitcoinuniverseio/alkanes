/* Alkanes docs: theme toggle, heading anchors, client-side search.
   No network calls other than fetching this site's own search-index.json.
   Nothing typed on this site is logged or transmitted. */
(function () {
  'use strict';

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var KEY = 'alkanes-docs-theme';
  function apply(v) {
    if (v === 'light' || v === 'dark') { root.setAttribute('data-theme', v); }
    else { root.removeAttribute('data-theme'); }
  }
  try { apply(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.hidden = false;
      var label = function () {
        var t = currentTheme();
        btn.textContent = t === 'dark' ? 'Light' : 'Dark';
        btn.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme');
      };
      label();
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
        label();
      });
    }

    /* ---------- heading anchors ---------- */
    var hs = document.querySelectorAll('main h2[id], main h3[id]');
    for (var i = 0; i < hs.length; i++) {
      var a = document.createElement('a');
      a.className = 'anchor';
      a.href = '#' + hs[i].id;
      a.textContent = '#';
      a.setAttribute('aria-label', 'Link to this section');
      hs[i].appendChild(a);
    }

    setupSearch();
  });

  /* ---------- search ---------- */
  function setupSearch() {
    var input = document.getElementById('search-input');
    var list = document.getElementById('search-results');
    var wrap = document.getElementById('search-wrap');
    if (!input || !list || !wrap) return;

    wrap.hidden = false;
    var index = null, loading = false, pending = false;

    function base() {
      var p = document.querySelector('link[rel="search-base"]');
      return p ? p.getAttribute('href') : './';
    }

    function load() {
      if (index || loading) return;
      loading = true;
      fetch(base() + 'search-index.json', { credentials: 'omit' })
        .then(function (r) { return r.json(); })
        .then(function (j) { index = j.entries || []; loading = false; if (pending) run(); })
        .catch(function () { loading = false; index = []; render([], input.value, true); });
    }

    input.addEventListener('focus', load);
    input.addEventListener('input', function () { load(); pending = true; run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; list.innerHTML = ''; input.blur(); }
      if (e.key === 'ArrowDown') {
        var first = list.querySelector('a');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    list.addEventListener('keydown', function (e) {
      var links = Array.prototype.slice.call(list.querySelectorAll('a'));
      var at = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && at > -1 && links[at + 1]) { e.preventDefault(); links[at + 1].focus(); }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (at > 0) links[at - 1].focus(); else input.focus();
      }
      if (e.key === 'Escape') { list.innerHTML = ''; input.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) list.innerHTML = '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });

    function norm(s) { return (s || '').toLowerCase(); }

    function run() {
      var q = input.value.trim();
      if (q.length < 2) { list.innerHTML = ''; return; }
      if (!index) { return; }
      var terms = norm(q).split(/\s+/).filter(Boolean);
      var scored = [];
      for (var i = 0; i < index.length; i++) {
        var e = index[i];
        var hay = norm(e.t + ' ' + e.p + ' ' + e.x + ' ' + (e.a || []).join(' '));
        var score = 0, all = true;
        for (var k = 0; k < terms.length; k++) {
          var pos = hay.indexOf(terms[k]);
          if (pos < 0) { all = false; break; }
          score += 30 - Math.min(29, pos / 20);
          if (norm(e.t).indexOf(terms[k]) > -1) score += 45;
          if ((e.a || []).some(function (al) { return norm(al).indexOf(terms[k]) > -1; })) score += 30;
        }
        if (all) scored.push([score, e]);
      }
      scored.sort(function (a, b) { return b[0] - a[0]; });
      render(scored.slice(0, 12).map(function (s) { return s[1]; }), q, false);
    }

    function esc(s) { return s.replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    function mark(text, q) {
      var t = esc(text);
      var terms = q.trim().split(/\s+/).filter(function (x) { return x.length > 1; });
      for (var i = 0; i < terms.length; i++) {
        var re = new RegExp('(' + terms[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        t = t.replace(re, '<mark>$1</mark>');
      }
      return t;
    }

    function render(items, q, failed) {
      list.innerHTML = '';
      if (failed) {
        list.innerHTML = '<li class="sr-none">Search index could not be loaded. Use the page navigation above.</li>';
        return;
      }
      if (!items.length) {
        list.innerHTML = '<li class="sr-none">No match for &ldquo;' + esc(q) + '&rdquo;. Try <em>protostone</em>, <em>edict</em>, <em>cellpack</em>, <em>OP_RETURN</em>, <em>fuel</em>, or an alkane id like <em>2:0</em>.</li>';
        return;
      }
      var b = base();
      for (var i = 0; i < items.length; i++) {
        var e = items[i];
        var li = document.createElement('li');
        li.innerHTML = '<a href="' + b + esc(e.u) + '"><span class="sr-page">' + esc(e.p) +
          '</span><span class="sr-title">' + mark(e.t, q) + '</span><span class="sr-snip">' +
          mark(e.x.slice(0, 150), q) + '</span></a>';
        list.appendChild(li);
      }
    }
  }
})();
