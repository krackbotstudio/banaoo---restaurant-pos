import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, UserPlus, Store, Phone, Edit2,
  Trash2, AlertCircle, KeyRound, ShieldCheck, Copy, CheckCircle2, ExternalLink,
} from "lucide-react";
import { ALL_MODULES, ROLE_DEFAULT_PERMISSIONS, ModuleKey } from "@/lib/use-staff-permissions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  pin_code: string | null;
  username: string | null;
  system_email: string | null;
  is_active: boolean;
  notes: string | null;
  outlet_ids: string[];
  page_permissions: string[] | null;
}

interface StaffCredentials {
  username: string;
  pin: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "manager",  label: "Manager",  color: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
  { value: "chef",     label: "Chef",     color: "bg-orange-500/20 text-orange-600 border-orange-500/30" },
  { value: "waiter",   label: "Waiter",   color: "bg-green-500/20 text-green-600 border-green-500/30" },
  { value: "cashier",  label: "Cashier",  color: "bg-purple-500/20 text-purple-600 border-purple-500/30" },
  { value: "staff",    label: "Staff",    color: "bg-muted text-muted-foreground border-border" },
] as const;

const STAFF_EMAIL_DOMAIN = "banaoo-staff.app";
// Supabase requires min 6 chars — prefix PIN internally; staff still type 4 digits
const PIN_PREFIX = "bn_";

