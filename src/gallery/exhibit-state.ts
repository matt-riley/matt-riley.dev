import type { ExhibitRegistry } from "./exhibits";

type Mount = (registry: ExhibitRegistry) => undefined | (() => void);
let current: ExhibitRegistry | undefined;
const mounts = new Map<Mount, (() => void) | undefined>();

export function onExhibitsReady(mount: Mount) {
  mounts.set(mount, current ? (mount(current) ?? undefined) : undefined);
  return () => {
    mounts.get(mount)?.();
    mounts.delete(mount);
  };
}

export function publishExhibits(registry: ExhibitRegistry) {
  current = registry;
  for (const mount of mounts.keys())
    mounts.set(mount, mount(registry) ?? undefined);
  return () => {
    if (current !== registry) return;
    current = undefined;
    for (const [mount, cleanup] of mounts) {
      cleanup?.();
      mounts.set(mount, undefined);
    }
  };
}
