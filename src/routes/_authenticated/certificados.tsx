import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCertificateTemplates,
  fetchMyCertificates,
  fetchMyProfile,
} from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";
import { CertificateView } from "@/components/CertificateView";

export const Route = createFileRoute("/_authenticated/certificados")({
  head: () => ({
    meta: [
      { title: "Meus certificados — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Veja e baixe em PDF os certificados conquistados por instrumento na escola de bateria da DezOrganizada Furiosa.",
      },
      { property: "og:title", content: "Meus certificados — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Certificados de conclusão por instrumento da bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: Certificados,
});

type CertRow = {
  id: string;
  code: string;
  issued_at: string;
  instrument_id: string;
  instruments: { name: string; slug: string } | null;
};

function Certificados() {
  const { user } = useCurrentUser();
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: Boolean(user?.id),
  });
  const studentName =
    profile.data?.full_name ||
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    user?.email ||
    "Membro";

  const certs = useQuery({ queryKey: ["certificates"], queryFn: fetchMyCertificates });
  const templates = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: fetchCertificateTemplates,
  });
  const rows = (certs.data ?? []) as unknown as CertRow[];

  const templateFor = (instrumentId: string) =>
    (templates.data ?? []).find((t) => t.instrument_id === instrumentId) ??
    (templates.data ?? []).find((t) => t.instrument_id === null) ??
    null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl">Meus certificados</h1>
      <p className="mt-2 text-muted-foreground">
        Cada instrumento concluído gera um certificado com código de validação. Baixe em PDF.
      </p>

      {rows.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <Award className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            Você ainda não tem certificados. Conclua todas as etapas de um instrumento.
          </p>
          <Button asChild className="mt-4">
            <Link to="/painel">Ir para o painel</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-10">
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
    </main>
  );
}
