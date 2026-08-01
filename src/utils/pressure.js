const MAXIMUM_PRESSURE = 0.98;
const MAXIMUM_CONFIRMATION = 0.75;
const POINTER_DEFAULT_PRESSURE = 0.5;
const PRESSURE_EPSILON = 0.01;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createTouchForceState() {
  return {
    confirmed: false,
    lastValue: null,
    highestNonMaximum: 0,
  };
}

export function resetTouchForceState(state) {
  state.confirmed = false;
  state.lastValue = null;
  state.highestNonMaximum = 0;
}

// Touch.force is normalized to 0..1. Some iOS/WebKit combinations emit an
// isolated value of 1 at the edge of a gesture even when the press is light.
// Accept 1 only after the gesture has genuinely ramped toward maximum.
export function readReliableTouchForce(rawForce, state) {
  const force = Number(rawForce);
  if (!Number.isFinite(force) || force <= 0) return null;

  const normalized = clamp(force, 0, 1);
  if (normalized >= MAXIMUM_PRESSURE && state.highestNonMaximum < MAXIMUM_CONFIRMATION) {
    return state.lastValue ?? 0.01;
  }

  state.confirmed = true;
  state.lastValue = normalized;
  if (normalized < MAXIMUM_PRESSURE) {
    state.highestNonMaximum = Math.max(state.highestNonMaximum, normalized);
  }
  return normalized;
}

export function createPointerPressureState() {
  return {
    confirmed: false,
    lastValue: null,
    highestNonMaximum: 0,
  };
}

export function resetPointerPressureState(state) {
  state.confirmed = false;
  state.lastValue = null;
  state.highestNonMaximum = 0;
}

// Pointer Events use 0.5 while an unsupported pointer is held down. Wait for
// the value to vary before treating it as real pressure.
export function readReliablePointerPressure(rawPressure, state) {
  const pressure = Number(rawPressure);
  if (!Number.isFinite(pressure) || pressure <= 0) return null;

  const normalized = clamp(pressure, 0, 1);
  if (!state.confirmed) {
    const isUnsupportedDefault = Math.abs(normalized - POINTER_DEFAULT_PRESSURE) <= PRESSURE_EPSILON;
    const isUnconfirmedMaximum = normalized >= MAXIMUM_PRESSURE;
    if (isUnsupportedDefault || isUnconfirmedMaximum) return null;
    state.confirmed = true;
  }

  if (normalized >= MAXIMUM_PRESSURE && state.highestNonMaximum < MAXIMUM_CONFIRMATION) {
    return state.lastValue;
  }

  state.lastValue = normalized;
  if (normalized < MAXIMUM_PRESSURE) {
    state.highestNonMaximum = Math.max(state.highestNonMaximum, normalized);
  }
  return normalized;
}

// A press gesture tracks per-signal reliability state plus the strongest
// reading seen so far; the meter is driven by the peak so a sensor reading
// that drifts back toward zero mid-press cannot drag the value down.
export function createPressGestureState() {
  return {
    touchForce: createTouchForceState(),
    pointerPressure: createPointerPressureState(),
    peak: 0,
  };
}

export function resetPressGestureState(state) {
  resetTouchForceState(state.touchForce);
  resetPointerPressureState(state.pointerPressure);
  state.peak = 0;
}

// No web API reports whether the device has a real pressure sensor. Devices
// without one (iPhones since the XR) still emit a synthesized Touch.force —
// a single estimate at touchdown that only decays afterwards — while a real
// sensor produces readings that rise as the press gets harder. So support is
// confirmed only after readings rise mid-gesture, and a positive verdict is
// remembered across sessions. Until then intensity stays time-driven.
const SUPPORT_STORAGE_KEY = "pressureSupported";
const SUPPORT_RISE_MARGIN = 0.05;
const SUPPORT_CONFIRM_RISES = 2;

export function createPressureSupport() {
  let confirmed = false;
  try {
    confirmed = localStorage.getItem(SUPPORT_STORAGE_KEY) === "yes";
  } catch {
    // storage unavailable — detection simply reruns next session
  }
  return { confirmed, highest: null, rises: 0 };
}

export function resetPressureSupportGesture(state) {
  state.highest = null;
  state.rises = 0;
}

// Feed one reliable reading; returns whether the device is confirmed to
// have a real pressure sensor.
export function observePressureReading(state, value) {
  if (state.confirmed) return true;
  if (state.highest === null) {
    state.highest = value;
    return false;
  }
  if (value > state.highest + SUPPORT_RISE_MARGIN) {
    state.rises += 1;
    if (state.rises >= SUPPORT_CONFIRM_RISES) {
      state.confirmed = true;
      try {
        localStorage.setItem(SUPPORT_STORAGE_KEY, "yes");
      } catch {
        // best effort — the verdict just won't persist
      }
    }
  }
  state.highest = Math.max(state.highest, value);
  return state.confirmed;
}
