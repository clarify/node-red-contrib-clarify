const crypto = require('crypto');

module.exports = {
  structureData: function (dataFrames) {
    let ids = new Set();
    let times = new Set();

    let seriesMap = new Map();

    for (let dataFrame of dataFrames) {
      for (let timestamp of dataFrame.times) {
        times.add(timestamp);
      }

      for (let inputId of Object.keys(dataFrame.series)) {
        ids.add(inputId);
      }
    }

    let uniqueIds = Array.from(ids);

    for (let inputId of uniqueIds) {
      seriesMap.set(inputId, new Map());
    }

    for (let dataFrame of dataFrames) {
      for (let [inputId, values] of Object.entries(dataFrame.series)) {
        let data = seriesMap.get(inputId);
        for (let [index, value] of values.entries()) {
          data.set(dataFrame.times[index], value);
        }
      }
    }

    let length = times.size;
    let series = uniqueIds.reduce((series, inputId) => {
      series[inputId] = new Array(length).fill(null);
      return series;
    }, {});

    let data = {
      times: Array.from(times).sort(),
      series,
    };

    for (let [index, time] of data.times.entries()) {
      for (let inputId of uniqueIds) {
        let cache = seriesMap.get(inputId);
        let value = cache.get(time);
        let payloadValues = data.series[inputId];
        if (value !== undefined) {
          payloadValues[index] = value;
        }
      }
    }
    return data;
  },

  hashSignal(signal) {
    return crypto.createHash('md5').update(JSON.stringify(signal)).digest('hex');
  },
};
