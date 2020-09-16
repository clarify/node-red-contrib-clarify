module.exports = function (RED) {
    const signalIDpattern = /^[0-9a-v]{20}_[a-z0-9_]{1,40}$/
    const { v4: uuidv4 } = require('uuid');
    const _ = require('lodash');

    function ClarifyEnsureMultipleNode(config) {
        RED.nodes.createNode(this, config);
        this.api = RED.nodes.getNode(config.apiRef);
        this.ID = config.ID;
        this.signalName = config.signalName;
        var node = this;

        function prepareData(signalID, name, dataType, msg) {
            try {
                var labels = RED.util.getObjectProperty(msg.payload, "labels");
                var enumValues = RED.util.getObjectProperty(msg.payload, "enumValues");
                var engUnit = RED.util.getObjectProperty(msg.payload, "engUnit");
                var location = RED.util.getObjectProperty(msg.payload, "location");
                var sourceType = RED.util.getObjectProperty(msg.payload, "sourceType") || "measurement";
                var createItem = RED.util.getObjectProperty(msg.payload, "createItem");
            } catch (error) {
                throw (error);
            };

            let commonData = {
                "name": name,
                "labels": {
                    integrationName: [node.api.integrationName],
                    ...labels
                },
                "enumValues": enumValues,
                "engUnit": engUnit,
                "location": location || [],
            };
            let signal = {
                "id": signalID,
                "sourceType": sourceType,
            };

            let item = {
                "integration": node.api.integrationID,
                "integrationName": node.api.integrationName,
                "organization": node.api.organizationID,
                "type": dataType,
                "sourceType": sourceType,
                "signals": { value: signalID },
            };

            return {
                "common": commonData,
                "signal": signal,
                "createItem": createItem,
                "item": item
            };
        }

        async function createSignalItem(data) {
            var method = "integration.EnsureFloat64Signal";
            if (data.item.type === "enum") {
                method = "integration.EnsureEnumSignal";
            }

            try {
                let signalData = { "signal": { ...data.signal, ...data.common } };
                await node.api.ensureSignal(method, signalData);

                if (data.createItem) {
                    let result = await node.api.ensureItem({ ...data.item, ...data.common });
                    data.item.id = result.data.id;
                }
            } catch (error) {
                throw (error);
            }
            return data;
        }

        async function patchSignalItem(data, old) {
            let equal = compareSignals(data, old);
            let createItemEqual = _.isEqual(data.createItem, old.createItem);
            if (equal && createItemEqual) {
                return old;
            }

            // Set correct ID from the saved object
            data.item.id = old.item.id;
            try {
                // if the common data is unequal patch signal
                if (!equal) {
                    let url = `integrations/${node.api.integrationID}/signals/${data.signal.id}`;
                    await node.api.metaQuery(url, "PATCH", {}, { ...data.common });
                }
                if (!data.item.id && data.createItem) {
                    // create item
                    let result = await node.api.ensureItem({ ...data.item, ...data.common });
                    data.item.id = result.data.id;
                } else if (data.item.id) {
                    // patch item
                    node.api.metaQuery(`items/${data.item.id}`, "PATCH", {}, { ...data.common });
                }
            } catch (error) {
                throw (error);
            }
            return data;
        }

        this.status({});

        this.on('input', async function (msg, send, done) {

            try {
                var ID = RED.util.evaluateNodeProperty(node.ID, "msg", node, msg);
                var name = RED.util.evaluateNodeProperty(node.signalName, "msg", node, msg);
                var dataType = RED.util.getObjectProperty(msg.payload, "dataType");
            } catch (error) {
                done(error);
                node.status({ fill: "red", shape: "ring", text: error.message });
                return;
            }

            if (!ID || !name || !dataType) {
                done({ "error": "msg missing required parameter", "msg": msg });
                node.status({ fill: "red", shape: "ring", text: "msg missing required parameter" });
                return;
            }

            let savedSignal = node.context().get(ID);

            let data = {}
            try {
                if (savedSignal) {
                    // Signal exists, check if we should patch
                    data = prepareData(savedSignal.signal.id, name, dataType, msg);
                    data = await patchSignalItem(data, savedSignal);
                    msg.created = false;
                } else {
                    // Signal does not exists, create
                    let signalID = node.api.integrationID + "_" + uuidv4().replace(/-/g, "");
                    // use ID directly if it matches the Clarify SignalID pattern
                    if (signalIDpattern.test(ID)) {
                        signalID = ID;
                    }
                    data = prepareData(signalID, name, dataType, msg);
                    data = await createSignalItem(data);
                    msg.created = true;
                }
            } catch (error) {
                done({ "error": error });
                node.status({ fill: "red", shape: "ring", text: error.message });
                return;
            }
            node.context().set(ID, data);
            msg.signalID = data.signal.id;
            msg.itemID = data.item.id;
            msg.dataType = dataType;
            send(msg);
            done();
            node.status({});
        });
    }

    function compareSignals(obj1, obj2) {
        const labelsEqual = function (l1, l2) {
            let k1 = Object.keys(l1);
            let k2 = Object.keys(l2);

            if (!_.isEqual(k1, k2)) {
                return false;
            }

            for (var key in l1) {
                if (!_.isEqual(l1[key], l2[key])) {
                    return false;
                }
            }

            return true;

        }
        return labelsEqual(obj1.common.labels, obj2.common.labels) &&
            _.isEqual(obj1.common.name, obj2.common.name) &&
            _.isEqual(obj1.common.enumValues, obj2.common.enumValues) &&
            _.isEqual(obj1.common.engUnit, obj2.common.engUnit) &&
            _.isEqual(obj1.common.location, obj2.common.location)
    }

    RED.nodes.registerType("ensure-multiple", ClarifyEnsureMultipleNode);
};