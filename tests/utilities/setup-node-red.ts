import {NodeTestHelper} from 'node-red-node-test-helper';
import {afterAll, afterEach, beforeAll} from 'vitest';
import {rm, mkdtemp} from 'fs/promises';

export function setupNodeRed() {
  let tmpUserDir!: string;
  let helper = new NodeTestHelper();

  beforeAll(async () => {
    tmpUserDir = await mkdtemp('userdir');
    helper.settings({userDir: tmpUserDir});
    await new Promise<void>(resolve => {
      helper.startServer(resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      helper.stopServer(() => {
        resolve();
      });
    });

    await rm(tmpUserDir, {recursive: true});
  });

  afterEach(async () => {
    await helper.unload();
  });

  return helper;
}
