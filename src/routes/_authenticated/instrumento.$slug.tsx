import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchInstruments,
  fetchModulesWithLessons,
  fetchCompletedLessonIds,
  fetchMyEnrollments,
  fetchMyCertificates,
} from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, CheckCircle2, Lock, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/instrumento/$slug")({
  head: () => ({
    meta: [
      { title: "Etapas do instrumento — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Etapas, vídeo aulas e progresso do instrumento escolhido na escola de bateria da DezOrganizada Furiosa.",
      },
      { property: "og:title", content: "Etapas do instrumento — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Avance pelas etapas do seu instrumento e libere o certificado.",
      },
    ],
  }),
  component: InstrumentPage,
});

function InstrumentPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();

  const instruments = useQuery({ queryKey: ["instruments"], queryFn: fetchInstruments });
  const instrument = (instruments.data ?? []).find((i) => i.slug === slug);

  const modules = useQuery({
    queryKey: ["modules", instrument?.id],
    queryFn: () => fetchModulesWithLessons(instrument!.id),
    enabled: Boolean(instrument?.id),
  });
  const completed = useQuery({ queryKey: ["completions"], queryFn: fetchCompletedLessonIds });
  const enrollments = useQuery({ queryKey: ["enrollments"], queryFn: fetchMyEnrollments });
  const certs = useQuery({ queryKey: ["certificates"], queryFn: fetchMyCertificates });

  const enroll = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !instrument) throw new Error("sem usuário");
      const { error } = await supabase
        .from("enrollments")
        .insert({ user_id: uid, instrument_id: instrument.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instrumento adicionado ao seu aprendizado!");
      void queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("Não foi possível matricular."),
  });

  const issue = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("issue_certificate", {
        _instrument_id: instrument!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado emitido!");
      void queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: () => toast.error("Conclua todas as etapas antes de emitir o certificado."),
  });

  if (!instrument) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-muted-foreground">Carregando instrumento…</p>
      </main>
    );
  }

  const done = new Set(completed.data ?? []);
  const mods = modules.data ?? [];
  const orderedLessons = mods.flatMap((m) => m.lessons);
  const total = orderedLessons.length;
  const doneCount = orderedLessons.filter((l) => done.has(l.id)).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const enrolled = (enrollments.data ?? []).includes(instrument.id);
  const cert = (certs.data ?? []).find((c) => c.instrument_id === instrument.id);
  const finished = total > 0 && doneCount === total;

  // Uma aula libera quando todas as anteriores (na ordem das etapas) estão concluídas.
  const firstLockedIndex = orderedLessons.findIndex((l) => !done.has(l.id));
  const unlockedUntil = firstLockedIndex === -1 ? total : firstLockedIndex;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar ao painel
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{instrument.name}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{instrument.description}</p>
        </div>
        {!enrolled && (
          <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            Quero aprender este instrumento
          </Button>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Progresso das etapas</span>
          <span className="text-muted-foreground">
            {doneCount}/{total} aulas
          </span>
        </div>
        <Progress value={pct} className="mt-3" />
        <div className="mt-4">
          {cert ? (
            <Button asChild variant="outline">
              <Link to="/certificados">
                <Award /> Ver meu certificado
              </Link>
            </Button>
          ) : (
            <Button onClick={() => issue.mutate()} disabled={!finished || issue.isPending}>
              <Award /> {finished ? "Emitir certificado" : "Certificado bloqueado"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {mods.length === 0 && (
          <p className="text-muted-foreground">
            {enrolled
              ? "Nenhuma etapa publicada ainda para este instrumento."
              : "Clique em “Quero aprender este instrumento” para liberar as etapas e as vídeo aulas."}
          </p>
        )}
        {mods.map((mod, modIndex) => {
          const modDone = mod.lessons.length > 0 && mod.lessons.every((l) => done.has(l.id));
          return (
            <section key={mod.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl">{mod.title}</h2>
                {modDone ? (
                  <Badge className="bg-accent text-accent-foreground">
                    <CheckCircle2 className="size-3.5" /> Etapa concluída
                  </Badge>
                ) : (
                  <Badge variant="secondary">Etapa {modIndex + 1}</Badge>
                )}
              </div>
              {mod.description && (
                <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
              )}

              <ul className="mt-4 divide-y divide-border">
                {mod.lessons.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">
                    Aulas desta etapa em breve.
                  </li>
                )}
                {mod.lessons.map((lesson) => {
                  const globalIndex = orderedLessons.findIndex((l) => l.id === lesson.id);
                  const isDone = done.has(lesson.id);
                  const locked = globalIndex > unlockedUntil;
                  return (
                    <li key={lesson.id} className="flex items-center gap-3 py-3">
                      {isDone ? (
                        <CheckCircle2 className="size-5 shrink-0 text-accent" />
                      ) : locked ? (
                        <Lock className="size-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <PlayCircle className="size-5 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{lesson.title}</p>
                        {lesson.duration_minutes ? (
                          <p className="text-xs text-muted-foreground">
                            {lesson.duration_minutes} min
                          </p>
                        ) : null}
                      </div>
                      {locked ? (
                        <span className="text-xs text-muted-foreground">Bloqueada</span>
                      ) : (
                        <Button size="sm" variant={isDone ? "outline" : "default"} asChild>
                          <Link to="/aula/$lessonId" params={{ lessonId: lesson.id }}>
                            {isDone ? "Rever" : "Assistir"}
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
