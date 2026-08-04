import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView (used by Chat.tsx's auto-scroll)
// or matchMedia (some libs probe for it) — stub both so component tests
// don't crash on APIs the test DOM doesn't provide.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
