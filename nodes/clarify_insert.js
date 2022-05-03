var _ = require('lodash');
var Mutex = require('async-mutex').Mutex;
const {DateTime} = require('luxon');

const clarifyInputIdRegEx = /^[a-zA-Z0-9-_:.#+/]{1,128}$/;

module.exports = function (RED) {
  var util = require('./clarify_util');

  function ClarifyInsertNode(config) {
    RED.nodes.createNode(this, config);

    this.api = RED.nodes.getNode(config.apiRef);

    this.reporting = null;
    this.reportingTime = 500;

    if (config.bufferTime >= 5) {
      this.bufferTime = config.bufferTime * 1000;
    } else {
      this.bufferTime = 5000;
    }

    this.dataBuffer = {};
    this.dataError = false;
    this.dataBuffering = null;
    this.dataBufferMutex = new Mutex();
    this.dataBufferTime = this.bufferTime;

    this.debug = false;

    this.ensureBuffer = {};
    this.ensureError = false;
    this.ensureBuffering = null;
    this.ensureBufferMutex = new Mutex();
    this.ensureBufferTime = this.bufferTime;

    // nextEnsureFlush is the estimated time (as DateTime object) the ensure flush operation is executed.
    this.nextEnsureFlush = null;

    var node = this;
    node.addEnsureToBuffer = function (id, signal) {
      node.ensureBufferMutex.acquire().then(function (release) {
        node.ensureBuffer[id] = signal;
        release();
      });
    };

    node.addDataToBuffer = function (id, data) {
      node.ensureBufferMutex.acquire().then(function (release) {
        data.times.forEach(function (t, i) {
          if (!(t in node.dataBuffer)) {
            node.dataBuffer[t] = {};
          }
          node.dataBuffer[t][id] = data.values[i];
        });
        release();
      });
    };

    node.reportBuffer = function () {
      if (!node.reporting) {
        node.reporting = setTimeout(function () {
          dataBufferLength = Object.keys(node.dataBuffer).length;
          ensureBufferLength = Object.keys(node.ensureBuffer).length;

          if (node.dataError || node.ensureError) {
            let dataStatus = node.dataError ? 'error' : 'OK';
            let ensureStatus = node.ensureError ? 'error' : 'OK';
            let text = `Save: ${ensureStatus}, Insert: ${dataStatus}`;
            node.status({fill: 'red', shape: 'ring', text: text});
          } else if (dataBufferLength > 0 || ensureBufferLength > 0) {
            let text = '#meta: ' + ensureBufferLength + '. #data: ' + dataBufferLength;
            node.status({text: text});
          } else if (node.debug) {
            node.status({fill: 'yellow', shape: 'ring', text: 'Debug mode active'});
          } else {
            node.status({});
          }
          node.reporting = null;
        }, node.reportingTime);
      }
    };

    node.flushDataBuffer = function () {
      if (!node.dataBuffering) {
        var dataBufferTime = node.dataBufferTime;
        // If the ensureBuffer flush operation is in operation we want to flush the data
        // a certain time after, defined by bufferFlushDifference.
        if (node.nextEnsureFlush !== null) {
          try {
            dataBufferTime = adjustDataBufferTime(node.nextEnsureFlush, node.dataBufferTime);
          } catch (e) {
            node.dataError = true;
            node.send({error: e});
          }
        }

        node.dataBuffering = setTimeout(function () {
          node.dataBufferMutex
            .acquire()
            .then(function (release) {
              dataBuffer = node.dataBuffer;
              node.dataBuffer = {};
              release();
              return dataBuffer;
            })
            .then(function (dataBuffer) {
              data = util.structureData(dataBuffer);
              node.api
                .insert(data)
                .then(response => {
                  node.dataError = false;
                  node.send(response);
                })
                .catch(response => {
                  // Extract error string from response and report it. By adding the remaining response data
                  // as 2nd output can the message be catched by the CatchAll block in Node-RED.
                  let err = response.error;
                  delete response.error;
                  node.error(err, response);

                  node.dataError = true;
                  node.send(response);
                });
              node.reportBuffer();
            });

          node.dataBuffering = null;
        }, dataBufferTime);
      }
    };

    node.flushEnsureBuffer = function () {
      if (!node.ensureBuffering) {
        node.nextEnsureFlush = DateTime.utc().plus({millisecond: node.ensureBufferTime});

        node.ensureBuffering = setTimeout(function () {
          node.ensureBufferMutex
            .acquire()
            .then(function (release) {
              ensureBuffer = node.ensureBuffer;
              node.ensureBuffer = {};
              release();
              return ensureBuffer;
            })
            .then(function (ensureBuffer) {
              node.api
                .saveSignals(ensureBuffer)
                .then(response => {
                  let signalsByInput = _.get(response, 'payload.result.signalsByInput');
                  if (!signalsByInput) {
                    return;
                  }

                  for (id in signalsByInput) {
                    let integrationId = node.api.credentials.integrationId;
                    let savedSignal = node.api.db.findSignal(integrationId, id);
                    let signal = ensureBuffer[id];
                    let signalHashed = util.hashSignal(signal);

                    if (savedSignal) {
                      node.api.db.patchSignal(integrationId, id, signalHashed);
                    } else {
                      node.api.db.createSignal(integrationId, id, signalHashed);
                    }
                  }
                  node.ensureError = false;
                  node.send(response);
                })
                .catch(response => {
                  node.ensureError = true;

                  // Extract error string from response and report it. By adding the remaining response data
                  // as 2nd output can the message be catched by the CatchAll block in Node-RED.
                  let err = response.error;
                  delete response.error;
                  node.error(err, response);

                  node.send(response);
                });
              node.reportBuffer();
            });

          node.nextEnsureFlush = null;
          node.ensureBuffering = null;
        }, node.ensureBufferTime);
      }
    };

    this.on('input', async function (msg, send, done) {
      if (node.api === null) {
        let errMsg = 'missing api configuration';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(`${errMsg}`);
        return;
      }

      if (await !node.api.isCredentialsValid(node)) {
        let errMsg = 'credentials missing/invalid';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(`${errMsg}`);
        return;
      }

      // Validate incoming id. Must be correct to continue
      var id;
      try {
        id = RED.util.getMessageProperty(msg, 'topic');
      } catch (e) {
        let errMsg = 'unable to read topic from message';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(`${errMsg}: ${e}`);
        return;
      }

      if (id === undefined || !clarifyInputIdRegEx.test(id)) {
        let errMsg = 'missing or invalid signal id ([a-zA-Z0-9-_:.#+/]{1,128})';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(`${errMsg}: ${id}`);
        return;
      }

      // Get incoming signal and validate it.
      var signal;
      try {
        signal = util.prepareSignal(RED, msg);
      } catch (e) {
        let errMsg = 'Invalid signal: ' + id;
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        node.error(errMsg, {payload: JSON.parse(e)});
        node.send({errorType: 'Input', payload: JSON.parse(e)});
        return;
      }

      try {
        let debug = RED.util.getMessageProperty(msg, 'debug');
        if (debug) {
          this.debug = true;
        }
      } finally {
        if (this.debug) {
          node.reportBuffer();
        }
      }

      let integrationId = node.api.credentials.integrationId;
      let savedSignal = node.api.db.findSignal(integrationId, id);
      let signalHashed = util.hashSignal(signal);

      if (!_.isEmpty(signal) && (this.debug || !savedSignal || signalHashed != savedSignal.hash)) {
        node.addEnsureToBuffer(id, signal);
        node.flushEnsureBuffer();
      }

      var data;
      try {
        data = util.prepareData(RED, msg);
      } catch (e) {
        let errMsg = 'Invalid data: ' + id;
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        node.error(errMsg, {payload: JSON.parse(e)});
        node.send({errorType: 'Input', payload: JSON.parse(e)});
        return;
      }

      if (data !== null) {
        node.addDataToBuffer(id, data);
        node.flushDataBuffer();
      }

      node.reportBuffer();

      send(null);
      done();
    });

    this.on('close', function () {});
  }

  RED.nodes.registerType('clarify_insert', ClarifyInsertNode);
};

// bufferFlushDifference is the time in milliseconds between the ensure flush
// operation and the data flush operation, added to the data flush operation to
const bufferFlushDifference = 2000;

// adjustDataBufferTime calculates a new data buffer time based on when the ensure flush operation is being executed.
function adjustDataBufferTime(nextEnsureFlush, dataBufferTime) {
  if (typeof nextEnsureFlush !== 'object') {
    throw 'node.nextEnsureFlush is not an object';
  }
  if (!(nextEnsureFlush instanceof DateTime)) {
    throw 'node.nextEnsureFlush is not an object';
  }

  let nextEnsureFlushInMs = nextEnsureFlush.diffNow().toObject().milliseconds;
  if (nextEnsureFlushInMs < 0) {
    throw 'node.nextEnsureFlush is not an object';
  }

  let adjustedDataBufferTime = bufferFlushDifference + Math.round(nextEnsureFlushInMs / 1000) * 1000;
  if (adjustedDataBufferTime < dataBufferTime) {
    return dataBufferTime;
  }

  return adjustedDataBufferTime;
}
