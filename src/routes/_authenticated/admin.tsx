import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCertificateTemplate,
  fetchAdminSubmissions,
  fetchCertificateTemplates,
  fetchInstruments,
  fetchModulesWithLessons,
  saveCertificateTemplate,
  signedSubmissionUrl,
  signedTemplateUrl,
  updateLesson,
  uploadTemplateImage,
  type AdminSubmission,
  type CertificateTemplate,
  type Lesson,
  type Module,
} from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ImageIcon, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Área de administradores para criar módulos e publicar vídeo aulas por instrumento da bateria.",
      },
      { property: "og:title", content: "Administração — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Gerencie módulos e vídeo aulas da escola de bateria DezOrganizada Furiosa.",
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
      toast.success("Módulo criado.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível criar o módulo."),
  });

  const removeModule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo removido.");
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
        Crie os módulos de cada instrumento e publique as vídeo aulas (link ou upload).
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
            toast.error("Informe o nome do módulo.");
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
          <Label htmlFor="mod-title">Novo módulo</Label>
          <Input id="mod-title" name="title" placeholder="Módulo 1 — Fundamentos" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mod-desc">Descrição</Label>
          <Input id="mod-desc" name="description" placeholder="Opcional" maxLength={500} />
        </div>
        <Button type="submit" disabled={addModule.isPending}>
          <Plus /> Criar módulo
        </Button>
      </form>

      {current && (
        <LessonForm
          instrumentId={current.id}
          modules={modules.data ?? []}
          onDone={invalidate}
        />
      )}



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
                <Trash2 /> Excluir módulo
              </Button>
            </div>

            <ul className="mt-4 divide-y divide-border">
              {mod.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  modules={modules.data ?? []}
                  onDone={invalidate}
                  onRemove={() => removeLesson.mutate(lesson.id)}
                  removing={removeLesson.isPending}
                />
              ))}
            </ul>
          </section>
        ))}
        {(modules.data ?? []).length === 0 && (
          <p className="text-muted-foreground">Nenhum módulo criado para este instrumento.</p>
        )}
      </div>

      {current && (
        <CertificateTemplateAdmin
          instrumentId={current.id}
          instrumentName={current.name}
        />
      )}

      <SubmissionsReview />
    </main>
  );
}

