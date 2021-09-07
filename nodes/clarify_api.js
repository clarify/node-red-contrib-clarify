module.exports = function (RED) {
  var _ = require('lodash');
  var qs = require('qs');
  const axios = require('axios').default;
  var url = require('url');
  var jwtDecode = require('jwt-decode');
  const {DateTime} = require('luxon');

  const ClarifyDbLegacy = require('./clarify_db.js');

  const packageInfo = require('../package.json');
  const userAgent = `${packageInfo['name']}/${packageInfo['version']}`;

  function ClarifyApiNode(config) {
    RED.nodes.createNode(this, config);

    this.db = new ClarifyDbLegacy(RED.settings.userDir);

    var nodeContext = this.context();

    this.updateCredentials = function () {
      if (this.credentials.credentialsFile !== undefined) {
        credentialsFile = JSON.parse(this.credentials.credentialsFile);
        this.credentials.apiUrl = credentialsFile.apiUrl;
        this.credentials.clientId = credentialsFile.credentials.clientId;
        this.credentials.clientSecret = credentialsFile.credentials.clientSecret;
        this.credentials.integrationId = credentialsFile.integration;
      }

      if (this.credentials.overrideApiUrl) {
        this.credentials.apiUrl = this.credentials.overrideApiUrl;
      }

      // No need to continue if apiUrl isn't set.
      if (this.credentials.apiUrl === undefined) {
        return;
      }

      if (this.credentials.overrideTokenUrl) {
        this.credentials.tokenUrl = this.credentials.overrideTokenUrl;
      }

      if (this.credentials.overrideAudience) {
        this.credentials.audience = this.credentials.overrideAudience;
      }

      if (this.credentials.overrideClientId) {
        this.credentials.clientId = this.credentials.overrideClientId;
      }

      if (this.credentials.overrideClientSecret) {
        this.credentials.clientSecret = this.credentials.overrideClientSecret;
      }

      if (this.credentials.overrideIntegrationId) {
        this.credentials.integrationId = this.credentials.overrideIntegrationId;
      }

      let url = new URL(this.credentials.apiUrl);
      if (this.credentials.tokenUrl === undefined) {
        switch (url.host) {
          case 'api.clfy.io': // dev api (proxy)
            this.credentials.tokenUrl = 'https://login.clarify.clfy.io/oauth/token';
            break;
          case 'api.clarify.us': // prod api (proxy)
            this.credentials.tokenUrl = 'https://login.clarify.us/oauth/token';
            break;
        }
      }

      if (this.credentials.audience === undefined) {
        this.credentials.audience = this.credentials.apiUrl;
      }

      // Strip slash from apiUrl
      this.credentials.apiUrl = this.credentials.apiUrl.replace(/\/$/, '');
    };

    this.updateCredentials();

    this.isCredentialsValid = async function () {
      if (_.isEmpty(this.credentials)) {
        return false;
      }
      if (
        !this.credentials.apiUrl ||
        !this.credentials.clientId ||
        !this.credentials.clientSecret ||
        !this.credentials.integrationId
      ) {
        return false;
      }

      var accessTokenValid = false;
      await this.getAccessToken().then(token => {
        accessTokenValid = true;
      });

      return accessTokenValid;
    };

    this.tokenValid = function (accessToken) {
      return tokenValid(accessToken);
    };

    this.tokenExpiration = function (accessToken) {
      let decoded = jwtDecode(accessToken);
      return DateTime.fromSeconds(decoded.exp).toRelative();
    };

    this.getAccessToken = async function () {
      var node = this;

      return new Promise(function (resolve, reject) {
        let accessToken = nodeContext.get('accessToken');
        if (accessToken && tokenValid(accessToken)) {
          resolve(accessToken);
          return;
        }

        var options = {
          method: 'POST',
          url: node.credentials.tokenUrl,
          headers: {'content-type': 'application/x-www-form-urlencoded'},
          data: qs.stringify({
            grant_type: 'client_credentials',
            client_id: node.credentials.clientId,
            client_secret: node.credentials.clientSecret,
            audience: node.credentials.audience,
          }),
        };
        axios(options)
          .then(response => {
            nodeContext.set('accessToken', response.data.access_token);
            resolve(response.data.access_token);
          })
          .catch(error => {
            if (error.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              reject(error.response);
            } else if (error.request) {
              // The request was made but no response was received
              // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
              // http.ClientRequest in node.js
              reject(error.request);
            } else {
              // Something happened in setting up the request that triggered an Error
              reject(error.message);
            }
          });
      });
    };

    this.clearCredentialsFile = function () {
      delete this.credentials.credentialsFile;
      this.updateCredentials();
    };
  }

  RED.nodes.registerType('clarify_api', ClarifyApiNode, {
    credentials: {
      credentialsFile: {type: 'password'},
      overrideApiUrl: {type: 'text'},
      overrideTokenUrl: {type: 'text'},
      overrideAudience: {type: 'text'},
      overrideClientId: {type: 'text'},
      overrideClientSecret: {type: 'password'},
      overrideIntegrationId: {type: 'text'},
    },
  });

  function tokenValid(accessToken) {
    let decoded;
    try {
      decoded = jwtDecode(accessToken);
    } catch {
      return false;
    }

    let exp = DateTime.fromSeconds(decoded.exp);
    let limit = exp.minus({minutes: 5});

    return limit > DateTime.now();
  }

  ClarifyApiNode.prototype.saveSignals = function (signals) {
    var node = this;

    var req = node.getAccessToken().then(token => {
      var req = {
        jsonrpc: '2.0',
        method: 'integration.SaveSignals',
        // TODO: Consider making pseudo-random string and verify that we receive the same one.
        id: 1,
        params: {
          integration: node.credentials.integrationId,
          inputs: signals,
        },
      };

      let url = ` ${node.credentials.apiUrl}/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '1.0',
          'User-Agent': userAgent,
        },
        data: req,
      }).catch(error => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          throw error.response;
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          throw error.request;
        } else {
          // Something happened in setting up the request that triggered an Error
          throw error.message;
        }
      });
    });

    return req
      .then(response => {
        if (response.data.error) {
          throw response;
        }
        return response;
      })
      .catch(error => {
        throw error;
      });
  };

  ClarifyApiNode.prototype.insert = function (data) {
    var node = this;

    var req = node.getAccessToken().then(token => {
      var req = {
        jsonrpc: '2.0',
        method: 'integration.Insert',
        // TODO: Consider making pseudo-random string and verify that we receive the same one.
        id: 1,
        params: {
          integration: node.credentials.integrationId,
          data: data,
        },
      };

      let url = ` ${node.credentials.apiUrl}/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '1.0',
          'User-Agent': userAgent,
        },
        data: req,
      }).catch(error => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          throw error.response;
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          throw error.request;
        } else {
          // Something happened in setting up the request that triggered an Error
          throw error.message;
        }
      });
    });

    return req
      .then(response => {
        if (response.data.error) {
          throw response;
        }
        return response;
      })
      .catch(error => {
        throw error;
      });
  };

  RED.httpAdmin.get('/getToken', function (req, res) {
    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node
        .getAccessToken()
        .then(token => {
          res.json({created: true, token: token});
        })
        .catch(err => {
          res.json({
            created: false,
            msg: err.data,
          });
        });
    } else {
      res.json({
        created: false,
        msg: 'Node not deployed',
      });
    }
  });

  RED.httpAdmin.get('/tokenValid', function (req, res) {
    let out = {
      valid: false,
      expiration: null,
      msg: undefined,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      let accessToken = node.context().get('accessToken');
      if (!accessToken) {
        res.json(out);
        return;
      }

      out.valid = node.tokenValid(accessToken);
      if (!out.valid) {
        res.json(out);
        return;
      }

      out.expiration = node.tokenExpiration(accessToken);
    } else {
      out.msg = 'Node not deployed';
    }

    res.json(out);
  });

  RED.httpAdmin.get('/clearToken', function (req, res) {
    let out = {
      cleared: false,
      msg: undefined,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node.context().set('accessToken', undefined);

      out.cleared = true;
    } else {
      out.msg = 'Node not deployed';
    }

    res.json(out);
  });

  RED.httpAdmin.get('/clearCredentialsFile', function (req, res) {
    let out = {
      cleared: false,
      msg: undefined,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node.context().set('accessToken', undefined);
      node.clearCredentialsFile();

      out.cleared = true;
    } else {
      out.msg = 'Node not deployed';
    }

    res.json(out);
  });

  RED.httpAdmin.get('/clearCache', function (req, res) {
    let out = {
      cleared: false,
      msg: undefined,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      let integrationId = node.credentials.integrationId;
      let signalsRemoved = node.db.removeAllByIntegrationId(integrationId);
      out.msg = `Removed ${signalsRemoved.length} signals`;
      out.cleared = true;
    } else {
      out.msg = 'Node not deployed';
    }

    res.json(out);
  });
};
