var _ = require('lodash');
var Mutex = require('async-mutex').Mutex;

const signalIdPattern = /^[a-z0-9_-]{1,40}$/;

module.exports = function (RED) {
  var util = require('./clarify_util');

  function ClarifyInsertNode(config) {
    RED.nodes.createNode(this, config);
    this.api = RED.nodes.getNode(config.apiRef);
    this.signalStore = this.api.db.get('signals');

    this.reporting = null;
    this.reportingTime = 500;

    this.dataBuffer = {};
    this.dataError = false;
    this.dataBuffering = null;
    this.dataBufferMutex = new Mutex();
    this.dataBufferTime = 5000;

    this.ensureBuffer = {};
    this.ensureError = false;
    this.ensureBuffering = null;
    this.ensureBufferMutex = new Mutex();
    this.ensureBufferTime = 5000;

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
          node.dataBuffer[t][id] = data.series[i];
        });
        release();
      });
    };

    node.reportBuffer = function () {
      if (!node.reporting) {
        node.reporting = setTimeout(function () {
          dataBufferLength = Object.keys(node.dataBuffer).length;
          ensureBufferLength = Object.keys(node.ensureBuffer).length;

          if (node.dataError && node.ensureError) {
            node.status({fill: 'red', shape: 'ring', text: 'Ensure: error, Insert: error'});
          } else if (node.ensureError) {
            node.status({fill: 'red', shape: 'ring', text: 'Ensure: error, Insert: OK'});
          } else if (node.dataError) {
            node.status({fill: 'red', shape: 'ring', text: 'Ensure: OK, Insert: error'});
          } else if (dataBufferLength > 0 || ensureBufferLength > 0) {
            let text = '#meta: ' + ensureBufferLength + '. #data: ' + dataBufferLength;
            node.status({text: text});
          } else {
            node.status({});
          }
          node.reporting = null;
        }, node.reportingTime);
      }
    };

    node.flushDataBuffer = function () {
      if (!node.dataBuffering) {
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
                  node.send([{payload: response}, null]);
                })
                .catch(error => {
                  node.dataError = true;
                  node.send([null, error]);
                });
              node.reportBuffer();
            });

          node.dataBuffering = null;
        }, this.dataBufferTime);
      }
    };

    node.flushEnsureBuffer = function () {
      if (!node.ensureBuffering) {
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
                .ensureInputs(ensureBuffer)
                .then(response => {
                  let signalsByInput = _.get(response, 'data.result.signalsByInput');
                  if (!signalsByInput) {
                    return;
                  }

                  for (id in signalsByInput) {
                    let savedSignal = node.signalStore.find({id: id}).value();
                    let signal = ensureBuffer[id];

                    if (savedSignal) {
                      node.signalStore.find({id: id}).assign({data: signal}).write();
                    } else {
                      node.signalStore.push({id: id, data: signal}).write();
                    }
                  }
                  node.ensureError = false;
                  node.send([{payload: response}, null]);
                })
                .catch(error => {
                  node.ensureError = true;
                  node.send([null, error]);
                });
              node.reportBuffer();
            });

          node.ensureBuffering = null;
        }, this.ensureBufferTime);
      }
    };

    this.on('input', async function (msg, send, done) {
      // Validate incoming id. Must be correct to continue
      let id = RED.util.getMessageProperty(msg, config.signalId);
      if (id === undefined) {
        let errMsg = 'missing signal id';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(errMsg);
        return;
      }
      if (!signalIdPattern.test(id)) {
        let errMsg = 'invalid signal id';
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(errMsg);
        return;
      }

      // Get incoming signal and validate it.
      var signal;
      try {
        signal = util.prepareSignal(RED, msg, config);
      } catch (e) {
        let errMsg = 'Invalid signal: ' + id;
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        done(errMsg + '\n' + e);
        return;
      }

      let savedSignal = node.signalStore.find({id: id}).value();

      if (config.alwaysEnsure || !savedSignal || !RED.util.compareObjects(signal, savedSignal.data)) {
        node.addEnsureToBuffer(id, signal);
        node.flushEnsureBuffer();
      }

      var data;
      try {
        data = util.prepareData(RED, msg, config);
      } catch (e) {
        let errMsg = 'Invalid data: ' + id;
        node.status({fill: 'red', shape: 'ring', text: errMsg});
        errMsg += ':\n' + e;
        done(errMsg);
        return;
      }

      node.addDataToBuffer(id, data);
      node.flushDataBuffer();

      node.reportBuffer();

      send(null);
      done();
    });

    this.on('close', function () {});
  }

  RED.nodes.registerType('clarify_insert', ClarifyInsertNode);
};
