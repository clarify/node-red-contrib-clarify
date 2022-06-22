const Joi = require('joi');

const clarifyInputIdRegEx = /^[a-zA-Z0-9-_:.#+/]{1,128}$/;
const numbers = '\\d+(?:[\\.,]\\d+)?';
const datePattern = `(${numbers}D)?`;
const timePattern = `T(${numbers}H)?(${numbers}M)?(${numbers}S)?`;
const duration = new RegExp(`^P(?:${datePattern}(?:${timePattern})?)$`);
const keyPattern = /^[a-zA-Z0-9_/-]{1,40}$/;
const enumKeyPattern = /^(0|[1-9][0-9]{0,3})$/;

const SignalSchema = Joi.object({
  name: Joi.string().max(100).required(),
  type: Joi.string().valid('enum', 'numeric'),
  valueType: Joi.string().valid('enum', 'numeric'),
  description: Joi.string().max(1000),
  engUnit: Joi.string().max(255),
  sourceType: Joi.string().valid('aggregation', 'measurement', 'prediction'),
  sampleInterval: Joi.string().regex(duration),
  gapDetection: Joi.string().regex(duration),
  labels: Joi.object().pattern(keyPattern, Joi.array().items(Joi.string())),
  annotations: Joi.object().pattern(keyPattern, Joi.string()),
  enumValues: Joi.object().pattern(enumKeyPattern, Joi.string().max(128)),
});

/** @type Joi.ObjectSchema<{times: string[], value: number[]}> */
const PayloadSchema = Joi.object({
  times: Joi.array().items(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
  values: Joi.array().items(Joi.number(), Joi.equal(null)),
}).assert('.times.length', Joi.ref('values.length'));

/** @type Joi.ObjectSchema<{time: string, value: number}> */
const PayloadSingleSchema = Joi.object({
  time: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
  value: Joi.number().required(),
});

/** @type Joi.AnySchema<number> */
const PayloadNumberSchema = Joi.number().required();

const MessageSchema = Joi.object({
  topic: Joi.string().regex(clarifyInputIdRegEx).required(),
  signal: SignalSchema,
  payload: Joi.alternatives().try(PayloadSchema, PayloadSingleSchema, PayloadNumberSchema),
});

async function convertPayload(payload) {
  let payloadData = PayloadSchema.validate(payload);
  if (!payloadData.error) {
    return payloadData.value;
  }

  let payloadSingleData = PayloadSingleSchema.validate(payload);
  if (!payloadSingleData.error) {
    return {
      times: [payloadSingleData.value.time],
      values: [payloadSingleData.value.value],
    };
  }

  let data = PayloadNumberSchema.validate(payload);
  if (!data.error) {
    let now = new Date();
    return {
      times: [now.toISOString()],
      values: [data.value],
    };
  }

  return null;
}

async function validateMessage(message) {
  try {
    let payload = await MessageSchema.validateAsync({
      topic: message.topic,
      signal: message.signal,
      payload: message.payload,
    });
    payload.payload = await convertPayload(payload.payload);
    return payload;
  } catch (error) {
    return Promise.reject(error);
  }
}

module.exports = {validateMessage};
