var _ = require('lodash');
var CryptoJS = require('crypto-js');
const {DateTime, Duration} = require('luxon');

const keyPattern = /^[a-zA-Z0-9_/-]{1,40}$/;

module.exports = {
  structureData: function (dataBuffer) {
    let allIds = [];
    for (t in dataBuffer) {
      allIds = allIds.concat(Object.keys(dataBuffer[t]));
    }
    let uniqueIds = [...new Set(allIds)].sort();

    let data = {
      times: Object.keys(dataBuffer).sort(),
      series: {},
    };

    let n = data.times.length;
    uniqueIds.forEach(id => {
      data.series[id] = new Array(n).fill(null);
    });

    data.times.forEach((t, i) => {
      uniqueIds.forEach(id => {
        if (id in dataBuffer[t]) {
          data.series[id][i] = dataBuffer[t][id];
        }
      });
    });

    return data;
  },

  prepareData: function (RED, msg) {
    let payload = RED.util.getMessageProperty(msg, 'payload');
    if (payload === undefined) {
      return null;
    }

    let validationErrors = [];
    if (typeof payload !== 'object') {
      validationErrors.push('msg.payload must be object');
    }

    if (_.isEmpty(payload)) {
      validationErrors.push('msg.payload can not be empty');
    }

    if (!Array.isArray(payload.times)) {
      validationErrors.push('payload.times must be array');
    }

    if (!Array.isArray(payload.values)) {
      validationErrors.push('payload.values must be array');
    }

    if (_.isEmpty(payload.times)) {
      validationErrors.push('msg.payload.times can not be empty');
    }

    if (_.isEmpty(payload.values)) {
      validationErrors.push('msg.payload.values can not be empty');
    }

    if (payload.times.length != payload.values.length) {
      validationErrors.push('length of payload.times and payload.values must be equal');
    }

    if (!_.every(payload.values, _.isNumber)) {
      validationErrors.push('payload.values can only consists of numbers');
    }

    let _times = [];
    if (Array.isArray(payload.times)) {
      payload.times.forEach(t => {
        // Normalize times to RFC3339 times in UTC.
        let dt = DateTime.fromISO(t);
        if (!dt.isValid) {
          validationErrors.push('not valid RFC3339 time: ' + t);
        }

        _times.push(dt);
      });
    }

    if (validationErrors.length > 0) {
      throw JSON.stringify(validationErrors);
    }

    return {
      times: _times,
      values: payload.values,
    };
  },

  prepareSignal: function (RED, msg) {
    let signal = RED.util.getMessageProperty(msg, 'signal');
    if (signal === undefined) {
      return {};
    }

    if (typeof signal !== 'object') {
      throw 'msg.signal must be object';
    }

    if (_.isEmpty(signal)) {
      throw 'msg.signal can not be empty';
    }

    let validationErrors = [];
    validateString(validationErrors, 'name', signal.name);
    validateStringEnum(validationErrors, 'type', signal.type, ['enum', 'numeric']);
    validateString(validationErrors, 'description', signal.description);
    validateMapStringWithStrings(validationErrors, 'labels', signal.labels);
    validateMapStringWithString(validationErrors, 'annotations', signal.annotations);
    validateMapIntWithString(validationErrors, 'enumValues', signal.enumValues);
    validateString(validationErrors, 'engUnit', signal.engUnit);
    validateStringEnum(validationErrors, 'sourceType', signal.sourceType, ['aggregation', 'measurement', 'prediction']);
    validateStringRFC3339(validationErrors, 'sampleInterval', signal.sampleInterval);
    validateStringRFC3339(validationErrors, 'gapDetection', signal.gapDetection);

    if (validationErrors.length > 0) {
      throw JSON.stringify(validationErrors);
    }

    return signal;
  },

  hashSignal(signal) {
    return CryptoJS.MD5(JSON.stringify(signal)).toString();
  },
};

function validateString(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'string') {
    validationErrors.push(varName + ' must be string');
    return;
  }
}

function validateStringEnum(validationErrors, varName, variable, allowed) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'string') {
    validationErrors.push(varName + ' must be string');
    return;
  }

  if (!allowed.includes(variable)) {
    validationErrors.push(`unsupported ${varName}: ${variable}`);
    return;
  }
}

function validateStringRFC3339(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'string') {
    validationErrors.push(varName + ' must be string');
    return;
  }

  let d = Duration.fromISO(variable);
  if (!d.isValid) {
    validationErrors.push(`${varName} isn't a valid RFC3339 duration (${variable})`);
    return;
  }

  if (d.years > 0 || d.months > 0) {
    validationErrors.push(
      `${varName} must be an RFC3339 duration with entries from week to fraction only (${variable})`,
    );
    return;
  }
}

function validateMapStringWithStrings(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'object') {
    validationErrors.push(varName + ' must be object');
    return;
  }

  for (const [key, values] of Object.entries(variable)) {
    if (typeof key !== 'string') {
      validationErrors.push(key + ' in ' + varName + ' must be a string');
      continue;
    }

    if (key === '') {
      validationErrors.push(varName + ' keys can not be empty');
      continue;
    }

    if (!keyPattern.test(key)) {
      validationErrors.push(key + ' in ' + varName + ' must fulfil ' + keyPattern);
    }

    if (typeof values !== 'object' || !Array.isArray(values)) {
      validationErrors.push(varName + '.' + key + ' values must be an array');
      continue;
    }

    if (!_.every(values, _.isString)) {
      validationErrors.push(varName + '.' + key + ' values must be an array of strings');
    }

    if (values.includes('')) {
      validationErrors.push(varName + '.' + key + ' values can not be empty strings.');
    }
  }

  return validationErrors;
}

function validateMapStringWithString(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'object') {
    validationErrors.push(varName + ' must be object');
    return;
  }

  for (const [key, values] of Object.entries(variable)) {
    if (typeof key !== 'string') {
      validationErrors.push(key + ' in ' + varName + ' must be a string');
      continue;
    }

    if (key === '') {
      validationErrors.push(varName + ' keys can not be empty');
      continue;
    }

    if (!keyPattern.test(key)) {
      validationErrors.push(key + ' in ' + varName + ' must fulfil ' + keyPattern);
    }

    if (typeof values !== 'string') {
      validationErrors.push(varName + '.' + key + ' must be a string');
      continue;
    }
  }

  return validationErrors;
}

function validateMapIntWithString(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'object') {
    validationErrors.push(varName + ' must be object');
    return;
  }

  for (const [key, values] of Object.entries(variable)) {
    if (key !== parseInt(key).toString()) {
      validationErrors.push(key + ' in ' + varName + ' must be a integer');
      continue;
    }
    if (typeof values !== 'string') {
      validationErrors.push(varName + '.' + key + ' values must be a string');
    }
  }

  return validationErrors;
}

function assignIfDefined(object, varName, variable) {
  if (variable !== undefined) {
    object[varName] = variable;
  }
}
