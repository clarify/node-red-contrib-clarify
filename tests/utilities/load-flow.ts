import type {Flow, NodeTestHelper} from 'node-red-node-test-helper';
import {CLARIFY_CREDENTIALS} from '@clarify/api-test-support';

// @ts-expect-error
import ClarifyInsert from '../../nodes/clarify_insert';
// @ts-expect-error
import ClarifyAPI from '../../nodes/clarify_api';

export async function loadFlow(helper: NodeTestHelper) {
  let flow: Flow[] = [
    {
      id: 'clarify-insert-01',
      type: 'clarify_insert',
      name: 'test name',
      apiRef: 'clarify-api-01',
      wires: [['output']],
    },
    {id: 'clarify-api-01', type: 'clarify_api', name: 'api node'},
    {id: 'output', type: 'helper'},
  ];

  await helper.load([ClarifyInsert, ClarifyAPI], flow, {
    'clarify-api-01': {
      credentialsFile: JSON.stringify(CLARIFY_CREDENTIALS),
    },
  });
}

export async function loadFlowWithoutAPI(helper: NodeTestHelper) {
  let flow: Flow[] = [
    {
      id: 'clarify-insert-01',
      type: 'clarify_insert',
      name: 'test name',
      wires: [['output']],
    },
    {id: 'output', type: 'helper'},
  ];

  await helper.load([ClarifyInsert, ClarifyAPI], flow, {});
}

export async function loadFlowWithoutCredentials(helper: NodeTestHelper) {
  let flow: Flow[] = [
    {
      id: 'clarify-insert-01',
      type: 'clarify_insert',
      name: 'test name',
      apiRef: 'clarify-api-01',
      wires: [['output']],
    },
    {id: 'clarify-api-01', type: 'clarify_api', name: 'api node'},
    {id: 'output', type: 'helper'},
  ];

  await helper.load([ClarifyInsert, ClarifyAPI], flow, {});
}

export async function loadClarifyNodes(helper: NodeTestHelper) {
  await helper.load([ClarifyInsert, ClarifyAPI], [], {});
}
