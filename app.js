(() => {
'use strict';
// ---------- utilitaires ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nm = n => n.replace(' District','').replace(' City','').replace('Wanganui','Whanganui').replace(' Territory','');
const gmCoord = (la, lo) => `https://www.google.com/maps/search/?api=1&query=${la.toFixed(5)},${lo.toFixed(5)}`;
const gmName = (n, dist) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((GQ[n] || n.replace(/\s*\(.*?\)/g,'') + (dist ? ', ' + dist : '')) + ', New Zealand')}`;
const srcLink = k => S[k] ? `<a href="${S[k][1]}" target="_blank" rel="noopener">${esc(S[k][0])}</a>` : '';
const linkBtn = (href, label) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>` : '';
const isMobile = () => window.matchMedia('(max-width:800px)').matches;

// ---------- légende : couleur = prix, forme = type de lieu ----------
const PRICE = {
  free:  { label: 'Gratuit', color: '#1e8a4c', on: true },
  paid:  { label: 'Payant', color: '#d32f2f', on: false },
  check: { label: 'Don ou prix à vérifier', color: '#ef8f00', on: false }
};
const KIND = {
  site: { label: 'Site de freedom camping ouvert aux non-SC', shape: 'circle', on: true },
  doc:  { label: 'Camping du DOC', shape: 'triangle', on: true },
  muni: { label: 'Camping municipal', shape: 'square', on: true },
  ban:  { label: 'Zone interdite même en SC (DOC)', shape: 'cross', on: false }
};
function svgShape(shape, color, size = 18) {
  const s = size, h = s / 2, st = 'stroke="#fff" stroke-width="2"';
  const body = {
    circle:   `<circle cx="${h}" cy="${h}" r="${h - 1.5}" fill="${color}" ${st}/>`,
    triangle: `<path d="M${h} 1.5 L${s - 1.5} ${s - 2} L1.5 ${s - 2} Z" fill="${color}" ${st} stroke-linejoin="round"/>`,
    square:   `<rect x="2" y="2" width="${s - 4}" height="${s - 4}" rx="2" fill="${color}" ${st}/>`,
    cross:    `<circle cx="${h}" cy="${h}" r="${h - 1.5}" fill="#15181c" ${st}/><path d="M${h - 4} ${h - 4} L${h + 4} ${h + 4} M${h + 4} ${h - 4} L${h - 4} ${h + 4}" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`
  }[shape];
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))">${body}</svg>`;
}
const icon = (kind, price) => L.divIcon({ className: 'sym', html: svgShape(KIND[kind].shape, price ? PRICE[price].color : '#15181c', 20), iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -8] });

// ---------- carte & fonds ----------
const map = L.map('map', { zoomSnap: .25, minZoom: 4.5 }).setView([-41.2, 172.8], 5.5);
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DOC_ATTR = ' · Campings DOC © Department of Conservation (CC BY 4.0)';
const LOCAL = location.protocol === 'file:'; // ouverte en double-clic : OSM refuse les tuiles sans « Referer »
const esriAttr = 'Tuiles © Esri';
const BASES = {
  'Plan OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: OSM_ATTR + DOC_ATTR }),
  'Plan Esri': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriAttr + ' — Esri, HERE, Garmin, OpenStreetMap' + DOC_ATTR }),
  'Topographique Esri': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriAttr + ' — Esri, HERE, Garmin, OpenStreetMap' + DOC_ATTR }),
  'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' + DOC_ATTR })
};
BASES['Satellite + noms'] = L.layerGroup([
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' + DOC_ATTR }),
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
]);
(LOCAL ? BASES['Plan Esri'] : BASES['Plan OpenStreetMap']).addTo(map);
L.control.layers(BASES, null, { position: isMobile() ? 'bottomleft' : 'topright', collapsed: isMobile() }).addTo(map);

const distGroup = L.layerGroup(); // masqué par défaut (case « Afficher les zones »)
const pointGroup = L.layerGroup().addTo(map);
const info = document.getElementById('info');
const countEl = document.getElementById('count');

// ---------- éléments de légende / filtres ----------
const pricesBox = document.getElementById('prices');
pricesBox.innerHTML = Object.entries(PRICE).map(([k, p]) =>
  `<button class="chip" data-p="${k}" aria-pressed="${p.on}" style="--c:${p.color}"><span class="cdot"></span>${p.label}</button>`).join('');
