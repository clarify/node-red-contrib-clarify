module.exports = function (RED) {
  var qs = require('qs');
  const axios = require('axios').default;
  var url = require('url');
  var jwtDecode = require('jwt-decode');
  var moment = require('moment');

  const low = require('lowdb');
  const FileSync = require('lowdb/adapters/FileSync');

  const adapter = new FileSync(RED.settings.userDir + '/clarify_db.json');
  const db = low(adapter);

  function ClarifyApiNode(config) {
    RED.nodes.createNode(this, config);

    this.db = db;
    var nodeContext = this.context();

    db.defaults({
      signals: [],
      nodes: [],
    }).write();

    this.updateCredentials = function () {
      if (this.credentials.credentialsFile !== undefined) {
        credentialsFile = JSON.parse(this.credentials.credentialsFile);
        this.credentials.apiUrl = credentialsFile.apiURL;
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

      let urlElements = url.parse(this.credentials.apiUrl);

      if (this.credentials.tokenUrl === undefined) {
        switch (urlElements.host) {
          case 'dev.clfy.io': // dev-legacy
            this.credentials.tokenUrl = 'https://searis.auth0.com/oauth/token';
            break;
          case 'clarify.searis.no': // prod-legacy
            this.credentials.tokenUrl = 'https://login.clarify.searis.no/oauth/token';
            break;
          case 'clarify.clfy.io': // dev
            this.credentials.tokenUrl = 'https://login.clarify.clfy.io/oauth/token';
            break;
        }
      }

      if (this.credentials.audience === undefined) {
        this.credentials.audience =
          url.host === 'dev.clfy.io' ? `${url.protocol}//${url.host}/` : `${url.protocol}//${url.host}/api/`;
      }
    };

    this.updateCredentials();

    this.tokenValid = function (accessToken) {
      let decoded;
      try {
        decoded = jwtDecode(accessToken);
      } catch {
        return false;
      }
      let exp = moment.unix(decoded.exp);
      if (exp.subtract(5, 'minutes').isBefore(moment())) {
        return false;
      }
      return true;
    };

    this.tokenExpiration = function (accessToken) {
      let decoded = jwtDecode(accessToken);
      return moment.unix(decoded.exp);
    };

    this.getAccessToken = async function () {
      var node = this;

      return new Promise(function (resolve, reject) {
        let accessToken = nodeContext.get('accessToken');
        if (accessToken && valid(accessToken)) {
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

  function valid(accessToken) {
    let decoded = jwtDecode(accessToken);
    let exp = moment.unix(decoded.exp);
    if (exp.subtract(5, 'minutes').isBefore(moment())) {
      return false;
    }
    return true;
  }

  ClarifyApiNode.prototype.ensureInputs = function (signals) {
    var node = this;

    var req = node.getAccessToken().then(token => {
      var req = {
        jsonrpc: '2.0',
        method: 'integration.EnsureInputs',
        // TODO: Consider making pseudo-random string and verify that we receive the same one.
        id: 1,
        params: {
          integration: node.credentials.integrationId,
          inputs: signals,
        },
      };

      let url = ` ${node.credentials.apiUrl}/meta/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '1.0',
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

      let url = ` ${node.credentials.apiUrl}/input/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '1.0',
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
        .catch(() => {
          res.json({created: false});
        });
    } else {
      res.json({created: false});
    }
  });

  RED.httpAdmin.get('/tokenValid', function (req, res) {
    let out = {
      valid: false,
      expiration: null,
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
    }

    res.json(out);
  });

  RED.httpAdmin.get('/clearToken', function (req, res) {
    let out = {
      cleared: false,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node.context().set('accessToken', undefined);
      res.json({cleared: true});

      out.cleared = true;
    }

    res.json(out);
  });

  RED.httpAdmin.get('/clearCredentialsFile', function (req, res) {
    let out = {
      cleared: false,
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node.context().set('accessToken', undefined);
      node.clearCredentialsFile();

      out.cleared = true;
    }

    res.json(out);
  });

  RED.httpAdmin.get('/getCache', function (req, res) {
    let out = {
      signals: {},
    };

    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      out.signals = JSON.stringify(node.db.get('signals').value());
    }

    res.json(out);
  });
};
