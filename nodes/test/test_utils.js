var fs = require('fs');
const jwt = require('njwt');

module.exports = {
  createUserDir: function () {
    return fs.mkdtempSync(`userdir`);
  },

  removeUserDir: function (path) {
    fs.rmdirSync(path, {recursive: true});
  },

  generateToken: function () {
    const claims = {iss: 'fun-with-jwts', sub: 'clarifyDiamond'};
    const token = jwt.create(claims, 'top-secret-phrase');
    token.setExpiration(new Date().getTime() + 6 * 60 * 1000);
    return token.compact();
  },
  generateExpiredToken: function () {
    const claims = {iss: 'fun-with-jwts', sub: 'clarifyDiamond'};
    const token = jwt.create(claims, 'top-secret-phrase');
    token.setExpiration(new Date().getTime() - 1 * 60 * 1000);
    return token.compact();
  },
};
