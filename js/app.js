// Basit veriler (istersen data/products.json'dan da çekebiliriz)
const PRODUCTS = [
  { name: "Organik Zeytin", tag: "Aydın · Erken Hasat", price: "₺220/lt", stock: 38 },
  { name: "Çiğ Süt", tag: "Balıkesir · Günlük", price: "₺35/lt", stock: 120 },
  { name: "Serbest Gezen Yumurta", tag: "Manisa · XL", price: "₺90/10'lu", stock: 64 },
  { name: "Lavanta Balı", tag: "Isparta · 2025", price: "₺360/500g", stock: 42 },
];

const TOKENS = [
  { sym: "$FARM", name: "Farm‑Chain", price: 1.24, change: +4.2, points: "0,22 16,18 32,18 48,20 64,12 80,10 100,11", color:"#34d399" },
  { sym: "$HONEY", name: "Honey Token", price: 0.32, change: -1.8, points: "0,10 16,11 32,9 48,12 64,14 80,16 100,15", color:"#fb7185" },
  { sym: "$GRAIN", name: "Grain Index", price: 0.87, change: +0.6, points: "0,18 16,17 32,16 48,17 64,15 80,14 100,13", color:"#34d399" },
];

// Elemanları yakala
const tabMarketBtn = document.getElementById('tab-market');
const tabCryptoBtn = document.getElementById('tab-crypto');
const badgeMarket = document.getElementById('badge-market');
const badgeCrypto = document.getElementById('badge-crypto');
const viewMarket = document.getElementById('view-market');
const viewCrypto = document.getElementById('view-crypto');

// Sekme değiştir
function setTab(which){
  const isMarket = which === 'market';
  viewMarket.classList.toggle('hide', !isMarket);
  viewCrypto.classList.toggle('hide', isMarket);
  tabMarketBtn.classList.toggle('active', isMarket);
  tabCryptoBtn.classList.toggle('active', !isMarket);
  badgeMarket.classList.toggle('active', isMarket);
  badgeCrypto.classList.toggle('active', !isMarket);
}
['click'].forEach(ev=>{
  tabMarketBtn.addEventListener(ev, () => setTab('market'));
  tabCryptoBtn.addEventListener(ev, () => setTab('crypto'));
  badgeMarket.addEventListener(ev, () => setTab('market'));
  badgeCrypto.addEventListener(ev, () => setTab('crypto'));
});

// Market kartlarını üret
function renderMarket(){
  const html = PRODUCTS.map(p => `
    <article class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <h4 style="margin:0; font-size:20px;">${p.name}</h4>
        <span class="tag">${p.tag}</span>
      </div>
      <div class="media"></div>
      <div class="actions">
        <div><strong style="color:#fff">${p.price}</strong> · Stok: ${p.stock}</div>
        <button class="btn em">Sepete Ekle</button>
      </div>
    </article>
  `).join('');
  viewMarket.innerHTML = html;
}

// Kripto kartlarını üret
function renderCrypto(){
  const html = TOKENS.map(t => `
    <article class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="tag">${t.sym}</span>
            <h4 style="margin:0; font-size:18px;">${t.name}</h4>
          </div>
          <p style="margin:6px 0 0; color:#cfd;">
            Fiyat: <strong style="color:#fff">$${t.price.toFixed(2)}</strong>
            <span style="margin-left:8px; color:${t.change>=0 ? '#b8ffda' : '#fb7185'}">${t.change>=0?'+':''}${t.change.toFixed(1)}%</span>
          </p>
        </div>
        <div class="logo" style="width:38px;height:38px;color:#e5fff6;background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.12));"></div>
      </div>
      <svg viewBox="0 0 100 32" style="width:100%; height:72px; border-radius:14px; background: rgba(0,0,0,.35); padding:8px;">
        <polyline fill="none" stroke="${t.color}" stroke-width="2" points="${t.points}" />
      </svg>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn">Satın Al</button>
        <button class="btn em">Takas Et</button>
      </div>
    </article>
  `).join('');
  viewCrypto.innerHTML = html;
}

// (Opsiyonel) dış JSON'dan veri çekmek istersen:
/*
fetch('data/products.json')
  .then(r => r.json())
  .then(list => { PRODUCTS.splice(0, PRODUCTS.length, ...list); renderMarket(); });
*/

renderMarket();
renderCrypto();
