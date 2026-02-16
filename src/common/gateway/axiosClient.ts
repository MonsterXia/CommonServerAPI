import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export const request = axios.create();
request.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    return config;
}, (error) => {
    return Promise.reject(error);
});

request.interceptors.response.use((response: AxiosResponse) => {
    return response;
}, (error) => {
    return Promise.reject(error);
});

export default request;