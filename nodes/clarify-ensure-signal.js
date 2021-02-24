module.exports = function (RED) {
  const {v4: uuidv4} = require('uuid');
  var utils = require('./clarify-utils');

  function ClarifyEnsureSignalNode(config) {
    RED.nodes.createNode(this, config);
    this.api = RED.nodes.getNode(config.apiRef);
    this.dataType = config.dataType;
    this.sourceType = config.sourceType;
    this.signalID = config.signalID;
    this.signalIDType = config.signalIDType;
    this.signalName = config.signalName;
    this.signalNameType = config.signalNameType;
    this.signalEngUnit = config.signalEngUnit;
    this.signalEngUnitType = config.signalEngUnitType;
    this.signalLabels = config.signalLabels;
    this.signalLabelsType = config.signalLabelsType;
    this.signalEnumValues = config.enumValues;
    this.signalEnumValuesType = config.enumValuesType;
    this.signalLocations = config.signalLocations;
    this.signalLocationsType = config.signalLocationsType;
    this.createItem = config.createItem;
    this.itemID = config.itemID;

    const nodeStore = this.api.db.get('nodes');
    const signalStore = this.api.db.get('signals');

    var node = this;

    if (!node.api || !node.api.apiUrl || !node.dataType) {
      this.status({fill: 'red', shape: 'ring', text: 'missing parameters'});
      node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again');
      return;
    }

    let nx = nodeStore.find({id: node.id}).value();
    if (nx && nx.signalID) {
      node.signalID = nx.signalID;
    }
    if (nx && nx.itemID) {
      node.itemID = nx.itemID;
    }

    formatStatus();

    function formatStatus() {
      let nx = nodeStore.find({id: node.id}).value();
      if (nx) {
        let signal = signalStore.find({id: nx.signalID}).value();
        let signalName = signal.data.common.name;
        let signalID = signal.data.signal.id;
        let itemID = signal.data.item.id;

        if (signalName && signalID && itemID) {
          node.status({fill: 'green', shape: 'dot', text: `${signalName} (signalID & itemID set)`});
        } else if (signalName && signalID && !itemID) {
          node.status({fill: 'green', shape: 'dot', text: `${signalName} (signalID set)`});
        } else if (signalName && !signalID && !itemID) {
          node.status({fill: 'grey', shape: 'dot', text: `${signalName} (Missing signalID)`});
        } else {
          node.status({fill: 'grey', shape: 'dot', text: 'Unknown state'});
        }
      }
    }

    function prepareData(signalID, dataType, sourceType, createItem, msg, api) {
      try {
        var name = RED.util.evaluateNodeProperty(node.signalName, node.signalNameType, node, msg);
        var engUnit = RED.util.evaluateNodeProperty(node.signalEngUnit, node.signalEngUnitType, node, msg);
        var labels = RED.util.evaluateNodeProperty(node.signalLabels, node.signalLabelsType, node, msg);
        var enumValues = RED.util.evaluateNodeProperty(node.signalEnumValues, node.signalEnumValuesType, node, msg);
        var location = RED.util.evaluateNodeProperty(node.signalLocations, node.signalLocationsType, node, msg);
      } catch (error) {
        throw error;
      }

      if (!name) {
        throw {message: 'missing signal name'};
      }

      // Legacy check to not break earlier versions
      var dType = 'numeric';
      if (dataType === 'integration.EnsureEnumSignal') {
        dType = 'enum';
      }

      let commonData = {
        name: name,
        labels: {
          integrationName: [api.integrationName],
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
        integration: api.integrationID,
        integrationName: api.integrationName,
        organization: api.organizationID,
        type: dType,
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

    this.on('input', async function (msg, send, done) {
      try {
        var signalID = RED.util.evaluateNodeProperty(node.signalID, node.signalIDType, node, msg);
      } catch (error) {
        done(error);
        node.status({fill: 'red', shape: 'ring', text: error.message});
        return;
      }

      let savedNode = nodeStore.find({id: node.id}).value();
      let savedSignal = signalStore.find({id: signalID}).value();
      let data = {};
      try {
        if (savedSignal && savedSignal.data) {
          // Signal exists, check if we should patch
          data = prepareData(
            savedSignal.data.signal.id,
            node.dataType,
            node.sourceType,
            node.createItem,
            msg,
            node.api,
          );
          data, (patched = await utils.patchSignalItem(data, savedSignal.data, node.api));
          msg.patched = patched;
          msg.created = false;
        } else {
          // Set signalID
          switch (node.signalIDType) {
            case 'str':
            case 'msg':
              if (utils.signalIDpattern.test(signalID)) {
                node.signalID = signalID;
              } else {
                node.signalID = node.api.integrationID + '_' + signalID;
              }
              break;
            case 'autoGenerated':
              node.signalID = node.api.integrationID + '_' + uuidv4().replace(/-/g, '');
              break;
          }

          if (!node.signalID) {
            done('Missing signalID');
            node.status({fill: 'red', shape: 'ring', text: 'Missing signalID'});
            return;
          }
          data = prepareData(node.signalID, node.dataType, node.sourceType, node.createItem, msg, node.api);
          data = await utils.createSignalItem(data, node.api);
          msg.created = true;
        }
      } catch (error) {
        done({error: error});
        node.status({fill: 'red', shape: 'ring', text: error.message});
        return;
      }

      if (!savedSignal) {
        // store signal to db
        signalStore.push({id: data.signal.id, data: data}).write();
      } else if (msg.patched) {
        // store the changes to db
        signalStore.find({id: data.signal.id}).assign({data: data}).write();
      }

      // Save the node to db
      if (!savedNode) {
        nodeStore
          .push({
            id: node.id,
            signalID: data.signal.id,
            itemID: data.item.id,
          })
          .write();
      }

      msg.signalID = data.signal.id;
      msg.itemID = data.item.id;
      msg.dataType = data.item.type;

      formatStatus();
      send(msg);
      done();
    });
  }

  RED.httpAdmin.get('/signalID', RED.auth.needsPermission('serial.read'), function (req, res) {
    let node = RED.nodes.getNode(req.query.id);
    if (node && node.signalID) {
      res.json({signalID: node.signalID});
    } else {
      res.json();
    }
  });

  RED.httpAdmin.get('/itemID', RED.auth.needsPermission('serial.read'), function (req, res) {
    let node = RED.nodes.getNode(req.query.id);
    if (node && node.itemID) {
      res.json({itemID: node.itemID});
    } else {
      res.json();
    }
  });

  RED.nodes.registerType('ensure-signal', ClarifyEnsureSignalNode);
};
