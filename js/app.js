// ===================== FarmChain - app.js =====================

// ---- Supabase Client ----
const supa = supabase.createClient(
  window.FARMCHAIN_SUPABASE_URL,
  window.FARMCHAIN_SUPABASE_ANON
);

// ---- Global State ----
let currentUser = null;
let isAdmin = false;

let lands = [];
let marketItems = [];
let rigLast = null;
let tutorialStep = 0;
let silo = { level: 1, capacity: 20 };

// ---- DOM Helpers ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const now = () => new Date();

// ---- Router (hash tab) ----
function go(route) {
  ["#game", "#market", "#crypto", "#profile", "#admin"].forEach((r) => {
    const sec = document.getElementById("route-" + r.slice(1));
    if (sec) sec.classList.toggle("hide", r !== route);
  });
  // nav active
  $$("#nav .btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.route === route)
  );
  if (location.hash !== route) location.hash = route;
}
window.addEventListener("hashchange", () => {
  const r = location.hash || "#game";
  go(r);
});

// ---- Admin <-> Oyun Toggle ----
function toggleAdminGame() {
  const current = location.hash || "#game";
  if (current === "#admin") go("#game");
  else go("#admin");
}
function showAdminToggleIfAny() {
  const btn = document.getElementById("btnToggleView");
  if (isAdmin) {
    btn.style.display = "inline-block";
    btn.onclick = toggleAdminGame;
  } else {
    btn.style.display = "none";
  }
}

// ===================== AUTH =====================
async function doLogin() {
  const email = $("#email").value.trim();
  const pass = $("#password").value;
  const { error } = await supa.auth.signInWithPassword({ email, password: pass });
  if (error) return alert(error.message);
  await boot();
}

async function doSignup() {
  const farmName = $("#farmName").value.trim();
  const email = $("#email").value.trim();
  const pass = $("#password").value;
  if (!farmName) return alert("Çiftlik adı gerekli.");

  const { data, error } = await supa.auth.signUp({ email, password: pass });
  if (error) return alert(error.message);

  const uid = data.user.id;
  // İlk kayıt setupları
  await supa.from("farms").insert({ user_id: uid, farm_name: farmName, tutorial_step: 0 });
  await supa.from("wallets").insert({ user_id: uid, balance: 1000 });
  await supa.from("silos").insert({ user_id: uid, level: 1, capacity: 20 });
  await supa.from("inventory").insert({
    user_id: uid,
    item_name: "tohum",
    amount: 1,
    category: "bitkisel",
  });

  alert("Kayıt başarılı! E‑posta doğrulaması gerekiyorsa lütfen onaylayın.");
}

// ===================== BOOT =====================
document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  // Buton bağla (idempotent güvenli)
  bindAuthButtons();
  bindStaticButtons();

  const { data: { user } } = await supa.auth.getUser();

  if (!user) {
    // Auth ekranı
    $("#authView").classList.remove("hide");
    $("#appView").classList.add("hide");
    return;
  }

  // App ekranı
  $("#authView").classList.add("hide");
  $("#appView").classList.remove("hide");

  currentUser = user;

  // Admin kontrolü
  const { data: role } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  isAdmin = !!role;

  // Üst bar, nav, veri yükleri
  await loadFarmHeader(user.id);
  await loadWallet(user.id);
  await loadInventory(user.id);
  await loadSilo(user.id);

  renderLandsInit();
  bindGameButtons(); // route içi butonlar

  if (isAdmin) {
    // Nav'a Admin butonu (opsiyonel)
    if (!document.getElementById("adminLink")) {
      const a = document.createElement("button");
      a.id = "adminLink";
      a.className = "btn";
      a.dataset.route = "#admin";
      a.textContent = "⚙️ Admin";
      a.onclick = () => go("#admin");
      $("#nav").appendChild(a);
    }
    await loadAdminAll();
  }

  // Toggle görünürlüğü
  showAdminToggleIfAny();

  // Route başlangıç
  go(location.hash || "#game");

  // Vitrin (market sayfası) için ilk çizimler
  renderMarketCards();
  renderCryptoCards();
  setTabShowcase('market');
}

