module.exports = function (RED) {
  const {v4: uuidv4} = require('uuid');
  var utils = require('./clarify-utils');

  function ClarifyEnsureMultipleNode(config) {
    RED.nodes.createNode(this, config);
    this.api = RED.nodes.getNode(config.apiRef);
    this.ID = config.ID;
    this.signalName = config.signalName;
    var node = this;
    const signalStore = this.api.db.get('signals');

    function prepareData(signalID, name, dataType, msg) {
      try {
        var labels = RED.util.getObjectProperty(msg.payload, 'labels');
        var enumValues = RED.util.getObjectProperty(msg.payload, 'enumValues');
        var engUnit = RED.util.getObjectProperty(msg.payload, 'engUnit');
        var location = RED.util.getObjectProperty(msg.payload, 'location');
        var sourceType = RED.util.getObjectProperty(msg.payload, 'sourceType') || 'measurement';
        var createItem = RED.util.getObjectProperty(msg.payload, 'createItem');
      } catch (error) {
        throw error;
      }

      let commonData = {
        name: name,
        labels: {
          integrationName: [node.api.integrationName],
          ...labels,
        },
        enumValues: enumValues,
        engUnit: engUnit,
        location: location || [],
      };
      let signal = {
        id: signalID,
        sourceType: sourceType,
      };

      let item = {
        integration: node.api.integrationID,
        integrationName: node.api.integrationName,
        organization: node.api.organizationID,
        type: dataType,
        sourceType: sourceType,
        signals: {value: signalID},
      };

      return {
        common: commonData,
        signal: signal,
        createItem: createItem,
        item: item,
      };
    }

    this.status({});

    this.on('input', async function (msg, send, done) {
      try {
        var ID = RED.util.evaluateNodeProperty(node.ID, 'msg', node, msg);
        var name = RED.util.evaluateNodeProperty(node.signalName, 'msg', node, msg);
        var dataType = RED.util.getObjectProperty(msg.payload, 'dataType');
      } catch (error) {
        done(error);
        node.status({fill: 'red', shape: 'ring', text: error.message});
        return;
      }

      if (!ID || !name || !dataType) {
        done({error: 'msg missing required parameter', msg: msg});
        node.status({fill: 'red', shape: 'ring', text: 'msg missing required parameter'});
        return;
      }

      let savedSignal = signalStore.find({id: ID}).value();

      let data = {};
      try {
        if (savedSignal && savedSignal.data) {
          // Signal exists, check if we should patch
          data = prepareData(savedSignal.data.signal.id, name, dataType, msg);
          data, (patched = await utils.patchSignalItem(data, savedSignal.data, node.api));
          msg.patched = patched;
          msg.created = false;
        } else {
          // Signal does not exists, create
          let signalID = node.api.integrationID + '_' + uuidv4().replace(/-/g, '');
          // use ID directly if it matches the Clarify SignalID pattern
          if (utils.signalIDpattern.test(ID)) {
            signalID = ID;
          }
          data = prepareData(signalID, name, dataType, msg);
          data = await utils.createSignalItem(data, node.api);
          msg.created = true;
        }
      } catch (error) {
        done({error: error});
        node.status({fill: 'red', shape: 'ring', text: error.message});
        return;
      }
      if (savedSignal && msg.patched) {
        // store the changes to db
        signalStore.find({id: ID}).assign({data: data}).write();
      } else {
        signalStore.push({id: ID, data: data}).write();
      }

      msg.signalID = data.signal.id;
      msg.itemID = data.item.id;
      msg.dataType = dataType;
      send(msg);
      done();
      node.status({});
    });
  }

  RED.nodes.registerType('ensure-multiple', ClarifyEnsureMultipleNode);
};
