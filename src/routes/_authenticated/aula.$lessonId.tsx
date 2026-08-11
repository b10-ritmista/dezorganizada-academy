import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedVideoUrl, toEmbedUrl } from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/aula/$lessonId")({
  head: () => ({
    meta: [
      { title: "Vídeo aula — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Assista à vídeo aula e marque como concluída para avançar para a próxima etapa do seu instrumento.",
      },
      { property: "og:title", content: "Vídeo aula — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Vídeo aula da escola de bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: LessonPage,
});

type LessonDetail = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_path: string | null;
  module_id: string;
  requires_submission: boolean;
  modules: { title: string; instruments: { name: string; slug: string } | null } | null;
};

function LessonPage() {
  const { lessonId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select(
          "id, title, description, video_url, video_path, module_id, requires_submission, modules(title, instruments(name, slug))",
        )
        .eq("id", lessonId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LessonDetail | null;
    },
  });

  const videoSrc = useQuery({
    queryKey: ["lesson-video", lessonId, lesson.data?.video_path],
    queryFn: () => signedVideoUrl(lesson.data!.video_path!),
    enabled: Boolean(lesson.data?.video_path),
  });

  const completion = useQuery({
    queryKey: ["completion", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("id")
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("sem usuário");
      const { error } = await supabase
        .from("lesson_completions")
        .upsert({ user_id: uid, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aula concluída!");
      void queryClient.invalidateQueries({ queryKey: ["completion", lessonId] });
      void queryClient.invalidateQueries({ queryKey: ["completions"] });
      const slug = lesson.data?.modules?.instruments?.slug;
      if (slug) navigate({ to: "/instrumento/$slug", params: { slug } });
    },
    onError: () => toast.error("Não foi possível marcar como concluída."),
  });

  const data = lesson.data;
  const embed = data?.video_url ? toEmbedUrl(data.video_url) : null;
  const slug = data?.modules?.instruments?.slug;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {slug && (
        <Link
          to="/instrumento/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {data?.modules?.instruments?.name}
        </Link>
      )}
      <h1 className="mt-3 text-3xl">{data?.title ?? "Carregando…"}</h1>
      {data?.modules?.title && (
        <p className="mt-1 text-sm text-primary">{data.modules.title}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="aspect-video w-full bg-black">
          {embed ? (
            <iframe
              src={embed}
              title={data?.title ?? "Vídeo aula"}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : videoSrc.data ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={videoSrc.data} controls className="h-full w-full" />
          ) : data?.video_url ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <a href={data.video_url} target="_blank" rel="noreferrer" className="underline">
                Abrir vídeo em nova aba
              </a>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Vídeo ainda não disponível.
            </div>
          )}
        </div>
      </div>

      {data?.description && (
        <p className="mt-6 whitespace-pre-line text-muted-foreground">{data.description}</p>
      )}

      {data?.requires_submission && <SubmissionCard lessonId={lessonId} />}

      <div className="mt-8">
        {completion.data ? (
          <Button variant="outline" disabled>
            <CheckCircle2 /> Aula concluída
          </Button>
        ) : (
          <Button
            onClick={() => complete.mutate()}
            disabled={complete.isPending || (data?.requires_submission && !submission.data)}
          >
            <CheckCircle2 /> Marcar como concluída
          </Button>
        )}
        {data?.requires_submission && !submission.data && (
          <p className="mt-2 text-xs text-muted-foreground">
            Envie o seu vídeo tocando o instrumento para concluir esta aula.
          </p>
        )}
      </div>
    </main>
  );
}

function SubmissionCard({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const submission = useQuery({
    queryKey: ["my-submission", lessonId],
    queryFn: () => fetchMySubmission(lessonId),
  });
  const preview = useQuery({
    queryKey: ["submission-video", submission.data?.video_path],
    queryFn: () => signedSubmissionUrl(submission.data!.video_path),
    enabled: Boolean(submission.data?.video_path),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Selecione o vídeo com você tocando.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error("O vídeo deve ter até 200 MB.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("sem usuário");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const path = `${uid}/${lessonId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lesson-submissions")
        .upload(path, file, { contentType: file.type || "video/mp4" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("lesson_submissions").upsert(
        {
          user_id: uid,
          lesson_id: lessonId,
          video_path: path,
          note: String(fd.get("note") ?? "")
            .trim()
            .slice(0, 500) || null,
          status: "pending",
          feedback: null,
        },
        { onConflict: "lesson_id,user_id" },
      );
      if (error) throw error;
      toast.success("Vídeo enviado! Aguarde a avaliação.");
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["my-submission", lessonId] });
    } catch {
      toast.error("Não foi possível enviar o vídeo.");
    } finally {
      setBusy(false);
    }
  }

  const s = submission.data;

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-5">
      <h2 className="text-2xl">Envie o seu vídeo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Grave você tocando o instrumento nesta aula e envie para avaliação da equipe.
      </p>

      {s && (
        <div className="mt-4 space-y-3 rounded-lg bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Situação:</span>
            <span
              className={
                s.status === "approved"
                  ? "text-accent"
                  : s.status === "rejected"
                    ? "text-destructive"
                    : "text-primary"
              }
            >
              {s.status === "approved"
                ? "Aprovado"
                : s.status === "rejected"
                  ? "Precisa reenviar"
                  : "Em avaliação"}
            </span>
          </div>
          {s.feedback && <p className="text-sm text-muted-foreground">“{s.feedback}”</p>}
          {preview.data && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={preview.data} controls className="aspect-video w-full rounded-md bg-black" />
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label>Arquivo de vídeo (até 200 MB)</Label>
          <Input name="file" type="file" accept="video/*" />
        </div>
        <div className="space-y-2">
          <Label>Comentário (opcional)</Label>
          <Textarea name="note" rows={2} maxLength={500} />
        </div>
        <Button type="submit" disabled={busy}>
          <Upload /> {busy ? "Enviando…" : s ? "Reenviar vídeo" : "Enviar vídeo"}
        </Button>
      </form>
    </section>
  );
}
