const fs = require('fs');
const path = require('path');

function exists(path) {
  return new Promise((resolve, reject) => {
    fs.access(path, err => err ? reject(err) : resolve());
  });
}

function mkdir(dir) {
  return ensureDir(path.dirname(dir)).then(() => {
    return new Promise((resolve, reject) => {
      fs.mkdir(dir, err => err ? reject(err) : resolve());
    });
  });
}

function ensureDir(dir) {
  return exists(dir).catch(() => {
    return mkdir(dir);
  });
}

module.exports = ensureDir;
