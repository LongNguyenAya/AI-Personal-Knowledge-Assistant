// URL của backend-service đọc từ env, hardcode sẽ hỏng ngay khi deploy vì mỗi môi trường trỏ tới backend-service khác nhau.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
