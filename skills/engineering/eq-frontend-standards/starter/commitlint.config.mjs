// .mjs because commitlint loads a .js config as CommonJS unless package.json sets "type": "module".
export default {
  extends: ['@commitlint/config-conventional'],
};
