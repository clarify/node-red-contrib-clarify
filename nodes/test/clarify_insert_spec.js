var helper = require('node-red-node-test-helper');
var insertNode = require('../clarify_insert.js');
var apiNode = require('../clarify_api.js');
var fs = require('fs');
const jwt = require('njwt');

////// HELPER FUNCTIONS //////
var tmpUserDir = '';

helper.init(require.resolve('node-red'));

function createDir() {
  tmpUserDir = fs.mkdtempSync(`userdir`);
}

function removeDir() {
  fs.rmdirSync(tmpUserDir, {recursive: true});
}

function generateToken() {
  const claims = {iss: 'fun-with-jwts', sub: 'AzureDiamond'};
  const token = jwt.create(claims, 'top-secret-phrase');
  token.setExpiration(new Date().getTime() + 6 * 60 * 1000);
  return token.compact();
}

let credentials = {
  credentialsFile: 'bop',
  overrideApiUrl: 'apiurl',
  overrideTokenUrl: 'tokenurl',
  overrideAudience: 'aud',
  overrideClientId: 'cliid',
  overrideClientSecret: 'clisec',
  overrideIntegrationId: 'iid',
};

////// TESTS //////

describe('insert node', function () {
  beforeEach(function (done) {
    createDir();
    helper.settings({userDir: tmpUserDir});
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload();
    helper.stopServer(done);
    removeDir();
  });

  it('should be loaded', function (done) {
    var flow = [
      {id: 'n1', type: 'clarify_insert', name: 'test name', apiRef: 'a1'},
      {id: 'a1', type: 'clarify_api', name: 'api node'},
    ];
    helper.load([insertNode, apiNode], flow, credentials, function () {
      var n1 = helper.getNode('n1');
      var a1 = helper.getNode('a1');
      a1.credentials = credentials;
      try {
        n1.should.have.property('name', 'test name');
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});