pricesBox.addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  PRICE[b.dataset.p].on = !PRICE[b.dataset.p].on; b.setAttribute('aria-pressed', PRICE[b.dataset.p].on); refresh();
});
const kindsBox = document.getElementById('kinds');
kindsBox.innerHTML = Object.entries(KIND).map(([k, v]) =>
  `<label class="chk"><input type="checkbox" autocomplete="off" data-kind="${k}" ${v.on ? 'checked' : ''}><span class="shape">${svgShape(v.shape, k === 'ban' ? '#15181c' : '#6b7178', 18)}</span><span>${v.label}</span></label>`).join('');
kindsBox.addEventListener('change', e => { const k = e.target.dataset.kind; if (k) { KIND[k].on = e.target.checked; refresh(); } });
document.getElementById('showDist').addEventListener('change', e => e.target.checked ? distGroup.addTo(map) : map.removeLayer(distGroup));
window.addEventListener('pageshow', () => { // certains navigateurs restaurent d'anciens états de cases
  for (const cb of kindsBox.querySelectorAll('input')) cb.checked = KIND[cb.dataset.kind].on;
  document.getElementById('showDist').checked = false; document.getElementById('showPcl').checked = true; map.removeLayer(distGroup);
});

// ---------- registre des points ----------
const ITEMS = []; // {kind, price, name, sub, marker, car}
function addItem(o) {
  o.marker = L.marker(o.latlng, { icon: icon(o.kind, o.price), keyboard: false, title: o.name }).bindPopup(o.html, { maxWidth: 300 });
  ITEMS.push(o);
  return o;
}
const visible = o => KIND[o.kind].on && (o.kind === 'ban' || PRICE[o.price].on);
let refreshTimer = null;
function refresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    let n = 0;
    for (const o of ITEMS) {
      const v = visible(o), has = pointGroup.hasLayer(o.marker);
      if (v) n++;
      if (v && !has) o.marker.addTo(pointGroup); else if (!v && has) pointGroup.removeLayer(o.marker);
    }
    const anyPrice = Object.values(PRICE).some(p => p.on);
    countEl.textContent = !anyPrice ? 'Aucun prix sélectionné : choisissez Gratuit, Payant ou les deux.' : `${n} lieux affichés.`;
    if (me) renderNear();
  }, 30);
}

// ---------- districts ----------
const DCOL = { strict: '#9a9a9a', some: '#e3b23c', def: '#c9bfa5' };
const clsOf = n => D[n] ? D[n][0] : 'def';
let distOf = () => '';
Promise.resolve(TA).then(g => {
  for (const f of g.features) { // Chatham : passer l'antiméridien
    const fix = c => typeof c[0] === 'number' ? [c[0] < 0 ? c[0] + 360 : c[0], c[1]] : c.map(fix);
    f.geometry.coordinates = fix(f.geometry.coordinates);
  }
  const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  distOf = (lat, lng) => { for (const f of g.features) { const gm = f.geometry, ps = gm.type === 'Polygon' ? [gm.coordinates] : gm.coordinates; for (const p of ps) if (inRing(lng, lat, p[0])) return nm(f.properties.name); } return ''; };
  L.geoJSON(g, {
    style: f => ({ color: '#555', weight: .6, fillColor: DCOL[clsOf(f.properties.name)], fillOpacity: .28 }),
    onEachFeature: (f, l) => {
      l.bindTooltip(nm(f.properties.name), { sticky: true });
      l.on('click', e => showDistrict(f.properties.name, e.latlng));
    }
  }).addTo(distGroup);
  drawSites();
});
const DLABEL = { strict: 'Aucun site non-SC', some: 'Quelques sites non-SC', def: 'Statut à confirmer' };
function showDistrict(n, latlng) {
  const c = clsOf(n), d = D[n];
  const html = `<h3>${esc(nm(n))}</h3><span class="tag" style="background:${DCOL[c]}">${DLABEL[c]}</span><p style="margin:4px 0">${esc(d ? d[1] : CLS[c].desc)}</p><p class="small">Source : ${srcLink(d ? d[2] : 'mbie')}</p>`;
  info.innerHTML = html.replace('<h3>', '<h2>').replace('</h3>', '</h2>');
  if (latlng) L.popup({ maxWidth: 300 }).setLatLng(latlng).setContent(`<div class="pop">${html}</div>`).openOn(map);
}

