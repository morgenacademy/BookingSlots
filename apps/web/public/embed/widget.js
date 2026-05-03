/*!
 * BookingSlots embed widget — drop-in replacement for cdn.bsport.io/scripts/widget.js
 *
 * Usage on a customer site (e.g. Webflow):
 *   <script src="https://app.bookingslots.nl/embed/widget.js"></script>
 *   <div id="bookingslots-login"></div>
 *   <script>
 *     BookingSlots.mount({
 *       parentElement: 'bookingslots-login',
 *       studio: '00000000-0000-0000-0000-000000000001',
 *       widgetType: 'loginButton'
 *     });
 *   </script>
 *
 * Bsport-compatibility: existing markup with `bsport-widget-desktop` /
 * `bsport-widget-mobile` mount IDs is auto-detected so no HTML changes are
 * needed during the cutover.
 */
(function (global) {
  'use strict';

  var SCRIPT = document.currentScript;
  var ORIGIN = (function () {
    if (SCRIPT && SCRIPT.src) {
      try { return new URL(SCRIPT.src).origin; } catch (e) {}
    }
    return 'https://app.bookingslots.nl';
  })();

  function $(id) { return document.getElementById(id); }
  function eur(c) { return '€ ' + (c / 100).toFixed(2).replace('.', ','); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function link(href, text, opts) {
    return el('a', Object.assign({ href: ORIGIN + href, target: '_top' }, opts || {}), [text]);
  }

  function renderLoginButton(host, cfg) {
    var btn = link('/login', cfg.loginLabel || 'Inloggen', {
      class: 'bs-btn bs-btn-login',
      style: 'all:unset;display:inline-block;background:transparent;color:#fff;border:1px solid #fff;border-radius:9999px;padding:8px 16px;font:inherit;cursor:pointer;text-align:center;'
    });
    host.innerHTML = '';
    host.appendChild(btn);
  }

  function renderPricing(host, cfg) {
    host.innerHTML = '<p style="font:14px sans-serif;color:#666">Loading…</p>';
    var url = ORIGIN + '/api/embed/catalog?studio=' + encodeURIComponent(cfg.studio || '');
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      host.innerHTML = '';
      var grid = el('div', { style: 'display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));font:14px Inter,sans-serif;' });
      (data.passes || []).forEach(function (p) {
        var card = el('article', { style: 'border:1px solid #e5e0db;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px;background:#fff;' }, [
          el('h3', { style: 'font:600 18px serif;margin:0;' }, [p.name]),
          el('p', { style: 'font:600 22px serif;margin:0;' }, [eur(p.price_eur_cents)]),
          el('p', { style: 'color:#666;margin:0;' }, [p.credits + ' credits · ' + p.validity_days + ' dagen']),
          link('/prijzen?buy=' + p.id, 'Koop ' + p.name, {
            style: 'margin-top:auto;background:#7F716A;color:#fff;border-radius:9999px;padding:10px 16px;text-decoration:none;text-align:center;'
          }),
        ]);
        grid.appendChild(card);
      });
      host.appendChild(grid);
    }).catch(function () {
      host.innerHTML = '<p style="color:#900">Kon prijzen niet laden.</p>';
    });
  }

  function renderCalendar(host, cfg) {
    host.innerHTML = '';
    var iframe = el('iframe', {
      src: ORIGIN + '/rooster?studio=' + encodeURIComponent(cfg.studio || '') + '&embed=1',
      style: 'width:100%;min-height:600px;border:0;',
      title: 'Rooster',
    });
    host.appendChild(iframe);
  }

  var RENDERERS = {
    loginButton: renderLoginButton,
    pricing: renderPricing,
    calendar: renderCalendar,
  };

  function resolveHost(cfg) {
    if (!cfg.parentElement) return null;
    if (typeof cfg.parentElement === 'string') {
      // Bsport mount-ID alias
      var id = cfg.parentElement;
      if (id.indexOf('bsport-widget-') === 0) {
        return $(id) || $(id.replace('bsport-widget-', 'bookingslots-'));
      }
      return $(id);
    }
    return cfg.parentElement;
  }

  function mount(cfg) {
    cfg = cfg || {};
    var host = resolveHost(cfg);
    if (!host) {
      console.warn('[BookingSlots] mount: parentElement not found', cfg.parentElement);
      return;
    }
    var renderer = RENDERERS[cfg.widgetType] || renderPricing;
    renderer(host, cfg);
  }

  // Auto-mount any Bsport-style placeholders so customers don't need to change HTML.
  function autoMount() {
    ['bsport-widget-desktop', 'bsport-widget-mobile'].forEach(function (id) {
      var node = $(id);
      if (node && !node.dataset.bsMounted) {
        node.dataset.bsMounted = '1';
        renderLoginButton(node, {});
      }
    });
  }

  global.BookingSlots = { mount: mount, version: '0.1.0' };
  // Bsport global alias for zero-touch migration on customer sites.
  if (!global.BsportWidget) global.BsportWidget = { mount: mount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})(window);
