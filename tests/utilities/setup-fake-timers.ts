import FakeTimers, {InstalledClock} from '@sinonjs/fake-timers';
import {afterEach, beforeEach} from 'vitest';

export function setupFakeTimers(): InstalledClock {
  let clock!: InstalledClock;
  let proxy = new Proxy(
    {},
    {
      get(_obj, prop: keyof InstalledClock) {
        return clock[prop];
      },
      set(_obj, prop: keyof InstalledClock, value: unknown) {
        // @ts-expect-error
        clock[prop] = value;
        return true;
      },
    },
  );

  beforeEach(function () {
    clock = FakeTimers.install();
  });

  afterEach(function () {
    clock.uninstall();
  });

  return proxy as InstalledClock;
}