// ---------- sites désignés (data.js) ----------
function priceOfSite(t, pr) {
  if (t === 'ns') return 'free';
  if (/don/i.test(pr || '')) return 'check';
  return 'paid';
}
function drawSites() {
  for (const [la, lo, t, n, txt, s, pr] of P) {
    const d = distOf(la, lo);
    if (t === 'x') {
      addItem({ kind: 'ban', price: null, name: n, sub: 'Zone interdite', latlng: [la, lo],
        html: `<div class="pop"><h3>${esc(n)}</h3><div class="price" style="color:#15181c">Interdit, même en self-contained</div><div>${esc(txt)}</div><div class="links">${S[s] ? linkBtn(S[s][1], 'Source officielle') : ''}</div></div>` });
      continue;
    }
    const price = priceOfSite(t, pr), label = pr || 'Gratuit';
    const kind = /camping municipal|Waimate Lakes|Mighty River|Ōkaro/.test(n) ? 'muni' : 'site';
    addItem({ kind, price, name: n, sub: label + (d ? ' · ' + d : ''), latlng: [la, lo],
      html: `<div class="pop"><h3>${esc(n)}</h3><div class="price" style="color:${PRICE[price].color}">${esc(label)}</div><div>${esc(txt)}</div>
        <div class="meta">${kind === 'muni' ? 'Camping municipal' : 'Site désigné pour non-SC'}${d ? ' · ' + esc(d) : ''} · position approximative</div>
        <div class="links">${linkBtn(gmName(n, d), 'Google Maps')}${S[s] ? linkBtn(S[s][1], 'Source officielle') : ''}</div></div>` });
  }
  refresh();
}

// ---------- campings du DOC (données ouvertes, en direct) ----------
const DOC_CAT = {
  'Basic':       { price: 'free',  label: 'Gratuit' },
  'Standard':    { price: 'paid',  label: '10 à 20 $ par adulte et par nuit' },
  'Serviced':    { price: 'paid',  label: 'Environ 25 $ par adulte et par nuit' },
  'Great Walk':  { price: 'check', label: 'Tarif Great Walk, réservation obligatoire' },
  'Backcountry': { price: 'check', label: 'Variable, voir la page DOC' }
};
const DOC_URL = 'https://services1.arcgis.com/3JjYDyG3oajxU6HO/ArcGIS/rest/services/DOC_Campsites/FeatureServer/0/query?where=1%3D1&outFields=name,place,region,campsiteCategory,free,bookable,access,facilities,staticLink&outSR=4326&f=geojson';
const isCar = p => /car|campervan|caravan/i.test(p.access || '');
const docStatus = msg => { const el = document.getElementById('docStatus'); if (el) el.textContent = msg; };
fetch(DOC_URL).then(r => { if (!r.ok) throw 0; return r.json(); }).then(g => {
  for (const f of g.features || []) {
    if (!f.geometry) continue;
    const p = f.properties, [lo, la] = f.geometry.coordinates;
    const cat = DOC_CAT[p.campsiteCategory] || { price: 'check', label: 'Voir la page DOC' };
    const free = p.free === 'Yes' || p.free === true;
    const price = free ? 'free' : cat.price, label = free ? 'Gratuit' : cat.label;
    const fac = (p.facilities || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 6).join(', ');
    addItem({ kind: 'doc', price, car: isCar(p), name: p.name, sub: 'DOC ' + (p.campsiteCategory || '') + ' · ' + label, latlng: [la, lo],
      html: `<div class="pop"><h3>${esc(p.name)}</h3><div class="price" style="color:${PRICE[price].color}">${esc(label)}</div>
        <div class="meta">Camping du DOC · catégorie ${esc(p.campsiteCategory || '?')}${p.place ? ' · ' + esc(p.place) : ''}</div>
        <div class="small">Accès : ${esc(p.access || 'non précisé')}${p.bookable === 'Yes' ? ' · réservation possible ou requise' : ''}</div>
        ${fac ? `<div class="small">Équipements : ${esc(fac)}</div>` : ''}
        <div class="links">${linkBtn(gmCoord(la, lo), 'Google Maps')}${linkBtn(p.staticLink, 'Site DOC')}</div></div>` });
  }
  refresh();
}).catch(() => { countEl.insertAdjacentHTML('afterend', '<p class="status">Campings du DOC indisponibles pour le moment.</p>'); });

