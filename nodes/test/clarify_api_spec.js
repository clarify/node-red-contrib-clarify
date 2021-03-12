const helper = require('node-red-node-test-helper');
const apiNode = require('../clarify_api.js');
const nock = require('nock');
const utils = require('./test_utils.js');

////// HELPER FUNCTIONS //////
var tmpUserDir = '';

helper.init(require.resolve('node-red'), {
  userDir: './',
});

let credentials = {
  credentialsFile: `{
    "credentials": {
      "type": "client-credentials",
      "clientId": "bop",
      "clientSecret": "sop"
    },
    "integration": "integrationID",
    "apiUrl": "https://clarify.localhost.no/api/"
  }`,
  tokenUrl: 'https://login.localhost.no/oauth/token',
};

////// TESTS //////

describe('api node', function () {
  before(function (done) {
    // runs once before the first test in this block
    tmpUserDir = utils.createUserDir();
    helper.settings({userDir: tmpUserDir});
    helper.startServer(done);
  });

  afterEach(function () {
    // runs once after the last test in this block
    helper.unload();
  });

  after(function (done) {
    helper.stopServer(done);
    utils.removeUserDir(tmpUserDir);
  });

  it('should be loaded', function (done) {
    var flow = [{id: 'n1', type: 'clarify_api', name: 'test name'}];
    helper.load(apiNode, flow, function () {
      var n1 = helper.getNode('n1');
      try {
        n1.should.have.property('name', 'test name');
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('token should be invalid', function (done) {
    var flow = [{id: 'n1', type: 'clarify_api', name: 'test name'}];
    helper.load(apiNode, flow, function () {
      var n1 = helper.getNode('n1');
      try {
        n1.tokenValid('not-a-valid-token').should.not.be.true();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('token should be valid', function (done) {
    var flow = [{id: 'n1', type: 'clarify_api', name: 'test name'}];
    var token = utils.generateToken();
    helper.load(apiNode, flow, {test: 123}, function () {
      var n1 = helper.getNode('n1');
      try {
        n1.tokenValid(token).should.be.true();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('token should be expired', function (done) {
    var flow = [{id: 'n1', type: 'clarify_api', name: 'test name'}];
    var token = utils.generateExpiredToken();
    helper.load(apiNode, flow, {test: 123}, function () {
      var n1 = helper.getNode('n1');
      try {
        n1.tokenValid(token).should.be.false();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('should get valid token', function (done) {
    let token = utils.generateToken();
    nock('https://login.localhost.no')
      .post('/oauth/token')
      .reply(200, function (uri, requestBody) {
        return {
          access_token: token,
        };
      });
    var flow = [{id: 'n1', type: 'clarify_api', name: 'test name'}];
    helper.load(apiNode, flow, function () {
      var n1 = helper.getNode('n1');
      n1.credentials = credentials;
      n1.updateCredentials();
      try {
        n1.credentials.should.be.an.Object().and.not.empty();
        n1.getAccessToken()
          .then(
            resToken => {
              resToken.should.equal(token);
              n1.tokenValid(resToken).should.be.true();
            },
            err => {
              throw err;
            },
          )
          .then(done, done);
      } catch (err) {
        done(err);
      }
    });
  });
});
