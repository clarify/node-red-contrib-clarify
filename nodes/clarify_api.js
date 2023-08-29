const ClarifyDatabase = require('./clarify_db.js');
const {Client, DataFrameResponse} = require('@clarify/api');
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
    if (this.credentials && this.credentials.credentialsFile) {
      try {
        let file = JSON.parse(this.credentials.credentialsFile);
        let {error} = CredentialSchema.validate(file);
        if (!error) {
          this.client = new Client(file);
          this.integrationId = file.integration;
          this.database = new ClarifyDatabase(RED.settings.userDir, this.id, file.integration);
        }
      } catch (error) {
        console.error('Failed creating client: ', error);
      }
    }
  }

  ClarifyApiNode.prototype.saveSignals = function (payload) {
    return this.client.saveSignals(payload);
  };

  ClarifyApiNode.prototype.insert = function (data) {
    return this.client.insert(data);
  };

  ClarifyApiNode.prototype.dataFrame = async function (data) {
    let payload = await this.client.dataFrame(data);
    return {
      included: payload.included ?? [],
      data: new DataFrameResponse(payload.data),
    };
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
        error: error.message || error,
      });
    }
  });

  RED.httpAdmin.post('/clearCache', function (req, res) {
    let out = {
      cleared: false,
      msg: undefined,
    };

    /** @type {ClarifyApiNode} */
    let node = RED.nodes.getNode(req.body.nodeId);
    if (node && node.database) {
      let signalsRemoved = node.database.removeAll();
      out.msg = `Removed ${Object.keys(signalsRemoved).length} signals`;
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
