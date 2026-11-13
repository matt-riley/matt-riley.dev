import { traceImports } from "./immersive-import-graph";

export function mountImportExample(root: HTMLElement): () => void {
  const toggle = root.querySelector<HTMLInputElement>("[data-import-toggle]");
  const optional = root.querySelector<HTMLElement>("[data-import-optional]");
  const state = root.querySelector<HTMLElement>("[data-import-state]");
  const result = root.querySelector<HTMLElement>("[data-import-result]");
  const line = root.querySelector<HTMLElement>("[data-import-line]");
  if (!toggle || !optional || !state || !result || !line) return () => {};
  const initiallyDisabled = toggle.disabled;
  const update = () => {
    const imports = toggle.checked ? ["greet.ts", "legacy.ts"] : ["greet.ts"];
    const graph = { "main.ts": imports, "greet.ts": [], "legacy.ts": [] };
    const { unreachable } = traceImports(graph, "main.ts");
    optional.dataset.reachable = String(!unreachable.includes("legacy.ts"));
    state.textContent = toggle.checked ? "Imported" : "Unreachable";
    result.textContent = `${unreachable.length} unreachable ${unreachable.length === 1 ? "file" : "files"} in this example.`;
    line.hidden = !toggle.checked;
  };
  toggle.disabled = false;
  toggle.addEventListener("change", update);
  update();
  return () => {
    toggle.removeEventListener("change", update);
    toggle.disabled = initiallyDisabled;
  };
}
