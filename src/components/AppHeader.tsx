import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.png.asset.json";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Award, LayoutGrid, ShieldCheck, LogOut, MessagesSquare, UserRound } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/painel" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="Logo DezOrganizada Furiosa" className="h-10 w-10" />
          <span className="hidden font-display text-lg leading-none sm:block">
            DezOrganizada <span className="text-primary">Furiosa</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/painel">
              <LayoutGrid /> <span className="hidden sm:inline">Painel</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/certificados">
              <Award /> <span className="hidden sm:inline">Certificados</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/chat">
              <MessagesSquare /> <span className="hidden sm:inline">Chat</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/perfil">
              <UserRound /> <span className="hidden sm:inline">Perfil</span>
            </Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin">
                <ShieldCheck /> <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sair">
            <LogOut />
          </Button>
        </nav>
      </div>
    </header>
  );
}
