"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasUsers) router.push("/login");
      });
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      // Redirect to settings so admin can immediately copy the public key
      router.push("/dashboard/settings");
    } else {
      setError(data.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      <div className="w-1/2 flex flex-col justify-between bg-neutral-900 p-12">
        <h1 className="text-2xl font-semibold">FleetOps</h1>
        <div>
          <h2 className="text-3xl font-bold mb-4">First-time Setup</h2>
          <p className="text-gray-400">
            Welcome to FleetOPS. Create your admin account to get started
            managing your server fleet.
          </p>
        </div>
        <p className="text-gray-500 text-sm">
          "The open-source SSH fleet management platform."
        </p>
      </div>

      <div className="w-1/2 flex flex-col justify-center items-center bg-black">
        <form
          onSubmit={handleRegister}
          className="w-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800"
        >
          <h2 className="text-xl font-semibold mb-2 text-center">
            Create Admin Account
          </h2>
          <p className="text-center text-gray-400 mb-6 text-sm">
            This account will have full admin access.
          </p>

          <div className="mb-4">
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-green-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
