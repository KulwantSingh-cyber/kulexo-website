import { getDesignById } from "./catalogue.js";

const cartStorageKey = "kulexoCart";
const cartEvent = "kulexo-cart-updated";

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter(value => typeof value === "string"))]
      : [];
  } catch {
    return [];
  }
}

function writeCart(ids) {
  localStorage.setItem(cartStorageKey, JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new Event(cartEvent));
}

export function getCartIds() {
  return readCart();
}

export async function getCartProducts() {
  const products = await Promise.all(readCart().map(getDesignById));
  return products.filter(product =>
    product?.access === "premium" &&
    product.product?.purchasable === true
  );
}

export async function addToCart(productId) {
  const product = await getDesignById(productId);
  if (!product?.product?.purchasable || product.access !== "premium") {
    throw new Error("Only configured premium products can be added to the cart.");
  }
  writeCart([...readCart(), productId]);
}

export function removeFromCart(productId) {
  writeCart(readCart().filter(id => id !== productId));
}

export function clearCart() {
  writeCart([]);
}

export function onCartChange(listener) {
  window.addEventListener(cartEvent, listener);
  return () => window.removeEventListener(cartEvent, listener);
}

export function initCartCount() {
  const nodes = document.querySelectorAll("[data-cart-count]");
  const sync = () => {
    const count = readCart().length;
    nodes.forEach(node => {
      node.textContent = String(count);
      node.hidden = count === 0;
    });
  };
  sync();
  return onCartChange(sync);
}
