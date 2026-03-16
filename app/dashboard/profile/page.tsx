"use client";

import { useState, useEffect, useRef } from "react";
import { User, Eye, EyeOff, Save, Camera, X } from "lucide-react";



export default function ProfilePage() {
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [email, setEmail]           = useState("");
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [avatar, setAvatar]         = useState("");
  const [photo, setPhoto]           = useState<string>("");   // base64 data URL
  const [showCurr, setShowCurr]     = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setFirstName(d.first_name ?? "");
        setLastName(d.last_name ?? "");
        setEmail(d.email ?? "");
        setAvatar(d.avatar ?? "");
        setPhoto(d.photo ?? "");
      });
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: "error", text: "Photo must be under 2 MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setAvatar(""); // clear emoji when photo is set
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const body: any = { firstName, lastName, email, avatar, photo };
    if (newPw) { body.currentPassword = currentPw; body.newPassword = newPw; }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMsg({ type: "error", text: data.error ?? "Failed to save" });
    } else {
      // Update state from saved response so UI reflects what's in the DB
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setEmail(data.email ?? "");
      setAvatar(data.avatar ?? "");
      setPhoto(data.photo ?? "");
      setCurrentPw("");
      setNewPw("");
      setMsg({ type: "success", text: "Profile updated successfully" });
      window.dispatchEvent(new Event("profileUpdated"));
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase() || "A";

  // Decide what to show in the avatar preview
  const avatarPreview = photo ? (
    <img src={photo} alt="avatar" className="w-full h-full object-cover rounded-full" />
  ) : avatar ? (
    <span className="text-2xl">{avatar}</span>
  ) : (
    <span className="text-sm font-bold">{initials}</span>
  );

  return (
    <div className="min-h-full flex items-center justify-center p-6 text-white">
      <form onSubmit={handleSave} className="w-full max-w-2xl">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <User size={18} className="text-neutral-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Account</h2>
                <p className="text-xs text-neutral-500">Change the details of your profile here.</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-2">Profile Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatarPreview}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded-lg hover:bg-neutral-700 transition"
                  >
                    <Camera size={13} />
                    Upload photo
                  </button>
                  {photo && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-red-400 text-xs rounded-lg hover:bg-neutral-700 transition"
                    >
                      <X size={13} />
                      Remove photo
                    </button>
                  )}
                  <p className="text-xs text-neutral-600">JPG, PNG or GIF · Max 2 MB</p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                suppressHydrationWarning
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
              />
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurr ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Required only if changing password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
                <button type="button" onClick={() => setShowCurr((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1}>
                  {showCurr ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>


            {/* Feedback */}
            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                msg.type === "success"
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
              }`}>
                {msg.text}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
