export function showNotification(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 5000);
}
