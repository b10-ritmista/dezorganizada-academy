import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { signedTemplateUrl, type CertificateTemplate } from "@/lib/app-data";
import logoAsset from "@/assets/logo.png.asset.json";

export type CertificateData = {
  id: string;
  code: string;
  issued_at: string;
  instrumentName: string;
};

/** Renders a certificate (custom admin template when available) and exports it to PDF. */
export function CertificateView({
  cert,
  studentName,
  template,
}: {
  cert: CertificateData;
  studentName: string;
  template?: CertificateTemplate | null;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const bg = useQuery({
    queryKey: ["template-url", template?.image_path],
    queryFn: () => signedTemplateUrl(template!.image_path),
    enabled: Boolean(template?.image_path),
  });

  async function download() {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(`certificado-${cert.instrumentName}-${cert.code}.pdf`);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div ref={sheetRef}>
        {template && bg.data ? (
          <TemplateSheet
            imageUrl={bg.data}
            template={template}
            studentName={studentName}
          />
        ) : (
          <FallbackSheet cert={cert} studentName={studentName} />
        )}
      </div>
      <Button variant="outline" onClick={download} disabled={busy} className="print:hidden">
        <Download /> {busy ? "Gerando…" : "Baixar PDF"}
      </Button>
    </div>
  );
}

function TemplateSheet({
  imageUrl,
  template,
  studentName,
}: {
  imageUrl: string;
  template: CertificateTemplate;
  studentName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-lg bg-white">
      <img src={imageUrl} alt="Modelo do certificado" className="block w-full" />
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold"
        style={{
          left: `${template.name_x}%`,
          top: `${template.name_y}%`,
          color: template.name_color,
          fontSize: width ? `${(Number(template.name_size) / 100) * width}px` : "16px",
        }}
      >
        {studentName}
      </span>
    </div>
  );
}

function FallbackSheet({
  cert,
  studentName,
}: {
  cert: CertificateData;
  studentName: string;
}) {
  return (
    <article className="rounded-xl border-2 border-primary/60 bg-card p-8 text-center">
      <img src={logoAsset.url} alt="Logo" className="mx-auto h-20 w-20" />
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-primary">
        Certificado de conclusão
      </p>
      <h2 className="mt-4 text-3xl">{studentName}</h2>
      <p className="mt-3 text-muted-foreground">
        concluiu todas as etapas do curso de{" "}
        <span className="font-semibold text-foreground">{cert.instrumentName}</span> da bateria
        DezOrganizada Furiosa.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Emitido em {new Date(cert.issued_at).toLocaleDateString("pt-BR")} · Código{" "}
        <span className="text-accent">{cert.code}</span>
      </p>
    </article>
  );
}
