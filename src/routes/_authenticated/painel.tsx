import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchInstruments,
  fetchCompletedLessonIds,
  fetchMyEnrollments,
  fetchMyCertificates,
} from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meu painel — Escola DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Acompanhe suas etapas concluídas em cada instrumento da bateria e veja o quanto falta para o certificado.",
      },
      { property: "og:title", content: "Meu painel — Escola DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Progresso das etapas por instrumento na escola da DezOrganizada Furiosa.",
      },
    ],
  }),
  component: Painel,
});

type LessonRow = { id: string; modules: { instrument_id: string } | null };

async function fetchAllLessons(): Promise<LessonRow[]> {
  const { data, error } = await supabase.from("lessons").select("id, modules(instrument_id)");
  if (error) throw error;
  return (data ?? []) as unknown as LessonRow[];
}

function Painel() {
  const instruments = useQuery({ queryKey: ["instruments"], queryFn: fetchInstruments });
  const lessons = useQuery({ queryKey: ["all-lessons"], queryFn: fetchAllLessons });
  const completed = useQuery({ queryKey: ["completions"], queryFn: fetchCompletedLessonIds });
  const enrollments = useQuery({ queryKey: ["enrollments"], queryFn: fetchMyEnrollments });
  const certs = useQuery({ queryKey: ["certificates"], queryFn: fetchMyCertificates });

  const done = new Set(completed.data ?? []);
  const certByInstrument = new Set((certs.data ?? []).map((c) => c.instrument_id));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">Meu painel</h1>
      <p className="mt-2 text-muted-foreground">
        Escolha um instrumento e avance pelas etapas até liberar o certificado.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(instruments.data ?? []).map((inst) => {
          const total = (lessons.data ?? []).filter(
            (l) => l.modules?.instrument_id === inst.id,
          ).length;
          const doneCount = (lessons.data ?? []).filter(
            (l) => l.modules?.instrument_id === inst.id && done.has(l.id),
          ).length;
          const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          const enrolled = (enrollments.data ?? []).includes(inst.id);

          return (
            <div key={inst.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl">{inst.name}</h2>
                {certByInstrument.has(inst.id) ? (
                  <Badge className="bg-accent text-accent-foreground">
                    <Award className="size-3.5" /> Certificado
                  </Badge>
                ) : enrolled ? (
                  <Badge variant="secondary">Em andamento</Badge>
                ) : null}
              </div>
              <p className="mt-2 min-h-10 text-sm text-muted-foreground">{inst.description}</p>
              <div className="mt-4">
                <Progress value={pct} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {doneCount} de {total} aulas concluídas ({pct}%)
                </p>
              </div>
              <Button asChild className="mt-4 w-full">
                <Link to="/instrumento/$slug" params={{ slug: inst.slug }}>
                  {enrolled ? "Continuar" : "Começar"} <ChevronRight />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
