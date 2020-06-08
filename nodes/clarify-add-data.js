module.exports = function (RED) {
    const signalIDpattern = /^[0-9a-v]{20}_[a-z0-9_]{1,40}$/
    function ClarifyAddDataNode(config) {
        RED.nodes.createNode(this, config);
        this.api = RED.nodes.getNode(config.apiRef);
        this.signalID = config.signalID;
        this.signalIDType = config.signalIDType
        this.data = config.data;
        this.dataType = config.dataType;
        this.dataTypeType = config.dataTypeType;
        var node = this;
        if (this.api) {
            if (!this.api.apiUrl || !this.signalID) {
                this.status({ fill: "red", shape: "ring", text: "missing parameters" });
                node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again');
                return;
            }
            this.status({});
            this.on('input', function (msg, send, done) {
                try {
                    var signalID = RED.util.evaluateNodeProperty(node.signalID, node.signalIDType, node, msg);
                    var data = RED.util.evaluateNodeProperty(node.data, "msg", node, msg);
                    var dataType = RED.util.evaluateNodeProperty(node.dataType, node.dataTypeType, node, msg);
                    if (node.dataTypeType != "msg") {
                        dataType = node.dataTypeType
                    }
                } catch (error) {
                    done(error)
                    node.status({ fill: "red", shape: "ring", text: error.message });
                    return
                }


                if (!dataType) {
                    node.status({ fill: "red", shape: "ring", text: 'Missing data type' });
                    done({ "error:": 'Missing data type' });
                    return
                }

                if (!signalID || !signalIDpattern.test(signalID)) {
                    node.status({ fill: "red", shape: "ring", text: 'Missing or incorrect signal ID' });
                    done({ "error:": 'Missing or incorrect signal ID' });
                    return
                }
                if (inputDataCheck(data)) {
                    node.api.addData(dataType, signalID, data).then(response => {
                        msg.payload = response
                        send(msg);
                        done();
                    }).catch(error => {
                        node.status({ fill: "red", shape: "ring", text: error.message });
                        done({ "error:": error });
                    });
                } else {
                    node.status({ fill: "red", shape: "ring", text: 'Missing or wrong data format' });
                    done({ "error:": 'Missing or wrong data format' });
                }
            });

        } else {
            this.error("Missing config");
        }
    }

    function inputDataCheck(inputData) {
        if (Array.isArray(inputData)) {
            if (inputData.length > 0) {
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