import { createContext, useCallback, useContext, useMemo, useState } from "react";

type NotificationKind = "success" | "error" | "info";

export type Notification = {
  id: string;
  message: string;
  kind: NotificationKind;
};

type NotificationContextValue = {
  notify: (message: string, kind?: NotificationKind) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);

  const notify = useCallback((message: string, kind: NotificationKind = "info") => {
    const id = crypto.randomUUID?.() ?? `toast_${Date.now()}_${Math.random()}`;
    const next: Notification = { id, message, kind };
    setItems((prev) => [...prev, next]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-6 z-50 flex w-[420px] max-w-[90vw] -translate-x-1/2 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              item.kind === "success"
                ? "border-emerald-500/70 bg-emerald-50/95 text-emerald-800"
                : item.kind === "error"
                  ? "border-rose-500/70 bg-rose-50/95 text-rose-800"
                  : "border-slate-200 bg-white/95 text-slate-800"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}
