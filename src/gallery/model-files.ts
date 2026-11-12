import manifest from "./manifest.json" with { type: "json" };

/** Logical IDs stay stable; only the built deployment uses immutable names. */
export function modelFile(id: string) {
  const filename = (manifest as Record<string, string>)[id];
  if (!filename) throw new Error(`Unknown gallery model: ${id}`);
  return filename;
}

export function modelURL(id: string) {
  return `/models/${modelFile(id)}`;
}
