import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AffiliateProtectedRouteProps {
  children: React.ReactNode;
}

export function AffiliateProtectedRoute({ children }: AffiliateProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAffiliate, setIsAffiliate] = useState<boolean | null>(null);
  const [checkingAffiliate, setCheckingAffiliate] = useState(true);

  useEffect(() => {
    const checkAffiliate = async () => {
      if (!user) {
        setCheckingAffiliate(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("affiliates")
          .select("id, status")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking affiliate:", error);
          setIsAffiliate(false);
        } else {
          setIsAffiliate(!!data);
        }
      } catch (err) {
        console.error("Error:", err);
        setIsAffiliate(false);
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

    if (!checkingAffiliate && !isAffiliate && user) {
      navigate("/affiliate/auth");
    }
  }, [authLoading, user, checkingAffiliate, isAffiliate, navigate]);

  if (authLoading || checkingAffiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAffiliate) {
    return null;
  }

  return <>{children}</>;
}
