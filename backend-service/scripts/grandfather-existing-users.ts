import postgres from "postgres";

// Chạy 1 lần khi bật requireEmailVerification — tài khoản tạo trước mốc này chưa qua bước xác
// nhận (tính năng chưa có lúc đó), ân xá thay vì khoá ngược. Cần CUTOFF, không thì chạy nhầm lần 2 sẽ ân xá luôn user mới thật sự chưa xác nhận.
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
