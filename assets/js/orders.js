export function initOrders() {
  const orders = document.getElementById("ordersList");
  const downloads = document.getElementById("downloadsList");
  if (orders) orders.innerHTML = `<p class="empty-state">Orders will appear here after secure checkout is enabled.</p>`;
  if (downloads) downloads.innerHTML = `<p class="empty-state">Verified downloads will appear here after your purchase.</p>`;
}
