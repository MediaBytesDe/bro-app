"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { User } from "@/types/database";

const roleLabels: Record<string, string> = { admin: "Admin", user: "Benutzer", viewer: "Betrachter" };
const roleColors: Record<string, string> = { admin: "text-orange-400", user: "text-blue-400", viewer: "text-neutral-400" };

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    email: "",
    role: "user" as User["role"],
    active: true,
  });

  const supabase = createClient();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from("users").select("*").order("created_at");
    setUsers(data || []);
    setLoading(false);
  }

  function openNew() {
    setEditingUser(null);
    setForm({ username: "", display_name: "", email: "", role: "user", active: true });
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({
      username: user.username,
      display_name: user.display_name || "",
      email: user.email || "",
      role: user.role || "mitarbeiter",
      active: user.active ?? true,
    });
    setShowForm(true);
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form };

    if (editingUser) {
      // Don't update username
      const { username, ...updatePayload } = payload;
      await supabase.from("users").update(updatePayload).eq("id", editingUser.id);
    } else {
      await supabase.from("users").insert(payload);
    }
    setShowForm(false);
    await loadUsers();
  }

  async function toggleActive(user: User) {
    await supabase.from("users").update({ active: !user.active }).eq("id", user.id);
    await loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm("Benutzer wirklich löschen?")) return;
    await supabase.from("users").delete().eq("id", id);
    await loadUsers();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Benutzerverwaltung</h2>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          <span>Benutzer</span>
        </button>
      </div>

      {loading ? (
        <div className="empty-state py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((user) => (
            <div key={user.id} className={`user-card ${!user.active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                  {user.display_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white">{user.display_name || user.username}</h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>@{user.username}</span>
                    <span className={`px-1.5 py-0.5 rounded ${roleColors[user.role || "mitarbeiter"]} bg-white/5`}>
                      {roleLabels[user.role || "mitarbeiter"]}
                    </span>
                    {!user.active && <span className="text-red-400">Inaktiv</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleActive(user)}
                    className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                    title={user.active ? "Deaktivieren" : "Aktivieren"}
                  >
                    {user.active ? "✓" : "○"}
                  </button>
                  <button
                    onClick={() => openEdit(user)}
                    className="p-2 rounded-lg text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {user.email && <p className="text-xs text-neutral-600 mt-2 pl-[52px]">{user.email}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingUser ? "Benutzer bearbeiten" : "Neuer Benutzer"}>
        <form onSubmit={saveUser} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Benutzername *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                className="input"
                placeholder="z.B. andre"
                disabled={!!editingUser}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Anzeigename</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="input"
                placeholder="z.B. André Freese"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="email@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rolle</label>
              <select
                value={form.role || "mitarbeiter"}
                onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}
                className="input"
              >
                <option value="admin">Admin</option>
                <option value="user">Benutzer</option>
                <option value="viewer">Betrachter</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={form.active ? "true" : "false"}
              onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
              className="input"
            >
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              Speichern
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
