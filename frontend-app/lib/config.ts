// backend-service's URL is read from env, hardcoding it would break immediately at deploy since each environment points to a different backend-service.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
