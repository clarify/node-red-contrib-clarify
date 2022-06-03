import {describe, test, beforeEach, assert, afterEach} from 'vitest';
import {rm, mkdtemp, writeFile, access} from 'fs/promises';
import {constants} from 'fs';
// @ts-expect-error
import Database from '../../nodes/clarify_db';

describe('clarify-db', () => {
  let tmpUserDir!: string;
  beforeEach(async () => {
    tmpUserDir = await mkdtemp('userdir');
  });

  afterEach(async () => {
    await rm(tmpUserDir, {recursive: true});
  });

  describe('#saveSignal', () => {
    test('saves input id', async () => {
      let one = new Database(tmpUserDir, 'node-id', 'integration-id');

      await one.saveSignal('input-id', 'hash');

      assert.deepEqual(one.findSignal('input-id'), 'hash');
    });

    test('supports saving multipe input ids', async () => {
      let one = new Database(tmpUserDir, 'node-id', 'integration-id');

      await one.saveSignal('input-id-01', 'hash-01');
      await one.saveSignal('input-id-02', 'hash-02');

      assert.deepEqual(one.findSignal('input-id-01'), 'hash-01');
      assert.deepEqual(one.findSignal('input-id-02'), 'hash-02');
    });

    test('saves to disk', async () => {
      let database = new Database(tmpUserDir, 'node-id', 'integration-id');

      await database.saveSignal('input-id-01', 'hash-01');
      assert.deepEqual(database.findSignal('input-id-01'), 'hash-01');

      let another = new Database(tmpUserDir, 'node-id', 'integration-id');
      assert.deepEqual(another.findSignal('input-id-01'), 'hash-01');
    });

    test('#saveSignal (override)', async () => {
      let one = new Database(tmpUserDir, 'node-id', 'integration-id');

      await one.saveSignal('input-id', 'hash-01');
      await one.saveSignal('input-id', 'hash-02');

      assert.deepEqual(one.findSignal('input-id'), 'hash-02');
    });
  });

  test('#removeAll', async () => {
    let one = new Database(tmpUserDir, 'node-id', 'integration-id');

    await one.saveSignal('input-id', 'hash');
    await one.removeAll();

    assert.deepEqual(one.findSignal('input-id'), undefined);
  });

  test('#deletePreviousVersions', async () => {
    const jsonPath = `${tmpUserDir}/clarify_db.json`;

    await writeFile(jsonPath, '{"signals": []}');

    new Database(tmpUserDir, 'node-id', 'integration-id');

    let exist: boolean;
    try {
      await access(jsonPath, constants.F_OK);
      exist = true;
    } catch (error) {
      exist = false;
    }
    assert.notOk(exist, 'Removes old versions of our database');
  });
});
