module.exports = function (RED) {
    const { v4: uuidv4 } = require('uuid');
    var _ = require('lodash');
    var hash = require('object-hash');
    var signalIDpattern = /^[0-9a-v]{20}_[a-z0-9_]{1,40}$/

    function ClarifyEnsureSignalNode(config) {
        RED.nodes.createNode(this, config);
        this.api = RED.nodes.getNode(config.apiRef);
        this.dataType = config.dataType;
        this.sourceType = config.sourceType;
        this.signalID = config.signalID;
        this.signalIDType = config.signalIDType
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
        var nodeContext = this.context();
        this.signalEnsured = false;
        this.itemEnsured = false;

        var node = this;

        if (!node.api || !node.api.apiUrl || !node.dataType) {
            this.status({ fill: "red", shape: "ring", text: "missing parameters" });
            node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again');
            return;
        }

        if (nodeContext.get("signalID")) {
            node.signalID = nodeContext.get("signalID")
            node.signalEnsured = true;
        }
        if (nodeContext.get("itemID")) {
            node.itemID = nodeContext.get("itemID");
            node.itemEnsured = true;
        }

        this.status(formatStatus(nodeContext));

        async function createSignal(node, data, context) {
            let signal = {
                "signal": {
                    "id": node.signalID,
                    "sourceType": node.sourceType,
                    ...data
                }
            }
            return node.api.ensureSignal(node.dataType, signal).then(response => {
                // Signal created, store in context and set status
                node.signalID = response.data.result.signal.id
                node.signalName = signal.signal.name;
                node.engUnit = signal.signal.engUnit;
                context.set("signalID", node.signalID);
                context.set("signalName", node.signalName);
                nodeContext.set("signalEngUnit", node.engUnit);
                res = _.isEmpty(signal.signal.labels) ? "empty" : hash(signal.signal.labels)
                context.set("signalLabels", res);
                res = _.isEmpty(signal.signal.enumValues) ? "empty" : hash(signal.signal.enumValues)
                context.set("signalEnumValues", res);
                res = _.isEmpty(signal.signal.location) ? "empty" : hash(signal.signal.location);
                context.set("signalLocations", res);
                node.signalEnsured = true;
            }).catch(error => {
                throw (error)
            })
        }

        async function createItem(node, data, context) {
            var dType = "numeric";
            if (node.dataType === "integration.EnsureEnumSignal") {
                dType = "enum";
            }

            var itemData = {
                integration: node.api.integrationID,
                integrationName: node.api.integrationName,
                organization: node.api.organizationID,
                type: dType,
                sourceType: node.sourceType,
                signals: { value: node.signalID },
                ...data
            };

            return node.api.ensureItem(itemData).then(response => {
                let id = response.data.id;
                context.set("itemID", id);
                node.itemID = id;
                node.itemEnsured = true;
                node.status(formatStatus(context));
            }).catch(error => {
                throw (error)
            });
        }

        function patchSignalItem(node, data, context) {

            // Check if we should patch
            let name = context.get("signalName");
            let engUnit = context.get("signalEngUnit");
            let labels = context.get("signalLabels");
            let enums = context.get("signalEnumValues");
            let itemID = context.get("itemID");
            let locations = context.get("signalLocations");

            let checkName = engUnit != data.engUnit;
            let checkEngUnit = name != data.name;
            let checkLabels = _.isEmpty(data.labels) ? labels != "empty" : (labels != hash(data.labels));
            let checkEnums = _.isEmpty(data.enumValues) ? enums != "empty" : (enums != hash(data.enumValues));
            let checkLocations = _.isEmpty(data.location) ? locations != "empty" : (locations != hash(data.location));

            if (checkName || checkLabels || checkEnums || checkEngUnit || checkLocations) {
                // Patch signal
                return node.api.metaQuery(`integrations/${node.api.integrationID}/signals/${node.signalID}`, "PATCH", {}, data).then(() => {
                    nodeContext.set("signalName", data.name);
                    nodeContext.set("signalEngUnit", data.engUnit);
                    res = _.isEmpty(data.labels) ? "empty" : hash(data.labels)
                    nodeContext.set("signalLabels", res);
                    res = _.isEmpty(data.enumValues) ? "empty" : hash(data.enumValues)
                    nodeContext.set("signalEnumValues", res);
                    res = _.isEmpty(data.locations) ? "empty" : hash(data.locations)
                    nodeContext.set("signalLocations", res);
                }).then(() => {
                    if (itemID) {
                        // Patch item
                        return node.api.metaQuery(`items/${itemID}`, "PATCH", {}, data)
                    }

                }).catch(error => {
                    throw (error)
                })
            }
        }


        this.on('input', async function (msg, send, done) {
            try {
                var signalID = RED.util.evaluateNodeProperty(node.signalID, node.signalIDType, node, msg);
                var signalName = RED.util.evaluateNodeProperty(node.signalName, node.signalNameType, node, msg);
                var signalEngUnit = RED.util.evaluateNodeProperty(node.signalEngUnit, node.signalEngUnitType, node, msg);
                var signalLabels = RED.util.evaluateNodeProperty(node.signalLabels, node.signalLabelsType, node, msg);
                var signalEnumValues = RED.util.evaluateNodeProperty(node.signalEnumValues, node.signalEnumValuesType, node, msg);
                var signalLocations = RED.util.evaluateNodeProperty(node.signalLocations, node.signalLocationsType, node, msg);
            } catch (error) {
                done(error)
                node.status({ fill: "red", shape: "ring", text: error.message });
                return
            }

            if (!signalName) {
                done("Missing signal name")
                node.status({ fill: "red", shape: "ring", text: "Missing signal name" });
                return
            }

            let data = {
                "name": signalName,
                "labels": {
                    integrationName: [node.api.integrationName],
                    ...signalLabels
                },
                "enumValues": signalEnumValues,
                "engUnit": signalEngUnit,
                "location": signalLocations,
            };


            // If ensured we should check if we should patch signal and item
            if (node.signalEnsured) {
                if (signalID && signalID != node.signalID) {
                    node.status({ fill: "red", shape: "ring", text: "Stored SignalID != msg.SignalID" });
                    done("Incoming ID not equal to stored ID")
                    return
                }

                if (node.createItem && !node.itemEnsured) {
                    try {
                        await createItem(node, data, nodeContext)
                        msg.itemID = node.itemID
                    } catch (error) {
                        node.status({ fill: "red", shape: "ring", text: error.message });
                        done({ "error:": error })
                        return
                    }
                }

                try {
                    await patchSignalItem(node, data, nodeContext)
                    msg.signalID = node.signalID
                } catch (error) {
                    node.status({ fill: "red", shape: "ring", text: error.message });
                    done({ "error:": error })
                    return
                }

            } else {
                // Set signalID
                switch (node.signalIDType) {
                    case "str":
                    case "msg":
                        if (signalIDpattern.test(signalID)) {
                            node.signalID = signalID;
                        } else {
                            node.warn({ "iid": node.api.integrationID, "sid": signalID })
                            node.signalID = node.api.integrationID + "_" + signalID;
                        }
                        break;
                    case "autoGenerated":
                        node.signalID = node.api.integrationID + "_" + uuidv4().replace(/-/g, "");
                        break;
                }

                if (!node.signalID) {
                    done("Missing signalID");
                    node.status({ fill: "red", shape: "ring", text: "Missing signalID" });
                    return
                }

                try {
                    await createSignal(node, data, nodeContext);
                    msg.signalID = node.signalID;

                } catch (error) {
                    node.status({ fill: "red", shape: "ring", text: error.message });
                    done(error)
                    return
                }

                if (node.createItem && !node.itemEnsured) {
                    try {
                        await createItem(node, data, nodeContext);
                        msg.itemID = node.itemID
                    } catch (error) {
                        node.status({ fill: "red", shape: "ring", text: error.message });
                        done({ "error:": error })
                        return
                    }
                }

            }

            msg.dataType = node.dataType;

            node.status(formatStatus(nodeContext));
            send(msg);
            done()

        });
    }

    function formatStatus(context) {

        let signalName = context.get("signalName")
        let signalID = context.get("signalID");
        let itemID = context.get("itemID");

        if (signalName && signalID && itemID) {
            return { fill: "green", shape: "dot", text: `${signalName} (signalID & itemID set)` };
        } else if (signalName && signalID && !itemID) {
            return { fill: "green", shape: "dot", text: `${signalName} (signalID set)` };
        } else if (signalName && !signalID && !itemID) {
            return { fill: "grey", shape: "dot", text: `${signalName} (Missing signalID)` };
        } else {
            return { fill: "grey", shape: "dot", text: 'Unknown state' };
        }
    }

    RED.httpAdmin.get("/signalID", RED.auth.needsPermission('serial.read'), function (req, res) {
        let node = RED.nodes.getNode(req.query.id);
        if (node && node.signalEnsured) {
            res.json({ signalID: node.signalID });
        } else {
            res.json();
        }

    });

    RED.httpAdmin.get("/itemID", RED.auth.needsPermission('serial.read'), function (req, res) {
        let node = RED.nodes.getNode(req.query.id);
        if (node && node.signalEnsured) {
            res.json({ itemID: node.itemID });
        } else {
            res.json();
        }
    });

    RED.nodes.registerType("ensure-signal", ClarifyEnsureSignalNode, {
        settings: {
            sampleNodeColour: {
                value: "red",
                exportable: true
            }
        }
    });
};