/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@estimate-pro/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    'import/order': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  },
};
