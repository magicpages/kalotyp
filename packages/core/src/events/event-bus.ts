export type EventListener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class EventBus<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<EventListener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as EventListener<unknown>);
    return () => {
      set?.delete(listener as EventListener<unknown>);
    };
  }

  off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): void {
    this.listeners.get(event)?.delete(listener as EventListener<unknown>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as EventListener<TEvents[K]>)(payload);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
