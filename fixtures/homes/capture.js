// Fixture capture for homes.com — run in YOUR browser console on a listing
// detail page (docs/conventions.md → Fixtures; ADR-0003 §4, ADR-0006 §5).
// Never run by an agent. homes.com has no embedded photo list, so both
// fixtures are DOM slices. OPEN THE FULL-SCREEN VIEWER FIRST (click the main
// photo) so #gallery-modal-v2 exists. Downloads homes-fixture.json:
//   carouselHtml -> fixtures/homes/x0000000000000/carousel.html
//   modalHtml    -> fixtures/homes/x0000000000000/gallery-modal.html
// Anonymisation: attributes pruned to class/id/src/data-*/role/alt; scripts,
// styles, buttons, links removed; alt reduced to "photo N"; address slug ->
// 123-away-st and visible address -> "123 Away St"; listing + photo ids ->
// zeros; URL listing id -> x0000000000000. Read the file before committing —
// this site puts the street address in every image filename.
(() => {
  const slug = (location.pathname.match(/property\/([^/]+)\//) || [])[1] || '';
  const addressText = document.querySelector('#gallery-modal-v2 .address, .property-info .address')?.textContent.trim();
  const scrub = (s) => {
    let t = s.split(slug).join('123-away-st');
    if (addressText) t = t.split(addressText).join('123 Away St');
    return t.replace(/(\d{2})\d{8}-\d{9}/g, '$100000000-000000000').replace(/[^/"']*\/x[0-9a-z]{12}\//g, '123-away-st/x0000000000000/');
  };
  const KEEP = new Set(['class', 'id', 'src', 'data-image', 'data-src', 'srcset', 'data-index', 'data-slide', 'data-totalimgs', 'role', 'alt']);
  const prune = (root) => {
    const c = root.cloneNode(true);
    for (const el of c.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'SVG', 'BUTTON', 'A'].includes(el.tagName)) { el.remove(); continue; }
      for (const a of [...el.attributes]) if (!KEEP.has(a.name)) el.removeAttribute(a.name);
      if (el.hasAttribute('alt')) el.setAttribute('alt', (el.getAttribute('alt').match(/photo \d+/i) || ['photo'])[0]);
    }
    return scrub(c.outerHTML);
  };
  const modal = document.querySelector('#gallery-modal-v2');
  const car = document.querySelector('#gallery-primary-carousel');
  const info = { modalPresent: !!modal, modalImgs: modal?.querySelectorAll('img').length, carouselImgs: car?.querySelectorAll('img').length, totalimgs: car?.getAttribute('data-totalimgs') };
  const fixture = { info, carouselHtml: car ? prune(car) : null, modalHtml: modal ? prune(modal) : null };
  const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'homes-fixture.json'; a.click();
  console.log(info, modal ? '' : 'NO VIEWER — click the main photo first, then rerun');
})();
