const Joi = require('joi');

const numbers = '\\d+(?:[\\.,]\\d+)?';
const datePattern = `(${numbers}D)?`;
const timePattern = `T(${numbers}H)?(${numbers}M)?(${numbers}S)?`;
const duration = new RegExp(`^P(?:${datePattern}(?:${timePattern})?)$`);

/** @type Joi.ObjectSchema<{
 *   groupIncludedByType: boolean,
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
    rollup: Joi.string().regex(duration),
    last: Joi.number(),
  }).required(),
  include: Joi.array().items('item'),
  groupIncludedByType: Joi.boolean(),
});

module.exports = {DataFrameRequestValidator};
