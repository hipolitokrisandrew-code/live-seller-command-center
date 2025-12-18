// Lightweight image storage without changing the Dexie schema.
// Images are saved as data URLs in localStorage, keyed by itemId and variantId.

const ITEM_KEY_PREFIX = "item-image:";
const VARIANT_KEY_PREFIX = "variant-image:";

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function saveItemImage(itemId: string, dataUrl: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(`${ITEM_KEY_PREFIX}${itemId}`, dataUrl);
}

export async function getItemImage(itemId: string): Promise<string | null> {
  const storage = safeStorage();
  if (!storage) return null;
  return storage.getItem(`${ITEM_KEY_PREFIX}${itemId}`);
}

export async function removeItemImage(itemId: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(`${ITEM_KEY_PREFIX}${itemId}`);
}

export async function saveVariantImage(
  itemId: string,
  variantId: string,
  dataUrl: string
) {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(`${VARIANT_KEY_PREFIX}${itemId}:${variantId}`, dataUrl);
}

export async function getVariantImage(
  itemId: string,
  variantId: string
): Promise<string | null> {
  const storage = safeStorage();
  if (!storage) return null;
  return storage.getItem(`${VARIANT_KEY_PREFIX}${itemId}:${variantId}`);
}

export async function removeVariantImage(itemId: string, variantId: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(`${VARIANT_KEY_PREFIX}${itemId}:${variantId}`);
}
