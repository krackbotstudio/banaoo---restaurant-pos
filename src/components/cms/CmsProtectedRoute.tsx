import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCmsAuth } from "@/lib/cms-auth";

export function CmsProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useCmsAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !admin) {
      navigate("/cms/login", { replace: true });
    }
  }, [admin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!admin) return null;

  return <>{children}</>;
}
