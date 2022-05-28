import {describe, test, beforeEach, assert} from 'vitest';
import {validToken, CLARIFY_STAGING_API_URL, CLARIFY_CREDENTIALS} from '@clarify/api-test-support';

import {rest} from 'msw';
import {setupNodeRed} from './utilities/setup-node-red';
import {setupMockServiceWorker} from './utilities/setup-msw';
import {loadClarifyNodes, loadFlow} from './utilities/load-flow';

describe('clarify-api', () => {
  let helper = setupNodeRed();
  let server = setupMockServiceWorker();

  describe('HTTP API', () => {
    beforeEach(() => {
      server.resetHandlers(
        validToken(),
        rest.post(/\/clearCache$/, req => {
          return req.passthrough();
        }),
        rest.post(/\/validateToken$/, req => {
          return req.passthrough();
        }),
      );
    });

    test('valid token', async () => {
      await loadClarifyNodes(helper);
      await helper
        .request()
        .post('/validateToken')
        .send({
          credentials: JSON.stringify(CLARIFY_CREDENTIALS),
        })
        .set('Content-Type', 'application/json')
        .expect('Content-Type', /json/)
        .expect(function (res: any) {
          assert.equal(res.body.isValid, true);
        })
        .expect(200);
    });

    test('invalid token', async () => {
      await loadClarifyNodes(helper);
      await helper
        .request()
        .post('/validateToken')
        .send({
          credentials: JSON.stringify({
            credentials: {
              type: 'password',
              clientId: 'client-id',
              clientSecret: 'client-secret',
            },
            integration: 'integration id',
            apiUrl: CLARIFY_STAGING_API_URL,
          }),
        })
        .set('Content-Type', 'application/json')
        .expect('Content-Type', /json/)
        .expect(function (res: any) {
          assert.equal(res.body.isValid, false);
        })
        .expect(200);
    });

    test('clear cache not deployed node', async () => {
      await loadClarifyNodes(helper);
      await helper
        .request()
        .post('/clearCache')
        .send({nodeId: 'bop'})
        .set('Content-Type', 'application/json')
        .expect('Content-Type', /json/)
        .expect(function (res: any) {
          assert.equal(res.body.cleared, false);
        })
        .expect(200);
    });

    test('clear cache on deployed node', async () => {
      await loadFlow(helper);
      await helper
        .request()
        .post('/clearCache')
        .send({nodeId: 'clarify-api-01'})
        .set('Content-Type', 'application/json')
        .expect('Content-Type', /json/)
        .expect(function (res: any) {
          assert.equal(res.body.cleared, true);
        })
        .expect(200);
    });
  });
});
