import { Toast } from "../hooks/useToasts";

const KIND_BORDER = {
  error: "border-l-error",
  success: "border-l-success",
  info: "border-l-accent",
} as const;

/** Fixed top-right stack of transient toast notifications using WCAG AA semantic tokens. */
export default function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] sm:max-w-xs flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`rounded-card border border-border-active border-l-4 ${KIND_BORDER[t.kind]} bg-bg-secondary px-4 py-3 text-body text-text-primary shadow-toast`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
