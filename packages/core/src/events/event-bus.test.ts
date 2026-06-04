import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event-bus.js';

type TestEvents = {
  hello: { name: string };
  goodbye: undefined;
};

describe('EventBus', () => {
  it('delivers an emitted event to a registered listener', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('hello', listener);
    bus.emit('hello', { name: 'world' });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ name: 'world' });
  });

  it('returns an unsubscribe function from on()', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const unsubscribe = bus.on('hello', listener);
    unsubscribe();
    bus.emit('hello', { name: 'world' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates listener exceptions so other listeners still fire', () => {
    const bus = new EventBus<TestEvents>();
    const errorHandler = vi.fn();
    process.once('uncaughtException', errorHandler);

    const exploding = vi.fn(() => {
      throw new Error('boom');
    });
    const peaceful = vi.fn();
    bus.on('hello', exploding);
    bus.on('hello', peaceful);

    bus.emit('hello', { name: 'world' });
    expect(exploding).toHaveBeenCalledOnce();
    expect(peaceful).toHaveBeenCalledOnce();
  });

  it('clear() removes every registered listener', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('hello', listener);
    bus.clear();
    bus.emit('hello', { name: 'world' });
    expect(listener).not.toHaveBeenCalled();
  });
});
