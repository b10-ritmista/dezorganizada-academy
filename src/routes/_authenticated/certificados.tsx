import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyCertificates } from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Award, Printer } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/certificados")({
  head: () => ({
    meta: [
      { title: "Meus certificados — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Veja e imprima os certificados conquistados por instrumento na escola de bateria da DezOrganizada Furiosa.",
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
  const { profileName } = useCurrentUser();
  const certs = useQuery({ queryKey: ["certificates"], queryFn: fetchMyCertificates });
  const rows = (certs.data ?? []) as unknown as CertRow[];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl">Meus certificados</h1>
      <p className="mt-2 text-muted-foreground">
        Cada instrumento concluído gera um certificado com código de validação.
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

      <div className="mt-8 space-y-8 print:space-y-0">
        {rows.map((cert) => (
          <article
            key={cert.id}
            className="rounded-xl border-2 border-primary/60 bg-card p-8 text-center print:break-after-page"
          >
            <img src={logoAsset.url} alt="Logo" className="mx-auto h-20 w-20" />
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-primary">
              Certificado de conclusão
            </p>
            <h2 className="mt-4 text-3xl">{profileName ?? "Membro"}</h2>
            <p className="mt-3 text-muted-foreground">
              concluiu todas as etapas do curso de{" "}
              <span className="font-semibold text-foreground">{cert.instruments?.name}</span> da
              bateria DezOrganizada Furiosa.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Emitido em {new Date(cert.issued_at).toLocaleDateString("pt-BR")} · Código{" "}
              <span className="text-accent">{cert.code}</span>
            </p>
            <Button variant="outline" className="mt-6 print:hidden" onClick={() => window.print()}>
              <Printer /> Imprimir / salvar PDF
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}
