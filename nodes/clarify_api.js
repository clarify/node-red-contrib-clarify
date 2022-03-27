const ClarifyDb = require('./clarify_db.js');
const {Client} = require('@clarify/api');
const Joi = require('joi');

const CredentialSchema = Joi.object({
  credentials: Joi.object({
    clientId: Joi.string(),
    clientSecret: Joi.string(),
    type: Joi.string().equal('client-credentials'),
  }),
  integration: Joi.string().required(),
  apiUrl: Joi.string().required(),
});

module.exports = function (RED) {
  function ClarifyApiNode(config) {
    RED.nodes.createNode(this, config);
    this.db = new ClarifyDb(RED.settings.userDir);
    if (this.credentials && this.credentials.credentialsFile) {
      try {
        let file = JSON.parse(this.credentials.credentialsFile);
        let {error} = CredentialSchema.validate(file);
        if (!error) {
          this.client = new Client(file);
          this.integrationId = file.integration;
        }
      } catch (error) {
        console.error('Failed creating client');
      }
    }
  }

  ClarifyApiNode.prototype.saveSignals = function (payload) {
    return this.client.saveSignals(payload);
  };

  ClarifyApiNode.prototype.insert = function (data) {
    return this.client.insert(data);
  };

  RED.httpAdmin.post('/validateToken', async function (request, response) {
    try {
      let credentials = request.body.credentials;
      let file = JSON.parse(credentials);
      await CredentialSchema.validateAsync(file);
      let client = new Client(file);
      await client.authenticator.authenticate();
      response.json({isValid: true});
    } catch (error) {
      response.json({
        isValid: false,
        error: error.message ?? error,
      });
    }
  });

  RED.httpAdmin.post('/clearCache', function (req, res) {
    let out = {
      cleared: false,
      msg: undefined,
    };

    let node = RED.nodes.getNode(req.body.nodeId);
    if (node) {
      let signalsRemoved = node.db.removeAllByIntegrationId(node.integrationId);
      out.msg = `Removed ${signalsRemoved.length} signals`;
      out.cleared = true;
    } else {
      out.msg = 'Node not deployed';
    }

    res.json(out);
  });

  RED.nodes.registerType('clarify_api', ClarifyApiNode, {
    credentials: {
      credentialsFile: {type: 'password'},
    },
  });
};
