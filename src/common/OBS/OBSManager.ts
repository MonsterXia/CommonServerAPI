import { Bindings } from "@/index";
import R2Manager from "./r2";

class OBSManager {
    private _r2 : R2Manager;

    constructor(env: Bindings) {
        this._r2 = new R2Manager(env.OBS);
    }

    public getObject(obsType: string, key: string, config?: any) {
        if (obsType === 'r2') {
            return this._r2.getObject(key, config);
        } else {
            throw new Error(`Unsupported OBS type: ${obsType}`);
        }
        
    }

    public putObject(obsType: string, key: string, value: string | ArrayBuffer | ReadableStream, config?: any) {
        if (obsType === 'r2') {
            return this._r2.putObject(key, value, config);
        } else {
            throw new Error(`Unsupported OBS type: ${obsType}`);
        }
    }

    public deleteObject(obsType: string, key: string) {
        if (obsType === 'r2') {
            return this._r2.deleteObject(key);
        } else {
            throw new Error(`Unsupported OBS type: ${obsType}`);
        }
    }
}

export default OBSManager;