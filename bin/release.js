#!/usr/bin/env node

const {logger, run, failIf, runRoot, mainBranch} = require("../lib");
const {inc, valid} = require("semver");

module.exports = (async ({ _: [release], d: dryrun, m: message }) => {
    if (!release || !message) {
        logger.error("Usage: scramjet-tool-release <version> -m '<message>'");
        return process.exitCode = 1;
    }

    const package = JSON.parse((await run("cat package.json")).stdout);
    const version = valid(release) ? release : inc(package.version, release);
    const main = await mainBranch();

    failIf(!version, "Version must be minor|major|patch or semver.");
    failIf(dryrun, `Would run: $ npm version ${version} -m "${version}: ${message.replace("\"", "\"'\"'\"")}"`,);

    logger.info("Pushing latest changes...");

    await run("git push");

    logger.info("Checking local git repo status.");

    await run("git status");
    await run("npm version");

    const {stdout: dirty} = await run("git status --porcelain");
    failIf(dirty.trim(), "Git repo dirty. Commit all changes before attempting release.");

    logger.info(" ... Current working copy clean and correct.");

    logger.info("Fetching latest changes in fast-forward mode only");
    await run(`git checkout ${main}`);
    await run("git pull --ff-only");
    await run("git checkout -");
    await run("git pull --ff-only");

    logger.info("Checking branch correctness");
    const {stdout: branchData} = await run("git branch -v");
    const currentBranch = branchData.split("\n").find(b => b.startsWith("*"));

    failIf(currentBranch.substr(2,3) !== "dev", "Release is done only from development branch.");
    failIf(branchData.match(/\[(ahead|behind) \d\]/), "There are branches not in sync with upstream.");

    logger.info(" ... Branch correct.");

    logger.info("Checks done, merging to main branch...");

    await run(`git checkout ${main}`);

    try {
        await run("git merge --no-ff -");

        logger.info("Merged to main... attempting to build version");
        const {stdout: out} = await run(
            `npm version ${version} -m "${version}: ${message.replace("\"", "\"'\"'\"")}"`,
            {
                maxBuffer: 10485760 // 10m max buffer
            }
        );

        logger.info(`Version ${out.match(/v[\d.]+/)} released, merging back to dev`);

    } catch(e) {
        logger.error("Error occurred, rolling back to main");
        await run(`git reset --hard ${main}`);
        await run("git checkout -");

        throw e;
    }

    await run("git checkout -");
    await run(`git merge --no-ff ${main}`);

    logger.info("Pushing to upstream...");

    await run("git push --all --follow-tags");

    logger.info("Done!");

});

runRoot(module.exports, require("minimist")(process.argv.slice(2)));
