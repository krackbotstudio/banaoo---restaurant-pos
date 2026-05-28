import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Shield, UserCog, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCmsAuth } from "@/lib/cms-auth";
import { API_URL } from "@/lib/api-url";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ROLES: Array<{ key: "super_admin" | "support" | "billing" | "marketing"; scope: string }> = [
  { key: "super_admin", scope: "Full platform and CMS configuration access" },
  { key: "support", scope: "Customer operations and account interventions" },
  { key: "billing", scope: "Payments, invoices, and subscription operations" },
  { key: "marketing", scope: "Leads, affiliates, and dashboard carousel banners" },
];

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "support" | "billing" | "marketing";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function CmsRoles() {
  const { admin } = useCmsAuth();
  const isSuperAdmin = admin?.role === "super_admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "support" as AdminUser["role"],
  });

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [users]
  );

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/admin-users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load admin users");
      setUsers(data.admin_users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      void loadUsers();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/admin-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin user");
      toast.success("Admin user created");
      setNewUser({ email: "", password: "", full_name: "", role: "support" });
      setUsers((prev) => [data.admin_user, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create admin user");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (id: string, payload: Partial<Pick<AdminUser, "role" | "is_active">>) => {
    try {
      const res = await fetch(`${API_URL}/api/cms/admin-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update admin user");
      setUsers((prev) => prev.map((u) => (u.id === id ? data.admin_user : u)));
      toast.success("Admin user updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin user");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage CMS staff users and role-based permissions.
          </p>
        </div>
        <Badge variant="secondary">Phase 5</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Current signed-in role
          </CardTitle>
          <CardDescription>
            {admin ? `${admin.email} · ${admin.role}` : "No active admin session"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Super admin access confirmed. Role management actions will be enabled once CMS role APIs are added."
            : "Only super_admin users should be allowed to create or deactivate CMS staff accounts."}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Defined role model
          </CardTitle>
          <CardDescription>Matches role constraints from `admin_users.role`</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ROLES.map((role) => (
            <div key={role.key} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>
                <strong>{role.key}</strong>: {role.scope}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Invite CMS admin
              </CardTitle>
              <CardDescription>Create an admin user with a role and temporary password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createUser} className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
                    placeholder="name@tectangle.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Full name</Label>
                  <Input
                    value={newUser.full_name}
                    onChange={(e) => setNewUser((s) => ({ ...s, full_name: e.target.value }))}
                    placeholder="Team Member"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser((s) => ({ ...s, role: value as AdminUser["role"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Temporary password</Label>
                  <Input
                    type="password"
                    minLength={8}
                    value={newUser.password}
                    onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create admin"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">CMS admin users</CardTitle>
              <CardDescription>Active and inactive operator accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : sortedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No CMS admin users found.</p>
              ) : (
                sortedUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          void updateUser(user.id, { role: value as AdminUser["role"] })
                        }
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.key} value={role.key}>
                              {role.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={user.is_active ? "outline" : "secondary"}
                        size="sm"
                        onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                        disabled={admin?.id === user.id && user.is_active}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Restricted</CardTitle>
            <CardDescription>Only super admins can manage CMS users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Super admin required
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
