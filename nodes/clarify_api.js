const ClarifyDatabase = require('./clarify_db.js');
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
    this.requests = new Set();

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

    this.on('close', done => {
      let requests = Array.from(this.requests);
      Promise.allSettled(requests).finally(() => {
        done();
      });
    });
  }

  ClarifyApiNode.prototype.handleRequest = async function (request) {
    this.requests.add(request);
    try {
      return await request;
    } catch (error) {
      return Promise.reject(error);
    } finally {
      this.requests.delete(request);
    }
  };

  ClarifyApiNode.prototype.saveSignals = async function (payload) {
    let request = this.client.saveSignals(payload);
    return await this.handleRequest(request);
  };

  ClarifyApiNode.prototype.insert = async function (data) {
    let request = this.client.insert(data);
    return await this.handleRequest(request);
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
