const Joi = require('joi');

const numbers = '\\d+(?:[\\.,]\\d+)?';
const datePattern = `(${numbers}D)?`;
const timePattern = `T(${numbers}H)?(${numbers}M)?(${numbers}S)?`;
const duration = new RegExp(`^P(?:${datePattern}(?:${timePattern})?)$`);

/** @type Joi.ObjectSchema<{
 *   include: ['item'],
 *   query: {
 *     sort: string[],
 *     limit: number,
 *     skip: number,
 *     total: boolean,
 *     filter: any,
 *   },
 *   data: {
 *     times: {
 *       $gte: string,
 *       $lt: string,
 *     },
 *     rollup?: string,
 *     last?: number,
 *   },
 * }> */
const DataFrameRequestValidator = Joi.object({
  query: Joi.object({
    sort: Joi.array().items(Joi.string()),
    limit: Joi.number().max(50).min(1).integer(),
    skip: Joi.number().min(0).integer(),
    total: Joi.boolean(),
    filter: Joi.any(),
  }).required(),
  data: Joi.object({
    filter: Joi.object({
      times: Joi.object({
        $gte: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
        $lt: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
      }).required(),
    }).required(),
    timeZone: Joi.string(),
    firstDayOfWeek: Joi.number(),
    outsidePoints: Joi.boolean(),
    rollup: Joi.string().regex(duration),
    origin: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
    last: Joi.number(),
  }).required(),
  include: Joi.array().items('item'),
  format: Joi.object({
    dataAsArray: Joi.boolean(),
    groupIncludedByType: Joi.boolean(),
  }),
});

const EvaluateValidator = Joi.object({
  items: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      alias: Joi.string().required(),
      aggregation: Joi.string()
        .valid(
          'min',
          'max',
          'avg',
          'count',
          'sum',
          'state-histogram-rate',
          'state-histogram-seconds',
          'state-histogram-percent',
        )
        .required(),
      state: Joi.number(),
      lag: Joi.number(),
      lead: Joi.number(),
    }),
  ),
  calculations: Joi.array().items(
    Joi.object({
      formula: Joi.string().required(),
      alias: Joi.string().required(),
    }),
  ),
  data: Joi.object({
    filter: Joi.object({
      times: Joi.object({
        $gte: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
        $lt: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
      }).required(),
      series: Joi.object({
        $in: Joi.array().items(Joi.string()).required(),
      }).required(),
    }).required(),
    timeZone: Joi.string(),
    firstDayOfWeek: Joi.number(),
    outsidePoints: Joi.boolean(),
    rollup: Joi.string().regex(duration),
    origin: Joi.alternatives().try(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
    last: Joi.number(),
  }).required(),
  include: Joi.array().items('item'),
  format: Joi.object({
    dataAsArray: Joi.boolean(),
    groupIncludedByType: Joi.boolean(),
  }),
});

module.exports = {DataFrameRequestValidator, EvaluateValidator};