// ---------- campings municipaux (OpenStreetMap via Overpass, en direct) ----------
const OQ = '[out:json][timeout:60];area["ISO3166-1"="NZ"][admin_level=2]->.nz;nwr["tourism"="camp_site"]["operator"~"[Cc]ouncil"](area.nz);out center tags;';
fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(OQ))
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(j => {
    for (const e of j.elements || []) {
      const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon, t = e.tags || {};
      if (la == null) continue;
      const name = t.name || 'Camping municipal';
      const price = t.fee === 'no' ? 'free' : (t.fee === 'yes' || t.charge) ? 'paid' : 'check';
      const label = t.fee === 'no' ? 'Gratuit' : t.charge ? t.charge : t.fee === 'yes' ? 'Payant (tarif non indiqué)' : 'Tarif non indiqué';
      const web = t.website || t['contact:website'] || t.url;
      const extra = [t.toilets === 'yes' ? 'toilettes' : '', t.shower && t.shower !== 'no' ? 'douches' : '', t.drinking_water === 'yes' ? 'eau potable' : ''].filter(Boolean).join(', ');
      addItem({ kind: 'muni', price, name, sub: 'Camping municipal · ' + label, latlng: [la, lo],
        html: `<div class="pop"><h3>${esc(name)}</h3><div class="price" style="color:${PRICE[price].color}">${esc(label)}</div>
          <div class="meta">Géré par : ${esc(t.operator)}</div>${extra ? `<div class="small">${esc(extra)}</div>` : ''}
          <div class="links">${linkBtn(gmCoord(la, lo), 'Google Maps')}${linkBtn(web, 'Site internet')}${linkBtn(`https://www.openstreetmap.org/${e.type}/${e.id}`, 'Fiche OSM')}</div>
          <div class="meta">Données OpenStreetMap : tarif à vérifier.</div></div>` });
    }
    refresh();
  })
  .catch(() => { countEl.insertAdjacentHTML('afterend', '<p class="status">Campings municipaux (OSM) indisponibles pour le moment.</p>'); });

// ---------- terres du DOC (polygones, chargés par zone visible) ----------
const PCL_URL = 'https://services1.arcgis.com/3JjYDyG3oajxU6HO/ArcGIS/rest/services/DOC_Public_Conservation_Land/FeatureServer/0/query';
const PCL_MINZOOM = 9;
const pclRenderer = L.canvas({ padding: .3 });
const pclGroup = L.layerGroup().addTo(map);
const pclSeen = new Set();
const pclStatus = document.getElementById('pclStatus');
const pclStyle = t => t === 'Reserve'
  ? { color: '#6d3f85', weight: .8, fillColor: '#8e5ea2', fillOpacity: .3 }
  : { color: '#1f7469', weight: .8, fillColor: '#2a9d8f', fillOpacity: .3 };
const TYPE_FR = { 'Conservation Area': 'Zone de conservation', 'National Park': 'Parc national', 'Reserve': 'Réserve', 'Marginal Strip': 'Bande riveraine (marginal strip)', 'Wildlife Area': 'Zone de faune sauvage' };
let pclToken = 0, pclTimer = null;
async function loadPcl() {
  const show = document.getElementById('showPcl').checked;
  if (!show) return;
  if (map.getZoom() < PCL_MINZOOM) { pclStatus.textContent = 'Zoomez sur une région pour les afficher.'; return; }
  const token = ++pclToken, b = map.getBounds();
  const tol = 360 / (256 * Math.pow(2, map.getZoom())); // ~1 pixel en degrés
  pclStatus.textContent = 'Chargement des terres du DOC…';
  let offset = 0, more = true, added = 0;
  try {
    while (more && token === pclToken) {
      const params = new URLSearchParams({
        where: "Type <> 'Marine Area'", outFields: 'OBJECTID,Name,Type,Section', returnGeometry: 'true',
        geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => v.toFixed(4)).join(','),
        geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outSR: '4326',
        maxAllowableOffset: tol.toFixed(6), geometryPrecision: '5', resultOffset: offset, resultRecordCount: 1000, f: 'geojson'
      });
      const r = await fetch(PCL_URL + '?' + params);
      if (!r.ok) throw 0;
      const g = await r.json();
      const fid = f => f.id ?? f.properties?.OBJECTID ?? null;
      const feats = (g.features || []).filter(f => f.geometry && fid(f) !== null && !pclSeen.has(fid(f)));
      feats.forEach(f => pclSeen.add(fid(f)));
      if (feats.length) {
        L.geoJSON({ type: 'FeatureCollection', features: feats }, {
          renderer: pclRenderer,
          style: f => pclStyle(f.properties.Type),
          onEachFeature: (f, l) => {
            const p = f.properties, res = p.Type === 'Reserve';
            l.bindPopup(`<div class="pop"><h3>${esc(p.Name || 'Terre du DOC')}</h3><div class="price" style="color:${res ? '#6d3f85' : '#1f7469'}">${res ? 'Freedom camping interdit, sauf site désigné' : 'Freedom camping permis, même non-SC, sauf panneau contraire'}</div>
              <div class="meta">${esc(TYPE_FR[p.Type] || p.Type || '')}${p.Section ? ' · ' + esc(p.Section) : ''}</div>
              <div class="small">Vérifiez toujours les panneaux sur place et la <a href="https://www.doc.govt.nz/parks-and-recreation/places-to-stay/freedom-camping/prohibited-conservation-areas" target="_blank" rel="noopener">liste des zones interdites du DOC</a>.</div></div>`, { maxWidth: 300 });
          }
        }).addTo(pclGroup);
        added += feats.length;
      }
      more = !!(g.properties && g.properties.exceededTransferLimit) || (g.exceededTransferLimit === true);
      offset += 1000;
    }
    if (token === pclToken) pclStatus.textContent = `${pclSeen.size} parcelles du DOC chargées.`;
  } catch (e) {
    console.warn('PCL', e);
    if (token === pclToken) pclStatus.textContent = 'Terres du DOC indisponibles pour le moment.';
  }
}
map.on('moveend', () => { clearTimeout(pclTimer); pclTimer = setTimeout(loadPcl, 350); });
document.getElementById('showPcl').addEventListener('change', e => {
  if (e.target.checked) { pclGroup.addTo(map); loadPcl(); } else map.removeLayer(pclGroup);
});
pclGroup.setZIndex && pclGroup.setZIndex(1);

// ---------- ouvrir un lieu (recherche, liste proche) ----------
function reveal(o) {
  if (!KIND[o.kind].on) { KIND[o.kind].on = true; kindsBox.querySelector(`[data-kind="${o.kind}"]`).checked = true; }
  if (o.price && !PRICE[o.price].on) { PRICE[o.price].on = true; pricesBox.querySelector(`[data-p="${o.price}"]`).setAttribute('aria-pressed', 'true'); }
  if (!pointGroup.hasLayer(o.marker)) o.marker.addTo(pointGroup);
  refresh();
  closeSheet();
  map.flyTo(o.marker.getLatLng(), Math.max(map.getZoom(), 12), { duration: .8 });
  map.once('moveend', () => o.marker.openPopup());
}

// ---------- recherche ----------
const q = document.getElementById('q'), results = document.getElementById('results');
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dotFor = o => `<span class="shape">${svgShape(KIND[o.kind].shape, o.price ? PRICE[o.price].color : '#15181c', 16)}</span>`;
q.addEventListener('input', () => {
  const v = norm(q.value.trim());
  if (v.length < 2) { results.hidden = true; return; }
  const hits = ITEMS.filter(s => norm(s.name).includes(v)).slice(0, 30);
  results.innerHTML = hits.length ? hits.map(h => `<li><button data-i="${ITEMS.indexOf(h)}">${dotFor(h)}<span>${esc(h.name)}<small>${esc(h.sub)}</small></span></button></li>`).join('') : '<li class="hint" style="padding:8px 12px">Aucun résultat</li>';
  results.hidden = false;
});
results.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  results.hidden = true; q.blur();
  reveal(ITEMS[+b.dataset.i]);
});

// ---------- sources ----------
document.getElementById('src').innerHTML = Object.values(S).map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('') +
  '<li><a href="https://catalogue.data.govt.nz/dataset/doc-campsites4" target="_blank" rel="noopener">DOC · Campsites (données ouvertes)</a></li><li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></li>';

// ---------- panneau (tiroir sur téléphone) ----------
const side = document.getElementById('side'), tog = document.getElementById('toggle'), openBtn = document.getElementById('openSheet');
function openSheet() { side.classList.add('open'); openBtn.setAttribute('aria-expanded', 'true'); }
function closeSheet() { side.classList.remove('open'); openBtn.setAttribute('aria-expanded', 'false'); }
openBtn.addEventListener('click', openSheet);
tog.addEventListener('click', closeSheet);
map.on('click', () => { if (isMobile()) { closeSheet(); results.hidden = true; } });
let y0 = null;
side.querySelector('header').addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
side.querySelector('header').addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 50) closeSheet(); y0 = null; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); results.hidden = true; } });

// ---------- géolocalisation ----------
const locBtn = document.getElementById('locate'), near = document.getElementById('near');
let me = null, meMarker = null, meCircle = null;
const fmtKm = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
function renderNear() {
  if (!me) return;
  const list = ITEMS.filter(o => o.kind !== 'ban' && visible(o)).map(o => ({ o, d: me.distanceTo(o.marker.getLatLng()) })).sort((a, b) => a.d - b.d).slice(0, 3);
  near.innerHTML = `<h2 class="ch">Les 3 plus proches de vous</h2><p class="small muted">Selon les filtres de prix et de type choisis. Distances à vol d’oiseau.</p>` +
    (list.length ? `<ol>${list.map(({ o, d }) => `<li><button data-i="${ITEMS.indexOf(o)}">${dotFor(o)}<span>${esc(o.name)}<small>${esc(o.sub)}</small></span><span class="km">${fmtKm(d)}</span></button></li>`).join('')}</ol>` : '<p class="hint small">Aucun lieu avec ces filtres.</p>');
  near.hidden = false;
}
near.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) reveal(ITEMS[+b.dataset.i]); });
locBtn.addEventListener('click', () => {
  if (!('geolocation' in navigator)) { alert('La géolocalisation n’est pas disponible sur cet appareil.'); return; }
  locBtn.classList.add('busy');
  map.locate({ setView: false, enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 });
});
map.on('locationfound', e => {
  locBtn.classList.remove('busy');
  me = e.latlng;
  if (!meMarker) {
    meCircle = L.circle(me, { radius: e.accuracy, color: '#2a6fb0', weight: 1, fillOpacity: .1, interactive: false }).addTo(map);
    meMarker = L.circleMarker(me, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a6fb0', fillOpacity: 1 }).bindTooltip('Vous êtes ici').addTo(map);
  } else { meMarker.setLatLng(me); meCircle.setLatLng(me).setRadius(e.accuracy); }
  map.flyTo(me, Math.max(map.getZoom(), 10), { duration: .8 });
  renderNear();
  openSheet();
  near.scrollIntoView({ block: 'start' });
});
map.on('locationerror', e => {
  locBtn.classList.remove('busy');
  near.hidden = false;
  near.innerHTML = `<h2 class="ch">Localisation impossible</h2><p class="small">${e.code === 1 ? 'Autorisez l’accès à la position dans votre navigateur, puis réessayez.' : 'Position introuvable pour le moment. Réessayez à l’extérieur ou plus tard.'} La géolocalisation demande une page en https (c’est le cas sur GitHub Pages).</p>`;
  openSheet();
});
map.on('popupopen', e => {
  if (!me || !e.popup._source || e.popup._source === meMarker) return;
  const el = e.popup.getElement().querySelector('.pop'); if (!el || el.querySelector('.dist')) return;
  const p = document.createElement('div'); p.className = 'dist'; p.textContent = `À ${fmtKm(me.distanceTo(e.popup.getLatLng()))} de vous (vol d’oiseau)`;
  el.querySelector('h3').after(p);
});
// ---------- application installable (PWA) ----------
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let installEvt = null;
const installBtn = document.getElementById('install');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; installBtn.hidden = true; });
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
const netEl = document.getElementById('offline');
const net = () => { netEl.hidden = navigator.onLine; };
window.addEventListener('online', net); window.addEventListener('offline', net); net();
})();
