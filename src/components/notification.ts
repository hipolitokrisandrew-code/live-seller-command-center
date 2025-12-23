import { createContext } from "react";

export type NotificationKind = "success" | "error" | "info";

export type Notification = {
  id: string;
  message: string;
  kind: NotificationKind;
};

export type NotificationContextValue = {
  notify: (message: string, kind?: NotificationKind) => void;
};

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
