import { isSupabaseConfigured, requireSupabase } from "./supabase-client.js";

const storageKey = "kulexoSavedDesigns";

function readLocalSavedDesigns() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? [...new Set(saved.filter(Boolean))] : [];
  } catch {
    return [];
  }
}

function writeLocalSavedDesigns(ids) {
  localStorage.setItem(storageKey, JSON.stringify([...new Set(ids)]));
}

async function currentUser() {
  if (!isSupabaseConfigured) return null;
  const { data: { user } } = await requireSupabase().auth.getUser();
  return user;
}

export async function getSavedDesignIds() {
  const user = await currentUser();
  if (!user) return readLocalSavedDesigns();

  const { data, error } = await requireSupabase()
    .from("saved_designs")
    .select("design_id")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(row => row.design_id);
}

export async function toggleSavedDesign(designId) {
  if (!designId) return false;

  const user = await currentUser();
  if (!user) {
    const saved = readLocalSavedDesigns();
    const index = saved.indexOf(designId);
    if (index === -1) saved.push(designId);
    else saved.splice(index, 1);
    writeLocalSavedDesigns(saved);
    return saved.includes(designId);
  }

  const client = requireSupabase();
  const { data: existing, error: findError } = await client
    .from("saved_designs")
    .select("design_id")
    .eq("design_id", designId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await client
      .from("saved_designs")
      .delete()
      .eq("design_id", designId);
    if (error) throw error;
    return false;
  }

  const { error } = await client
    .from("saved_designs")
    .insert({ user_id: user.id, design_id: designId });
  if (error) throw error;
  return true;
}

export async function migrateLocalSavedDesigns() {
  const user = await currentUser();
  const localIds = readLocalSavedDesigns();
  if (!user || !localIds.length) return { migrated: 0, skipped: 0 };

  const response = await fetch("assets/designs.json");
  if (!response.ok) throw new Error("Could not validate saved designs.");
  const { designs = [] } = await response.json();
  const validIds = new Set(designs.map(design => design.id));
  const idsToMigrate = localIds.filter(id => validIds.has(id));

  if (!idsToMigrate.length) {
    localStorage.removeItem(storageKey);
    return { migrated: 0, skipped: localIds.length };
  }

  const { error } = await requireSupabase()
    .from("saved_designs")
    .upsert(
      idsToMigrate.map(design_id => ({ user_id: user.id, design_id })),
      { onConflict: "user_id,design_id", ignoreDuplicates: true }
    );

  if (error) throw error;
  localStorage.removeItem(storageKey);
  return { migrated: idsToMigrate.length, skipped: localIds.length - idsToMigrate.length };
}

export async function initDesignGridFavorites() {
  const buttons = [...document.querySelectorAll(".favorite")];
  if (!buttons.length) return;

  let savedIds;
  try {
    savedIds = new Set(await getSavedDesignIds());
  } catch (error) {
    console.warn("KULEXO saved designs could not load:", error);
    savedIds = new Set(readLocalSavedDesigns());
  }

  buttons.forEach(button => {
    const card = button.closest(".design-card");
    const designId = card?.dataset.designId;
    if (!designId) return;

    const setState = saved => {
      button.classList.toggle("active", saved);
      button.textContent = saved ? "♥" : "♡";
    };

    setState(savedIds.has(designId));
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        const saved = await toggleSavedDesign(designId);
        setState(saved);
      } catch (error) {
        console.error("KULEXO save failed:", error);
        alert("We could not update your saved designs. Please try again.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

export async function initDetailSavedDesign(getDesignId) {
  const button = document.querySelector(".actions .secondary-btn");
  if (!button) return;

  const sync = async () => {
    const id = getDesignId();
    if (!id) return;
    const saved = (await getSavedDesignIds()).includes(id);
    button.dataset.saved = saved ? "true" : "false";
    button.innerHTML = saved ? "♡ Saved" : "♡ Save Design";
  };

  window.KulexoSavedDesigns = {
    async toggleCurrentDesign() {
      const id = getDesignId();
      if (!id) return;
      const saved = await toggleSavedDesign(id);
      button.dataset.saved = saved ? "true" : "false";
      button.innerHTML = saved ? "♡ Saved" : "♡ Save Design";
    },
    sync
  };

  try {
    await sync();
  } catch (error) {
    console.warn("KULEXO saved designs could not sync:", error);
  }
}
