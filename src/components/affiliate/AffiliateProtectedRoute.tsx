import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api-url";

interface AffiliateProtectedRouteProps {
  children: React.ReactNode;
}

export function AffiliateProtectedRoute({ children }: AffiliateProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [affiliateStatus, setAffiliateStatus] = useState<"pending" | "approved" | "suspended" | null>(null);
  const [checkingAffiliate, setCheckingAffiliate] = useState(true);

  useEffect(() => {
    const checkAffiliate = async () => {
      if (!user) {
        setCheckingAffiliate(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/affiliate/me`, { credentials: "include" });
        if (!res.ok) {
          setAffiliateStatus(null);
        } else {
          const payload = await res.json();
          const status = payload?.affiliate?.status as "pending" | "approved" | "suspended" | undefined;
          setAffiliateStatus(status || null);
        }
      } catch (err) {
        console.error("Error:", err);
        setAffiliateStatus(null);
      } finally {
        setCheckingAffiliate(false);
      }
    };

    if (!authLoading) {
      checkAffiliate();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/affiliate/auth");
      return;
    }

    if (!checkingAffiliate && user) {
      if (!affiliateStatus) {
        navigate("/affiliate/auth");
        return;
      }
      if (affiliateStatus !== "approved") {
        navigate(`/affiliate/auth?status=${affiliateStatus}`);
      }
    }
  }, [authLoading, user, checkingAffiliate, affiliateStatus, navigate]);

  if (authLoading || checkingAffiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || affiliateStatus !== "approved") {
    return null;
  }

  return <>{children}</>;
}
