import postgres from "postgres";

// Chạy 1 lần khi bật requireEmailVerification — tài khoản tạo trước mốc này chưa từng qua bước
// xác nhận email (tính năng chưa có lúc đó), nên ân xá thay vì khoá ngược họ khỏi tài khoản
// đang dùng bình thường.
//
// Cần CUTOFF — không có nó, lỡ chạy nhầm lần 2 sẽ ân xá luôn cả user mới đăng ký thật sự chưa
// xác nhận, vô hiệu hoá tính năng này cho mọi người từ đó về sau.
const CUTOFF = new Date("2026-08-11T00:00:00Z"); // ngày requireEmailVerification được bật

const sql = postgres(process.env.DATABASE_ADMIN_URL!);

async function main() {
  const updated = await sql`
    UPDATE users SET email_verified = true
    WHERE email_verified = false AND created_at < ${CUTOFF}
    RETURNING email
  `;
  console.log(`Đã ân xá ${updated.length} tài khoản:`, updated.map((r) => r.email));
  await sql.end();
}

main();