function LessonForm({
  instrumentId,
  modules,
  onDone,
}: {
  instrumentId: string;
  modules: Module[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [busy, setBusy] = useState(false);
  const [moduleId, setModuleId] = useState<string>("__new");
  const [requiresSubmission, setRequiresSubmission] = useState(false);

  const selected = modules.find((m) => m.id === moduleId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (title.length < 2) {
      toast.error("Informe o título da aula.");
      return;
    }
    const newModuleTitle = String(fd.get("newModule") ?? "").trim();
    if (moduleId === "__new" && newModuleTitle.length < 2) {
      toast.error("Informe o nome do novo módulo.");
      return;
    }
    const description = String(fd.get("description") ?? "")
      .trim()
      .slice(0, 2000);
    const durationRaw = String(fd.get("duration") ?? "").trim();
    const duration = durationRaw ? Number(durationRaw) : null;

    setBusy(true);
    try {
      let targetModuleId = moduleId;
      let nextPosition = (selected?.lessons.length ?? 0) + 1;

      if (moduleId === "__new") {
        const { data: created, error: modErr } = await supabase
          .from("modules")
          .insert({
            instrument_id: instrumentId,
            title: newModuleTitle.slice(0, 120),
            position: modules.length + 1,
          })
          .select("id")
          .single();
        if (modErr) throw modErr;
        targetModuleId = created.id;
        nextPosition = 1;
      }

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
        const path = `${targetModuleId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lesson-videos")
          .upload(path, file, { contentType: file.type || "video/mp4" });
        if (upErr) throw upErr;
        video_path = path;
      }

      const { error } = await supabase.from("lessons").insert({
        module_id: targetModuleId,
        title: title.slice(0, 160),
        description: description || null,
        video_url,
        video_path,
        duration_minutes: duration && Number.isFinite(duration) ? duration : null,
        position: nextPosition,
        requires_submission: requiresSubmission,
      });
      if (error) throw error;
      toast.success("Aula publicada!");
      form.reset();
      setRequiresSubmission(false);
      onDone();
    } catch {
      toast.error("Não foi possível publicar a aula.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="text-2xl">Publicar vídeo aula</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o módulo" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
              <SelectItem value="__new">+ Criar novo módulo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {moduleId === "__new" && (
          <div className="space-y-2">
            <Label>Nome do novo módulo</Label>
            <Input name="newModule" maxLength={120} placeholder="Módulo 1 — Fundamentos" />
          </div>
        )}
      </div>

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

      <div className="flex items-start gap-3 rounded-lg bg-secondary/40 p-4">
        <Checkbox
          id="requires-submission"
          checked={requiresSubmission}
          onCheckedChange={(v) => setRequiresSubmission(v === true)}
        />
        <div>
          <Label htmlFor="requires-submission">Pedir vídeo do aluno nesta aula</Label>
          <p className="text-xs text-muted-foreground">
            O aluno envia um vídeo tocando o instrumento para concluir a aula.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={busy}>
        <Plus /> {busy ? "Publicando…" : "Publicar aula"}
      </Button>
    </form>
  );
}

function SubmissionsReview() {
  const queryClient = useQueryClient();
  const subs = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: () => fetchAdminSubmissions(),
  });

  const review = useMutation({
    mutationFn: async (p: { id: string; status: "approved" | "rejected"; feedback: string }) => {
      const { error } = await supabase
        .from("lesson_submissions")
        .update({ status: p.status, feedback: p.feedback || null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação salva.");
      void queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    },
    onError: () => toast.error("Não foi possível salvar a avaliação."),
  });

  const items = subs.data ?? [];

  return (
    <section className="mt-10">
      <h2 className="text-3xl">Vídeos enviados pelos alunos</h2>
      {subs.isLoading && <p className="mt-2 text-muted-foreground">Carregando envios…</p>}
      {subs.isError && (
        <p className="mt-2 text-destructive">Não foi possível carregar os envios dos alunos.</p>
      )}
      {!subs.isLoading && !subs.isError && items.length === 0 && (
        <p className="mt-2 text-muted-foreground">Nenhum vídeo enviado pelos alunos ainda.</p>
      )}
      <div className="mt-4 space-y-4">
        {items.map((s) => (
          <SubmissionRow key={s.id} sub={s} onReview={review.mutate} busy={review.isPending} />
        ))}
      </div>
    </section>
  );
}

function SubmissionRow({
  sub,
  onReview,
  busy,
}: {
  sub: AdminSubmission;
  onReview: (p: { id: string; status: "approved" | "rejected"; feedback: string }) => void;
  busy: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const url = useQuery({
    queryKey: ["admin-submission-video", sub.video_path],
    queryFn: () => signedSubmissionUrl(sub.video_path),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {sub.profiles?.full_name || sub.profiles?.email || "Aluno"}
          </p>
          <p className="text-sm text-muted-foreground">
            {sub.lessons?.modules?.title} — {sub.lessons?.title}
          </p>
        </div>
        <span
          className={
            sub.status === "approved"
              ? "text-sm text-accent"
              : sub.status === "rejected"
                ? "text-sm text-destructive"
                : "text-sm text-primary"
          }
        >
          {sub.status === "approved"
            ? "Aprovado"
            : sub.status === "rejected"
              ? "Reprovado"
              : "Em avaliação"}
        </span>
      </div>

      {sub.note && <p className="mt-2 text-sm text-muted-foreground">“{sub.note}”</p>}

      {url.data && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url.data} controls className="mt-3 aspect-video w-full rounded-md bg-black" />
      )}

      <div className="mt-3 space-y-2">
        <Label>Comentário para o aluno</Label>
        <Textarea
          rows={2}
          maxLength={500}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onReview({ id: sub.id, status: "approved", feedback })}
          >
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onReview({ id: sub.id, status: "rejected", feedback })}
          >
            Reprovar
          </Button>
        </div>
      </div>
    </article>
  );
}

function LessonRow({
  lesson,
  modules,
  onDone,
  onRemove,
  removing,
}: {
  lesson: Lesson;
  modules: Module[];
  onDone: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [duration, setDuration] = useState(
    lesson.duration_minutes ? String(lesson.duration_minutes) : "",
  );
  const [url, setUrl] = useState(lesson.video_url ?? "");
  const [moduleId, setModuleId] = useState(lesson.module_id);
  const [requires, setRequires] = useState(lesson.requires_submission);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Informe o título da aula.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    setBusy(true);
    try {
      let video_path = lesson.video_path;
      let video_url: string | null = url.trim() ? url.trim().slice(0, 800) : null;

      if (file instanceof File && file.size > 0) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
        const path = `${moduleId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lesson-videos")
          .upload(path, file, { contentType: file.type || "video/mp4" });
        if (upErr) throw upErr;
        video_path = path;
        video_url = null;
      }
      if (video_url) video_path = null;
      if (!video_url && !video_path) {
        toast.error("Informe um link ou envie um arquivo de vídeo.");
        setBusy(false);
        return;
      }

      const parsed = Number(duration);
      await updateLesson(lesson.id, {
        title: title.trim().slice(0, 160),
        description: description.trim() ? description.trim().slice(0, 2000) : null,
        duration_minutes: duration && Number.isFinite(parsed) ? parsed : null,
        video_url,
        video_path,
        module_id: moduleId,
        requires_submission: requires,
      });
      toast.success("Aula atualizada!");
      setEditing(false);
      onDone();
    } catch {
      toast.error("Não foi possível salvar a aula.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <li className="flex items-center gap-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
        {lesson.requires_submission && (
          <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
            envio do aluno
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {lesson.video_url ? "link" : "arquivo"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Editar aula">
          <Pencil />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={removing}>
          <Trash2 />
        </Button>
      </li>
    );
  }

  return (
    <li className="py-3">
      <form onSubmit={save} className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Editar aula</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X /> Cancelar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label>Módulo</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Input
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Link do vídeo (YouTube/Vimeo)</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={800}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Substituir por novo arquivo (opcional)</Label>
          <Input name="file" type="file" accept="video/*" />
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id={`req-${lesson.id}`}
            checked={requires}
            onCheckedChange={(v) => setRequires(v === true)}
          />
          <Label htmlFor={`req-${lesson.id}`}>Pedir vídeo do aluno nesta aula</Label>
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>
    </li>
  );
}

function CertificateTemplateAdmin({
  instrumentId,
  instrumentName,
}: {
  instrumentId: string;
  instrumentName: string;
}) {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: fetchCertificateTemplates,
  });
  const existing =
    (templates.data ?? []).find((t) => t.instrument_id === instrumentId) ?? null;

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<CertificateTemplate>>({});
  const [file, setFile] = useState<File | null>(null);

  const value = <K extends keyof CertificateTemplate>(key: K, fallback: CertificateTemplate[K]) =>
    (draft[key] ?? existing?.[key] ?? fallback) as CertificateTemplate[K];

  const nameX = Number(value("name_x", 50));
  const nameY = Number(value("name_y", 50));
  const nameSize = Number(value("name_size", 5));
  const nameColor = String(value("name_color", "#111111"));

  const previewUrl = useQuery({
    queryKey: ["template-url", existing?.image_path],
    queryFn: () => signedTemplateUrl(existing!.image_path),
    enabled: Boolean(existing?.image_path),
  });
  const localPreview = file ? URL.createObjectURL(file) : null;
  const preview = localPreview ?? previewUrl.data ?? null;

  async function save() {
    setBusy(true);
    try {
      let imagePath = existing?.image_path ?? null;
      if (file) imagePath = await uploadTemplateImage(file);
      if (!imagePath) {
        toast.error("Envie a imagem do modelo do certificado.");
        setBusy(false);
        return;
      }
      await saveCertificateTemplate({
        ...(existing?.id ? { id: existing.id } : {}),
        instrument_id: instrumentId,
        image_path: imagePath,
        name_x: nameX,
        name_y: nameY,
        name_size: nameSize,
        name_color: nameColor,
      });
      toast.success("Modelo do certificado salvo.");
      setFile(null);
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
    } catch {
      toast.error("Não foi possível salvar o modelo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteCertificateTemplate(existing.id);
      toast.success("Modelo removido.");
      setFile(null);
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
    } catch {
      toast.error("Não foi possível remover o modelo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-3xl">
        <ImageIcon className="size-6 text-primary" /> Modelo do certificado — {instrumentName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie a arte do certificado e posicione o campo onde o sistema vai imprimir o nome do aluno.
        Clique na imagem para definir a posição exata do nome.
      </p>

      <div className="mt-4 space-y-2">
        <Label>Imagem do modelo (PNG/JPG)</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {preview && (
        <button
          type="button"
          className="relative mt-4 block w-full overflow-hidden rounded-lg bg-white [container-type:inline-size]"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setDraft((d) => ({
              ...d,
              name_x: Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2)),
              name_y: Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2)),
            }));
          }}
        >
          <img src={preview} alt="Pré-visualização do modelo" className="block w-full" />
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold"
            style={{
              left: `${nameX}%`,
              top: `${nameY}%`,
              color: nameColor,
              fontSize: `${nameSize}cqw`,
            }}
          >
            Nome do Aluno
          </span>
        </button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="space-y-2">
          <Label>Posição X (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={nameX}
            onChange={(e) => setDraft((d) => ({ ...d, name_x: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Posição Y (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={nameY}
            onChange={(e) => setDraft((d) => ({ ...d, name_y: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Tamanho do nome (% largura)</Label>
          <Input
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={nameSize}
            onChange={(e) => setDraft((d) => ({ ...d, name_size: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Cor do nome</Label>
          <Input
            type="color"
            value={nameColor}
            onChange={(e) => setDraft((d) => ({ ...d, name_color: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvando…" : "Salvar modelo"}
        </Button>
        {existing && (
          <Button variant="outline" onClick={remove} disabled={busy}>
            <Trash2 /> Remover modelo
          </Button>
        )}
      </div>
    </section>
  );
}
