"use client";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await signIn.email({ email, password });
    if (error) {
      alert(error.message);
      return;
    }

    // Điều hướng theo role
    if (data.user.role === "admin") {
      router.push("/admin/dashboard");
    } else {
      router.push("/chat");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
      <button type="submit">Đăng nhập</button>
    </form>
  );
}