import {setupServer, SetupServerApi} from 'msw/node';
import {afterAll, beforeAll} from 'vitest';

export function setupMockServiceWorker(): SetupServerApi {
  let actualServer!: SetupServerApi;
  let proxy = new Proxy(
    {},
    {
      get(_obj, prop: keyof SetupServerApi) {
        return actualServer[prop];
      },
      set(_obj, prop: keyof SetupServerApi, value: unknown) {
        // @ts-expect-error
        actualServer[prop] = value;
        return true;
      },
    },
  );

  beforeAll(async () => {
    actualServer = setupServer();
    actualServer.listen();
  });

  afterAll(async () => {
    actualServer.close();
  });

  return proxy as SetupServerApi;
}
