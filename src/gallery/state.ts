// Type-only imports keep this subscription boundary safe in the eager entry.
import type { Cleanup, GalleryApp } from "./types";

// biome-ignore lint/suspicious/noConfusingVoidType: async mounts may deliberately return no cleanup.
type Mount = (app: GalleryApp) => void | Cleanup | Promise<void | Cleanup>;
interface Subscription {
  mount: Mount;
  release?: Cleanup;
}
const subscriptions = new Set<Subscription>();
let active: GalleryApp | undefined;

async function mountSubscription(subscription: Subscription, app: GalleryApp) {
  if (app.disposed || !subscriptions.has(subscription)) return;
  const cleanup = await subscription.mount(app);
  if (typeof cleanup !== "function") return;
  if (!subscriptions.has(subscription)) {
    cleanup();
    return;
  }
  let done = false;
  let unregister = () => {};
  const release = () => {
    unregister();
    if (!done) {
      done = true;
      cleanup();
    }
    if (subscription.release === release) subscription.release = undefined;
  };
  subscription.release = release;
  // addCleanup runs immediately if an async mount finishes after disposal.
  unregister = app.addCleanup(release);
}

export function onGalleryReady(mount: Mount): Cleanup {
  const subscription: Subscription = { mount };
  subscriptions.add(subscription);
  if (active && !active.disposed) {
    // A late optional enhancement cannot make the catalogue unusable.
    void mountSubscription(subscription, active).catch(() => {});
  }
  return () => {
    subscriptions.delete(subscription);
    subscription.release?.();
  };
}

export async function publishGallery(app: GalleryApp) {
  active = app;
  app.addCleanup(() => {
    if (active === app) active = undefined;
  });
  await Promise.all(
    [...subscriptions].map((subscription) =>
      mountSubscription(subscription, app),
    ),
  );
}
