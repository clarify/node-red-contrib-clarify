const Joi = require('joi');
const {structureData, hashSignal} = require('./clarify_util');

const clarifyInputIdRegEx = /^[a-zA-Z0-9-_:.#+/]{1,128}$/;
const numbers = '\\d+(?:[\\.,]\\d+)?';
const datePattern = `(${numbers}D)?`;
const timePattern = `T(${numbers}H)?(${numbers}M)?(${numbers}S)?`;
const duration = new RegExp(`^P(?:${datePattern}(?:${timePattern})?)$`);
const keyPattern = /^[a-zA-Z0-9_/-]{1,40}$/;

const SignalSchema = Joi.object({
  name: Joi.string().max(100).required(),
  type: Joi.string().valid('enum', 'numeric'),
  description: Joi.string().max(1000),
  engUnit: Joi.string().max(255),
  sourceType: Joi.string().valid('aggregation', 'measurement', 'prediction'),
  sampleInterval: Joi.string().regex(duration),
  gapDetection: Joi.string().regex(duration),
  labels: Joi.object().pattern(keyPattern, Joi.array().items(Joi.string())),
  annotations: Joi.object().pattern(keyPattern, Joi.string()),
});

const PayloadSchema = Joi.object({
  times: Joi.array().items(Joi.date().iso().cast('string'), Joi.date().timestamp().cast('string')),
  values: Joi.array().items(Joi.number(), Joi.equal(null)),
}).assert('times.length', Joi.ref('values.length'));

const MessageSchema = Joi.object({
  topic: Joi.string().regex(clarifyInputIdRegEx).required(),
  signal: SignalSchema,
  payload: PayloadSchema,
});

class DataBuffer {
  constructor(timeout, flush) {
    this.timeout = timeout;
    this.flush = flush;
    this.buffer = [];
    this.flushTimer = null;
  }

  get length() {
    return this.buffer.length;
  }

  cancel() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  add(data) {
    this.buffer.push(data);
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        let buffer = [...this.buffer];
        this.buffer = [];
        try {
          this.flush(buffer);
        } catch (error) {}
      }, this.timeout);
    }
  }
}

function uniqueInputIds(dataBuffer) {
  let inputIds = new Set();
  for (let signal of dataBuffer.buffer) {
    inputIds.add(signal.inputId);
  }
  return inputIds.size;
}

class ClarifyInsertReporter {
  counts = {};
  errors = {};

  constructor(status) {
    this.status = status;
  }

  setCount(name, count) {
    this.counts[name] = count;
    this.updateStatus();
  }

  setError(name, error) {
    this.errors[name] = error;
    this.updateStatus();
  }

  updateStatus() {
    let errors = [];
    for (let error of Object.values(this.errors)) {
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length) {
      this.status({
        fill: 'red',
        shape: 'ring',
        text: errors.join(', '),
      });
      return;
    }

    let values = [];
    for (let [key, count] of Object.entries(this.counts)) {
      if (count !== 0) {
        values.push(`${key}: ${count}`);
      }
    }

    if (values.length) {
      this.status({
        text: values.join(' | '),
      });
      return;
    }

    this.status({});
  }
}

module.exports = function (RED) {
  function ClarifyInsertNode(config) {
    RED.nodes.createNode(this, config);

    this.reporter = new ClarifyInsertReporter((...args) => {
      this.status(...args);
    });

    let bufferTime = config.bufferTime >= 5 ? config.bufferTime * 1000 : 5000;

    this.dataFrameBuffer = new DataBuffer(bufferTime, data => {
      this.flushDataFramesBuffer(data);
    });
    this.saveSignalBuffer = new DataBuffer(bufferTime, data => {
      this.flushSaveSignalBuffer(data);
    });

    this.api = RED.nodes.getNode(config.apiRef);

    if (this.api && !this.api.client) {
      this.status({fill: 'red', shape: 'ring', text: 'Credentails are invalid'});
    }

    this.on('input', (msg, send, done) => {
      this.handleInput(msg, send, done);
    });

    this.on('close', () => {
      this.dataFrameBuffer.cancel();
      this.saveSignalBuffer.cancel();
    });
  }

  ClarifyInsertNode.prototype.handleInput = async function (msg, send, done) {
    if (this.api === null || !this.api.client || !this.api.database) {
      let errorMessage = 'Missing API configuration';
      this.status({fill: 'red', shape: 'ring', text: errorMessage});
      done(errorMessage);
      return;
    }

    let payload;
    try {
      payload = await MessageSchema.validateAsync({
        topic: msg.topic,
        signal: msg.signal,
        payload: msg.payload,
      });
    } catch (error) {
      this.status({fill: 'red', shape: 'ring', text: `${error}`});
      done(`${error}`);
      return;
    }

    let inputId = payload.topic;

    if (payload.signal) {
      let savedSignal = this.api.database.findSignal(payload.topic);
      let signalHashed = hashSignal(payload.signal);

      if (!savedSignal || signalHashed !== savedSignal.hash) {
        this.saveSignal(inputId, payload.signal);
      }
    }

    if (payload.payload) {
      this.insertDataFrame({
        times: payload.payload.times,
        series: {
          [inputId]: payload.payload.values,
        },
      });
    }

    done();
  };

  ClarifyInsertNode.prototype.insertDataFrame = function (dataFrame) {
    this.dataFrameBuffer.add(dataFrame);
    this.reporter.setCount('insert', this.dataFrameBuffer.length);
  };

  ClarifyInsertNode.prototype.saveSignal = function (inputId, signal) {
    this.saveSignalBuffer.add({inputId, signal});
    this.reporter.setCount('signals', uniqueInputIds(this.saveSignalBuffer));
  };

  ClarifyInsertNode.prototype.flushDataFramesBuffer = async function (dataFrames) {
    let data = structureData(dataFrames);
    try {
      await this.api.insert({data});
      this.reporter.setError('insert', null);
      this.reporter.setCount('insert', this.dataFrameBuffer.length);
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Unknown error';
      this.reporter.setError('insert', `Failed inserting data`);
      this.error(message, {
        payload: data,
      });
    }
  };

  ClarifyInsertNode.prototype.flushSaveSignalBuffer = async function (signals) {
    let inputs = {};
    for (let signal of signals) {
      inputs[signal.inputId] = signal.signal;
    }

    try {
      let response = await this.api.saveSignals({
        createOnly: false,
        inputs: inputs,
      });

      for (let inputId of Object.keys(response.signalsByInput)) {
        let signal = inputs[inputId];
        this.api.database.saveSignal(inputId, hashSignal(signal));
      }

      this.reporter.setError('signals', null);
      this.reporter.setCount('signals', uniqueInputIds(this.saveSignalBuffer));
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Unknown error';
      this.reporter.setError(
        'signals',
        `Failed saving ${signals.length} ${signals.length === 1 ? 'signal' : 'signals'}`,
      );
      this.error(message, {
        payload: inputs,
      });
    }
  };
  RED.nodes.registerType('clarify_insert', ClarifyInsertNode);
};
