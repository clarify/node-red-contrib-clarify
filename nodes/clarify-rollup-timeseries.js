module.exports = function (RED) {

    function ClarifyRollupTimeseriesNode(n) {
        RED.nodes.createNode(this, n);
        this.api = RED.nodes.getNode(n.apiRef);
        this.itemID = n.itemID;
        this.itemIDType = n.itemIDType
        this.method = n.method;
        this.methodType = n.methodType;
        this.delta = n.delta;
        this.from = n.from;
        this.fromType = n.fromType
        this.to = n.to;
        this.toType = n.toType
        var node = this;
        this.status({});


        this.on('input', async function (msg, send, done) {
            var itemID = RED.util.evaluateNodeProperty(node.itemID, node.itemIDType, node, msg);
            var method = node.method;
            var delta = node.delta ? node.delta : "P1D"
            var from = RED.util.evaluateNodeProperty(node.from, node.fromType, node, msg);
            var to = RED.util.evaluateNodeProperty(node.to, node.toType, node, msg);

            let params = {
                query: {
                    "id": itemID
                },
                window: {
                    "from": from,
                    "to": to
                }
            }

            if (method == "timeseries.Enums" || method == "timeseries.EnumsOnChange") {
                params.query.delta = delta;
            }

            node.api.getData(method, params).then(response => {

                let result = response.data.result.sections.flatMap(
                    section => section.map(([timestamp, value]) => { return { timestamp, value } })
                )

                msg.payload = {
                    data: result,
                    length: result.length,
                    firstTs: result[0].timestamp,
                    lastTs: result[result.length - 1].timestamp
                }
                send(msg);
                done();
            }).catch(error => {
                node.status({ fill: "red", shape: "ring", text: error.data.error.message });
                done({ "error:": error });
            });
            done();
            node.status({});
        });
    }

    RED.nodes.registerType("rollup-timeseries", ClarifyRollupTimeseriesNode);
};