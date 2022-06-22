import {setupFakeTimers} from '../utilities/setup-fake-timers';
import {describe, test, assert, beforeEach, expect} from 'vitest';

// @ts-expect-error
import {validateMessage} from '../../nodes/utilities/validate-input';

const first = Date.now() - 1000;
const now = Date.now();

describe('validate-input', () => {
  let clock = setupFakeTimers();
  beforeEach(() => {
    clock.setSystemTime(now);
  });

  describe('signal', () => {
    describe('valid payloads', () => {
      test.each([
        [
          'accept signal with name',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Name of signal',
            },
          },
        ],
        [
          'accept signal with enum values',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Name of signal',
              enumValues: {
                '0': 'Off',
                '1234': 'On',
              },
            },
          },
        ],
      ])('with valid payload (%s)', async (_name, payload) => {
        let parsedResult = await validateMessage(payload);
        assert.ok(parsedResult, 'parses payload');
      });
    });

    describe('invalid payloads', () => {
      test.each([
        [
          'rejects when name isn’t included',
          {
            topic: 'clarify-input-id',
            signal: {
              type: 'enum',
            },
          },
        ],
        [
          'rejects when enum key isn’t valid',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Valid name',
              enumValues: {
                '0123': 'Prevents leading zero',
              },
            },
          },
        ],
        [
          'rejects when enum key is too large',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Valid name',
              enumValues: {
                '10000': 'Too large enum value',
              },
            },
          },
        ],
        [
          'rejects when enum key is negative',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Valid name',
              enumValues: {
                '-100': 'Negative key',
              },
            },
          },
        ],
        [
          'rejects when enum key is non numeric',
          {
            topic: 'clarify-input-id',
            signal: {
              name: 'Valid name',
              enumValues: {
                string: 'String key',
              },
            },
          },
        ],
      ])('with invalid payload (%s)', async (_name, payload) => {
        let parsedResult = validateMessage(payload);
        await expect(parsedResult).rejects.toThrow();
      });
    });
  });

  describe('valid payloads', () => {
    test.each([
      [
        'accept list of items',
        {
          topic: 'clarify-input-id',
          payload: {
            times: [first, now],
            values: [100, 200],
          },
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(first).toISOString(), new Date(now).toISOString()],
            values: [100, 200],
          },
        },
      ],
      [
        'accepts ISO8601 string',
        {
          topic: 'clarify-input-id',
          payload: {
            times: [new Date(now).toISOString()],
            values: [200],
          },
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(now).toISOString()],
            values: [200],
          },
        },
      ],
      [
        'accepts single value',
        {
          topic: 'clarify-input-id',
          payload: {
            time: now,
            value: 200,
          },
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(now).toISOString()],
            values: [200],
          },
        },
      ],
      [
        'accepts single value',
        {
          topic: 'clarify-input-id',
          payload: {
            time: new Date(now).toISOString(),
            value: 200,
          },
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(now).toISOString()],
            values: [200],
          },
        },
      ],
      [
        'accepts single value',
        {
          topic: 'clarify-input-id',
          payload: 200,
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(now).toISOString()],
            values: [200],
          },
        },
      ],
      [
        'accepts single value as zero',
        {
          topic: 'clarify-input-id',
          payload: 0,
        },
        {
          topic: 'clarify-input-id',
          signal: undefined,
          payload: {
            times: [new Date(now).toISOString()],
            values: [0],
          },
        },
      ],
    ])('with valid payload (%s)', async (_name, payload, result) => {
      let parsedResult = await validateMessage(payload);
      assert.deepEqual(result, parsedResult, 'parses payload');
    });
  });

  describe('invalid payloads', () => {
    test.each([
      [
        'rejects when times and values isn’t the same length',
        {
          topic: 'clarify-input-id',
          payload: {
            times: [first, now],
            values: [100, 200, 300],
          },
        },
      ],
      [
        'rejects when value is NaN',
        {
          topic: 'clarify-input-id',
          payload: {
            times: [first],
            values: [NaN],
          },
        },
      ],
      [
        'rejects when date isn’t a number of ISO8601',
        {
          topic: 'clarify-input-id',
          payload: {
            times: ['Thursday'],
            values: [1000],
          },
        },
      ],
      [
        'rejects when value is null',
        {
          topic: 'clarify-input-id',
          payload: {
            time: now,
            value: null,
          },
        },
      ],
      [
        'rejects when payload is null',
        {
          topic: 'clarify-input-id',
          payload: null,
        },
      ],
    ])('with invalid payload (%s)', async (_name, payload) => {
      let parsedResult = validateMessage(payload);
      await expect(parsedResult).rejects.toThrow();
    });
  });
});
