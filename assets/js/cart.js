const storageKey = "kulexoCart";
const maxQuantity = 20;

function normalize(items) {
  if (!Array.isArray(items)) return [];
  const quantities = new Map();
  for (const item of items) {
    const id = typeof item?.design_id === "string" ? item.design_id.trim() : "";
    const quantity = Number.isInteger(item?.quantity) ? item.quantity : 0;
    if (!/^kulexo-\d{3}$/.test(id) || quantity < 1) continue;
    quantities.set(id, Math.min(maxQuantity, (quantities.get(id) || 0) + quantity));
  }
  return [...quantities].map(([design_id, quantity]) => ({ design_id, quantity }));
}

export function getCart() {
  try { return normalize(JSON.parse(localStorage.getItem(storageKey) || "[]")); }
  catch { return []; }
}

function save(items) {
  localStorage.setItem(storageKey, JSON.stringify(normalize(items)));
  window.dispatchEvent(new CustomEvent("kulexo-cart-change"));
}

export function addToCart(designId, quantity = 1) {
  const items = getCart();
  const item = items.find(entry => entry.design_id === designId);
  if (item) item.quantity = Math.min(maxQuantity, item.quantity + quantity);
  else items.push({ design_id: designId, quantity: Math.min(maxQuantity, Math.max(1, quantity)) });
  save(items);
}

export function updateCartQuantity(designId, quantity) {
  const items = getCart().map(item => item.design_id === designId ? { ...item, quantity } : item);
  save(items.filter(item => item.quantity > 0));
}

export function removeFromCart(designId) { save(getCart().filter(item => item.design_id !== designId)); }
export function clearCart() { localStorage.removeItem(storageKey); window.dispatchEvent(new CustomEvent("kulexo-cart-change")); }
export function cartCount() { return getCart().reduce((total, item) => total + item.quantity, 0); }

export function initCartCount() {
  const render = () => document.querySelectorAll("[data-cart-count]").forEach(node => { node.textContent = cartCount(); });
  render();
  window.addEventListener("kulexo-cart-change", render);
  window.addEventListener("storage", event => { if (event.key === storageKey) render(); });
}

async function catalogue() {
  const response = await fetch("assets/designs.json");
  if (!response.ok) throw new Error("Could not load the design catalogue.");
  const { designs = [] } = await response.json();
  return designs;
}

function notify(message) {
  const target = document.querySelector("[data-cart-message]");
  if (target) target.textContent = message;
}

export async function initCatalogCartActions() {
  const designs = await catalogue();
  const premiumIds = new Set(designs.filter(design => design.access === "premium").map(design => design.id));
  document.querySelectorAll(".design-card[data-design-id]").forEach(card => {
    const id = card.dataset.designId;
    if (!premiumIds.has(id) || card.querySelector(".add-cart-card")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add-cart-card";
    button.textContent = "Add to cart";
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); addToCart(id); notify("Added to cart.");
    });
    card.querySelector(".design-info")?.appendChild(button);
  });
}

export function initDetailCommerce(getDesign) {
  const addButton = document.getElementById("addToCartButton");
  const primaryButton = document.getElementById("designPrimaryAction");
  const configure = design => {
    if (!design || !primaryButton || !addButton) return;
    const premium = design.access === "premium";
    primaryButton.textContent = premium ? "Buy now →" : "View / Download Design →";
    addButton.hidden = !premium;
  };
  window.addEventListener("kulexo-design-loaded", event => configure(event.detail));
  configure(getDesign());
  window.KulexoCart = {
    addCurrentDesign() { const design = getDesign(); if (design?.access === "premium") { addToCart(design.id); notify("Added to cart."); } },
    buyNow() { const design = getDesign(); if (design?.access === "premium") { addToCart(design.id); location.assign("cart.html"); } }
  };
}

export async function initCartPage() {
  const list = document.getElementById("cartItems");
  if (!list) return;
  const designs = await catalogue();
  const byId = new Map(designs.map(design => [design.id, design]));
  const render = () => {
    const items = getCart().map(item => ({ ...item, design: byId.get(item.design_id) })).filter(item => item.design?.access === "premium");
    if (!items.length) { list.innerHTML = `<p class="empty-state">Your cart is empty. <a href="designs.html">Explore premium designs.</a></p>`; return; }
    list.innerHTML = items.map(({ design, quantity }) => `<article class="cart-item" data-design-id="${design.id}"><div><p class="eyebrow">${design.category}</p><h3>${design.name}</h3><p>${design.type} · Premium design</p></div><div class="cart-controls"><button type="button" data-cart-decrease>−</button><span>${quantity}</span><button type="button" data-cart-increase>+</button><button type="button" class="remove" data-cart-remove>Remove</button></div></article>`).join("");
    list.querySelectorAll(".cart-item").forEach(card => {
      const id = card.dataset.designId; const quantity = () => getCart().find(item => item.design_id === id)?.quantity || 0;
      card.querySelector("[data-cart-decrease]").onclick = () => updateCartQuantity(id, quantity() - 1);
      card.querySelector("[data-cart-increase]").onclick = () => updateCartQuantity(id, quantity() + 1);
      card.querySelector("[data-cart-remove]").onclick = () => removeFromCart(id);
    });
  };
  render(); window.addEventListener("kulexo-cart-change", render);
  document.getElementById("clearCart")?.addEventListener("click", clearCart);
}
