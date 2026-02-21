import gatewayManager from "@/common/gateway/gatewayManager";

declare global {
  var gatewayManager: gatewayManager | undefined
}

export const initGatewayManager = () => {
  if (!global.gatewayManager) {
    console.log('📡 Initializing Gateway Manager...');
    global.gatewayManager = gatewayManager.getInstance();
  }
}

export const getGatewayManager = () => {
  if (!global.gatewayManager) {
    global.gatewayManager = gatewayManager.getInstance();
  }
  return global.gatewayManager;
}