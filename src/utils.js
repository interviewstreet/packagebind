import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { noop } from 'lodash';
import * as babel from '@babel/core';
/**
 * For a given path return if the path is from current repo or not
 */
export function isFromCurrentRepo (filePath) {
  const currentRepoDir = process.cwd();
  return filePath.startsWith(currentRepoDir);
}

/**
 * given a alias path find the root path for that repo
 * */
export function findRepoRootPath (aliasPath) {
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
export function getLinkedBabelrc (repoPath) {
  if (existsSync(`${repoPath}/.babelrc`)) {
    return JSON.parse(readFileSync(`${repoPath}/.babelrc`, 'utf8'));
  } else if (existsSync(`${repoPath}/babel.config.js`)) {
    return require(`${repoPath}/babel.config.js`);
  }
  return null;
}

/**
 * given a repo path return its package.json
 */
export function getLinkedPackageJSON (repoPath) {
  if (existsSync(`${repoPath}/package.json`)) {
    return JSON.parse(readFileSync(`${repoPath}/package.json`, 'utf8'));
  } else if (existsSync(`${repoPath}/babel.config.js`)) {
    return {};
  }
}

/**
 * Get the effective plugins based on BABEL_ENV or NODE_ENV
 */
export function getPlugins (babelConfig) {
  const babelEnv = process.env.BABEL_ENV || process.env.NODE_ENV;
  let plugins = babelConfig.plugins || [];

  // add environment specific plugins
  if (babelConfig.env && babelConfig.env[babelEnv]) {
    plugins = plugins.concat(babelConfig.env[babelEnv].plugins || []);
  }

  return plugins;
}

/**
 * From the plugins array of a babel config extract the aliases.
 * */
export function getAliases (plugins) {
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
export function getFilesRepo (filePath, linkedReposMeta) {
  if (isFromCurrentRepo(filePath)) {
    return 'currentRepo';
  }

  return linkedReposMeta.find(({ rootPath }) => filePath.startsWith(rootPath)).name;
}

/**
 * Get all preset configs
 */
function safeRequire (path) {
  try {
    return require(path);
  } catch (e) {
    return undefined;
  }
}

function gePresetConfig (preset, projectPath) {
  if (typeof preset === 'string') {
    // no need to add @babel namespaced presets
    if (preset.startsWith('@babel')) return;

    return safeRequire(`${projectPath}/node_modules/${preset}`) || // try requiring preset with presetName
                   safeRequire(`${projectPath}/node_modules/babel-preset-${preset}`); // try requiring with babel-preset- prefix
  } else if (Array.isArray(preset)) {
    return gePresetConfig(preset[0]);
  } else {
    return preset;
  }
}

// get babel configs from the preset
export function getPresetAliases (projectPath, presets) {
  let presetAliases = {};
  /**
   * We don't want to recurse on the preset of preset as most of the case
   * resolveModules are on top level config or one common preset
   */
  if (Array.isArray(presets)) {
    presets.forEach((preset) => {
      let presetConfig = gePresetConfig(preset, projectPath);

      if (!presetConfig) return;

      const presetOption = Array.isArray(preset) ? preset[1] : {};

      // if presetConfig is function call the function with babel and options
      if (typeof presetConfig === 'function') {
        // have fake value for assertVersion method as that check is not important
        presetConfig = presetConfig({ ...babel, assertVersion: noop }, presetOption, projectPath);
      }

      const linkedPlugins = getPlugins(presetConfig);
      const aliases = getAliases(linkedPlugins);

      // push the preset config on all configs
      presetAliases = { ...presetAliases, ...aliases };
    });
  }

  return presetAliases;
}
