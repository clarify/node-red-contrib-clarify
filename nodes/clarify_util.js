var _ = require('lodash');
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

  prepareData: function (RED, msg, config) {
    let times = null;
    try {
      times = RED.util.getMessageProperty(msg, config.signalDataTimes);
    } catch (e) {}

    let series = null;
    try {
      series = RED.util.getMessageProperty(msg, config.signalDataSeries);
    } catch (e) {}

    if (times === null && series === null) {
      return null;
    }

    if (!Array.isArray(times)) {
      throw 'dataTimes must be array';
    }

    if (!Array.isArray(series)) {
      throw 'dataSeries must be array';
    }

    if (times.length != series.length) {
      throw 'length of dataTimes and dataSeries must be equal';
    }

    if (!_.every(series, _.isNumber)) {
      throw 'dataSeries can only be consist of numbers';
    }

    let _times = [];
    times.forEach(t => {
      // Normalize times to RFC3339 times in UTC.
      let dt = DateTime.fromISO(t);
      if (!dt.isValid) {
        throw 'not valid RFC3339 time: ' + t;
      }

      _times.push(dt);
    });

    return {
      times: _times,
      series: series,
    };
  },

  prepareSignal: function (RED, msg, config) {
    let name = RED.util.getMessageProperty(msg, config.signalName);
    let type = RED.util.getMessageProperty(msg, config.signalType);
    let description = RED.util.getMessageProperty(msg, config.signalDescription);
    let engUnit = RED.util.getMessageProperty(msg, config.signalEngUnit);
    let labels = RED.util.getMessageProperty(msg, config.signalLabels);
    let annotations = RED.util.getMessageProperty(msg, config.signalAnnotations);
    let enumValues = RED.util.getMessageProperty(msg, config.signalEnumValues);
    let sourceType = RED.util.getMessageProperty(msg, config.signalSourceType);
    let sampleInterval = RED.util.getMessageProperty(msg, config.signalSampleInterval);
    let gapDetection = RED.util.getMessageProperty(msg, config.signalGapDetection);

    let validationErrors = [];
    validateString(validationErrors, 'name', name);
    validateStringEnum(validationErrors, 'type', type, ['enum', 'numeric']);
    validateString(validationErrors, 'description', description);
    validateMapStringWithStrings(validationErrors, 'labels', labels);
    validateMapStringWithString(validationErrors, 'annotations', annotations);
    validateMapIntWithString(validationErrors, 'enumValues', enumValues);
    validateString(validationErrors, 'engUnit', engUnit);
    validateStringEnum(validationErrors, 'sourceType', sourceType, ['aggregation', 'measurement', 'prediction']);
    validateStringRFC3339(validationErrors, 'sampleInterval', sampleInterval);
    validateStringRFC3339(validationErrors, 'gapDetection', gapDetection);

    if (validationErrors.length > 0) {
      throw validationErrors.join('\n');
    }

    let signal = {};
    assignIfDefined(signal, 'name', name);
    assignIfDefined(signal, 'type', type);
    assignIfDefined(signal, 'description', description);
    assignIfDefined(signal, 'labels', labels);
    assignIfDefined(signal, 'annotations', annotations);
    assignIfDefined(signal, 'engUnit', engUnit);
    assignIfDefined(signal, 'enumValues', enumValues);
    assignIfDefined(signal, 'sourceType', sourceType);
    assignIfDefined(signal, 'sampleInterval', sampleInterval);
    assignIfDefined(signal, 'gapDetection', gapDetection);
    return signal;
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
  validateString(validationErrors, varName, variable);
  if (validationErrors.length > 0) {
    return;
  }

  if (!allowed.includes(variable)) {
    validationErrors.push(`unsupported ${varName}: ${variable}`);
    return;
  }
}

function validateStringRFC3339(validationErrors, varName, variable) {
  validateString(validationErrors, varName, variable);
  if (validationErrors.length > 0) {
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
