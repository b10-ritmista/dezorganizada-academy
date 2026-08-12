import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCertificateTemplates,
  fetchMembers,
  fetchMyCertificates,
  fetchMyProfile,
  grantRole,
  revokeRole,
  updateMyProfile,
} from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CertificateView } from "@/components/CertificateView";
import { toast } from "sonner";
import { Award, ShieldCheck, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Dados pessoais, certificados em PDF e, para administradores, controle de acessos da bateria DezOrganizada Furiosa.",
      },
      { property: "og:title", content: "Meu perfil — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Suas informações, certificados e permissões na bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: PerfilPage,
});

type CertRow = {
  id: string;
  code: string;
  issued_at: string;
  instrument_id: string;
  instruments: { name: string; slug: string } | null;
};

function PerfilPage() {
  const { user, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: Boolean(user?.id),
  });
  const certs = useQuery({ queryKey: ["certificates"], queryFn: fetchMyCertificates });
  const templates = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: fetchCertificateTemplates,
  });

  const [name, setName] = useState<string | null>(null);
  const currentName = name ?? profile.data?.full_name ?? "";

  const save = useMutation({
    mutationFn: async (value: string) => updateMyProfile(user!.id, value),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => toast.error("Não foi possível salvar o perfil."),
  });

  const rows = (certs.data ?? []) as unknown as CertRow[];
  const studentName = profile.data?.full_name || user?.email || "Membro";
  const templateFor = (instrumentId: string) =>
    (templates.data ?? []).find((t) => t.instrument_id === instrumentId) ??
    (templates.data ?? []).find((t) => t.instrument_id === null) ??
    null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl">Meu perfil</h1>
      <p className="mt-2 text-muted-foreground">
        {isAdmin
          ? "Suas informações, certificados e o controle de acessos do sistema."
          : "Suas informações pessoais e os certificados conquistados."}
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-2xl">
          <UserRound className="size-5 text-primary" /> Informações pessoais
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = currentName.trim();
            if (value.length < 2) {
              toast.error("Informe seu nome completo.");
              return;
            }
            save.mutate(value.slice(0, 120));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome completo</Label>
            <Input
              id="full-name"
              value={currentName}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Seu nome como sairá no certificado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={profile.data?.email ?? user?.email ?? ""} readOnly disabled />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              Salvar informações
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Papel no sistema: {isAdmin ? "Administrador" : "Aluno"} · Membro desde{" "}
          {profile.data?.created_at
            ? new Date(profile.data.created_at).toLocaleDateString("pt-BR")
            : "—"}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-2xl">
          <Award className="size-5 text-primary" /> Meus certificados
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Você ainda não tem certificados. Conclua todas as etapas de um instrumento.
          </p>
        ) : (
          <div className="mt-4 space-y-10">
            {rows.map((cert) => (
              <CertificateView
                key={cert.id}
                studentName={studentName}
                template={templateFor(cert.instrument_id)}
                cert={{
                  id: cert.id,
                  code: cert.code,
                  issued_at: cert.issued_at,
                  instrumentName: cert.instruments?.name ?? "Instrumento",
                }}
              />
            ))}
          </div>
        )}
      </section>

      {isAdmin && <AccessControl currentUserId={user?.id ?? ""} />}
    </main>
  );
}

function AccessControl({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const members = useQuery({ queryKey: ["members"], queryFn: fetchMembers });

  const toggle = useMutation({
    mutationFn: async (p: { userId: string; role: "admin" | "student"; grant: boolean }) =>
      p.grant ? grantRole(p.userId, p.role) : revokeRole(p.userId, p.role),
    onSuccess: () => {
      toast.success("Acessos atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Não foi possível atualizar os acessos."),
  });

  const term = search.trim().toLowerCase();
  const list = (members.data ?? []).filter(
    (m) =>
      !term ||
      (m.full_name ?? "").toLowerCase().includes(term) ||
      (m.email ?? "").toLowerCase().includes(term),
  );

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-2xl">
        <ShieldCheck className="size-5 text-accent" /> Controle de acessos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Defina quem é aluno e quem é administrador do sistema.
      </p>
      <Input
        className="mt-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou e-mail"
      />

      <ul className="mt-4 divide-y divide-border">
        {list.map((m) => {
          const isAdminMember = m.roles.includes("admin");
          const isStudent = m.roles.includes("student");
          const self = m.id === currentUserId;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.full_name || "Sem nome"}</p>
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {isAdminMember ? "Administrador" : isStudent ? "Aluno" : "Sem papel"}
              </span>
              <Button
                size="sm"
                variant={isAdminMember ? "outline" : "default"}
                disabled={toggle.isPending || (self && isAdminMember)}
                onClick={() =>
                  toggle.mutate({ userId: m.id, role: "admin", grant: !isAdminMember })
                }
              >
                {isAdminMember ? "Remover admin" : "Tornar admin"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ userId: m.id, role: "student", grant: !isStudent })}
              >
                {isStudent ? "Remover aluno" : "Tornar aluno"}
              </Button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">Nenhum membro encontrado.</li>
        )}
      </ul>
    </section>
  );
}
