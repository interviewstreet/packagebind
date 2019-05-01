## What is packagebind?

Lets say you have built an utility package and published on npm and in your application you are using that utility package. Now some change is required in the utility package. Would you cut a new release just to try if it works in application? Nah.

"I'll use `npm link`" you might be thinking but it has mulitple known issues.

And so we built `packagebind`.

## How does it work?

There is an awesome babel plugin called [module-resolver](https://github.com/tleunen/babel-plugin-module-resolver) which lets you change the path of imports in your source-code.

Its used in `babel.config.js` like this

```js
module.exports = {
  plugins: [
    ["module-resolver", {
      alias: {
        "my-design-kit": "../my-design-kit", // root path of my-design-kit package code
      }
    }]
  ]
}
```

This in itself is good enough, HMR works but there is a problem. The `my-design-kit` package would probably have its own babel config and its own set of node_modules dependencies. Right now instead of using those things, the package is going to use the application's babel config and node_modules.

This is how we solve it.

Inside `babel.config.js`

```js
const packagebind = require('packagebind').default;

const babelConfig = {
  plugins: [
    ["module-resolver", {
      alias: {
        "my-design-kit": "../my-design-kit", // root path of my-design-kit package code
      }
    }]
  ]
}

module.exports = packagebind(babelConfig);
```

