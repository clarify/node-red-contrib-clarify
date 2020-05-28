module.exports = function (RED) {
    function ClarifyAddDataNode(config) {
        RED.nodes.createNode(this, config);
        this.api = RED.nodes.getNode(config.apiRef);
        this.signalID = config.signalID;
        this.signalIDType = config.signalIDType
        this.dataType = config.dataType;
        var node = this;
        if (this.api) {
            if (!this.api.apiUrl || !this.dataType || !this.signalID) {
                this.status({ fill: "red", shape: "ring", text: "missing parameters" });
                node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again');
                return;
            }
            this.status({});
            this.on('input', function (msg, send, done) {

                let signalID = RED.util.evaluateNodeProperty(node.signalID, node.signalIDType, node, msg);

                if (msg.payload && inputDataCheck(msg.payload)) {
                    if (msg.dataType) {
                        if (dataTypeMatch(msg.dataType, node.dataType)) {
                            node.api.addData(node.dataType, signalID, msg.payload).then(response => {
                                msg.payload = response
                                send(msg);
                                done();
                            }).catch(error => {
                                node.status({ fill: "red", shape: "ring", text: error.message });
                                done({ "error:": error });
                            });
                        } else {
                            node.status({ fill: "red", shape: "ring", text: 'Data type does not match'});
                            done({ "error:": 'Data type does not match' });
                        }
                    } else {
                        node.api.addData(node.dataType, signalID, msg.payload).then(response => {
                            msg.payload = response
                            send(msg);
                            done();
                        }).catch(error => {
                            node.status({ fill: "red", shape: "ring", text: error.message });
                            done({ "error:": error });
                        });
                    }
                } else {
                    node.status({ fill: "red", shape: "ring", text: 'Missing or wrong data format'});
                    done({ "error:": 'Missing or wrong data format'});
                }

            });

        } else {
            this.error("Missing config");
        }
    }

    function dataTypeMatch(signalType, inputType) {
        if (signalType === "integration.EnsureEnumSignal" && inputType === "input.AddEnums"){
            return true;
        } else if (signalType === "integration.EnsureFloat64Signal" && inputType === "input.AddFloats") {
            return true;
        } else {
            return false;
        }
    }

    function inputDataCheck(inputData) {
        if (Array.isArray(inputData)) {
            if (inputData.length>0) {
                if (Array.isArray(inputData[0])) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    RED.nodes.registerType("add-data", ClarifyAddDataNode);
};