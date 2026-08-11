import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInstruments, fetchModulesWithLessons } from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Área de administradores para criar etapas e publicar vídeo aulas por instrumento da bateria.",
      },
      { property: "og:title", content: "Administração — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Gerencie etapas e vídeo aulas da escola de bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useCurrentUser();
  const queryClient = useQueryClient();
  const instruments = useQuery({ queryKey: ["instruments"], queryFn: fetchInstruments });
  const [slug, setSlug] = useState<string | null>(null);

  const current = (instruments.data ?? []).find((i) => i.slug === slug) ?? instruments.data?.[0];

  const modules = useQuery({
    queryKey: ["admin-modules", current?.id],
    queryFn: () => fetchModulesWithLessons(current!.id),
    enabled: Boolean(current?.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-modules", current?.id] });
    void queryClient.invalidateQueries({ queryKey: ["modules", current?.id] });
    void queryClient.invalidateQueries({ queryKey: ["all-lessons"] });
  };

  const addModule = useMutation({
    mutationFn: async (payload: { title: string; description: string }) => {
      const position = (modules.data?.length ?? 0) + 1;
      const { error } = await supabase.from("modules").insert({
        instrument_id: current!.id,
        title: payload.title,
        description: payload.description || null,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa criada.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível criar a etapa."),
  });

  const removeModule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa removida.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const removeLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aula removida.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl">Área restrita</h1>
        <p className="mt-3 text-muted-foreground">
          Somente administradores podem publicar vídeo aulas.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl">Administração</h1>
      <p className="mt-2 text-muted-foreground">
        Crie as etapas de cada instrumento e publique as vídeo aulas (link ou upload).
      </p>

      <Tabs
        value={current?.slug ?? ""}
        onValueChange={setSlug}
        className="mt-6"
      >
        <TabsList className="flex-wrap">
          {(instruments.data ?? []).map((i) => (
            <TabsTrigger key={i.id} value={i.slug}>
              {i.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form
        className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const title = String(form.get("title") ?? "").trim();
          if (title.length < 2) {
            toast.error("Informe o nome da etapa.");
            return;
          }
          addModule.mutate({
            title: title.slice(0, 120),
            description: String(form.get("description") ?? "")
              .trim()
              .slice(0, 500),
          });
          e.currentTarget.reset();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="mod-title">Nova etapa</Label>
          <Input id="mod-title" name="title" placeholder="Etapa 1 — Fundamentos" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mod-desc">Descrição</Label>
          <Input id="mod-desc" name="description" placeholder="Opcional" maxLength={500} />
        </div>
        <Button type="submit" disabled={addModule.isPending}>
          <Plus /> Criar etapa
        </Button>
      </form>

      <div className="mt-8 space-y-6">
        {(modules.data ?? []).map((mod) => (
          <section key={mod.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl">{mod.title}</h2>
                {mod.description && (
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeModule.mutate(mod.id)}
                disabled={removeModule.isPending}
              >
                <Trash2 /> Excluir etapa
              </Button>
            </div>

            <ul className="mt-4 divide-y divide-border">
              {mod.lessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {lesson.video_url ? "link" : "arquivo"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLesson.mutate(lesson.id)}
                    disabled={removeLesson.isPending}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>

          </section>
        ))}
        {(modules.data ?? []).length === 0 && (
          <p className="text-muted-foreground">Nenhuma etapa criada para este instrumento.</p>
        )}
      </div>
    </main>
  );
}

function LessonForm({
  moduleId,
  nextPosition,
  onDone,
}: {
  moduleId: string;
  nextPosition: number;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (title.length < 2) {
      toast.error("Informe o título da aula.");
      return;
    }
    const description = String(fd.get("description") ?? "")
      .trim()
      .slice(0, 2000);
    const durationRaw = String(fd.get("duration") ?? "").trim();
    const duration = durationRaw ? Number(durationRaw) : null;

    setBusy(true);
    try {
      let video_url: string | null = null;
      let video_path: string | null = null;

      if (mode === "link") {
        const url = String(fd.get("url") ?? "").trim();
        if (!/^https?:\/\//.test(url)) {
          toast.error("Informe um link válido (http/https).");
          setBusy(false);
          return;
        }
        video_url = url.slice(0, 800);
      } else {
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) {
          toast.error("Selecione um arquivo de vídeo.");
          setBusy(false);
          return;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
        const path = `${moduleId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lesson-videos")
          .upload(path, file, { contentType: file.type || "video/mp4" });
        if (upErr) throw upErr;
        video_path = path;
      }

      const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title: title.slice(0, 160),
        description: description || null,
        video_url,
        video_path,
        duration_minutes: duration && Number.isFinite(duration) ? duration : null,
        position: nextPosition,
      });
      if (error) throw error;
      toast.success("Aula publicada!");
      form.reset();
      onDone();
    } catch {
      toast.error("Não foi possível publicar a aula.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg bg-secondary/40 p-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "link" ? "default" : "outline"}
          onClick={() => setMode("link")}
        >
          Link YouTube/Vimeo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => setMode("upload")}
        >
          <Upload /> Upload de arquivo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Título da aula</Label>
          <Input name="title" maxLength={160} placeholder="Levada básica" />
        </div>
        <div className="space-y-2">
          <Label>Duração (min)</Label>
          <Input name="duration" type="number" min={1} max={600} placeholder="10" />
        </div>
      </div>

      {mode === "link" ? (
        <div className="space-y-2">
          <Label>Link do vídeo</Label>
          <Input name="url" placeholder="https://youtube.com/watch?v=..." maxLength={800} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Arquivo de vídeo</Label>
          <Input name="file" type="file" accept="video/*" />
        </div>
      )}

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea name="description" rows={2} maxLength={2000} />
      </div>

      <Button type="submit" disabled={busy}>
        <Plus /> {busy ? "Publicando…" : "Publicar aula"}
      </Button>
    </form>
  );
}