// ===================== LOADERS (GAME) =====================
async function loadFarmHeader(uid) {
  const { data } = await supa
    .from("farms")
    .select("farm_name,tutorial_step")
    .eq("user_id", uid)
    .single();
  $("#farmTitle").textContent = data?.farm_name
    ? `Hoşgeldin ${data.farm_name}!`
    : "Hoşgeldin!";
  tutorialStep = data?.tutorial_step || 0;
}

async function loadWallet(uid) {
  const w = await supa.from("wallets").select("balance").eq("user_id", uid).single();
  $("#balance").textContent = `💰 ${Number(w.data?.balance || 0)} FC`;
}

async function loadInventory(uid) {
  const inv = await supa
    .from("inventory")
    .select("item_name,amount")
    .eq("user_id", uid)
    .order("item_name");
  const body = $("#invBody");
  body.innerHTML = "";
  (inv.data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.item_name}</td><td class="right">${r.amount}</td>`;
    body.appendChild(tr);
  });
}

// ===================== SILO =====================
function siloUpgradeCost() {
  // orta-zor: 30 * 1.6^(level-1)
  return Math.round(30 * Math.pow(1.6, silo.level - 1));
}
function nextCapacity() {
  // bir sonraki kapasite
  return 20 + 10 * silo.level;
}
async function loadSilo(uid) {
  const { data } = await supa
    .from("silos")
    .select("level,capacity")
    .eq("user_id", uid)
    .maybeSingle();
  if (data) {
    silo = data;
  } else {
    silo = { level: 1, capacity: 20 };
    await supa.from("silos").insert({ user_id: uid, level: 1, capacity: 20 });
  }
  await updateSiloBar();
}
async function getTotalItems() {
  const { data } = await supa
    .from("inventory")
    .select("amount")
    .eq("user_id", currentUser.id);
  return (data || []).reduce((a, b) => a + (b.amount || 0), 0);
}
async function updateSiloBar() {
  const used = await getTotalItems();
  $("#siloCap").textContent = `${used} / ${silo.capacity}`;
  $("#siloLevel").textContent = `Seviye ${silo.level}`;
  $("#siloUpgradeInfo").textContent = `Ücret: ${siloUpgradeCost()} FC (Kap.: ${nextCapacity()})`;
}
async function upgradeSilo() {
  // bakiye kontrol & düş
  const w = await supa
    .from("wallets")
    .select("balance")
    .eq("user_id", currentUser.id)
    .single();
  const nb = Number(w.data?.balance || 0) - siloUpgradeCost();
  if (nb < 0) return alert("Bakiye yetersiz.");
  await supa.from("wallets").update({ balance: nb }).eq("user_id", currentUser.id);
  await loadWallet(currentUser.id);

  // seviye artır
  silo.level += 1;
  silo.capacity = nextCapacity();
  await supa
    .from("silos")
    .update({ level: silo.level, capacity: silo.capacity })
    .eq("user_id", currentUser.id);
  await updateSiloBar();
  alert("Silo yükseltildi!");
}
function openSilo() {
  $("#siloModal").classList.remove("hide");
  renderSiloList("hepsi");
}
function closeSilo() {
  $("#siloModal").classList.add("hide");
}
async function renderSiloList(cat) {
  const { data } = await supa
    .from("inventory")
    .select("item_name,amount,category")
    .eq("user_id", currentUser.id)
    .order("item_name");
  const body = $("#siloBody");
  body.innerHTML = "";
  (data || []).forEach((r) => {
    const c = r.category || "genel";
    if (cat !== "hepsi" && c !== cat) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.item_name}</td><td>${c}</td><td class="right">${r.amount}</td>`;
    body.appendChild(tr);
  });
}

