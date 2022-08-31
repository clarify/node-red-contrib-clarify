import {describe, test, beforeEach, assert} from 'vitest';
import {fake, match, type SinonSpy} from 'sinon';
import {
  validToken,
  rpc,
  CLARIFY_STAGING_API_URL,
  insert,
  CLARIFY_CREDENTIALS,
  saveSignals,
  invalidToken,
} from '@clarify/api-test-support';
import {InsertRPCMethod, SaveSignalsRPCMethod} from '@clarify/api';

import {setupNodeRed} from './utilities/setup-node-red';
import {waitUntil} from './utilities/wait-until';
import {setupMockServiceWorker} from './utilities/setup-msw';
import {setupFakeTimers} from './utilities/setup-fake-timers';
import {loadFlow, loadFlowWithoutAPI, loadFlowWithoutCredentials} from './utilities/load-flow';
import sinon from 'sinon';

let assertMatches = (expected: unknown) => {
  return match(payload => {
    try {
      assert.deepEqual(payload, expected);
      return true;
    } catch (error) {
      return false;
    }
  });
};

describe('clarify-insert', () => {
  let insertRequest!: SinonSpy<[InsertRPCMethod['parameters']]>;
  let saveRequest!: SinonSpy<[SaveSignalsRPCMethod['parameters']]>;

  let helper = setupNodeRed();
  let server = setupMockServiceWorker();
  let clock = setupFakeTimers();

  describe('success', () => {
    beforeEach(async () => {
      let clarifyAPI = rpc.link(`${CLARIFY_STAGING_API_URL}rpc`);
      insertRequest = fake();
      saveRequest = fake();

      server.resetHandlers(validToken(), insert(clarifyAPI, insertRequest), saveSignals(clarifyAPI, saveRequest));

      await loadFlow(helper);
    });

    test('loads nodes', () => {
      let apiNode = helper.getNode('clarify-api-01');
      let insertNode = helper.getNode('clarify-insert-01');
      assert.ok(apiNode, 'Clarify API configuration loaded');
      assert.ok(insertNode, 'Clarify Insert loaded');
    });

    describe('inserting data', () => {
      test('fires single request API', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id',
          payload: {
            times: [new Date().toISOString()],
            values: [1],
          },
        });

        await Promise.resolve();

        assert.notOk(insertRequest.calledOnce);
        assert.ok(insertNode.status.calledOnce);
        await clock.runAllAsync();

        await waitUntil(() => insertRequest.calledOnce && insertNode.status.calledThrice);

        assert.ok(insertNode.status.calledThrice);
        assert.equal(insertNode.error.callCount, 0);
      });

      test('concatinates multiple topics', async () => {
        const DATE = '2022-05-27T08:00:00.000Z';
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id-01',
          payload: {
            times: [DATE],
            values: [1],
          },
        });

        insertNode.receive({
          topic: 'clarify-input-id-02',
          payload: {
            times: [DATE],
            values: [2],
          },
        });

        await Promise.resolve();

        assert.notOk(insertRequest.calledOnce);

        await clock.runAllAsync();
        await waitUntil(() => insertRequest.calledOnce);

        assert.ok(
          insertRequest.calledWithExactly({
            integration: CLARIFY_CREDENTIALS.integration,
            data: {
              times: [DATE],
              series: {
                'clarify-input-id-01': [1],
                'clarify-input-id-02': [2],
              },
            },
          }),
        );
        assert.equal(insertNode.error.callCount, 0);
      });

      test('concatinates multiple topics with non matching times', async () => {
        const DATE_1 = '2022-05-27T08:00:00.000Z';
        const DATE_2 = '2022-05-27T08:01:00.000Z';
        const DATE_3 = '2022-05-27T07:59:00.000Z';
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id-01',
          payload: {
            times: [DATE_1],
            values: [1],
          },
        });

        insertNode.receive({
          topic: 'clarify-input-id-02',
          payload: {
            times: [DATE_2],
            values: [2],
          },
        });

        insertNode.receive({
          topic: 'clarify-input-id-01',
          payload: {
            times: [DATE_3],
            values: [3],
          },
        });

        await Promise.resolve();

        assert.notOk(insertRequest.calledOnce);

        await clock.runAllAsync();
        await waitUntil(() => insertRequest.calledOnce);

        assert.ok(
          insertRequest.calledWithExactly({
            integration: CLARIFY_CREDENTIALS.integration,
            data: {
              times: [DATE_3, DATE_1, DATE_2],
              series: {
                'clarify-input-id-01': [3, 1, null],
                'clarify-input-id-02': [null, null, 2],
              },
            },
          }),
        );
        assert.equal(insertNode.error.callCount, 0);
      });
    });

    describe('saving signals', () => {
      test('saves signal', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id-01',
          signal: {
            name: 'Input id#01',
          },
        });

        await Promise.resolve();

        assert.notOk(saveRequest.calledOnce);

        await clock.runAllAsync();
        await waitUntil(() => saveRequest.calledOnce);

        assert.ok(
          saveRequest.calledWithExactly({
            createOnly: false,
            integration: CLARIFY_CREDENTIALS.integration,
            inputs: {
              'clarify-input-id-01': {
                name: 'Input id#01',
              },
            },
          }),
        );
        assert.equal(insertNode.error.callCount, 0);
      });

      test('saves signal after each other', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id-04',
          signal: {
            name: 'Input id#01',
          },
        });

        await Promise.resolve();

        assert.notOk(saveRequest.calledOnce);

        await clock.runAllAsync();
        await waitUntil(() => saveRequest.calledOnce);

        insertNode.receive({
          topic: 'clarify-input-id-04',
          signal: {
            name: 'Input id#02',
          },
        });

        await clock.runAllAsync();
        await waitUntil(() => saveRequest.calledTwice);
      });
    });
  });

  describe('invalid payload', () => {
    beforeEach(async () => {
      await loadFlow(helper);
    });

    test.each([
      [
        'without topic',
        {
          signal: {
            name: 'Signal name',
          },
        },
      ],
      [
        'with invalid topic',
        {
          topic: 'topic id with space',
          signal: {
            name: 'Signal name',
          },
        },
      ],
      [
        'with invalid payload',
        {
          topic: 'valid-id',
          payload: {
            times: ['2022-05-29P13:24:44.837Z'],
            series: [1],
          },
        },
      ],
      [
        'with not the same number of series as times',
        {
          topic: 'valid-id',
          payload: {
            times: [new Date().toISOString()],
            series: [1, 2],
          },
        },
      ],
    ])('with invalid payload (%s)', async (_name, payload) => {
      let insertNode = helper.getNode('clarify-insert-01');
      insertNode.receive(payload);

      await clock.runAllAsync();
      await waitUntil(() => insertNode.error.calledOnce);
      assert.ok(insertNode.status.called, 'Invokes error callback');
    });
  });

  describe('failure (invalid token)', () => {
    beforeEach(async () => {
      let clarifyAPI = rpc.link(`${CLARIFY_STAGING_API_URL}rpc`);
      insertRequest = fake();
      saveRequest = fake();

      server.resetHandlers(invalidToken(), insert(clarifyAPI, insertRequest), saveSignals(clarifyAPI, saveRequest));
    });

    describe('revoked credentials', () => {
      beforeEach(async () => {
        await loadFlow(helper);
      });

      test('clarify-insert node sends error when flushing data frames', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        const INSERT_DATE = new Date().toISOString();
        insertNode.receive({
          topic: 'clarify-input-id',
          payload: {
            times: [INSERT_DATE],
            values: [1],
          },
        });

        await Promise.resolve();

        assert.notOk(insertRequest.calledOnce);
        assert.ok(insertNode.status.calledOnce);
        await clock.runAllAsync();

        await waitUntil(() => insertNode.error.calledOnce);

        sinon.assert.calledWithMatch(
          insertNode.error,
          assertMatches('Unknown payload'),
          assertMatches({
            payload: {
              times: [INSERT_DATE],
              series: {'clarify-input-id': [1]},
            },
          }),
        );
      });

      test('clarify-insert node sends saving signals', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        insertNode.receive({
          topic: 'clarify-input-id',
          signal: {
            name: 'Clarify input id #456',
          },
        });

        await Promise.resolve();

        assert.notOk(saveRequest.calledOnce);
        assert.ok(insertNode.status.calledOnce);
        await clock.runAllAsync();

        await waitUntil(() => insertNode.error.calledOnce);

        sinon.assert.calledWithMatch(
          insertNode.error,
          assertMatches('Unknown payload'),
          assertMatches({
            payload: {
              'clarify-input-id': {
                name: 'Clarify input id #456',
              },
            },
          }),
        );
      });
    });

    describe('without API node', () => {
      beforeEach(async () => {
        await loadFlowWithoutAPI(helper);
      });

      test('sets status ', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        assert.notOk(insertNode.status.called, 'Refrains from setting status when not configured');
        insertNode.receive({
          topic: 'clarify-input-id',
          signal: {
            name: 'Clarify input id #456',
          },
        });
        await clock.runAllAsync();
        await waitUntil(() => insertNode.status.calledOnce);
        assert.ok(insertNode.error.called, 'Invokes error callback');
      });
    });

    describe('without credentials', () => {
      beforeEach(async () => {
        await loadFlowWithoutCredentials(helper);
      });

      test('sets status when receiving ', async () => {
        let insertNode = helper.getNode('clarify-insert-01');
        assert.ok(insertNode.status.calledOnce, 'Immediately sets status');

        insertNode.receive({
          topic: 'clarify-input-id',
          signal: {
            name: 'Clarify input id #456',
          },
        });
        await clock.runAllAsync();
        await waitUntil(() => insertNode.status.calledTwice);
        assert.ok(insertNode.error.called, 'Invokes error callback');
      });
    });
  });
});
