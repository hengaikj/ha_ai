export type SessionExpiredHandler = () => void | Promise<void>;

const handlers = new Set<SessionExpiredHandler>();
let notificationPromise: Promise<void> | null = null;

export function onSessionExpired(handler: SessionExpiredHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function notifySessionExpired(): Promise<void> {
  if (!notificationPromise) {
    notificationPromise = Promise.all(
      [...handlers].map((handler) => Promise.resolve(handler())),
    )
      .then(() => undefined)
      .finally(() => {
        notificationPromise = null;
      });
  }

  return notificationPromise;
}
