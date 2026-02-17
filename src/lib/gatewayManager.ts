import gatewayManager from "../common/gateway/gatewayManager";

declare global {
  var gatewayManager: gatewayManager | undefined
}

export const getGatewayManager = () => {
  if (!global.gatewayManager) {
    global.gatewayManager = gatewayManager.getInstance();
  }
  return global.gatewayManager;
}