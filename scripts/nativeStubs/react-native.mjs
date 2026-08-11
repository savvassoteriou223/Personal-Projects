// Minimal react-native stand-in so lib/ modules that branch on Platform.OS can be
// unit-tested under plain Node. Only add what a test actually needs.
export const Platform = { OS: 'ios' };
export function __setPlatform(os) { Platform.OS = os; }
