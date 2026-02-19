/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@estimate-pro/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
