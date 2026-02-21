export interface R2RequsetConfig {
    onlyIf?: Headers;
    httpMetadata?: Headers;
}

class R2Manager {
    private _r2: R2Bucket;

    constructor(r2: R2Bucket) {
        this._r2 = r2;
    }

    async getObject(key: string, config?: R2RequsetConfig): Promise<R2ObjectBody | null> {
        try {
            const object = await this._r2.get(key, config);
            return object;
        } catch (error) {
            console.error(`Error fetching object with key ${key} from R2:`, error);
            return null;
        }
    }

    async putObject(key: string, value: string | ArrayBuffer | ReadableStream, config?: R2RequsetConfig): Promise<boolean> {
        try {
            await this._r2.put(key, value, config);
            return true;
        } catch (error) {
            console.error(`Error putting object with key ${key} to R2:`, error);
            return false;
        }
    }

    async deleteObject(key: string): Promise<boolean> {
        try {
            await this._r2.delete(key);
            return true;
        } catch (error) {
            console.error(`Error deleting object with key ${key} from R2:`, error);
            return false;
        }
    }
}

export default R2Manager;