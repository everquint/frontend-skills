// Named .mjs, not .js: this file uses `export default`, and commitlint loads a .js config as
// CommonJS unless package.json declares "type": "module". The .mjs extension is unambiguous.
export default {
    extends: ['@commitlint/config-conventional'],
};
