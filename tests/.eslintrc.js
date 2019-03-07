const rules = require('../.eslintrc.js');

module.exports = {
    ...rules,
    env: {
      'mocha': true
    },
    rules: {
      'max-lines-per-function': false
    }
};