function generateUsername(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${first}.${suffix}`;
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  role: "staff",
  pin_code: "",
  notes: "",
  outlet_ids: [] as string[],
  page_permissions: null as string[] | null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleStyle(role: string) {
  return ROLES.find((r) => r.value === role)?.color ?? "bg-muted text-muted-foreground";
}

function getRoleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

// ── Staff Card ────────────────────────────────────────────────────────────────

function StaffCard({
  member,
  outlets,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  member: StaffMember;
  outlets: Outlet[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const assigned = outlets.filter((o) => member.outlet_ids.includes(o.id));

  return (
    <Card
      className={`group transition-all duration-200 ${
        !member.is_active
          ? "opacity-55 border-border/40"
          : "hover:border-primary/50 hover:shadow-md"
      }`}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 border-2 border-primary/20 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {getInitials(member.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                {member.full_name}
              </h3>
              <Badge
                variant="outline"
                className={`${getRoleStyle(member.role)} text-xs capitalize shrink-0`}
              >
                {getRoleLabel(member.role)}
              </Badge>
            </div>

            {member.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0" />
                {member.phone}
              </p>
            )}

            {member.username ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 shrink-0" />
                <span className="font-mono">{member.username}</span>
                <span className="text-muted-foreground/50">· PIN ••••</span>
              </p>
            ) : member.pin_code ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 shrink-0" />
                PIN: ••••
              </p>
            ) : null}

            {assigned.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {assigned.map((o) => (
                  <Badge key={o.id} variant="secondary" className="text-xs">
                    <Store className="h-2.5 w-2.5 mr-1" />
                    {o.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">No outlets assigned</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Switch
              checked={member.is_active}
              onCheckedChange={onToggleActive}
              className="scale-[0.8]"
            />
            <span className="text-xs text-muted-foreground">
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={onEdit}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [credentials, setCredentials] = useState<StaffCredentials | null>(null);
  const [copied, setCopied] = useState<"username" | "pin" | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: outletsData }, { data: staffData }] = await Promise.all([
      supabase.from("outlets").select("id, name").eq("owner_id", user!.id).order("created_at"),
      supabase
        .from("staff_members")
        .select("*, staff_outlet_links(outlet_id)")
        .eq("owner_id", user!.id)
        .order("created_at"),
    ]);

    setOutlets(outletsData ?? []);
    setStaff(
      (staffData ?? []).map((s: any) => ({
        ...s,
        outlet_ids: (s.staff_outlet_links ?? []).map((l: any) => l.outlet_id),
        page_permissions: s.page_permissions ?? null,
        username: s.username ?? null,
        system_email: s.system_email ?? null,
      }))
    );
    setLoading(false);
  };

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      page_permissions: [...(ROLE_DEFAULT_PERMISSIONS["staff"] ?? [])],
    });
    setDialogOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setForm({
      full_name: member.full_name,
      phone: member.phone ?? "",
      email: member.email ?? "",
      role: member.role,
      pin_code: member.pin_code ?? "",
      notes: member.notes ?? "",
      outlet_ids: [...member.outlet_ids],
      page_permissions: member.page_permissions ?? [...(ROLE_DEFAULT_PERMISSIONS[member.role] ?? [])],
    });
    setDialogOpen(true);
  };

  const copyToClipboard = async (text: string, field: "username" | "pin") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleOutlet = (outletId: string) => {
    setForm((prev) => ({
      ...prev,
      outlet_ids: prev.outlet_ids.includes(outletId)
        ? prev.outlet_ids.filter((id) => id !== outletId)
        : [...prev.outlet_ids, outletId],
    }));
  };

  const toggleModule = (key: string) => {
    setForm((prev) => {
      const current = prev.page_permissions ?? [];
      return {
        ...prev,
        page_permissions: current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key],
      };
    });
  };

  // When role changes in the form, reset permissions to new role's defaults
  const handleRoleChange = (role: string) => {
    setForm((prev) => ({
      ...prev,
      role,
      page_permissions: [...(ROLE_DEFAULT_PERMISSIONS[role] ?? [])],
    }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      const isNew = !editingId;
      let staffId = editingId;

      // For new staff: generate login credentials
      const username = isNew ? generateUsername(form.full_name) : undefined;
      const pin = isNew ? (form.pin_code || generatePin()) : form.pin_code || undefined;
      const systemEmail = isNew ? `${username}@${STAFF_EMAIL_DOMAIN}` : undefined;

      if (isNew && pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
        toast({ variant: "destructive", title: "PIN must be exactly 4 digits" });
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        owner_id: user!.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        role: form.role,
        notes: form.notes.trim() || null,
        page_permissions: form.page_permissions ?? ROLE_DEFAULT_PERMISSIONS[form.role] ?? [],
      };

      if (isNew) {
        payload.username = username;
        payload.system_email = systemEmail;
        payload.pin_code = pin;
      } else if (pin) {
        payload.pin_code = pin;
      }

      if (editingId) {
        const { error } = await supabase
          .from("staff_members")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("staff_members")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        staffId = data.id;
      }

      // Re-sync outlet assignments
      await supabase.from("staff_outlet_links").delete().eq("staff_member_id", staffId);
      if (form.outlet_ids.length > 0) {
        const { error } = await supabase.from("staff_outlet_links").insert(
          form.outlet_ids.map((outlet_id) => ({ staff_member_id: staffId!, outlet_id }))
        );
        if (error) throw error;
      }

      setCredentials({ username: username!, pin });

      setDialogOpen(false);
      if (!isNew) {
        toast({ title: "Staff member updated" });
      }
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("staff_members").delete().eq("id", deleteId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Staff member removed" });
      setStaff((prev) => prev.filter((s) => s.id !== deleteId));
    }
    setDeleteId(null);
    setDeleting(false);
  };

  // ── Toggle active ──────────────────────────────────────────────────────────

  const handleToggleActive = async (member: StaffMember) => {
    const { error } = await supabase
      .from("staff_members")
      .update({ is_active: !member.is_active })
      .eq("id", member.id);
    if (!error) {
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, is_active: !s.is_active } : s))
      );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={Users}
            title="No Outlets Found"
            description="Create an outlet first before managing staff"
            actionLabel="Go to Outlets"
            onAction={() => (window.location.href = "/outlets")}
          />
        </div>
      </AppLayout>
    );
  }

  const activeStaff = staff.filter((s) => s.is_active);
  const inactiveStaff = staff.filter((s) => !s.is_active);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Staff</h1>
              <p className="text-sm text-muted-foreground">
                {activeStaff.length} active · {inactiveStaff.length} inactive
              </p>
            </div>
          </div>
          <Button className="gradient-primary glow-primary h-10" onClick={openAdd}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
        </div>

        {/* Staff Login Info Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Staff login portal</p>
                <p className="text-xs text-muted-foreground">
                  Share this link with your team — they log in with their username & PIN
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <code className="text-xs bg-background border border-border rounded px-2 py-1 font-mono select-all">
                {window.location.origin}/staff-login
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/staff-login`);
                  toast({ title: "Link copied!" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => window.open("/staff-login", "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Staff list */}
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Staff Members"
            description="Add your first team member to get started"
            actionLabel="Add Staff Member"
            onAction={openAdd}
          />
        ) : (
          <div className="space-y-8">
            {activeStaff.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Active — {activeStaff.length}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeStaff.map((m) => (
                    <StaffCard
                      key={m.id}
                      member={m}
                      outlets={outlets}
                      onEdit={() => openEdit(m)}
                      onDelete={() => setDeleteId(m.id)}
                      onToggleActive={() => handleToggleActive(m)}
                    />
                  ))}
                </div>
              </section>
            )}

            {inactiveStaff.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Inactive — {inactiveStaff.length}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactiveStaff.map((m) => (
                    <StaffCard
                      key={m.id}
                      member={m}
                      outlets={outlets}
                      onEdit={() => openEdit(m)}
                      onDelete={() => setDeleteId(m.id)}
                      onToggleActive={() => handleToggleActive(m)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update staff details and outlet assignments"
                : "Add a new team member and assign them to outlets"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Ravi Kumar"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                className="h-11"
                autoFocus
              />
            </div>

            {/* Phone + PIN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>4-Digit PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={form.pin_code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pin_code: e.target.value.replace(/\D/g, "") }))
                  }
                  className="h-11 text-center tracking-widest"
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select
                value={form.role}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Outlet assignment */}
            <div className="space-y-1.5">
              <Label>Assign to Outlets</Label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 min-h-[52px]">
                {outlets.map((outlet) => (
                  <Badge
                    key={outlet.id}
                    variant={form.outlet_ids.includes(outlet.id) ? "default" : "outline"}
                    className="cursor-pointer select-none transition-all"
                    onClick={() => toggleOutlet(outlet.id)}
                  >
                    <Store className="h-3 w-3 mr-1" />
                    {outlet.name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click badges to assign or unassign</p>
            </div>

            {/* Module Access */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label>Module Access</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose which pages this staff member can access. Defaults are set by role.
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
                {ALL_MODULES.map((mod) => {
                  const active = (form.page_permissions ?? []).includes(mod.key);
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => toggleModule(mod.key)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all select-none ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground border border-border hover:border-primary/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-primary-foreground" : "bg-muted-foreground/40"}`} />
                      {mod.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {(form.page_permissions ?? []).length} of {ALL_MODULES.length} modules enabled
              </p>
            </div>

            {/* Notes (optional) */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Morning shift, handles delivery"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 gradient-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Save Changes"
              ) : (
                "Add Staff Member"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Staff Credentials Dialog ── */}
      <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Staff Account Created
            </DialogTitle>
            <DialogDescription>
              Share these credentials with your team member so they can log in at{" "}
              <a
                href="/staff-login"
                target="_blank"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {window.location.origin}/staff-login
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-lg font-semibold tracking-wider">{credentials?.username}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => credentials && copyToClipboard(credentials.username, "username")}
                  >
                    {copied === "username" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/50" />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-3xl font-bold tracking-[0.3em]">{credentials?.pin}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => credentials && copyToClipboard(credentials.pin, "pin")}
                  >
                    {copied === "pin" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Save this PIN now — it won't be shown again in full.
            </p>

            <Button className="w-full" onClick={() => setCredentials(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Remove Staff Member?
            </DialogTitle>
            <DialogDescription>
              This will permanently remove them from your team and all outlet assignments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
