import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ChefHat, Loader2, MapPin, Phone, Plus, Store, Trash2 } from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function Outlets() {
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete outlet state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      fetchOutlets();
    }
  }, [user]);

  const fetchOutlets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/outlets`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load outlets");
      }
      setOutlets((data as { outlets: Outlet[] }).outlets || []);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load outlets",
      });
      setOutlets([]);
    }
    setLoading(false);
  };

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Outlet name is required"
      });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    let createError: string | null = null;
    try {
      const res = await fetch(`${API_URL}/api/outlets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        createError = (payload as { error?: string }).error || "Could not create outlet";
      }
    } catch (e) {
      createError =
        e instanceof TypeError
          ? "Cannot reach API server. Check that the backend is running and VITE_API_URL matches it (e.g. http://localhost:5000)."
          : e instanceof Error
            ? e.message
            : "Network error";
    }
    setIsSubmitting(false);

    if (createError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: createError,
      });
    } else {
      toast({
        title: "Success!",
        description: "Outlet created successfully"
      });
      setName("");
      setAddress("");
      setPhone("");
      setIsDialogOpen(false);
      fetchOutlets();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, outlet: Outlet) => {
    e.preventDefault();
    e.stopPropagation();
    setOutletToDelete(outlet);
    setDeletePassword("");
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteOutlet = async () => {
    if (!outletToDelete || !user || !deletePassword) {
      setDeleteError("Please enter your password");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      // Verify password by attempting to sign in
      const { error: authError } = await signIn(user.email!, deletePassword);
      
      if (authError) {
        setDeleteError("Incorrect password. Please try again.");
        setIsDeleting(false);
        return;
      }

      const delRes = await fetch(`${API_URL}/api/outlets/${outletToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const delPayload = await delRes.json().catch(() => ({}));
      if (!delRes.ok) {
        throw new Error((delPayload as { error?: string }).error || "Failed to delete outlet");
      }

      toast({
        title: "Outlet Deleted",
        description: `"${outletToDelete.name}" and all its data has been permanently deleted.`,
      });

      setDeleteDialogOpen(false);
      setOutletToDelete(null);
      setDeletePassword("");
      fetchOutlets();

    } catch (error: unknown) {
      console.error("Error deleting outlet:", error);
      const message = error instanceof Error ? error.message : "Failed to delete outlet";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Outlets</h1>
              <p className="text-sm text-muted-foreground">Manage your restaurant locations</p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary glow-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Outlet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Add New Outlet</DialogTitle>
                <DialogDescription>
                  Create a new restaurant outlet to manage
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOutlet} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="outlet-name">Outlet Name *</Label>
                  <Input
                    id="outlet-name"
                    placeholder="e.g., Main Branch, Downtown"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outlet-address">Address</Label>
                  <Textarea
                    id="outlet-address"
                    placeholder="Full address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outlet-phone">Phone</Label>
                  <Input
                    id="outlet-phone"
                    type="tel"
                    placeholder="Contact number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 gradient-primary glow-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Outlet"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : outlets.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No Outlets Yet"
            description="Add your first restaurant outlet to get started with managing your business"
            actionLabel="Add Your First Outlet"
            onAction={() => setIsDialogOpen(true)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {outlets.map((outlet) => (
              <Link key={outlet.id} to={`/outlets/${outlet.id}`}>
                <Card className="group h-full hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer overflow-hidden relative">
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDeleteClick(e, outlet)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl gradient-primary glow-primary transition-transform group-hover:scale-110">
                        <ChefHat className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-semibold truncate text-lg group-hover:text-primary transition-colors">{outlet.name}</h3>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            outlet.is_active 
                              ? "bg-accent/20 text-accent" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {outlet.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {outlet.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            {outlet.address}
                          </p>
                        )}
                        {outlet.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            {outlet.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Outlet Permanently?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                  <p className="font-semibold text-destructive">⚠️ This action cannot be undone!</p>
                  <p className="text-sm text-muted-foreground">
                    Deleting <span className="font-semibold text-foreground">"{outletToDelete?.name}"</span> will permanently remove:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>All menu items and categories</li>
                    <li>All orders and order history</li>
                    <li>All table configurations</li>
                    <li>All staff assignments</li>
                    <li>All associated data</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delete-password" className="text-sm font-medium">
                    Enter your password to confirm
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Your account password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      setDeleteError("");
                    }}
                    className={deleteError ? "border-destructive" : ""}
                  />
                  {deleteError && (
                    <p className="text-sm text-destructive">{deleteError}</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setOutletToDelete(null);
                setDeletePassword("");
                setDeleteError("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOutlet}
              disabled={isDeleting || !deletePassword}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
