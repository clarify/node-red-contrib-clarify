module.exports = function (RED) {
    function ClarifyInjectLocationsNode(config) {
        RED.nodes.createNode(this, config);
        this.active = config.active;
        this.locations = config.locations || [];
        this.destination = config.destination;
        this.destinationType = config.destinationType;
        var node = this;
        this.status({});
        node.on('input', async function (msg) {
            var locs = [];
            this.locations.forEach((e) => {
                locs.push(e.value);
            });

            try {
                msg[node.destination] = locs;
                node.send(msg);
            } catch (error) {
                node.error({ error });
            }
        });
    }

    RED.nodes.registerType("inject-locations", ClarifyInjectLocationsNode);
};