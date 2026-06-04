/**
 * Minimal observable store. Subscribers fire after every `set`/`update`;
 * the store does no equality check — subscribers diff if they care.
 */
export type StoreListener<T> = (state: T, previous: T) => void;
export type Unsubscribe = () => void;

export interface Store<T> {
  get(): T;
  set(next: Partial<T>): void;
  update(updater: (state: T) => Partial<T>): void;
  subscribe(listener: StoreListener<T>): Unsubscribe;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<StoreListener<T>>();

  function notify(previous: T): void {
    for (const listener of [...listeners]) {
      try {
        listener(state, previous);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  return {
    get(): T {
      return state;
    },
    set(next: Partial<T>): void {
      const previous = state;
      state = { ...state, ...next };
      notify(previous);
    },
    update(updater: (state: T) => Partial<T>): void {
      const previous = state;
      state = { ...state, ...updater(state) };
      notify(previous);
    },
    subscribe(listener: StoreListener<T>): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