// ===================== ENVANTER HELPERS =====================
async function addItem(name, amount) {
  const { data } = await supa
    .from("inventory")
    .select("amount")
    .eq("user_id", currentUser.id)
    .eq("item_name", name)
    .maybeSingle();

  if (data) {
    await supa
      .from("inventory")
      .update({ amount: (data.amount || 0) + amount })
      .eq("user_id", currentUser.id)
      .eq("item_name", name);
  } else {
    await supa.from("inventory").insert({
      user_id: currentUser.id,
      item_name: name,
      amount,
      category: name === "tohum" ? "bitkisel" : "genel",
    });
  }
  await loadInventory(currentUser.id);
}
async function addItemWithCap(name, amount) {
  const used = await getTotalItems();
  if (used + amount > silo.capacity) {
    alert("Silo kapasitesi dolu!");
    return false;
  }
  await addItem(name, amount);
  await updateSiloBar();
  return true;
}
async function removeItem(name, amount) {
  const { data } = await supa
    .from("inventory")
    .select("amount")
    .eq("user_id", currentUser.id)
    .eq("item_name", name)
    .maybeSingle();

  const have = data?.amount || 0;
  if (have < amount) return false;

  const left = have - amount;
  if (left === 0) {
    await supa
      .from("inventory")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("item_name", name);
  } else {
    await supa
      .from("inventory")
      .update({ amount: left })
      .eq("user_id", currentUser.id)
      .eq("item_name", name);
  }
  await loadInventory(currentUser.id);
  await updateSiloBar();
  return true;
}

// ===================== TARLALAR =====================
function renderLandsInit() {
  lands = [1, 2, 3, 4].map((i) => ({ id: i, planted: false, readyAt: null }));
  renderLands();
}
function renderLands() {
  const wrap = $("#lands");
  wrap.innerHTML = "";
  lands.forEach((slot) => {
    const d = document.createElement("div");
    d.className = "land" + (slot.planted ? " planted" : "");
    d.dataset.id = slot.id;

    if (!slot.planted) {
      d.innerHTML = `<div>Boş Tarla #${slot.id}<br><button class="btn">Ekim Yap</button></div>`;
      d.querySelector("button").onclick = () => plantOnLand(slot.id);
    } else {
      const left = Math.max(0, Math.ceil((slot.readyAt - now()) / 1000));
      if (left <= 0) {
        d.innerHTML = `<div>Hazır #${slot.id}<br><button class="btn">Hasat</button></div>`;
        d.querySelector("button").onclick = () => harvestLand(slot.id);
      } else {
        d.innerHTML = `<div>Ekildi #${slot.id}</div><div class="timer">Hasat: ${left}s</div>`;
        const t = setInterval(() => {
          const l = Math.max(0, Math.ceil((slot.readyAt - now()) / 1000));
          const tm = d.querySelector(".timer");
          if (tm) tm.textContent = `Hasat: ${l}s`;
          if (l <= 0) {
            clearInterval(t);
            renderLands();
          }
        }, 1000);
      }
    }
    wrap.appendChild(d);
  });
}
async function plantOnLand(id) {
  // kapasite kontrolü yan etkisiz tetikleyelim
  const capOk = await addItemWithCap("tohum", 0);
  if (!capOk) return;
  const ok = await removeItem("tohum", 1);
  if (!ok) {
    $("#status").textContent = "Tohum yok!";
    return;
  }
  const slot = lands.find((l) => l.id === id);
  slot.planted = true;
  slot.readyAt = new Date(Date.now() + 10000);
  renderLands();
}
async function harvestLand(id) {
  const slot = lands.find((l) => l.id === id);
  if (!slot || !slot.planted || slot.readyAt > now()) return;
  slot.planted = false;
  slot.readyAt = null;
  await addItemWithCap("bugday", 1);
  renderLands();
  $("#status").textContent = "Hasat tamam!";
}

