var _ = require('lodash');
var moment = require('moment');

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
        v = dataBuffer[t][id];
        if (v) {
          data.series[id][i] = v;
        }
      });
    });

    return data;
  },
  prepareData: function (RED, msg, config) {
    let times = RED.util.getMessageProperty(msg, config.signalDataTimes);
    let series = RED.util.getMessageProperty(msg, config.signalDataSeries);

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
      _times.push(moment(t).toISOString());
    });

    return {
      times: _times,
      series: series,
    };
  },
  prepareSignal: function (RED, msg, config) {
    let name = RED.util.getMessageProperty(msg, config.signalName);
    let dataType = RED.util.getMessageProperty(msg, config.signalDataType);
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
    validateString(validationErrors, 'dataType', dataType);
    validateString(validationErrors, 'description', description);
    validateMapStringWithStrings(validationErrors, 'labels', labels);
    validateMapStringWithStrings(validationErrors, 'annotations', annotations);
    validateMapIntWithString(validationErrors, 'enumValues', enumValues);
    validateString(validationErrors, 'engUnit', engUnit);
    validateString(validationErrors, 'sourceType', sourceType);
    validateString(validationErrors, 'sampleInterval', sampleInterval);
    validateString(validationErrors, 'gapDetection', gapDetection);

    if (validationErrors.length > 0) {
      throw validationErrors.join('\n');
    }

    let signal = {};
    assignIfDefined(signal, 'name', name);
    assignIfDefined(signal, 'type', dataType);
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

  // Field spesific validations
  let allowed = [];
  switch (varName) {
    case 'dataType':
      allowed = ['enum', 'numeric'];
      if (!allowed.includes(variable)) {
        validationErrors.push('unsupported dataType: ' + variable);
      }
      break;
    case 'sourceType':
      allowed = ['aggregation', 'measurement', 'prediction'];
      if (!allowed.includes(variable)) {
        validationErrors.push('unsupported sourceType: ' + variable);
      }
      break;
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

    if (key.length > 40) {
      validationErrors.push(key + ' in ' + varName + ' is too long. Max 40 chars.');
    }

    if (key.indexOf(' ') >= 0) {
      validationErrors.push(key + ' in ' + varName + ' can not contain spaces.');
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

function validateMapIntWithString(validationErrors, varName, variable) {
  if (variable === undefined) {
    return;
  }

  if (typeof variable !== 'object') {
    validationErrors.push(varName + ' must be object');
    return;
  }

  for (const [key, values] of Object.entries(variable)) {
    if (!Number.isInteger(key)) {
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
