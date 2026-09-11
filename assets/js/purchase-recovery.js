export function initPurchaseRecovery() {
  const form = document.getElementById("recoveryForm"); const message = document.getElementById("recoveryMessage");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    message.textContent = "Purchase recovery is not connected yet. No email has been sent.";
  });
}