// ===================== MARKET (demo in-memory) =====================
function renderMarket() {
  const body = $("#marketBody");
  body.innerHTML = "";
  marketItems.forEach((m, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${m.item}</td><td class="right">${m.price}</td><td class="right">${m.amount}</td><td class="right"><button class="btn" data-i="${i}">Satın Al</button></td>`;
    tr.querySelector("button").onclick = () => buyFromMarket(i);
    body.appendChild(tr);
  });
}
function listToMarket() {
  const item = $("#sellItem").value;
  const amt = Math.max(1, parseInt($("#sellAmount").value || "1", 10));
  const price = Math.max(1, parseInt($("#sellPrice").value || "1", 10));
  removeItem(item, amt).then((ok) => {
    if (!ok) return alert("Envanter yetersiz.");
    marketItems.push({ item, amount: amt, price });
    renderMarket();
    $("#status").textContent = "İlan eklendi.";
  });
}
async function buyFromMarket(i) {
  const m = marketItems[i];
  if (!m) return;

  const w = await supa
    .from("wallets")
    .select("balance")
    .eq("user_id", currentUser.id)
    .single();
  const nb = Number(w.data?.balance || 0) - m.price * m.amount;
  if (nb < 0) return alert("Bakiye yetersiz.");

  await supa.from("wallets").update({ balance: nb }).eq("user_id", currentUser.id);
  await loadWallet(currentUser.id);

  await addItemWithCap(m.item, m.amount);

  marketItems.splice(i, 1);
  renderMarket();
}

// ===================== KRİPTO (demo) =====================
function producedSince(d) {
  if (!d) return 0;
  const ms = now() - d;
  return Math.floor(ms / 60000); // dakikada 1 FC
}
async function collectRig() {
  const w = await supa
    .from("wallets")
    .select("balance")
    .eq("user_id", currentUser.id)
    .single();
  const gain = Math.max(1, producedSince(rigLast || new Date(Date.now() - 60000)));
  await supa
    .from("wallets")
    .update({ balance: Number(w.data?.balance || 0) + gain })
    .eq("user_id", currentUser.id);
  await loadWallet(currentUser.id);
  rigLast = now();
  $("#rigInfo").textContent = `Son toplama: ${rigLast.toLocaleTimeString()} (+${gain} FC)`;
}

// ===================== ADMIN LOADERS =====================
async function loadAdminAll() {
  await Promise.all([loadSummary(), loadAdminFarms(), loadAdminWallets(), loadAdminInventory()]);
}
async function loadSummary() {
  const { count: farmCount } = await supa.from("farms").select("*", { count: "exact", head: true });
  $("#sumPlayers").textContent = farmCount ?? "—";

  const { data: w } = await supa.from("wallets").select("balance");
  $("#sumFC").textContent = (w || []).reduce((a, b) => a + (b.balance || 0), 0);

  const { data: s } = await supa.from("silos").select("level");
  $("#avgSilo").textContent = s && s.length ? (s.reduce((a, b) => a + (b.level || 0), 0) / s.length).toFixed(1) : "—";
}
async function loadAdminFarms() {
  const q = $("#q")?.value?.trim();
  let qSel = supa.from("farms").select("user_id,farm_name,tutorial_step").order("farm_name");
  if (q) qSel = supa.from("farms").select("user_id,farm_name,tutorial_step").ilike("farm_name", "%" + q + "%");
  const { data } = await qSel;

  const tb = $("#tbodyFarms");
  tb.innerHTML = "";
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.user_id}</td><td>${r.farm_name || "-"}</td><td class="right">${r.tutorial_step ?? "-"}</td>`;
    tb.appendChild(tr);
  });
  const btn = $("#btnSearch");
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.onclick = () => loadAdminFarms();
  }
}
async function loadAdminWallets() {
  const { data: w } = await supa.from("wallets").select("user_id,balance").order("user_id");
  const { data: s } = await supa.from("silos").select("user_id,level,capacity");

  const mapS = new Map((s || []).map((x) => [x.user_id, x]));
  const tb = $("#tbodyWallets");
  tb.innerHTML = "";
  (w || []).forEach((r) => {
    const sv = mapS.get(r.user_id) || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.user_id}</td>
                    <td class="right">${Number(r.balance || 0)}</td>
                    <td class="right">${sv.level || "-"}</td>
                    <td class="right">${sv.capacity || "-"}</td>`;
    tb.appendChild(tr);
  });
}
async function loadAdminInventory() {
  const { data } = await supa
    .from("inventory")
    .select("user_id,item_name,amount,category")
    .order("user_id");
  const tb = $("#tbodyInv");
  tb.innerHTML = "";
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.user_id}</td><td>${r.item_name}</td><td class="right">${r.amount}</td><td>${r.category || "genel"}</td>`;
    tb.appendChild(tr);
  });
}

