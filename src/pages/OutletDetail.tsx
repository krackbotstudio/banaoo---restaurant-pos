import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, MapPin, Phone, Clock, Edit, ArrowLeft, Trash2, LayoutGrid, Link2, Copy, ExternalLink, Navigation } from "lucide-react";
import { OrderingQRCode } from "@/components/customer/OrderingQRCode";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// These must be module-level (not nested) so React doesn't recreate component types on each render
function OutletMapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMove(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function OutletMapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 16, { animate: true, duration: 0.5 }); }, [lat, lng, map]);
  return null;
}

// Fixes Leaflet rendering inside Dialog — map container has 0 size until Dialog is fully open
function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function OutletMapPicker({ lat, lng, onMove }: { lat: number | null; lng: number | null; onMove: (lat: number, lng: number) => void }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height: 200 }}>
      <MapContainer
        center={[lat ?? 20.5937, lng ?? 78.9629]}
        zoom={lat ? 15 : 5}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://openstreetmap.org">OSM</a>' />
        <MapSizeInvalidator />
        <OutletMapClickHandler onMove={onMove} />
        {lat !== null && lng !== null && (
          <>
            <Marker
              position={[lat, lng]}
              draggable
              eventHandlers={{ dragend: (e) => { const m = e.target as L.Marker; onMove(m.getLatLng().lat, m.getLatLng().lng); } }}
            />
            <OutletMapFlyTo lat={lat} lng={lng} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
import { FloorPlanEditor } from "@/components/floor-plan/FloorPlanEditor";
interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  opening_time: string | null;
  closing_time: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export default function OutletDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOpeningTime, setEditOpeningTime] = useState("");
  const [editClosingTime, setEditClosingTime] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchOutlet();
    }
  }, [user, id]);

  const fetchOutlet = async () => {
    const { data, error } = await supabase
      .from("outlets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Outlet not found" });
      navigate("/outlets");
      return;
    }

    setOutlet(data);
    setEditName(data.name);
    setEditAddress(data.address || "");
    setEditPhone(data.phone || "");
    setEditOpeningTime(data.opening_time || "");
    setEditClosingTime(data.closing_time || "");
    setEditIsActive(data.is_active);
    setEditLat(data.latitude ?? null);
    setEditLng(data.longitude ?? null);
    setLoading(false);
  };

  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name is required" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("outlets")
      .update({
        name: editName.trim(),
        address: editAddress.trim() || null,
        phone: editPhone.trim() || null,
        opening_time: editOpeningTime || null,
        closing_time: editClosingTime || null,
        is_active: editIsActive,
        latitude: editLat,
        longitude: editLng,
      })
      .eq("id", id);

    setIsSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Success!", description: "Outlet updated" });
      setIsEditDialogOpen(false);
      fetchOutlet();
    }
  };

  const handleDeleteOutlet = async () => {
    if (!confirm("Are you sure you want to delete this outlet? This action cannot be undone.")) {
      return;
    }

    const { error } = await supabase.from("outlets").delete().eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Outlet has been deleted" });
      navigate("/outlets");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!outlet) {
    return (
      <AppLayout>
        <div className="p-6">
          <p>Outlet not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/outlets")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl gradient-primary glow-primary">
                <Store className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">{outlet.name}</h1>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  outlet.is_active 
                    ? "bg-accent/20 text-accent" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  {outlet.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Edit Outlet</DialogTitle>
                <DialogDescription>Update outlet details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateOutlet} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Outlet Name *</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Opening Time</Label>
                    <Input
                      type="time"
                      value={editOpeningTime}
                      onChange={(e) => setEditOpeningTime(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Closing Time</Label>
                    <Input
                      type="time"
                      value={editClosingTime}
                      onChange={(e) => setEditClosingTime(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
                {/* Location Pin */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Outlet Location (for GPS ordering)</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary font-medium flex items-center gap-1 disabled:opacity-50"
                        onClick={() => {
                          if (!navigator.geolocation) {
                            toast({ variant: "destructive", title: "Not supported", description: "Your browser does not support geolocation." });
                            return;
                          }
                          setGeoLocating(true);
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setEditLat(pos.coords.latitude);
                              setEditLng(pos.coords.longitude);
                              setShowLocationPicker(true);
                              setGeoLocating(false);
                            },
                            (err) => {
                              setGeoLocating(false);
                              const msg =
                                err.code === 1
                                  ? "Location access denied. Allow location in your browser settings and try again."
                                  : err.code === 2
                                  ? "Location unavailable. Try pinning on the map instead."
                                  : "Location request timed out. Try pinning on the map instead.";
                              toast({ variant: "destructive", title: "GPS failed", description: msg });
                            },
                            { timeout: 10000, enableHighAccuracy: true }
                          );
                        }}
                        disabled={geoLocating}
                      >
                        {geoLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                        {geoLocating ? "Locating…" : "Use GPS"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground font-medium flex items-center gap-1"
                        onClick={() => setShowLocationPicker(!showLocationPicker)}
                      >
                        <MapPin className="h-3 w-3" />
                        {showLocationPicker ? "Hide map" : "Pin on map"}
                      </button>
                    </div>
                  </div>
                  {(editLat && editLng) && !showLocationPicker && (
                    <p className="text-xs text-muted-foreground">
                      Pinned: {editLat.toFixed(5)}, {editLng.toFixed(5)}{" "}
                      <button type="button" className="text-destructive ml-1" onClick={() => { setEditLat(null); setEditLng(null); }}>Remove</button>
                    </p>
                  )}
                  {showLocationPicker && (
                    <OutletMapPicker lat={editLat} lng={editLng} onMove={(lat, lng) => { setEditLat(lat); setEditLng(lng); }} />
                  )}
                  {showLocationPicker && (
                    <p className="text-xs text-muted-foreground">Tap on the map or drag the pin to set location</p>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Active Status</span>
                  <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 h-11 gradient-primary" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs for Details and Table Editor */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details">Outlet Details</TabsTrigger>
            <TabsTrigger value="floor-plan" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Table Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Outlet Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{outlet.address || "Not set"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{outlet.phone || "Not set"}</p>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Operating Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {outlet.opening_time && outlet.closing_time
                      ? `${outlet.opening_time} - ${outlet.closing_time}`
                      : "Not set"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Online Ordering Link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  Customer Ordering Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Share this link with your customers so they can order online from their phones.</p>

                {/* Brand link (primary — shows all outlets with GPS) */}
                {profile?.ordering_slug && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Brand Ordering Page <span className="text-muted-foreground font-normal">(recommended — shows all outlets with GPS)</span></p>
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <span className="text-sm font-mono text-primary truncate flex-1">
                        {window.location.origin}/order/{profile.ordering_slug}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/order/${profile.ordering_slug}`); toast({ title: "Brand link copied!" }); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                        onClick={() => window.open(`/order/${profile.ordering_slug}`, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Direct outlet link */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Direct Outlet Link <span className="text-muted-foreground font-normal">(goes straight to this outlet)</span></p>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-muted-foreground truncate flex-1">
                      {window.location.origin}/r/{outlet.id}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/r/${outlet.id}`); toast({ title: "Link copied!" }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => window.open(`/r/${outlet.id}`, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <OrderingQRCode
                      url={`${window.location.origin}/r/${outlet.id}`}
                      restaurantName={profile?.brand_name || outlet.name}
                      outletName={outlet.name}
                    />
                  </div>
                </div>

                {!outlet.latitude && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    No GPS location set — customers won't see distance. Click Edit → Pin on map to add it.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => navigate(`/menu`)}>
                  View Menu
                </Button>
                <Button variant="outline" onClick={() => navigate(`/orders`)}>
                  View Orders
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteOutlet}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Outlet
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="floor-plan">
            <FloorPlanEditor outletId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
