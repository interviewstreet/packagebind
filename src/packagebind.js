const fs = require('fs');
const path = require('path');
const { existsSync } = require('fs');
const { resolvePath } = require('babel-plugin-module-resolver');
const { cloneDeep } = require('lodash');

/**
 * given a alias path find the root path for that repo 
 * */
function findRepoRootPath(aliasPath) {
  const fullAliasPath = path.resolve(aliasPath);
  let rootPath = fullAliasPath;

  while (rootPath.includes('/') && !existsSync(`${rootPath}/package.json`)) {
    rootPath = rootPath.substring(0, rootPath.lastIndexOf('/'));
  }

  return rootPath;
}

/**
 * given a repo path get the babel config of the linked repository
 * */
function getLinkedBabelrc(repoPath) {
  if (existsSync(`${repoPath}/.babelrc`)) {
    return JSON.parse(fs.readFileSync(`${repoPath}/.babelrc`, 'utf8'));
  } else if (existsSync(`${repoPath}/babel.config.js`)) {
    return require(`${repoPath}/babel.config.js`);
  }
  return null;
}

/**
 * From the plugins array of a babel config extract the aliases.
 * */
function getAliases(plugins = []) {
  const moduleResolver = plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === 'module-resolver'
  );
  if (moduleResolver) {
    return moduleResolver[1].alias;
  }
  return null;
}


/**
 * Finds the repository name on which the file path exist.
 * It returns currentRepo if the file is from the same repo, otherwise it returns the repository name
 */
function getFilesRepo(filePath, linkedReposMeta) {
  const currentRepoDir = process.cwd();
  if (filePath.startsWith(currentRepoDir)) {
    return 'currentRepo';
  }

  return linkedReposMeta.find(({ rootPath }) => filePath.startsWith(rootPath)).name;
}

/**
 * Get the new babel config with optimized settings for linked aliases
 */
function getLinkedBabelConfig(babelConfig) {
  /** We are cloning babelrc here so we can mutate it directly to keep logic simpler */
  const cloneBabelrc = cloneDeep(babelConfig);
  const { plugins = [] } = cloneBabelrc;

  const moduleResolver = plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === 'module-resolver'
  );

  const aliases = getAliases(plugins);

  const linkedRepos = Object.keys(aliases).filter((aliasKey) => aliases[aliasKey].startsWith('../'));

  const linkedReposMeta = linkedRepos.map((name) => {
    const rootPath = findRepoRootPath(aliases[name]);
    const babelConfig = getLinkedBabelrc(rootPath);
    return {
      name,
      rootPath,
      babelConfig,
    };
  });
  
  /** TODO: Add plugins from the linked packages as well. 
   * For now that is not required as the plugins added on this repo is super set of all plugin used on linked repos
   * For now just get the alias from those babel files
   * */

  const aliasMaps = {};

  linkedReposMeta.forEach((meta) => {
    const { babelConfig, name, rootPath } = meta;
    if (babelConfig) {
      const aliases = getAliases(babelConfig.plugins);
      if (aliases) {
        aliasMaps[name] = Object.entries(aliases).reduce(( updatedAliases, [key, value] ) => {
          updatedAliases[key] = path.resolve(rootPath, value);
          return updatedAliases;
        }, {});
      }
    }
  });

  moduleResolver[1].resolvePath = (sourcePath, currentFile, opts) => {
    opts = cloneDeep(opts);
    const repo = getFilesRepo(currentFile, linkedReposMeta);
    if (repo !== 'currentRepo' && aliasMaps[repo]) {
      opts.alias = { ...opts.alias, ...aliasMaps[repo] };
    }
    const realPath = resolvePath(sourcePath, currentFile, opts);
    return realPath;
  };

  return cloneBabelrc;
}

module.exports = getLinkedBabelConfig;
