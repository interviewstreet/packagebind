const cloneDeep = require('lodash').cloneDeep;

module.exports = function getBabelrcForWebpack(babelrc, aliasKeys) {
  const cloneBabelrc = cloneDeep(babelrc);
  const { plugins } = cloneBabelrc;

  const moduleAliasIndex = plugins.findIndex(
    plugin => Array.isArray(plugin) && plugin[0] === 'module-alias'
  );

  if (moduleAliasIndex === -1) {
    return;
  }

  const aliases = plugins[moduleAliasIndex][1].reduce((obj, alias) => {
    const { expose } = alias;
    obj[expose] = alias;
    return obj;
  }, {});

  plugins.push([
    'module-resolver', {
      alias: aliasKeys.reduce((acc, key) => {
        acc[`${key}/es`] = `${key}/es`;
        acc[`${key}/lib`] = `${key}/es`;
        acc[`${key}`] = `${key}/es`;
        return acc;
      }, {}),
    },
  ]);


  aliasKeys.forEach(key => {
    delete aliases[key];
  });

  const modifiedPlugins = [...plugins];

  if (process.env.NODE_ENV === 'development') {
    modifiedPlugins.push('react-hot-loader/babel');
  }
  modifiedPlugins[moduleAliasIndex][1] = Object.values(aliases);

  const updatedBabelrc = {
    ...cloneBabelrc,
    cacheDirectory: false,
    babelrc: false,
    plugins: modifiedPlugins,
    presets: [['es2015', { modules: false }], 'react'],
  };
  return updatedBabelrc;
};
