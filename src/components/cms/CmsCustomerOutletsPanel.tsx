import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  LocateFixed,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  QrCode,
  Store,
  Trash2,
} from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-setup";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { OrderingLinkRow } from "@/components/customer/OrderingLinkRow";

export interface CmsOutletRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  operation_mode?: "standard" | "self_service" | null;
  created_at?: string;
}

interface Props {
  userId: string;
  initialOutlets?: CmsOutletRow[];
  brandName?: string | null;
  orderingSlug?: string | null;
  onChanged?: () => void;
}

type FormState = {
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  operation_mode: "standard" | "self_service";
};

const emptyForm: FormState = {
  name: "",
  address: "",
  phone: "",
  latitude: null,
  longitude: null,
  operation_mode: "standard",
};

function MapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMove(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapPosition({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

function PickupLocationMap({
  latitude,
  longitude,
  onMove,
}: {
  latitude: number | null;
  longitude: number | null;
  onMove: (lat: number, lng: number) => void;
}) {
  return (
    <div className="h-56 overflow-hidden rounded-lg border">
      <MapContainer
        center={[latitude ?? 20.5937, longitude ?? 78.9629]}
        zoom={latitude == null ? 5 : 16}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <MapSizeInvalidator />
        <MapClickHandler onMove={onMove} />
        {latitude != null && longitude != null && (
          <>
            <Marker
              position={[latitude, longitude]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const position = marker.getLatLng();
                  onMove(position.lat, position.lng);
                },
              }}
            />
            <MapPosition lat={latitude} lng={longitude} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

export function CmsCustomerOutletsPanel({
  userId,
  initialOutlets,
  brandName,
  orderingSlug,
  onChanged,
}: Props) {
  const [outlets, setOutlets] = useState<CmsOutletRow[]>(initialOutlets ?? []);
  const [loading, setLoading] = useState(initialOutlets === undefined);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CmsOutletRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CmsOutletRow | null>(null);
  const [orderingTarget, setOrderingTarget] = useState<CmsOutletRow | null>(null);
  const [locating, setLocating] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const displayBrand = brandName?.trim() || null;

  const loadOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/outlets`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load outlets");
      setOutlets(data.outlets ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load outlets");
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialOutlets !== undefined) {
      setOutlets(initialOutlets);
      setLoading(false);
      return;
    }
    void loadOutlets();
  }, [userId, initialOutlets, loadOutlets]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (outlet: CmsOutletRow) => {
    setEditing(outlet);
    setForm({
      name: outlet.name || "",
      address: outlet.address || "",
      phone: outlet.phone || "",
      latitude: outlet.latitude == null ? null : Number(outlet.latitude),
      longitude: outlet.longitude == null ? null : Number(outlet.longitude),
      operation_mode: outlet.operation_mode === "self_service" ? "self_service" : "standard",
    });
    setDialogOpen(true);
  };

  const saveOutlet = async () => {
    if (!form.name.trim()) {
      toast.error("Outlet name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        operation_mode: form.operation_mode,
      };
      const res = editing
        ? await fetch(`${API_URL}/api/cms/customers/${userId}/outlets/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_URL}/api/cms/customers/${userId}/outlets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save outlet");
      toast.success(editing ? "Outlet updated" : "Outlet created");
      setDialogOpen(false);
      await loadOutlets();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save outlet");
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location access is not supported by this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setLocating(false);
      },
      () => {
        toast.error("Could not get the current location. Click the map to place the pin.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const activateOutlet = async (outlet: CmsOutletRow) => {
    if (outlet.is_active) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/customers/${userId}/outlets/${outlet.id}/activate`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to activate outlet");
      toast.success(`"${outlet.name}" is now active`);
      await loadOutlets();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate outlet");
    } finally {
      setSaving(false);
    }
  };

  const deleteOutlet = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/customers/${userId}/outlets/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete outlet");
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await loadOutlets();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete outlet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Outlets</CardTitle>
            <CardDescription>Create and edit outlet locations for this customer</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add outlet
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Total outlets: <strong className="text-foreground">{outlets.length}</strong>
            {outlets.length > 1 && (
              <span className="ml-1">(only one can be active at a time)</span>
            )}
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : outlets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <Store className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No outlets yet for this customer.</p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add first outlet
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {outlets.map((outlet) => (
                <div
                  key={outlet.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{outlet.name}</p>
                      <Badge variant={outlet.is_active ? "default" : "secondary"}>
                        {outlet.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {outlet.operation_mode && (
                        <Badge variant="outline">{outlet.operation_mode}</Badge>
                      )}
                    </div>
                    {outlet.address && (
                      <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{outlet.address}</span>
                      </p>
                    )}
                    {outlet.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {outlet.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOrderingTarget(outlet)}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR / Link
                    </Button>
                    {!outlet.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void activateOutlet(outlet)}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Set active
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(outlet)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(outlet)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit outlet" : "Add outlet"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this customer’s outlet details."
                : "Create a new outlet for this customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cms-outlet-name">Name *</Label>
              <Input
                id="cms-outlet-name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Main Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cms-outlet-address">Address</Label>
              <Textarea
                id="cms-outlet-address"
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                rows={2}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cms-outlet-phone">Phone</Label>
              <Input
                id="cms-outlet-phone"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="Contact number"
              />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label>Shiprocket pickup pin</Label>
                  <p className="text-xs text-muted-foreground">
                    Click or drag the map pin to set this outlet&apos;s exact pickup location.
                  </p>
                </div>
                <div className="flex gap-2">
                  {(form.latitude != null || form.longitude != null) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          latitude: null,
                          longitude: null,
                        }))
                      }
                    >
                      Clear pin
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={locating}
                    onClick={useCurrentLocation}
                  >
                    {locating ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <LocateFixed className="mr-1 h-4 w-4" />
                    )}
                    Use current location
                  </Button>
                </div>
              </div>
              <PickupLocationMap
                latitude={form.latitude}
                longitude={form.longitude}
                onMove={(latitude, longitude) =>
                  setForm((current) => ({ ...current, latitude, longitude }))
                }
              />
              {form.latitude != null && form.longitude != null ? (
                <p className="font-mono text-xs text-muted-foreground">
                  {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-amber-600">
                  Pickup pin not set. Shiprocket Quick bookings require outlet coordinates.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Operation mode</Label>
              <Select
                value={form.operation_mode}
                onValueChange={(v) =>
                  setForm((s) => ({
                    ...s,
                    operation_mode: v as FormState["operation_mode"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">standard</SelectItem>
                  <SelectItem value="self_service">self_service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveOutlet()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderingTarget} onOpenChange={(open) => !open && setOrderingTarget(null)}>
        <DialogContent className="flex max-h-[min(92vh,920px)] w-[calc(100vw-1.25rem)] max-w-4xl flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1.5 text-left">
            <DialogTitle className="pr-8">Online ordering — {orderingTarget?.name}</DialogTitle>
            <DialogDescription>
              Share this link or QR code so customers can order from this outlet.
            </DialogDescription>
          </DialogHeader>
          {orderingTarget && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
              <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                <OrderingLinkRow
                  label="Direct outlet link"
                  hint="Goes straight to this outlet"
                  url={`${origin}/r/${orderingTarget.id}`}
                  openPath={`/r/${orderingTarget.id}`}
                  restaurantName={displayBrand || orderingTarget.name}
                  outletName={orderingTarget.name}
                  showQr
                />
                {orderingSlug ? (
                  <OrderingLinkRow
                    label="Brand ordering page"
                    hint="All outlets with GPS distance"
                    url={`${origin}/order/${orderingSlug}`}
                    openPath={`/order/${orderingSlug}`}
                    restaurantName={displayBrand || orderingTarget.name}
                    showQr
                  />
                ) : (
                  <p className="h-fit text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3 self-start">
                    No brand ordering slug set yet. Configure it under Settings → Branding to also
                    share <span className="font-mono">/order/…</span>.
                  </p>
                )}
              </div>
              {(orderingTarget.latitude == null || orderingTarget.longitude == null) && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    No GPS pin on this outlet — brand page won&apos;t show distance. Edit the outlet
                    and set the pickup pin.
                  </span>
                </p>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0 sm:justify-end">
            <Button variant="outline" onClick={() => setOrderingTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete outlet?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <strong>{deleteTarget?.name}</strong> and related outlet data (menu, orders linked to
              it may fail). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteOutlet()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
