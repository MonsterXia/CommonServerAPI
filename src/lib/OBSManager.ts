import OBSManager from "@/common/OBS/OBSManager";
import { Bindings } from "..";

declare global {
  var OBSManager: OBSManager | undefined
}

export const initOBSManager = (env: Bindings) => {
    if (!global.OBSManager) {
        console.log('☁️  Initializing OBS Manager...');
        global.OBSManager = new OBSManager(env);
    }
}

export const getOBSManager = () => {
    if (!global.OBSManager) {
        throw new Error("OBSManager is not initialized");
    }
    return global.OBSManager;
}

