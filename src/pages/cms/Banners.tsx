import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Image, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api-url";
import { useCmsAuth } from "@/lib/cms-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface CmsBanner {
  id: string;
  kind: "news" | "offer" | "commercial";
  title: string;
  description: string;
  cta_label: string | null;
  href: string | null;
  cta_action: "open_tour" | "link" | null;
  theme: "warm" | "cool" | "offer" | "violet";
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const EMPTY_FORM = {
  kind: "news" as CmsBanner["kind"],
  title: "",
  description: "",
  cta_label: "",
  href: "",
  cta_action: "link" as "open_tour" | "link",
  theme: "warm" as CmsBanner["theme"],
  sort_order: "0",
  is_active: true,
  starts_at: "",
  ends_at: "",
};

export default function CmsBanners() {
  const { admin } = useCmsAuth();
  const canEdit = admin?.role === "super_admin" || admin?.role === "marketing";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banners, setBanners] = useState<CmsBanner[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CmsBanner | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/banners`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load banners");
      setBanners(data.banners ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBanners();
  }, [loadBanners]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (banner: CmsBanner) => {
    setEditing(banner);
    setForm({
      kind: banner.kind,
      title: banner.title,
      description: banner.description,
      cta_label: banner.cta_label || "",
      href: banner.href || "",
      cta_action: banner.cta_action === "open_tour" ? "open_tour" : "link",
      theme: banner.theme,
      sort_order: String(banner.sort_order),
      is_active: banner.is_active,
      starts_at: banner.starts_at || "",
      ends_at: banner.ends_at || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    const payload = {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim(),
      cta_label: form.cta_label.trim() || null,
      href: form.cta_action === "link" ? form.href.trim() || null : null,
      cta_action: form.cta_label.trim() ? form.cta_action : null,
      theme: form.theme,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    try {
      const res = await fetch(
        editing ? `${API_URL}/api/cms/banners/${editing.id}` : `${API_URL}/api/cms/banners`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save banner");
      toast.success(editing ? "Banner updated" : "Banner created");
      setDialogOpen(false);
      await loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit || !confirm("Delete this banner?")) return;
    try {
      const res = await fetch(`${API_URL}/api/cms/banners/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Banner deleted");
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const toggleActive = async (banner: CmsBanner) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`${API_URL}/api/cms/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !banner.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? data.banner : b))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Image className="h-7 w-7 text-primary" />
            Dashboard banners
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Carousel slides shown at the top of the restaurant dashboard — news, offers, and product
            commercials. Lower sort order appears first.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add banner
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All banners</CardTitle>
          <CardDescription>
            {canEdit
              ? "Marketing and super admin can create and edit. Others can view."
              : "Read-only access for your role."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : banners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No banners yet.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.map((banner) => (
                    <TableRow key={banner.id}>
                      <TableCell className="font-mono text-xs">{banner.sort_order}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{banner.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{banner.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {banner.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {banner.starts_at
                          ? format(new Date(banner.starts_at), "MMM d, yyyy")
                          : "—"}
                        {" → "}
                        {banner.ends_at
                          ? format(new Date(banner.ends_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={banner.is_active}
                          disabled={!canEdit}
                          onCheckedChange={() => void toggleActive(banner)}
                        />
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(banner)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void handleDelete(banner.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
            <DialogDescription>Shown on every restaurant owner dashboard carousel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as CmsBanner["kind"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={form.theme} onValueChange={(v) => setForm((f) => ({ ...f, theme: v as CmsBanner["theme"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm (orange)</SelectItem>
                    <SelectItem value="cool">Cool (blue)</SelectItem>
                    <SelectItem value="offer">Offer (green)</SelectItem>
                    <SelectItem value="violet">Violet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CTA label</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                  placeholder="Learn more"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CTA action</Label>
              <Select
                value={form.cta_action}
                onValueChange={(v) => setForm((f) => ({ ...f, cta_action: v as "open_tour" | "link" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link (internal path)</SelectItem>
                  <SelectItem value="open_tour">Open app tour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.cta_action === "link" && (
              <div className="space-y-2">
                <Label>Link path</Label>
                <Input
                  value={form.href}
                  onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                  placeholder="/addons"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts (optional)</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends (optional)</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
              <Label>Active on dashboard</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !canEdit}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
