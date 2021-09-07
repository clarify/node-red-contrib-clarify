'use strict';

// FIXME: This code is applicable for 1.0.0, but v2 is different
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const fs = require('fs');

module.exports = class ClarifyDb {
  dbs = {};

  folderName = '';

  constructor(userDir) {
    this.folderName = userDir + '/clarify-db';
    this.createDbFolder(this.folderName);

    this.deletePreviousVersions(userDir);
  }

  createDbFolder(folderName) {
    try {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
    } catch (err) {
      console.error(err);
    }
  }

  deletePreviousVersions(userDir) {
    // previousVersions contains a list of all previous known versions of this database.
    let previousVersions = [userDir + '/clarify_db.json'];
    previousVersions.forEach(path => {
      try {
        if (fs.existsSync(path)) {
          try {
            fs.unlinkSync(path);
          } catch (err) {
            console.error(err);
          }
        }
      } catch (err) {
        console.log(err);
      }
    });
  }

  getDb(integrationId) {
    if (!(integrationId in this.dbs)) {
      const adapter = new FileSync(this.folderName + `/signals-v1-${integrationId}.json`);

      let db = low(adapter);
      db.defaults({
        signals: [],
      }).write();

      this.dbs[integrationId] = db;
    }
    return this.dbs[integrationId];
  }

  removeAllByIntegrationId(integrationId) {
    return this.getDb(integrationId).get('signals').remove().write();
  }

  findSignal(integrationId, inputId) {
    return this.getDb(integrationId).get('signals').find({inputId: inputId}).value();
  }

  patchSignal(integrationId, inputId, hash) {
    return this.getDb(integrationId).get('signals').find({inputId: inputId}).assign({hash: hash}).write();
  }

  createSignal(integrationId, inputId, hash) {
    this.getDb(integrationId)
      .get('signals')
      .push({
        inputId: inputId,
        hash: hash,
      })
      .write();
  }
};
