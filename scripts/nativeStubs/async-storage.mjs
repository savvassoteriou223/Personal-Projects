// In-memory AsyncStorage stand-in for Node tests.
const store = new Map();

const AsyncStorage = {
  async getItem(k) { return store.has(k) ? store.get(k) : null; },
  async setItem(k, v) { store.set(k, String(v)); },
  async removeItem(k) { store.delete(k); },
};

export function __clear() { store.clear(); }
export default AsyncStorage;
