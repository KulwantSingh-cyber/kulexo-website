const catalogueUrl = "assets/designs.json";

let cataloguePromise;

export function loadCatalogue() {
  if (!cataloguePromise) {
    cataloguePromise = fetch(catalogueUrl).then(async response => {
    if (!response.ok) throw new Error("Could not load the KULEXO catalogue.");
    const data = await response.json();
    if (!Array.isArray(data.designs)) {
      throw new Error("The KULEXO catalogue is invalid.");
    }
    return data.designs;
    });
  }
  return cataloguePromise;
}

export async function getPremiumProducts() {
  const designs = await loadCatalogue();
  return designs.filter(design =>
    design.status === "published" &&
    design.access === "premium" &&
    design.product?.purchasable === true
  );
}

export async function getDesignById(id) {
  const designs = await loadCatalogue();
  return designs.find(design => design.id === id) || null;
}

export function formatProductPrice(product) {
  if (!product?.product?.price_minor || !product.product.currency) {
    return "Price coming soon";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.product.currency.toUpperCase()
  }).format(product.product.price_minor / 100);
}
