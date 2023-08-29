import {describe, test, assert} from 'vitest';
// @ts-expect-error
import {DataFrameRequestValidator} from '../../nodes/utilities/data-frame-request-validator';

describe('DataFrameRequestValidator', () => {
  describe('valid payloads', () => {
    test.each([
      [
        'minimum amount of properties',
        {
          data: {
            filter: {
              times: {
                $gte: '2023-03-01T12:00:00.000Z',
                $lt: '2023-03-01T12:00:00.000Z',
              },
            },
          },
          query: {
            filter: {
              id: 'some-id',
            },
          },
        },
        {
          data: {
            filter: {
              times: {
                $gte: '2023-03-01T12:00:00.000Z',
                $lt: '2023-03-01T12:00:00.000Z',
              },
            },
          },
          query: {
            filter: {
              id: 'some-id',
            },
          },
        },
      ],
      [
        'minimum amount of properties with unix-timestamps',
        {
          data: {
            filter: {
              times: {
                $gte: 1677672000000,
                $lt: 1677675600000,
              },
            },
          },
          query: {
            filter: {
              id: 'some-id',
            },
          },
        },
        {
          data: {
            filter: {
              times: {
                $gte: '2023-03-01T12:00:00.000Z',
                $lt: '2023-03-01T13:00:00.000Z',
              },
            },
          },
          query: {
            filter: {
              id: 'some-id',
            },
          },
        },
      ],
    ])('with valid payload (%s)', async (_name, payload, result) => {
      let parsedResult = await DataFrameRequestValidator.validateAsync(payload);
      assert.deepEqual(result, parsedResult, 'parses payload');
    });
  });

  // describe('invalid payloads', () => {
  //   test.each([
  //     [
  //       'rejects when times and values isn’t the same length',
  //       {
  //         topic: 'clarify-input-id',
  //         payload: {
  //           times: [first, now],
  //           values: [100, 200, 300],
  //         },
  //       },
  //     ],
  //   ])('with invalid payload (%s)', async (_name, payload) => {
  //     let parsedResult = validateMessage(payload);
  //     await expect(parsedResult).rejects.toThrow();
  //   });
  // });
});
