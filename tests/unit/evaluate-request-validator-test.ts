import {describe, test, assert} from 'vitest';
// @ts-expect-error
import {EvaluateValidator} from '../../nodes/utilities/data-frame-request-validator';

describe('EvaluteRequestValidator', () => {
  describe('valid payloads', () => {
    test.each([
      [
        'minimum amount of properties',
        {
          items: [],
          calculations: [],
          data: {
            rollup: 'P1D',
            filter: {
              times: {
                $gte: '2023-03-01T12:00:00.000Z',
                $lt: '2023-03-01T12:00:00.000Z',
              },
              series: {
                $in: [],
              },
            },
          },
        },
        {
          items: [],
          calculations: [],
          data: {
            rollup: 'P1D',
            filter: {
              times: {
                $gte: '2023-03-01T12:00:00.000Z',
                $lt: '2023-03-01T12:00:00.000Z',
              },
              series: {
                $in: [],
              },
            },
          },
        },
      ],
    ])('with valid payload (%s)', async (_name, payload, result) => {
      let parsedResult = await EvaluateValidator.validateAsync(payload);
      assert.deepEqual(result, parsedResult, 'parses payload');
    });
  });
});
