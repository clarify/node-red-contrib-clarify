'use strict';

// FIXME: This code is applicable for 1.0.0, but v2 is different
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');

/**
 * @class ClarifyDatabase
 */
class ClarifyDatabase {
  /** @type {string} */
  nodeId;

  /** @type {string} */
  folderName;

  /** @type {string} */
  integration;

  /** @type {low.LowdbSync<{signals: {[key: string]: string}}>} */
  database;

  constructor(userDir, nodeId, integration) {
    this.integration = integration;
    this.nodeId = nodeId;
    this.folderName = `${userDir}/clarify-db`;
    this.createDbFolder(this.folderName);
    this.deletePreviousVersions(userDir);
    this.database = this.createDatabase();
  }

  createDatabase() {
    const adapter = new FileSync(`${this.folderName}/signals-v2-${this.nodeId}-${this.integration}.json`);

    let db = low(adapter);
    db.defaults({
      signals: {},
    }).write();

    return db;
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
    let previousVersions = [`${userDir}/clarify_db.json`, `${this.folderName}/signals-v1-${this.integration}.json`];
    previousVersions.forEach(path => {
      try {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      } catch (err) {
        console.log(err);
      }
    });
  }

  removeAll() {
    return this.database.set('signals', {}).write();
  }

  findSignal(inputId) {
    return this.database.get('signals').get(inputId).value();
  }

  saveSignal(inputId, hash) {
    return this.database.get('signals').set(inputId, hash).write();
  }
}

module.exports = ClarifyDatabase;
