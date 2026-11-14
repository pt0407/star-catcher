export function loadItem(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

export function saveItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}
