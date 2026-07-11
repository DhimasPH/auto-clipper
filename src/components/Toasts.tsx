import { Toast } from "../hooks/useToasts";

/** Fixed top-right stack of transient toast notifications. */
export default function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 1000,
        maxWidth: "320px",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "12px",
            fontSize: "0.875rem",
            color: "var(--on-accent)",
            background:
              t.kind === "error"
                ? "var(--toast-error-bg)"
                : t.kind === "success"
                  ? "var(--toast-success-bg)"
                  : "var(--toast-info-bg)",
            border: "1px solid var(--toast-border)",
            boxShadow: "0 4px 20px var(--toast-shadow)",
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
