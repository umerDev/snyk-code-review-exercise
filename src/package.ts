import { RequestHandler } from 'express';
import { maxSatisfying } from 'semver';
import got from 'got';
import { NPMPackage } from './types';

// review: move to types file
type Package = { version: string; dependencies: Record<string, Package> };

/**
 * Attempts to retrieve package data from the npm registry and return it
 */
export const getPackage: RequestHandler = async function (req, res, next) {
  const { name, version } = req.params;
  const dependencyTree = {};
  try {
    // review:  move to seperate function - get npm registry
    // review:  This call can also be cached in memory
    const npmPackage: NPMPackage = await got(
      `https://registry.npmjs.org/${name}`,
    ).json();

    const dependencies: Record<string, string> =
      npmPackage.versions[version].dependencies ?? {};

    // review: can batch and execute in parallel using promise all
    for (const [name, range] of Object.entries(dependencies)) {
      const subDep = await getDependencies(name, range);
      dependencyTree[name] = subDep;
    }

    return res
      .status(200)
      .json({ name, version, dependencies: dependencyTree });
  } catch (error) {
    return next(error);
  }
};

async function getDependencies(name: string, range: string): Promise<Package> {
  // review: delete and pass in as a param
  const npmPackage: NPMPackage = await got(
    `https://registry.npmjs.org/${name}`,
  ).json();

  const v = maxSatisfying(Object.keys(npmPackage.versions), range);
  const dependencies: Record<string, Package> = {};

  // review: check if v does not exist and return early
  if (v) {
    const newDeps = npmPackage.versions[v].dependencies;
    for (const [name, range] of Object.entries(newDeps ?? {})) {
      dependencies[name] = await getDependencies(name, range);
    }
  }

  return { version: v ?? range, dependencies };
}
