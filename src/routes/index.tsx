import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.png.asset.json";
import { Award, PlayCircle, Layers, Drum } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Escola de Bateria DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Vídeo aulas por etapas para os novos membros da DezOrganizada Furiosa: caixa, tamborim, chocalho, repique, surdo e percussão, com certificado por instrumento.",
      },
      { property: "og:title", content: "Escola de Bateria DezOrganizada Furiosa" },
      {
        property: "og:description",
        content:
          "Aprenda seu instrumento por etapas, acompanhe seu progresso e conquiste o certificado da bateria.",
      },
    ],
  }),
  component: Index,
});

const INSTRUMENTS = ["Caixa", "Tamborim", "Chocalho", "Repique", "Surdo", "Percussão"];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <img src={logoAsset.url} alt="Logo DezOrganizada Furiosa" className="h-11 w-11" />
          <span className="font-display text-lg leading-none">
            DezOrganizada <span className="text-primary">Furiosa</span>
          </span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main>
        <section className="relative overflow-hidden border-y border-border stage-panel">
          <div className="absolute inset-0 stripe-bg opacity-40" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1 text-xs font-semibold tracking-widest text-accent uppercase">
              <Drum className="size-3.5" /> Escola da bateria
            </p>
            <h1 className="max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
              Aprenda a tocar na <span className="text-gold">DezOrganizada Furiosa</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Vídeo aulas organizadas em etapas para os novos membros. Escolha seu instrumento,
              evolua etapa por etapa e receba o certificado da bateria.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Criar minha conta</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Já sou membro</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl">Instrumentos</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {INSTRUMENTS.map((name) => (
              <div
                key={name}
                className="rounded-lg border border-border bg-card px-4 py-6 text-center font-display text-lg"
              >
                {name}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Etapas de progresso",
              text: "Fundamentos, levadas, viradas e ensaio geral — uma etapa liberando a próxima.",
            },
            {
              icon: PlayCircle,
              title: "Vídeo aulas",
              text: "Os administradores publicam as aulas por link ou arquivo enviado.",
            },
            {
              icon: Award,
              title: "Certificado",
              text: "Concluiu todas as etapas do instrumento? O certificado é emitido na hora.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-4 text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        DezOrganizada Furiosa — Bateria
      </footer>
    </div>
  );
}
