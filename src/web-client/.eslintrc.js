module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "prettier"
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-console": "warn",
        "no-debugger": "error",
        "no-unused-vars": "warn",
        "prefer-const": "error",
        "no-var": "error"
    }
};
