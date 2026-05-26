import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";
import { MenuBuilderForm } from "@/components/tools/qr-menu/MenuBuilderForm";
import { MenuPreview } from "@/components/tools/qr-menu/MenuPreview";
import { QRCodeDisplay } from "@/components/tools/qr-menu/QRCodeDisplay";
import { ShareButtons } from "@/components/tools/qr-menu/ShareButtons";
import { MenuData } from "@/lib/menu-encoder";
import { ArrowLeft, Save, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const initialMenuData: MenuData = {
  restaurantName: "",
  tagline: "",
  categories: [],
  currency: "₹",
};

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${random}`;
}

export default function QRMenuBuilder() {
  const [menuData, setMenuData] = useState<MenuData>(initialMenuData);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Load menu if editing
  useEffect(() => {
    const editSlug = searchParams.get('edit');
    if (editSlug && user) {
      loadMenu(editSlug);
    }
  }, [searchParams, user]);

  const loadMenu = async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from('saved_menus')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;

      if (data) {
        const loadedMenuData = data.menu_data as unknown as MenuData;
        setMenuData({
          restaurantName: data.restaurant_name,
          tagline: data.tagline || "",
          logo: data.logo_url || loadedMenuData.logo,
          categories: loadedMenuData.categories || [],
          currency: data.currency,
        });
        setEditingMenuId(data.id);
        setSavedSlug(data.slug);
      }
    } catch (err) {
      console.error('Error loading menu:', err);
      toast.error("Failed to load menu");
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save your menu");
      navigate('/auth');
      return;
    }

    if (!menuData.restaurantName.trim()) {
      toast.error("Please enter a restaurant name");
      return;
    }

    setIsSaving(true);
    try {
      const slug = savedSlug || generateSlug(menuData.restaurantName);

      if (editingMenuId) {
        // Update existing menu
        const { error } = await supabase
          .from('saved_menus')
          .update({
            restaurant_name: menuData.restaurantName,
            tagline: menuData.tagline || null,
            logo_url: menuData.logo || null,
            currency: menuData.currency,
            menu_data: JSON.parse(JSON.stringify(menuData)),
          })
          .eq('id', editingMenuId);

        if (error) throw error;
        toast.success("Menu updated successfully!");
      } else {
        // Create new menu
        const { data, error } = await supabase
          .from('saved_menus')
          .insert({
            user_id: user.id,
            slug,
            restaurant_name: menuData.restaurantName,
            tagline: menuData.tagline || null,
            logo_url: menuData.logo || null,
            currency: menuData.currency,
            menu_data: JSON.parse(JSON.stringify(menuData)),
            is_published: true,
          })
          .select()
          .single();

        if (error) throw error;
        
        setEditingMenuId(data.id);
        setSavedSlug(data.slug);
        toast.success("Menu saved! You can now share the permanent link.");
      }
    } catch (err) {
      console.error('Error saving menu:', err);
      toast.error("Failed to save menu. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const savedMenuUrl = savedSlug 
    ? `${window.location.origin}/menu/${savedSlug}` 
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Free QR Menu Builder for Restaurants"
        description="Build a beautiful digital menu with QR code in minutes. Free QR menu builder for restaurants, cafes, cloud kitchens — no app to install, share via WhatsApp."
        path="/tools/qr-menu-builder"
        keywords={[
          "QR menu builder",
          "free QR menu maker",
          "digital restaurant menu",
          "QR code menu generator",
          "restaurant menu QR code",
        ]}
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools/qr-menu-builder" },
          { name: "QR Menu Builder", path: "/tools/qr-menu-builder" },
        ])}
      />
      <Navbar />
      
      <main className="flex-1 container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <div className="flex gap-2">
              {user && (
                <Button variant="outline" asChild>
                  <Link to="/my-menus">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    My Menus
                  </Link>
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingMenuId ? "Update Menu" : "Save Menu"}
              </Button>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-2">
            {editingMenuId ? "Edit Menu" : "QR Menu Builder"}
          </h1>
          <p className="text-muted-foreground">
            {editingMenuId 
              ? "Update your menu and the changes will reflect immediately."
              : "Create a digital menu for your restaurant, generate a QR code, and share it with customers."
            }
          </p>
          
          {savedMenuUrl && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                <span className="font-medium">Permanent link: </span>
                <a 
                  href={savedMenuUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  {savedMenuUrl}
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Build Your Menu</CardTitle>
              </CardHeader>
              <CardContent>
                <MenuBuilderForm menuData={menuData} onChange={setMenuData} />
              </CardContent>
            </Card>
          </div>

          {/* Preview & QR */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <MenuPreview menuData={menuData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <QRCodeDisplay menuData={menuData} savedSlug={savedSlug} />
                <div className="mt-4">
                  <ShareButtons menuData={menuData} savedSlug={savedSlug} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile Layout - Tabs */}
        <div className="lg:hidden">
          <Tabs defaultValue="build">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="build">Build</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="qr">QR Code</TabsTrigger>
            </TabsList>

            <TabsContent value="build" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <MenuBuilderForm menuData={menuData} onChange={setMenuData} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <MenuPreview menuData={menuData} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <QRCodeDisplay menuData={menuData} savedSlug={savedSlug} />
                  <div className="mt-6">
                    <ShareButtons menuData={menuData} savedSlug={savedSlug} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
