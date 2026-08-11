// URL của backend-service, đọc từ env — trước đây hardcode localhost:4000 lặp lại ở 3 chỗ,
// sẽ hỏng ngay khi deploy vì mỗi môi trường cần trỏ tới backend-service khác nhau.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
