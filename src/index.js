import path from 'path';
import { resolvePath } from 'babel-plugin-module-resolver';
import { cloneDeep } from 'lodash';

import {
  isFromCurrentRepo,
  findRepoRootPath,
  getLinkedBabelrc,
  getLinkedPackageJSON,
  getAliases,
  getFilesRepo,
  getPlugins,
  getPresetAliases,
  currentRepoDir,
} from './utils';

/**
 * Get the new babel config with optimized settings for linked aliases
 */
export default function packagebind (babelConfig) {
  /** We are cloning babelrc here so we can mutate it directly to keep logic simpler */
  const cloneBabelrc = cloneDeep(babelConfig);
  const plugins = getPlugins(cloneBabelrc);

  const moduleResolver = plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === 'module-resolver'
  );

  const aliases = getAliases(plugins);

  const linkedRepos = Object.keys(aliases).filter((aliasKey) => {
    const aliasPath = path.resolve(aliases[aliasKey]);
    return !isFromCurrentRepo(aliasPath);
  });

  const linkedReposMeta = linkedRepos.map((name) => {
    const rootPath = findRepoRootPath(aliases[name]);
    const babelConfig = getLinkedBabelrc(rootPath);
    const packageJSON = getLinkedPackageJSON(rootPath);
    return {
      name,
      rootPath,
      babelConfig,
      packageJSON,
    };
  });

  /**
   * For now that is not required as the plugins added on this repo is super set of all plugin used on linked repos
   * For now just get the alias from those babel files
   * */

  const aliasMaps = {};

  linkedReposMeta.forEach((meta) => {
    const { babelConfig, name, rootPath, packageJSON } = meta;

    aliasMaps[name] = {};

    // Add alias from linked babelConfig
    if (babelConfig) {
      const linkedPlugins = getPlugins(babelConfig);
      const aliases = getAliases(linkedPlugins);
      const presetAliases = getPresetAliases(rootPath, babelConfig.presets);
      const allAliases = { ...presetAliases, ...aliases };

      if (Object.keys(allAliases).length) {
        aliasMaps[name] = Object.entries(allAliases).reduce((updatedAliases, [key, value]) => {
          const modulePath = value.startsWith('.') ? '' : 'node_modules';
          updatedAliases[key] = path.resolve(rootPath, modulePath, value);
          return updatedAliases;
        }, aliasMaps[name]);
      }
    }

    // Add peer dependencies to aliasMaps to make sure the dependency conflict doesn't happens
    if (packageJSON.peerDependencies) {
      Object.keys(packageJSON.peerDependencies).forEach((module) => {
        const aliasObj = aliasMaps[name];
        const aliasPath = aliasObj[module];
        /**
         * Peer dependency should always point to the main repo,
         * If peer dependency is defined and its pointing to node modules
         * we should replace the module to point the main repos modules
         * If its not defined add peer dependency to alias and point it
         * to main repo module.
         */
        if (aliasPath && aliasPath.startsWith(module)) {
          aliasObj[module] = aliasPath.replace(module, currentRepoDir);
        } else if (!aliasPath) {
          aliasObj[module] = path.resolve(currentRepoDir, 'node_modules', module);
        }
      });
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
