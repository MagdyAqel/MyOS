import "./mobile.css";
export const COMPACT_QUERY =
  "(max-width: 650px), (max-width: 950px) and (max-height: 500px), (pointer: coarse) and (max-width: 1024px)";
export function setupMobileViewport() {
  const media = matchMedia(COMPACT_QUERY);
  function update() {
    const viewport = window.visualViewport;
    const height =
      viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
    const keyboard =
      viewport && viewport.scale === 1
        ? Math.max(0, window.innerHeight - height - viewport.offsetTop)
        : 0;
    document.documentElement.style.setProperty(
      "--app-height",
      `${Math.round(height)}px`,
    );
    document.documentElement.style.setProperty(
      "--keyboard-inset",
      `${Math.round(keyboard)}px`,
    );
    document.documentElement.toggleAttribute("data-compact", media.matches);
  }
  update();
  window.addEventListener("resize", update);
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  media.addEventListener("change", update);
}
