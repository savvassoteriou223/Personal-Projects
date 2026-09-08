// Uses the REAL RevenueCat SDK in native EAS builds (where the RNPurchases
// native module is linked) and falls back to a no-op stub only in Expo Go,
// where that module isn't present. This lets the app still run in Expo Go for
// development while shipping working billing in production.
//
// NOTE: this file previously exported the stub unconditionally, which meant the
// app never talked to RevenueCat at all — offerings came back empty (price "—")
// and purchases were no-ops. Do not revert to an unconditional stub.
import { NativeModules } from 'react-native';

let Purchases;
let LOG_LEVEL;

if (NativeModules.RNPurchases) {
  const RC = require('react-native-purchases');
  Purchases = RC.default;
  LOG_LEVEL = RC.LOG_LEVEL;
} else {
  const noop = () => {};
  const noopAsync = () => Promise.resolve({});
  Purchases = {
    setLogLevel: noop,
    configure: noop,
    logIn: noopAsync,
    logOut: noopAsync,
    getCustomerInfo: () => Promise.resolve({ entitlements: { active: {} } }),
    getOfferings: () => Promise.resolve({ current: { availablePackages: [] } }),
    purchasePackage: () => Promise.resolve({ customerInfo: { entitlements: { active: {} } } }),
    restorePurchases: () => Promise.resolve({ entitlements: { active: {} } }),
  };
  LOG_LEVEL = { ERROR: 'error' };
}

export default Purchases;
export { LOG_LEVEL };
