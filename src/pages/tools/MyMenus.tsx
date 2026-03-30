import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, MoreVertical, Edit, Trash2, ExternalLink, Copy, Eye, Loader2 } from "lucide-react";
import { MenuData } from "@/lib/menu-encoder";

interface SavedMenu {
  id: string;
  slug: string;
  restaurant_name: string;
  tagline: string | null;
  logo_url: string | null;
  currency: string;
  menu_data: MenuData;
  views_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function MyMenus() {
  const { user, getImageUrl } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<SavedMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMenus();
    }
  }, [user]);

  const fetchMenus = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_menus')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setMenus((data || []).map(item => ({
        ...item,
        menu_data: item.menu_data as unknown as MenuData
      })));
    } catch (err) {
      console.error('Error fetching menus:', err);
      toast.error("Failed to load menus");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/menu/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleDelete = async () => {
    if (!deleteMenuId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('saved_menus')
        .delete()
        .eq('id', deleteMenuId);

      if (error) throw error;
      
      setMenus(menus.filter(m => m.id !== deleteMenuId));
      toast.success("Menu deleted");
    } catch (err) {
      console.error('Error deleting menu:', err);
      toast.error("Failed to delete menu");
    } finally {
      setIsDeleting(false);
      setDeleteMenuId(null);
    }
  };

  const getItemCount = (menu: SavedMenu) => {
    return menu.menu_data?.categories?.reduce((sum, cat) => sum + (cat.items?.length || 0), 0) || 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Menus</h1>
            <p className="text-muted-foreground">
              Manage your saved QR menus
            </p>
          </div>
          <Button asChild>
            <Link to="/tools/qr-menu-builder">
              <Plus className="h-4 w-4 mr-2" />
              Create New Menu
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : menus.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground mb-4">
                <p className="text-lg font-medium">No menus yet</p>
                <p className="text-sm">Create your first QR menu to get started</p>
              </div>
              <Button asChild>
                <Link to="/tools/qr-menu-builder">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Menu
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Card key={menu.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {menu.logo_url ? (
                      <img
                        src={getImageUrl(menu.logo_url)}
                        alt={menu.restaurant_name}
                        className="w-12 h-12 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {menu.restaurant_name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {menu.restaurant_name}
                      </CardTitle>
                      {menu.tagline && (
                        <p className="text-sm text-muted-foreground truncate">
                          {menu.tagline}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/tools/qr-menu-builder?edit=${menu.slug}`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyLink(menu.slug)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/menu/${menu.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Menu
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteMenuId(menu.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>{getItemCount(menu)} items</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {menu.views_count}
                      </span>
                    </div>
                    <span>Updated {formatDate(menu.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMenuId} onOpenChange={() => setDeleteMenuId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The menu will be permanently deleted and the QR code will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
