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
      "id, instrument_id, title, description, position, lessons(id, module_id, title, description, video_url, video_path, duration_minutes, position, requires_submission)",
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

export type LessonSubmission = {
  id: string;
  lesson_id: string;
  user_id: string;
  video_path: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
  created_at: string;
};

export async function fetchMySubmission(lessonId: string): Promise<LessonSubmission | null> {
  const { data, error } = await supabase
    .from("lesson_submissions")
    .select("id, lesson_id, user_id, video_path, note, status, feedback, created_at")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return (data as LessonSubmission | null) ?? null;
}

export async function signedSubmissionUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("lesson-submissions")
    .createSignedUrl(path, 60 * 60 * 4);
  if (error) return null;
  return data?.signedUrl ?? null;
}


/* ---------- certificate templates ---------- */

export type CertificateTemplate = {
  id: string;
  instrument_id: string | null;
  image_path: string;
  name_x: number;
  name_y: number;
  name_size: number;
  name_color: string;
};

export async function fetchCertificateTemplates(): Promise<CertificateTemplate[]> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .select("id, instrument_id, image_path, name_x, name_y, name_size, name_color");
  if (error) throw error;
  return (data ?? []) as CertificateTemplate[];
}

export async function saveCertificateTemplate(input: {
  id?: string;
  instrument_id: string | null;
  image_path: string;
  name_x: number;
  name_y: number;
  name_size: number;
  name_color: string;
}) {
  if (input.id) {
    const { error } = await supabase
      .from("certificate_templates")
      .update({
        image_path: input.image_path,
        name_x: input.name_x,
        name_y: input.name_y,
        name_size: input.name_size,
        name_color: input.name_color,
      })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("certificate_templates").insert({
    instrument_id: input.instrument_id,
    image_path: input.image_path,
    name_x: input.name_x,
    name_y: input.name_y,
    name_size: input.name_size,
    name_color: input.name_color,
  });
  if (error) throw error;
}

export async function deleteCertificateTemplate(id: string) {
  const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function signedTemplateUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("certificate-templates")
    .createSignedUrl(path, 60 * 60 * 4);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadTemplateImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("certificate-templates")
    .upload(path, file, { contentType: file.type || "image/png" });
  if (error) throw error;
  return path;
}

/* ---------- lessons (admin edit) ---------- */

export async function updateLesson(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    video_url?: string | null;
    video_path?: string | null;
    duration_minutes?: number | null;
    requires_submission?: boolean;
    module_id?: string;
    position?: number;
  },
) {
  const { error } = await supabase.from("lessons").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- admin submissions ---------- */

export type AdminSubmission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  feedback: string | null;
  created_at: string;
  video_path: string;
  user_id: string;
  lessons: { title: string; modules: { title: string; instrument_id: string } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export async function fetchAdminSubmissions(instrumentId?: string): Promise<AdminSubmission[]> {
  let query = supabase
    .from("lesson_submissions")
    .select(
      "id, status, note, feedback, created_at, video_path, user_id, lessons!inner(title, modules!inner(title, instrument_id)), profiles!lesson_submissions_user_id_profiles_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false });
  if (instrumentId) query = query.eq("lessons.modules.instrument_id", instrumentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AdminSubmission[];
}

/* ---------- profile ---------- */

export type Profile = { id: string; full_name: string | null; email: string | null; created_at: string };

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(userId: string, fullName: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) throw error;
}

/* ---------- members & roles (admin) ---------- */

export type Member = Profile & { roles: ("admin" | "student")[] };

export async function fetchMembers(): Promise<Member[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  return (profiles ?? []).map((p) => ({
    ...(p as Profile),
    roles: (roles ?? [])
      .filter((r) => r.user_id === p.id)
      .map((r) => r.role as "admin" | "student"),
  }));
}

export async function grantRole(userId: string, role: "admin" | "student") {
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export async function revokeRole(userId: string, role: "admin" | "student") {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  if (error) throw error;
}

/* ---------- chat ---------- */

export type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

export async function fetchChatMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, user_id, display_name, content, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function sendChatMessage(input: {
  userId: string;
  displayName: string;
  content: string;
}) {
  const { error } = await supabase.from("chat_messages").insert({
    user_id: input.userId,
    display_name: input.displayName.slice(0, 80),
    content: input.content.slice(0, 1000),
  });
  if (error) throw error;
}

export async function deleteChatMessage(id: string) {
  const { error } = await supabase.from("chat_messages").delete().eq("id", id);
  if (error) throw error;
}
