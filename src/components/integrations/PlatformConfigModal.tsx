import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  description: string;
  logo: string;
  color: string;
  available: boolean;
}

interface PlatformConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  outletId: string;
  onSuccess: () => void;
}

export function PlatformConfigModal({
  open,
  onOpenChange,
  platform,
  outletId,
  onSuccess,
}: PlatformConfigModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [credentials, setCredentials] = useState({
    apiKey: "",
    apiSecret: "",
    restaurantId: "",
  });

  // Generate webhook URL - using Express API endpoints
  const API_URL = import.meta.env.VITE_API_URL ?? "";
  const webhookUrl = `${API_URL || window.location.origin}/api/webhooks/${platform.id}?outlet_id=${outletId}`;

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
  };

  const handleConnect = async () => {
    if (!credentials.apiKey || !credentials.restaurantId) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields" });
      return;
    }

    setLoading(true);

    try {
      // Check if integration already exists
      const { data: existing } = await supabase
        .from("platform_integrations")
        .select("id")
        .eq("outlet_id", outletId)
        .eq("platform", platform.id)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("platform_integrations")
          .update({
            credentials: {
              api_key: credentials.apiKey,
              api_secret: credentials.apiSecret,
              restaurant_id: credentials.restaurantId,
            },
            is_active: true,
            status: "connected",
            webhook_url: webhookUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("platform_integrations")
          .insert({
            outlet_id: outletId,
            platform: platform.id,
            credentials: {
              api_key: credentials.apiKey,
              api_secret: credentials.apiSecret,
              restaurant_id: credentials.restaurantId,
            },
            is_active: true,
            status: "connected",
            webhook_url: webhookUrl,
          });

        if (error) throw error;
      }

      toast({ title: "Connected!", description: `${platform.name} integration is now active` });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center text-xl`}>
              {platform.logo}
            </div>
            <div>
              <DialogTitle>Connect {platform.name}</DialogTitle>
              <DialogDescription>
                Enter your API credentials to enable integration
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="restaurantId">Restaurant ID *</Label>
            <Input
              id="restaurantId"
              placeholder={`Your ${platform.name} restaurant ID`}
              value={credentials.restaurantId}
              onChange={(e) => setCredentials({ ...credentials, restaurantId: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              value={credentials.apiKey}
              onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret (optional)</Label>
            <Input
              id="apiSecret"
              type="password"
              placeholder="Enter your API secret"
              value={credentials.apiSecret}
              onChange={(e) => setCredentials({ ...credentials, apiSecret: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Copy this URL and add it to your {platform.name} partner dashboard to receive orders
            </p>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhook}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-1">How to get credentials:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
              <li>Log in to your {platform.name} Partner Portal</li>
              <li>Navigate to Settings → API/Integrations</li>
              <li>Generate or copy your API credentials</li>
              <li>Add the webhook URL above to receive orders</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Connect {platform.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
