module.exports = function (RED) {
  function ClarifyInjectEnumsNode(config) {
    RED.nodes.createNode(this, config);
    this.active = config.active;
    this.enums = config.enums || [];
    this.destination = config.destination;
    this.destinationType = config.destinationType;
    var node = this;
    this.status({});
    node.on('input', async function (msg) {
      var dict = {};
      this.enums.forEach(e => {
        dict[e.key] = e.value;
      });

      try {
        msg[node.destination] = dict;
        node.send(msg);
      } catch (error) {
        node.error({error});
      }
    });
  }

  RED.nodes.registerType('inject-enums', ClarifyInjectEnumsNode);
};
