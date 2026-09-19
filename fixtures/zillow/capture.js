// Fixture capture for Zillow — run in YOUR browser console on a listing detail
// page (docs/conventions.md → Fixtures; ADR-0003 §4, ADR-0006 §5). Never run
// by an agent. Downloads zillow-fixture.json containing:
//   fixture     -> save as fixtures/zillow/Z<10 digits>/next-data.json
//   galleryHtml -> save as fixtures/zillow/Z<10 digits>/gallery.html (wrap in
//                  <ul data-testid="hollywood-gallery-images-tile-list">…</ul>)
// Anonymisation: zpid -> 1000000001, every photo hash -> 0…N, address -> fake,
// gdpClientCache pruned to one entry and only the keys the adapter reads,
// alt/title stripped, 3D-tour poster paths zeroed. Read the file before committing.
(() => {
  const nd = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
  const cache = JSON.parse(nd.props.pageProps.componentProps.gdpClientCache);
  const urlZpid = (location.href.match(/(\d+)_zpid/) || [])[1];
  const props = Object.values(cache).map((v) => v?.property).filter((p) => p?.responsivePhotos?.length);
  const p = props.find((x) => String(x.zpid) === urlZpid) || props[0];
  if (!p) { console.log('NO property with responsivePhotos in gdpClientCache — tell Hermes'); return; }
  const hashes = new Map();
  const fake = (h) => { if (!hashes.has(h)) hashes.set(h, String(hashes.size + 1).padStart(32, '0')); return hashes.get(h); };
  const anon = (u) => (typeof u === 'string' ? u.replace(/fp\/([0-9a-f]{32})/g, (_, h) => 'fp/' + fake(h)) : u);
  const photos = p.responsivePhotos.map((ph) => ({
    caption: '', subjectType: null, url: anon(ph.url),
    mixedSources: { jpeg: (ph.mixedSources?.jpeg || []).map((s) => ({ url: anon(s.url), width: s.width })) },
  }));
  const FAKE_ZPID = 1000000001;
  const key = `ForSalePriorityQuery{"zpid":${FAKE_ZPID}}`;
  const fixture = {
    _fixture: {
      site: 'zillow',
      capturedBy: 'human, own browser, ' + new Date().toISOString().slice(0, 10),
      anonymised: 'zpid -> 1000000001, photo hashes -> 0…N, address -> fake, gdpClientCache pruned to one entry and the keys the adapter reads',
      source: '#__NEXT_DATA__ props.pageProps.componentProps.gdpClientCache (JSON string) -> <key>.property.responsivePhotos',
    },
    props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify({ [key]: { property: {
      zpid: FAKE_ZPID, streetAddress: '123 Away St', city: 'Springfield', state: 'XX', zipcode: '00000', responsivePhotos: photos,
    } } }) } } },
  };
  const tiles = [...document.querySelectorAll('[data-testid="hollywood-gallery-images-tile-list"] > *')].slice(0, 2);
  const galleryHtml = tiles.map((t) => t.outerHTML).join('\n')
    .replace(/fp\/([0-9a-f]{32})/g, (_, h) => 'fp/' + fake(h))
    .replace(/vrmodels\/[0-9a-f-]+\/pano\/[0-9a-f]+\/\d+\//g, 'vrmodels/00000000-0000-0000-0000-000000000000/pano/0000000000/0000000/')
    .replace(/alt="[^"]*"/g, 'alt="photo"').replace(/title="[^"]*"/g, '');
  const info = { urlZpid, propertyZpid: String(p.zpid), photoCount: photos.length, tiles: tiles.length, hashesReplaced: hashes.size };
  const blob = new Blob([JSON.stringify({ info, fixture, galleryHtml }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'zillow-fixture.json'; a.click();
  console.log(info);
})();
