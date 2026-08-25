// mapbox-gl is loaded from public/vendor at runtime rather than imported, so the
// production build never has to parse and re-bundle its 1.8MB dist — see
// scripts/copy-mapbox.js, which puts the file there.
const SCRIPT_URL = "/vendor/mapbox-gl.js";
const STYLE_URL = "/vendor/mapbox-gl.css";

let pending = null;

function loadStyles() {
  if (document.querySelector(`link[href="${STYLE_URL}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLE_URL;
  document.head.appendChild(link);
}

export function loadMapbox() {
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    loadStyles();
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("mapbox-gl did not initialize"));
    };
    script.onerror = () => {
      // A failed load is worth retrying — the next map that mounts asks again.
      pending = null;
      script.remove();
      reject(new Error("failed to load mapbox-gl"));
    };
    document.head.appendChild(script);
  });
  return pending;
}
