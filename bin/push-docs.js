#!/usr/bin/env node

const { logger, run, scmClean, runRoot, failIf } = require("../lib");

module.exports = (async ({ n: noPush, x: noTest }) => {

    logger.info("Pulling latest changes from repo");

    noPush || await run("git pull --ff-only");

    const wasClean = await scmClean();

    logger.info("Checking branch correctness");
    const {stdout: branchData} = await run("git branch -v");
    const currentBranch = branchData.split("\n").find(b => b.startsWith("*"));

    failIf(currentBranch.substr(2,3) !== "dev", "Release is done only from development branch.");
    failIf(branchData.match(/\[behind \d\]/), "There are branches not in sync with upstream.");

    if (!(await scmClean())) {
        if (!noTest) {
            try {
                logger.info("Test before comitting...");
                await run("npm test");
            } catch (e) {
                e.message = `Test failed on audit: ${e.message}`;
                throw e;
            }
        } else {
            logger.warn("No test done");
        }
    }

    if (!wasClean || noPush)
        throw new Error("Working copy wasn't clean, so not releasing version");

    logger.warn("Committing changes and pushing...");

    await run("git merge master");
    if (await scmClean()) {
        logger.warn("Changes made but working copy not affected.");
    } else {
        await run("git commit -am \"Documentation update.\"");
    }

    await run("git checkout master");
    await run("git merge -");
    await run("git push");
    await run("git checkout -");

});

runRoot(module.exports, require("minimist")(process.argv.slice(2)));

