// Stripe Checkout is intentionally not invoked until the server-side create-checkout
// Edge Function is deployed. Browser cart data never contains prices or payment data.
export function initCheckoutButton() {
  const button = document.getElementById("checkoutButton");
  const message = document.getElementById("checkoutMessage");
  if (!button) return;
  button.addEventListener("click", () => {
    if (message) message.textContent = "Secure checkout is being connected. No payment has been started.";
  });
}
