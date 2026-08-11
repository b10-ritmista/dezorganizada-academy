import { supabase } from "@/integrations/supabase/client";

export type Instrument = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_path: string | null;
  duration_minutes: number | null;
  position: number;
  requires_submission: boolean;
};

export type Module = {
  id: string;
  instrument_id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: Lesson[];
};

export async function fetchInstruments(): Promise<Instrument[]> {
  const { data, error } = await supabase
    .from("instruments")
    .select("id, slug, name, description, position")
    .order("position");
  if (error) throw error;
  return data ?? [];
}

export async function fetchModulesWithLessons(instrumentId: string): Promise<Module[]> {
  const { data, error } = await supabase
    .from("modules")
    .select(
      "id, instrument_id, title, description, position, lessons(id, module_id, title, description, video_url, video_path, duration_minutes, position)",
    )
    .eq("instrument_id", instrumentId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...m,
    lessons: [...((m.lessons as Lesson[]) ?? [])].sort((a, b) => a.position - b.position),
  })) as Module[];
}

export async function fetchCompletedLessonIds(): Promise<string[]> {
  const { data, error } = await supabase.from("lesson_completions").select("lesson_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.lesson_id);
}

export async function fetchMyEnrollments(): Promise<string[]> {
  const { data, error } = await supabase.from("enrollments").select("instrument_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.instrument_id);
}

export async function fetchMyCertificates() {
  const { data, error } = await supabase
    .from("certificates")
    .select("id, code, issued_at, instrument_id, instruments(name, slug)")
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) return false;
  return Boolean(data);
}

/** Turns a YouTube/Vimeo link into an embeddable URL. */
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/"))
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function signedVideoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("lesson-videos")
    .createSignedUrl(path, 60 * 60 * 4);
  if (error) return null;
  return data?.signedUrl ?? null;
}
