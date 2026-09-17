import axios from "axios";

const apiClient = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",

  timeout: 10000,

  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  // Later we'll attach JWT here
  // const token = localStorage.getItem("token");

  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    console.error(error);
    return Promise.reject(error);
  }
);

export default apiClient;