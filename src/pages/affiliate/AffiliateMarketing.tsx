import { useAffiliate } from "@/hooks/use-affiliate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Download, Share2, MessageSquare, Mail, LinkIcon } from "lucide-react";

export default function AffiliateMarketing() {
  const { affiliate, loading } = useAffiliate();

  const referralLink = affiliate
    ? `${window.location.origin}/auth?ref=${affiliate.referral_code}`
    : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const socialMessages = {
    whatsapp: `🍽️ Running a restaurant? Check out Flaze - the easiest way to manage your restaurant!\n\nSign up with my link and start your free trial: ${referralLink}`,
    twitter: `I've been using @flazee for restaurant management and it's been a game changer! 🚀\n\nCheck it out: ${referralLink}`,
    email: {
      subject: "Transform Your Restaurant with Flaze",
      body: `Hi there,\n\nI wanted to share an amazing restaurant management platform I've been recommending - Flaze.\n\nIt helps restaurants with:\n- Digital menu management\n- Order management\n- Kitchen display system\n- Analytics and reporting\n\nYou can start with a free trial using my referral link:\n${referralLink}\n\nLet me know if you have any questions!\n\nBest regards`,
    },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Marketing Materials</h1>
        <p className="text-muted-foreground">Resources to help you promote Flaze</p>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link with potential customers to earn commissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="font-mono text-sm" />
            <Button onClick={() => copyToClipboard(referralLink, "Referral link")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(socialMessages.whatsapp)}`,
                  "_blank"
                )
              }
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    socialMessages.twitter
                  )}`,
                  "_blank"
                )
              }
            >
              <Share2 className="h-4 w-4 mr-2" />
              Twitter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `mailto:?subject=${encodeURIComponent(
                    socialMessages.email.subject
                  )}&body=${encodeURIComponent(socialMessages.email.body)}`,
                  "_blank"
                )
              }
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pre-written Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-written Messages</CardTitle>
          <CardDescription>Copy and customize these messages for your promotions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WhatsApp / SMS Message</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(socialMessages.whatsapp, "Message")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={socialMessages.whatsapp}
              readOnly
              className="min-h-[100px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Twitter / Social Post</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(socialMessages.twitter, "Message")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={socialMessages.twitter}
              readOnly
              className="min-h-[80px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email Template</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `Subject: ${socialMessages.email.subject}\n\n${socialMessages.email.body}`,
                    "Email"
                  )
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={socialMessages.email.body}
              readOnly
              className="min-h-[180px] text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">🎯 Target the right audience:</strong> Focus on
            restaurant owners, café managers, and food business operators.
          </p>
          <p>
            <strong className="text-foreground">💬 Personalize your outreach:</strong> Customize
            the pre-written messages with specific pain points you know the restaurant faces.
          </p>
          <p>
            <strong className="text-foreground">📱 Use multiple channels:</strong> Share on
            WhatsApp groups, social media, and through personal recommendations.
          </p>
          <p>
            <strong className="text-foreground">🤝 Build relationships:</strong> Follow up with
            referrals to help them get started and ensure they have a great experience.
          </p>
          <p>
            <strong className="text-foreground">📊 Track your results:</strong> Monitor which
            channels bring the most conversions and double down on what works.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
