import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteChatMessage,
  fetchChatMessages,
  fetchMyProfile,
  sendChatMessage,
} from "@/lib/app-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat da bateria — DezOrganizada Furiosa" },
      {
        name: "description",
        content:
          "Converse com outros alunos da bateria DezOrganizada Furiosa, tire dúvidas e combine ensaios.",
      },
      { property: "og:title", content: "Chat da bateria — DezOrganizada Furiosa" },
      {
        property: "og:description",
        content: "Espaço de conversa entre os alunos da bateria DezOrganizada Furiosa.",
      },
    ],
  }),
  component: ChatPage;
});

function ChatPage() {
  const { user, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: Boolean(user?.id),
  });
  const messages = useQuery({ queryKey: ["chat-messages"], queryFn: fetchChatMessages });

  useEffect(() => {
    const channel = supabase
      .channel("chat-messages-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void queryClient.invalidateQueries({ queryKey: ["chat-messages"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: async (content: string) =>
      sendChatMessage({
        userId: user!.id,
        displayName:
          profile.data?.full_name ||
          (user?.user_metadata?.["full_name"] as string | undefined) ||
          user?.email ||
          "Membro",
        content,
      }),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  const remove = useMutation({
    mutationFn: deleteChatMessage,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chat-messages"] }),
    onError: () => toast.error("Não foi possível apagar."),
  });

  const items = messages.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">Chat da bateria</h1>
      <p className="mt-2 text-muted-foreground">
        Fale com outros alunos, tire dúvidas e combine os ensaios.
      </p>

      <div className="mt-6 h-[60vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Manda a primeira!
          </p>
        )}
        {items.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  mine
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary/20 px-4 py-2"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-secondary/50 px-4 py-2"
                }
              >
                <p className="text-xs font-semibold text-primary">{m.display_name}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </span>
                  {(mine || isAdmin) && (
                    <button
                      type="button"
                      aria-label="Apagar mensagem"
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => remove.mutate(m.id)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const content = text.trim();
          if (!content || !user) return;
          send.mutate(content);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Escreva uma mensagem…"
        />
        <Button type="submit" disabled={send.isPending || !text.trim()}>
          <Send /> Enviar
        </Button>
      </form>
    </main>
  );
}
