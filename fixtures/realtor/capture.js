// Fixture capture for realtor.com — run in YOUR browser console on a listing
// detail page (docs/conventions.md → Fixtures; ADR-0003 §4, ADR-0006 §5).
// Never run by an agent. Produces two clipboard pastes:
//   1. next-data.json  — #__NEXT_DATA__ pruned to what the adapter reads,
//                        photo hash and address replaced with fake values.
//   2. gallery.html    — first two hero-carousel slides, hash replaced, alt/title
//                        stripped (paste as a second step, see bottom).
// Save both under fixtures/realtor/M<10 digits>/ using a fake id.
(() => {
  const pd = JSON.parse(document.getElementById('__NEXT_DATA__').textContent)
    .props.pageProps.initialReduxState.propertyDetails;
  const hash = (pd.photos[0].href.match(/([0-9a-f]{32})/) || [])[1];
  const FAKE = 'deadbeefdeadbeefdeadbeefdeadbeef';
  const anon = (s) => (typeof s === 'string' && hash ? s.split(hash).join(FAKE) : s);
  const out = {
    _fixture: {
      site: 'realtor',
      capturedBy: 'human, own browser, ' + new Date().toISOString().slice(0, 10),
      anonymised: 'photo hash -> deadbeef…, address -> fake, tags dropped, all other propertyDetails keys pruned',
      source: '#__NEXT_DATA__ pruned to props.pageProps.initialReduxState.propertyDetails (keys the adapter reads)',
    },
    props: { pageProps: { initialReduxState: { propertyDetails: {
      property_id: '0000000001',
      listing_id: '0000000001',
      photo_count: pd.photos.length,
      location: { address: { line: '123 Away St', city: 'Springfield', state_code: 'XX', postal_code: '00000', state: 'Nowhere' } },
      photos: pd.photos.map((p) => ({ title: null, description: null, href: anon(p.href), type: p.type, tags: [] })),
    } } } },
  };
  copy(JSON.stringify(out, null, 2));
  console.log('next-data.json on clipboard:', pd.photos.length, 'photos, hash', hash ? 'replaced' : 'NOT FOUND');
  // Step 2 — after saving the JSON, run this for gallery.html:
  window.__galleryHtml = () => {
    const slides = [...document.querySelectorAll('[data-testid="photo-slide"]')].slice(0, 2);
    let html = slides.map((s) => s.outerHTML).join('\n');
    if (hash) html = html.split(hash).join(FAKE);
    html = html.replace(/alt="[^"]*"/g, 'alt="photo"').replace(/title="[^"]*"/g, '');
    copy(html);
    console.log('gallery.html on clipboard:', slides.length, 'slides');
  };
  console.log('Then run: __galleryHtml()');
})();
