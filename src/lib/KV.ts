declare global {
  var KV: KVNamespace | undefined
}

export const initKV = (env: { KV: KVNamespace }) => {
  if (!global.KV) {
    console.log('🗝️  Initializing KV Namespace...');
    global.KV = env.KV;
  }
}

export const getKV = () => {
  if (!global.KV) {
    throw new Error("KV Namespace is not initialized");
  }
  return global.KV;
}