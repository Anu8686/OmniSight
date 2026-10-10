"""JavaScript executed inside the scanned page (read-only DOM/layout inspection).

The probe never mutates page state apart from temporarily scrolling to test whether
interactive elements are obscured; scroll position is restored afterwards.
"""

PROBE_JS = r"""
(maxElements) => {
  const SKIP = new Set(['SCRIPT','STYLE','LINK','META','NOSCRIPT','HEAD','TITLE','BR','HTML','TEMPLATE','SOURCE','TRACK','PATH','DEFS']);
  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[onclick],[tabindex]:not([tabindex="-1"])';
  const root = document.documentElement;
  const vw = root.clientWidth, vh = window.innerHeight;
  const selCache = new Map();
  const okIdent = /^[A-Za-z_][\w-]*$/;

  function selector(el, depth) {
    if (selCache.has(el)) return selCache.get(el);
    depth = depth || 0;
    let s;
    if (el.id && okIdent.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) {
      s = '#' + el.id;
    } else {
      s = el.tagName.toLowerCase();
      const cls = Array.from(el.classList).filter(c => okIdent.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      if (document.querySelectorAll(s).length !== 1) {
        const p = el.parentElement;
        if (p) {
          const idx = Array.from(p.children).indexOf(el) + 1;
          const s2 = s + ':nth-child(' + idx + ')';
          if (document.querySelectorAll(s2).length === 1 || depth > 6 || p === document.body) {
            s = s2;
          } else {
            s = selector(p, depth + 1) + ' > ' + s2;
          }
        }
      }
    }
    selCache.set(el, s);
    return s;
  }

  function visible(cs, r) {
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.02 && r.width > 0 && r.height > 0;
  }

  const all = Array.from(document.body.querySelectorAll('*')).filter(e => !SKIP.has(e.tagName) && !(e instanceof SVGElement && e.tagName !== 'svg'));
  const ids = new Map();
  const elements = [];
  for (const el of all) {
    if (elements.length >= maxElements) break;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!visible(cs, r)) continue;
    const id = elements.length;
    ids.set(el, id);
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/\s+/g, ' ').trim().slice(0, 120);
    const isInput = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    const interactive = el.matches(INTERACTIVE);
    let parentId = -1, p = el.parentElement;
    while (p && p !== document.body) { if (ids.has(p)) { parentId = ids.get(p); break; } p = p.parentElement; }
    elements.push({
      id, parent: parentId, tag: el.tagName.toLowerCase(), selector: selector(el), cls: Array.from(el.classList).join(' '),
      text: own, interactive, isInput,
      rect: { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height },
      color: cs.color, fontSize: parseFloat(cs.fontSize), fontWeight: cs.fontWeight,
      bgColor: cs.backgroundColor, bgImage: cs.backgroundImage,
      position: cs.position, top: cs.top, left: cs.left, marginTop: parseFloat(cs.marginTop) || 0,
      transform: cs.transform, display: cs.display, flexWrap: cs.flexWrap,
      overflowX: cs.overflowX, zIndex: cs.zIndex,
    });
  }

  // Obscured interactive elements (limited, restores scroll afterwards).
  const startX = window.scrollX, startY = window.scrollY;
  const elList = Array.from(ids.keys());
  let tested = 0;
  for (const e of elements) {
    if (!e.interactive || tested >= 40) continue;
    const el = elList[e.id];
    tested++;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), cy = r.top + r.height / 2;
    if (cy < 0 || cy > vh || r.width <= 0) continue;
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      e.obscuredBy = ids.has(hit) ? ids.get(hit) : -1;
      e.obscuredBySelector = selector(hit);
    }
  }
  window.scrollTo(startX, startY);

  const body = document.body, html = document.documentElement;
  const text = (document.body.innerText || '').toLowerCase();
  return {
    title: document.title || '',
    url: location.href,
    vw, vh,
    scrollWidth: Math.max(html.scrollWidth, body.scrollWidth),
    scrollHeight: Math.max(html.scrollHeight, body.scrollHeight),
    hasPasswordField: !!document.querySelector('input[type=password]'),
    looksLikeCaptcha: !!document.querySelector('iframe[src*="captcha" i],.g-recaptcha,.h-captcha,[data-sitekey]') ||
                      /verify (that )?you are (a )?human|are you a robot/.test(text),
    pageBg: (function(){ const b = getComputedStyle(document.body).backgroundColor, h = getComputedStyle(document.documentElement).backgroundColor;
      return (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') ? b : ((h && h !== 'rgba(0, 0, 0, 0)') ? h : 'rgb(255, 255, 255)'); })(),
    elementCount: all.length,
    elements,
  };
}
"""
