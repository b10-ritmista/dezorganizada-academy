import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logoAsset from "@/assets/logo.png.asset.json";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Escola DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Acesse sua conta para assistir às vídeo aulas de bateria da DezOrganizada Furiosa e acompanhar seu progresso.",
      },
      { property: "og:title", content: "Entrar — Escola DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Login e cadastro dos membros da bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "A senha precisa ter no mínimo 6 caracteres" }).max(72),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, { message: "Informe seu nome" }).max(100),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("not confirmed")
          ? "Confirme seu e-mail antes de entrar (veja sua caixa de entrada)."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      const code = (error as { code?: string }).code;
      const msg =
        code === "weak_password"
          ? "Senha fraca ou muito comum. Use uma senha mais forte (misture letras, números e símbolos)."
          : code === "user_already_exists" || error.message.includes("already")
            ? "E-mail já cadastrado. Use a aba Entrar."
            : error.message.includes("not allowed")
              ? "E-mail inválido. Confira o endereço digitado."
              : code === "over_email_send_rate_limit"
                ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
                : "Erro no cadastro. Tente novamente.";
      toast.error(msg);
      return;
    }
    if (data.session) {
      navigate({ to: "/painel", replace: true });
      return;
    }
    toast.success("Conta criada! Enviamos um link de confirmação para o seu e-mail.");
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-6 flex flex-col items-center gap-3">
        <img src={logoAsset.url} alt="Logo DezOrganizada Furiosa" className="h-16 w-16" />
        <span className="font-display text-xl">
          DezOrganizada <span className="text-primary">Furiosa</span>
        </span>
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <Tabs defaultValue="entrar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <form method="post" onSubmit={handleSignIn} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email-in">E-mail</Label>
                <Input id="email-in" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass-in">Senha</Label>
                <Input id="pass-in" name="password" type="password" required maxLength={72} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="cadastro">
            <form method="post" onSubmit={handleSignUp} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name-up">Nome completo</Label>
                <Input id="name-up" name="fullName" required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-up">E-mail</Label>
                <Input id="email-up" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass-up">Senha</Label>
                <Input
                  id="pass-up"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  maxLength={72}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Continuar com Google
        </Button>
      </div>
    </div>
  );
}
