import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * For a given path return if the path is from current repo or not
 */
export function isFromCurrentRepo(filePath) {
  const currentRepoDir = process.cwd();
  return filePath.startsWith(currentRepoDir);
}

/**
 * given a alias path find the root path for that repo 
 * */
export function findRepoRootPath(aliasPath) {
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
export function getLinkedBabelrc(repoPath) {
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
export function getLinkedPackageJSON(repoPath) {
  if (existsSync(`${repoPath}/package.json`)) {
    return JSON.parse(readFileSync(`${repoPath}/package.json`, 'utf8'));
  } else if (existsSync(`${repoPath}/babel.config.js`)) {
    return {};
  }
}

/**
 * From the plugins array of a babel config extract the aliases.
 * */
export function getAliases(plugins = []) {
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
export function getFilesRepo(filePath, linkedReposMeta) {
  if (isFromCurrentRepo(filePath)) {
    return 'currentRepo';
  }

  return linkedReposMeta.find(({ rootPath }) => filePath.startsWith(rootPath)).name;
}
