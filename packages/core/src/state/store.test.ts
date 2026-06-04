import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store.js';

interface S {
  a: number;
  b: string;
}

describe('createStore', () => {
  it('exposes the initial state through get()', () => {
    const store = createStore<S>({ a: 1, b: 'x' });
    expect(store.get()).toEqual({ a: 1, b: 'x' });
  });

  it('shallow-merges set() into the current state', () => {
    const store = createStore<S>({ a: 1, b: 'x' });
    store.set({ a: 2 });
    expect(store.get()).toEqual({ a: 2, b: 'x' });
  });

  it('notifies subscribers with the new and previous state', () => {
    const store = createStore<S>({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 2 });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ a: 2, b: 'x' }, { a: 1, b: 'x' });
  });

  it('unsubscribes via the returned function', () => {
    const store = createStore<S>({ a: 1, b: 'x' });
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.set({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('update() receives the current state and merges the result', () => {
    const store = createStore<S>({ a: 10, b: 'x' });
    store.update((current) => ({ a: current.a + 5 }));
    expect(store.get()).toEqual({ a: 15, b: 'x' });
  });

  it('isolates listener exceptions so other listeners still run', () => {
    const store = createStore<S>({ a: 1, b: 'x' });
    const errorHandler = vi.fn();
    process.once('uncaughtException', errorHandler);

    store.subscribe(() => {
      throw new Error('boom');
    });
    const peaceful = vi.fn();
    store.subscribe(peaceful);

    store.set({ a: 2 });
    expect(peaceful).toHaveBeenCalledOnce();
  });
});
