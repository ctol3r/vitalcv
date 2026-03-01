/**
 * VitalCV Widget SDK  v1.0.0
 * ─────────────────────────
 * Embeddable script for hospital career sites.
 *
 * Usage:
 *   <script src="https://vitalcv.com/vitalcv-widget.js" defer></script>
 *   <div id="vitalcv-apply-button" data-client-id="YOUR_CLIENT_ID"></div>
 */
(function (global) {
  'use strict';

  var BASE_URL = 'https://vitalcv.com';
  var POPUP_W  = 400;
  var POPUP_H  = 600;

  function getClientId(el) {
    return el.dataset.clientId
      || el.getAttribute('data-client-id')
      || 'demo';
  }

  function popupFeatures(w, h) {
    var sl = (screen && screen.availLeft) ? screen.availLeft : 0;
    var st = (screen && screen.availTop)  ? screen.availTop  : 0;
    var sw = (screen && screen.width)     ? screen.width     : 1024;
    var sh = (screen && screen.height)    ? screen.height    : 768;
    var left = Math.round(sl + (sw - w) / 2);
    var top  = Math.round(st + (sh - h) / 2);
    return [
      'width='    + w,    'height='  + h,
      'left='     + left, 'top='     + top,
      'resizable=yes',    'scrollbars=no',
      'status=no',        'toolbar=no',
      'menubar=no',       'location=no',
    ].join(',');
  }

  var ICON_SVG =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
    + '<circle cx="7" cy="7" r="6" stroke="rgba(74,222,128,0.9)" stroke-width="1.4"/>'
    + '<circle cx="7" cy="7" r="2.6" fill="rgba(74,222,128,0.9)"/>'
    + '</svg>';

  function createButton(clientId) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-vitalcv', clientId);
    btn.innerHTML = ICON_SVG + '<span>Apply with VitalCV</span>';

    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '11px 20px',
      background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '12px',
      fontSize: '13.5px', fontWeight: '600',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 16px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.06)',
      transition: 'opacity 0.15s,transform 0.12s',
      letterSpacing: '-0.01em', lineHeight: '1', userSelect: 'none',
    });

    btn.addEventListener('mouseenter', function () {
      btn.style.opacity = '0.86'; btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.opacity = '1';   btn.style.transform = 'translateY(0)';
    });
    btn.addEventListener('mousedown', function () {
      btn.style.transform = 'translateY(0) scale(0.98)';
    });
    btn.addEventListener('mouseup', function () {
      btn.style.transform = 'translateY(-1px)';
    });

    btn.addEventListener('click', function () {
      var url = BASE_URL + '/widget/authorize?clientId=' + encodeURIComponent(clientId);
      global.open(url, 'vitalcv_apply', popupFeatures(POPUP_W, POPUP_H));
    });

    return btn;
  }

  function injectButton(container) {
    if (container.dataset.vitalcvMounted) return;
    container.dataset.vitalcvMounted = '1';
    container.appendChild(createButton(getClientId(container)));
  }

  function init() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll('#vitalcv-apply-button, [data-vitalcv-client-id]')
    );
    targets.forEach(injectButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(typeof window !== 'undefined' ? window : this));
