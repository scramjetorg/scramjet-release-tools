#!/usr/bin/env node

const { logger, run, scmClean, runRoot } = require("../lib");
const path = require("path");
const semver = require("semver");
const { DataStream } = require("scramjet");
const save = {
    devDependencies: "D",
    dependencies: "s"
};

module.exports = (async ({ n: noPush, x: noTest }) => {
    logger.info("Pulling latest changes from repo");

    noPush || await run("git pull --ff-only");
    const wasClean = await scmClean();
    if (!wasClean)
        logger.warn("Working copy not clean, will not publish the package");

    logger.info("Finding dependencies");

    const { stdout: packageOutput, code: packageCode } = (await run("npm outdated --long --json", { allowError: 1 }));
    const packages = packageOutput ? JSON.parse(packageOutput) : {};
    if (packageCode === 0 && Object.keys(packageOutput).length === 0) {
        throw new Error("No outdated packages.");
    }

    const packageJson = require(path.resolve(process.cwd(), "package.json"));

    if (!Object.keys(packages).length)
        throw new Error("Up to date");

    const updated = await (
        DataStream.fromArray(Object.entries(packages))
            .setOptions({ maxParallel: 1 })
            .filter(
                ([, { type, current, wanted, latest }]) => !(type in save) || current !== wanted || semver.lt(current, latest)
            )
            .map(
                async ([pkg, { type }]) => {
                    if (packageJson[type][pkg].match(/^[^^]/)) {
                        logger.warn(`Package "${pkg}" is pinned`);
                        return DataStream.filter;
                    }

                    logger.info(`Trying to update and test ${type.replace(/ies$/, "y")}: ${pkg}`);
                    try {
                        await run(`npm install -${save[type]} ${pkg}@latest`);
                    } catch (e) {
                        e.message = `Could not install '${pkg}': ${e.message}`;
                        throw e;
                    }

                    if (!noTest) {
                        try {
                            await run("npm test");
                        } catch (e) {
                            e.message = `Test failed on updated '${pkg}': ${e.message}`;
                            throw e;
                        }
                    }

                    return pkg;
                }
            )
            .toArray()
    );

    logger.info("Running audit with auto-fix...");
    try {
        await run("npm audit fix");
    } catch (e) {
        logger.warn("Some vulnerable packages still persist.");
    }

    if (!(await scmClean())) {
        if (!noTest) {
            try {
                logger.info("One last test before comitting...");
                await run("npm test");
            } catch (e) {
                e.message = `Test failed on audit: ${e.message}`;
                throw e;
            }
        } else {
            logger.warn("No final test done");
        }
    }

    if (updated.length)
        logger.info("Packages updated: ", ...updated);
    else
        throw new Error("No packages to update.");

    if (!wasClean || noPush)
        throw new Error("Working copy wasn't clean, so not releasing version");

    logger.warn("Committing changes and pushing...");

    if (await scmClean()) {
        throw new Error("Changes made but working copy not affected.");
    }

    await run("git commit -am \"Dependencies update.\"");
    await run("git push");

});

runRoot(module.exports, require("minimist")(process.argv.slice(2)));