// ===================== BINDINGS =====================
function bindAuthButtons() {
  const login = $("#btnLogin");
  const signup = $("#btnSignup");
  if (login && !login._bound) { login._bound = true; login.onclick = doLogin; }
  if (signup && !signup._bound) { signup._bound = true; signup.onclick = doSignup; }
}
function bindStaticButtons() {
  const logout = $("#btnLogout");
  if (logout && !logout._bound) {
    logout._bound = true;
    logout.onclick = async () => { await supa.auth.signOut(); location.reload(); };
  }
  // Silo modal static
  const closeBtn = $("#btnCloseSilo");
  if (closeBtn && !closeBtn._bound) { closeBtn._bound = true; closeBtn.onclick = closeSilo; }

  // Silo sekmeleri
  $$("#siloTabs .btn").forEach((b) => {
    if (!b._bound) {
      b._bound = true;
      b.addEventListener("click", () => renderSiloList(b.dataset.cat));
    }
  });

  // Nav buttons (static)
  $$("#nav .btn").forEach((b) => {
    if (!b._bound) {
      b._bound = true;
      b.addEventListener("click", () => go(b.dataset.route));
    }
  });
}
function bindGameButtons() {
  // Game
  const addSeed = $("#btnAddSeed");
  if (addSeed && !addSeed._bound) {
    addSeed._bound = true;
    addSeed.onclick = async () => {
      const ok = await addItemWithCap("tohum", 1);
      if (ok) $("#status").textContent = "1 tohum eklendi.";
    };
  }
  const plantDemo = $("#btnPlantDemo");
  if (plantDemo && !plantDemo._bound) {
    plantDemo._bound = true;
    plantDemo.onclick = () => {
      const empty = lands.find((l) => !l.planted);
      if (empty) plantOnLand(empty.id);
      else $("#status").textContent = "Boş tarla yok.";
    };
  }
  const sellW = $("#btnSellWheat");
  if (sellW && !sellW._bound) {
    sellW._bound = true;
    sellW.onclick = () => {
      $("#sellItem").value = "bugday";
      $("#sellAmount").value = 1;
      listToMarket();
      renderMarket();
    };
  }

  // Market
  const listBtn = $("#btnList");
  if (listBtn && !listBtn._bound) {
    listBtn._bound = true;
    listBtn.onclick = () => {
      listToMarket();
      renderMarket();
    };
  }

  // Crypto
  const collect = $("#btnCollect");
  if (collect && !collect._bound) {
    collect._bound = true;
    collect.onclick = collectRig;
  }

  // Silo bar
  const openSiloBtn = $("#btnOpenSilo");
  if (openSiloBtn && !openSiloBtn._bound) {
    openSiloBtn._bound = true;
    openSiloBtn.onclick = openSilo;
  }
  const upgradeBtn = $("#btnUpgradeSilo");
  if (upgradeBtn && !upgradeBtn._bound) {
    upgradeBtn._bound = true;
    upgradeBtn.onclick = upgradeSilo;
  }
}

