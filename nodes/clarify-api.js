module.exports = function (RED) {
  var qs = require('qs');
  const axios = require('axios').default;
  var url = require('url');
  var jwtDecode = require('jwt-decode');
  var moment = require('moment');

  function ClarifyApiNode(config) {
    RED.nodes.createNode(this, config);
    this.apiUrl = config.apiUrl;
    this.integrationID = config.integrationID;
    this.integrationName = config.integrationName;
    this.organizationID = config.organizationID;

    var nodeContext = this.context();

    this.getAccessToken = async function () {
      var node = this;

      return new Promise(function (resolve, reject) {
        let accessToken = nodeContext.get('accessToken');
        if (accessToken && valid(accessToken)) {
          resolve(accessToken);
          return;
        }
        let urlElements = url.parse(node.apiUrl);
        //todo: remove when login.dev.clfy.io is set as ISS on dev environment
        let tokenUrl = urlElements.host === 'dev.clfy.io' ? 'searis.auth0.com' : 'login.clarify.searis.no';
        let audience =
          urlElements.host === 'dev.clfy.io'
            ? `${urlElements.protocol}//${urlElements.host}/`
            : `${urlElements.protocol}//${urlElements.host}/api/`;

        var options = {
          method: 'POST',
          url: `https://${tokenUrl}/oauth/token`,
          headers: {'content-type': 'application/x-www-form-urlencoded'},
          data: qs.stringify({
            grant_type: 'client_credentials',
            client_id: node.credentials.clientID,
            client_secret: node.credentials.clientSecret,
            audience: audience,
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
  }

  RED.nodes.registerType('clarify-api', ClarifyApiNode, {
    credentials: {
      clientID: {
        type: 'text',
      },
      clientSecret: {
        type: 'password',
      },
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

  ClarifyApiNode.prototype.metaQuery = function (query, method, params, data) {
    var node = this;

    return node
      .getAccessToken()
      .then(token => {
        let url = ` ${node.apiUrl}/meta/${query}`;
        return axios({
          method: method,
          url: url,
          headers: {
            Authorization: 'Bearer ' + token,
            contentType: 'application/json',
          },
          params: params,
          data: data,
        });
      })
      .catch(error => {
        throw error;
      });
  };

  ClarifyApiNode.prototype.getOrganizations = async function (params) {
    var node = this;

    let accessToken = await node.getAccessToken().catch(error => {
      node.error('Error getting accessToken', error);
    });
    let url = ` ${node.apiUrl}/meta/organizations`;
    return axios({
      method: 'GET',
      url: url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        contentType: 'application/json',
      },
      params: params,
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
  };

  ClarifyApiNode.prototype.createOrganization = async function (data) {
    var node = this;

    let accessToken = await node.getAccessToken().catch(error => {
      node.error('Error getting accessToken', error);
    });

    let url = ` ${node.apiUrl}/meta/organizations`;
    return axios({
      method: 'POST',
      url: url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        contentType: 'application/json',
      },
      data: data,
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
  };

  ClarifyApiNode.prototype.createIntegration = async function (data) {
    var node = this;

    let accessToken = await node.getAccessToken().catch(error => {
      node.error('Error getting accessToken', error);
    });

    var data = {
      jsonrpc: '2.0',
      id: 1,
      method: 'integration.CreateIntegration',
      params: data,
    };

    let url = ` ${node.apiUrl}/meta/rpc`;
    return axios({
      method: 'POST',
      url: url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        contentType: 'application/json',
        'X-API-Version': 'next',
      },
      data: data,
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
  };

  ClarifyApiNode.prototype.ensureSignal = function (dataType, data) {
    var node = this;

    var req = node.getAccessToken().then(token => {
      var req = {
        jsonrpc: '2.0',
        id: 1,
        method: dataType,
        params: data,
      };

      let url = ` ${node.apiUrl}/meta/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '0.5',
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

  ClarifyApiNode.prototype.ensureItem = function (data) {
    var node = this;

    return node.getAccessToken().then(token => {
      let url = ` ${node.apiUrl}/meta/items/`;
      var options = {
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
        },

        data: data,
      };
      return axios(options).catch(error => {
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
  };

  ClarifyApiNode.prototype.addData = async function (type, signalID, data) {
    var node = this;

    var req = node.getAccessToken().then(token => {
      var method = '';
      switch (type) {
        case 'numeric':
          method = 'input.AddFloats';
          break;
        case 'enum':
          method = 'input.AddEnums';
          break;
        default:
          throw `Unknown dataType: ${type}`;
      }
      var payload = {
        jsonrpc: '2.0',
        id: 1,
        method: method,
        params: {
          id: signalID,
          data: data,
        },
      };

      let url = ` ${node.apiUrl}/input/rpc`;
      return axios({
        method: 'POST',
        url: url,
        headers: {
          Authorization: 'Bearer ' + token,
          contentType: 'application/json',
          'X-API-Version': '0.5',
        },
        data: payload,
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

    return req.then(response => {
      if (response.data.error) {
        throw response;
      }
      return response;
    });
  };

  ClarifyApiNode.prototype.inviteUser = async function (organization, userID) {
    var node = this;

    let accessToken = await node.getAccessToken().catch(error => {
      node.error('Error getting accessToken', error);
    });

    var data = {
      group: `${organization}:users`,
      matcher: {
        type: 'invite',
        user: userID,
      },
      organization: `${organization}`,
    };

    let url = `${node.apiUrl}/meta/organizations/${organization}/policies`;
    return axios({
      method: 'POST',
      url: url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        contentType: 'application/json',
      },
      data: data,
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
  };

  ClarifyApiNode.prototype.createGroup = async function (organization, name) {
    var node = this;

    let accessToken = await node.getAccessToken().catch(error => {
      node.error('Error getting accessToken', error);
    });

    var data = {
      name: name,
      id: `${organization}:${name}`,
    };

    let url = `${node.apiUrl}/meta/organizations/${organization}/groups`;
    return axios({
      method: 'POST',
      url: url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        contentType: 'application/json',
      },
      data: data,
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
  };

  RED.httpAdmin.get('/clearToken', RED.auth.needsPermission('serial.read'), function (req, res) {
    let node = RED.nodes.getNode(req.query.id);
    if (node) {
      node.context().set('accessToken', undefined);
      res.json({cleared: true});
    } else {
      res.json({cleared: false});
    }
  });
};
