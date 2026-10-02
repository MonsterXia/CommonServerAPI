import axios from 'axios';

export const request = axios.create({
    adapter: 'fetch',
    // Workers rejects Axios's browser default cache mode before sending requests.
    fetchOptions: { cache: 'no-store' },
});

export default request;