// ============= VİTRİN: Basit veriler & Sekmeler (çakışma yok) =============
// Statik vitrin verileri (istersen dış JSON'dan da çekebilirsin)
const SHOWCASE_PRODUCTS = [
  { name: "Organik Zeytin", tag: "Aydın · Erken Hasat", price: "₺220/lt", stock: 38 },
  { name: "Çiğ Süt", tag: "Balıkesir · Günlük", price: "₺35/lt", stock: 120 },
  { name: "Serbest Gezen Yumurta", tag: "Manisa · XL", price: "₺90/10'lu", stock: 64 },
  { name: "Lavanta Balı", tag: "Isparta · 2025", price: "₺360/500g", stock: 42 },
];

const SHOWCASE_TOKENS = [
  { sym: "$FARM",  name: "Farm‑Chain",  price: 1.24, change: +4.2, points: "0,22 16,18 32,18 48,20 64,12 80,10 100,11", color:"#34d399" },
  { sym: "$HONEY", name: "Honey Token", price: 0.32, change: -1.8, points: "0,10 16,11 32,9 48,12 64,14 80,16 100,15", color:"#fb7185" },
  { sym: "$GRAIN", name: "Grain Index", price: 0.87, change: +0.6, points: "0,18 16,17 32,16 48,17 64,15 80,14 100,13", color:"#34d399" },
];

// Elemanları yakala (varsa)
const tabMarketBtn = document.getElementById('tab-market');
const tabCryptoBtn = document.getElementById('tab-crypto');
const badgeMarket  = document.getElementById('badge-market');
const badgeCrypto  = document.getElementById('badge-crypto');
const viewMarket   = document.getElementById('view-market');
const viewCrypto   = document.getElementById('view-crypto');

// Sekme değiştir
function setTabShowcase(which){
  if(!viewMarket || !viewCrypto) return; // market route'u henüz yoksa
  const isMarket = which === 'market';
  viewMarket.classList.toggle('hide', !isMarket);
  viewCrypto.classList.toggle('hide',  isMarket);
  tabMarketBtn?.classList.toggle('active', isMarket);
  tabCryptoBtn?.classList.toggle('active', !isMarket);
  badgeMarket?.classList.toggle('active', isMarket);
  if(badgeCrypto){
    badgeCrypto.style.opacity = isMarket ? '.8' : '1';
  }
}

// Market kartlarını üret (vitrin)
function renderMarketCards(){
  if(!viewMarket) return;
  const html = SHOWCASE_PRODUCTS.map(p => `
    <article class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <h4 style="margin:0; font-size:20px;">${p.name}</h4>
        <span class="tag">${p.tag}</span>
      </div>
      <div class="media" style="height:120px;border-radius:14px;background:rgba(255,255,255,.05);margin:10px 0;"></div>
      <div class="actions" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div><strong style="color:#fff">${p.price}</strong> · Stok: ${p.stock}</div>
        <button class="btn em">Sepete Ekle</button>
      </div>
    </article>
  `).join('');
  viewMarket.innerHTML = html;
}

// Kripto kartlarını üret (vitrin)
function renderCryptoCards(){
  if(!viewCrypto) return;
  const html = SHOWCASE_TOKENS.map(t => `
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
        <div class="logo" style="width:38px;height:38px;color:#e5fff6;background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.12));border-radius:10px;display:grid;place-items:center;">⚙️</div>
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

// Event bağla (varsa butonlar)
if(tabMarketBtn){
  ['click'].forEach(ev=>{
    tabMarketBtn.addEventListener(ev, () => setTabShowcase('market'));
    tabCryptoBtn.addEventListener(ev, () => setTabShowcase('crypto'));
    badgeMarket?.addEventListener(ev, () => setTabShowcase('market'));
    badgeCrypto?.addEventListener(ev, () => setTabShowcase('crypto'));
  });
}

// Dış JSON'dan beslemek istersen:
/*
fetch('data/products.json')
  .then(r => r.json())
  .then(list => { SHOWCASE_PRODUCTS.splice(0, SHOWCASE_PRODUCTS.length, ...list); renderMarketCards(); });
*/
