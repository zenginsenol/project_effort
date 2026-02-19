/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@estimate-pro/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    'import/order': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
};
