import { AxiosInstance } from "axios";
import request from "./axiosClient";
import { dominHypergraph } from "../config/predefinedDomin";

class gatewayManager {
    private static _instance: gatewayManager;
    private _axiosInstance: AxiosInstance;

    private constructor() {
        this._axiosInstance = request;
    }

    public static getInstance(): gatewayManager {
        if (!gatewayManager._instance) {
            gatewayManager._instance = new gatewayManager();
            console.log("Gateway Manager initialized");
        }
        return gatewayManager._instance;
    }

    public buildHypergryphURL(endpoint: string): string {
        console.log(`Building Hypergryph URL for endpoint: ${endpoint}`);
        console.log(`Base Hypergryph URL: ${dominHypergraph.hypergryph}`);
        return this.urlBuilder(dominHypergraph.hypergryph, endpoint);
    }

    public buildSKLandURL(endpoint: string): string {
        return this.urlBuilder(dominHypergraph.skland, endpoint);
    }

    private urlBuilder(baseURL: string, endpoint: string): string {
        if (!baseURL.endsWith('/')) {
            baseURL += '/';
        }

        if (endpoint.startsWith('/')) {
            endpoint = endpoint.substring(1);
        }

        return `${baseURL}${endpoint}`;
    }


    public async get<T>(url: string, params?: any, config?: any): Promise<T> {
        const response = await this._axiosInstance.get<T>(url, { params, ...config });
        return response.data;
    }

    public async post<T>(url: string, data?: any, config?: any): Promise<T> {
        const response = await this._axiosInstance.post<T>(url, data, config);
        return response.data;
    }

    public async put<T>(url: string, data?: any, config?: any): Promise<T> {
        const response = await this._axiosInstance.put<T>(url, data, config);
        return response.data;
    }

    public async delete<T>(url: string, config?: any): Promise<T> {
        const response = await this._axiosInstance.delete<T>(url, config);
        return response.data;
    }
}

export default gatewayManager;