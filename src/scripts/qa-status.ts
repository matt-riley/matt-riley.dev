import "../styles/qa-status.css";

// Opt-in, local-only status for the real-device acceptance visit.
const root = document.documentElement;
const status = document.createElement("p");
status.className = "qa-status mono";
status.setAttribute("aria-live", "off");
function sync() {
  const tier = root.dataset.galleryQuality;
  status.textContent =
    root.dataset.gallery === "ready" && tier
      ? `Test quality: ${tier}`
      : root.dataset.view === "catalogue" ||
          root.dataset.gallery === "unavailable"
        ? "Test view: catalogue"
        : "Test view: gallery loading";
}
sync();
new MutationObserver(sync).observe(root, {
  attributes: true,
  attributeFilter: ["data-gallery", "data-gallery-quality", "data-view"],
});
document.body.append(status);
