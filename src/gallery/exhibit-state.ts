// This eager subscription boundary contains no Three.js or animation imports.
import type { ExhibitRegistry } from "./exhibits";

type Cleanup = () => void;
type MountResult = Cleanup | undefined;
type Mount = (registry: ExhibitRegistry) => MountResult | Promise<MountResult>;
interface Subscription {
  mount: Mount;
  release?: Cleanup;
}
const subscriptions = new Set<Subscription>();
let current: ExhibitRegistry | undefined;

async function mountSubscription(
  subscription: Subscription,
  registry: ExhibitRegistry,
) {
  if (
    registry.disposed ||
    current !== registry ||
    !subscriptions.has(subscription)
  )
    return;
  const cleanup = await subscription.mount(registry);
  if (typeof cleanup !== "function") return;
  if (
    registry.disposed ||
    current !== registry ||
    !subscriptions.has(subscription)
  ) {
    cleanup();
    return;
  }
  let done = false;
  const release = () => {
    if (!done) {
      done = true;
      cleanup();
    }
    if (subscription.release === release) subscription.release = undefined;
  };
  subscription.release = release;
}

export function onExhibitsReady(mount: Mount): Cleanup {
  const subscription: Subscription = { mount };
  subscriptions.add(subscription);
  if (current) void mountSubscription(subscription, current).catch(() => {});
  return () => {
    subscriptions.delete(subscription);
    subscription.release?.();
  };
}

export async function publishExhibits(registry: ExhibitRegistry) {
  current = registry;
  await Promise.all(
    [...subscriptions].map((subscription) =>
      mountSubscription(subscription, registry),
    ),
  );
  return () => {
    if (current !== registry) return;
    current = undefined;
    for (const subscription of subscriptions) {
      subscription.release?.();
      subscription.release = undefined;
    }
  };
}
