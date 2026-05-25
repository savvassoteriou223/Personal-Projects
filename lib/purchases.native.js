// Stub — swap back to `export { default, LOG_LEVEL } from 'react-native-purchases'`
// once you have a native EAS build with real RC keys.
const noop = () => {};
const noopAsync = () => Promise.resolve({});

const Purchases = {
  setLogLevel: noop,
  configure: noop,
  logIn: noopAsync,
  logOut: noopAsync,
  getCustomerInfo: () => Promise.resolve({ entitlements: { active: {} } }),
  getOfferings: () => Promise.resolve({ current: { availablePackages: [] } }),
  purchasePackage: () => Promise.resolve({ customerInfo: { entitlements: { active: {} } } }),
  restorePurchases: () => Promise.resolve({ entitlements: { active: {} } }),
};

export default Purchases;
export const LOG_LEVEL = { ERROR: 'error' };
