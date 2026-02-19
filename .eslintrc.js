/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ['node_modules/**', 'dist/**', '.next/**', '.turbo/**'],
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2022: true,
  },
};
