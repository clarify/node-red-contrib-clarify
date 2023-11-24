const {EvaluateValidator} = require('./utilities/data-frame-request-validator');

module.exports = function (RED) {
  function ClarifyEvaluate(config) {
    RED.nodes.createNode(this, config);
    this.api = RED.nodes.getNode(config.apiRef);
    if (this.api && !this.api.client) {
      this.status({fill: 'red', shape: 'ring', text: 'Credentails are invalid'});
    }

    this.on('input', (msg, send, done) => {
      this.handleInput(msg, send, done);
    });
  }

  ClarifyEvaluate.prototype.handleInput = async function (msg, send, done) {
    if (this.api === null || !this.api.client) {
      let errorMessage = 'Missing API configuration';
      this.status({fill: 'red', shape: 'ring', text: errorMessage});
      done(errorMessage);
      return;
    }

    let payload;
    try {
      payload = await EvaluateValidator.validateAsync(msg.payload);
    } catch (error) {
      this.status({fill: 'red', shape: 'ring', text: `${error}`});
      done(`${error}`);
      return;
    }

    try {
      send({
        payload: await this.api.evaluate(payload),
      });
      done();
      this.status({});
    } catch (error) {
      this.status({fill: 'red', shape: 'ring', text: `${error.message}`});
      done(`${error}`);
    }
  };

  RED.nodes.registerType('clarify_evaluate', ClarifyEvaluate);
};
