import { requireAuthenticatedUser, initAuthNavigation } from "./auth.js";
import { getSavedDesignIds, toggleSavedDesign } from "./saved-designs.js";
import { requireSupabase } from "./supabase-client.js";

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

async function loadDesignsById(ids) {
  const response = await fetch("assets/designs.json");
  if (!response.ok) throw new Error("Could not load KULEXO designs.");
  const { designs = [] } = await response.json();
  const byId = new Map(designs.map(design => [design.id, design]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

function renderSavedDesigns(designs) {
  const container = document.getElementById("savedDesigns");
  if (!designs.length) {
    container.innerHTML = `<p class="empty-state">No saved designs yet. <a href="designs.html">Explore the library.</a></p>`;
    return;
  }

  container.innerHTML = designs.map(design => `
    <article class="saved-design" data-design-id="${escapeHtml(design.id)}">
      <div>
        <p class="eyebrow">${escapeHtml(design.category)}</p>
        <h3>${escapeHtml(design.name)}</h3>
        <p>${escapeHtml(design.type)} · ${escapeHtml(design.collection)}</p>
      </div>
      <div class="saved-actions">
        <a href="design-detail.html?design=${encodeURIComponent(design.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}" class="text-link">View</a>
        <button type="button" class="remove-saved">Remove</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll(".remove-saved").forEach(button => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-design-id]");
      button.disabled = true;
      try {
        await toggleSavedDesign(card.dataset.designId);
        await refreshSavedDesigns();
      } catch (error) {
        console.error("KULEXO saved design removal failed:", error);
        button.disabled = false;
        alert("We could not remove that saved design. Please try again.");
      }
    });
  });
}

export async function refreshSavedDesigns() {
  const ids = await getSavedDesignIds();
  renderSavedDesigns(await loadDesignsById(ids));
}

async function initAccount() {
  const user = await requireAuthenticatedUser();
  if (!user) return;
  await initAuthNavigation();

  document.getElementById("accountEmail").textContent = user.email || "";
  const { data: profile, error } = await requireSupabase()
    .from("profiles")
    .select("display_name")
    .single();
  if (error) console.warn("KULEXO profile could not load:", error);
  document.getElementById("accountName").textContent = profile?.display_name || "KULEXO customer";

  try {
    await refreshSavedDesigns();
  } catch (error) {
    console.error("KULEXO saved designs could not load:", error);
    document.getElementById("savedDesigns").innerHTML =
      `<p class="empty-state">We could not load saved designs. Please refresh and try again.</p>`;
  }
}

initAccount();
