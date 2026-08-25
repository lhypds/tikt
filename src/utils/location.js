// Optional geo tagging: while the "lo" switch in the top bar is on, every knot
// is saved with the coordinates of the spot where it was recorded. The browser
// only hands out a position once the user has granted permission, so flipping
// the switch on asks for it right away — a refused prompt flips it back off.
const LOCATION_STORAGE_KEY = "locationEnabled";
const FRESH_MS = 120000; // a fix this recent is reused as-is
const REQUEST_TIMEOUT_MS = 10000;
const CAPTURE_WAIT_MS = 1200; // how long saving a knot waits for a fix

let enabled = readStoredEnabled();
const listeners = new Set();
let cached = null; // { coords, at }
let inFlight = null;

function readStoredEnabled() {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function isLocationEnabled() {
  return enabled;
}

export function subscribeLocationEnabled(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function store(next) {
  enabled = next;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, enabled ? "yes" : "no");
  } catch {
    // best effort — the choice just won't persist
  }
  listeners.forEach((listener) => listener());
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Coarse positioning on purpose: a wifi/cell fix comes back in a few hundred
// milliseconds, where a GPS lock would outlast the press it belongs to.
function readPosition() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          coords: {
            latitude: round(position.coords.latitude, 6),
            longitude: round(position.coords.longitude, 6),
            accuracy: Number.isFinite(position.coords.accuracy)
              ? round(position.coords.accuracy, 1)
              : null,
          },
        }),
      (error) => resolve({ error }),
      { enableHighAccuracy: false, timeout: REQUEST_TIMEOUT_MS, maximumAge: FRESH_MS },
    );
  });
}

// One shared request at a time: a press primes it and the save that follows
// reuses the very same promise instead of asking the device twice.
function requestPosition() {
  if (inFlight) return inFlight;
  const request = readPosition().then((result) => {
    inFlight = null;
    if (result.coords) cached = { coords: result.coords, at: Date.now() };
    return result;
  });
  inFlight = request;
  return request;
}

function freshCoords() {
  if (!cached || Date.now() - cached.at > FRESH_MS) return null;
  return cached.coords;
}

function available() {
  return enabled && Boolean(navigator.geolocation);
}

// Returns "on" | "off" | "denied" | "unsupported".
export async function setLocationEnabled(next) {
  if (!next) {
    store(false);
    cached = null;
    return "off";
  }
  if (!navigator.geolocation) {
    store(false);
    return "unsupported";
  }
  store(true);
  // Asking straight away surfaces the permission prompt inside the click that
  // turned the switch on, and warms the cache for the first record.
  const { error } = await requestPosition();
  if (error && error.code === error.PERMISSION_DENIED) {
    store(false);
    return "denied";
  }
  return "on";
}

// Call when a press starts, so a fix is usually in hand by the time it ends.
export function primeLocation() {
  if (!available() || freshCoords()) return;
  requestPosition();
}

// Called while saving a knot: returns coordinates when one is already known or
// arrives quickly, and null otherwise — a knot is never held up by the device.
export async function captureLocation() {
  if (!available()) return null;
  const fresh = freshCoords();
  if (fresh) return fresh;
  const result = await Promise.race([
    requestPosition(),
    new Promise((resolve) => window.setTimeout(() => resolve(null), CAPTURE_WAIT_MS)),
  ]);
  return result?.coords ?? null;
}
