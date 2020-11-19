#!/usr/bin/env node

const { logger, run, getJSON, getText, failIf, packageFile, defer, runRoot } = require("../lib");
const semver = require("semver");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const { access } = require("fs");

const buildStatus = async (release, org, repo) => {
    const badgeSVG = (await getText(`https://api.travis-ci.com/${org}/${repo}.svg?branch=${release.name}`)) || ["null"];
    const [status] = badgeSVG.match(/passing|unknown|pending|failing/);
    return status;
};

module.exports = (async ({ i: ignoreCI, t: tag = "latest", d: dryRun }) => {
    logger.info("Finding repo origin.");

    const { name, repository } = await packageFile();

    failIf(repository.type !== "git" || repository.url.indexOf("github.com") === -1, "Must be hosted in github to work.");
    const parts = repository.url.split(/[:/]|\.git/g);
    const [org, repo] = parts.slice(parts.length - 3);

    failIf(!org || !repo || (""+org+repo).match(/[^\w-_]/), "Cannot identify repo...");

    logger.info(`Found repo "${org}/${repo}"`);

    const [tags, {stdout: npmOut}] = await Promise.all([
        getJSON(`https://api.github.com/repos/${org}/${repo}/tags`),
        run(`npm show ${name} dist-tags.${tag}`)
    ]);
    const release = tags[0];
    const npmLatest = npmOut.trim();
    const releaseVersion = release.name.substr(1);

    logger.info(`Latest repo version is ${release.name}, latest published is ${npmLatest}, checking build status...`);

    let i = 0;
    while(!ignoreCI) {
        if (++i > 60) {
            throw new Error("Build not ready after 5 minutes");
        }
        const status = await buildStatus(release, org, repo);
        if (status === "failing") {
            throw new Error("Build failed, cannot proceed...");
        }
        if (status === "passing") {
            logger.info("Build passing");
            break;
        }
        logger.warn(`Build is in ${status} state, waiting 5 secs...`);
        await defer(5e3);
    }

    if (!semver.gt(releaseVersion, npmLatest))
        throw new Error(`Newest version of ${name} already released.`);

    const tmp = path.join(os.tmpdir(), `srt-${process.pid}`);
    await run(`mkdir "${tmp}"`);

    try {
        logger.info(`Fetching tarball for ${name}@${releaseVersion}`);
        process.chdir(tmp);

        await run(`curl -Ls "https://github.com/${org}/${repo}/archive/v${releaseVersion}.tar.gz" | tar zx`);
        await promisify(access)(`${name}-${releaseVersion}`);

        process.chdir(`${name}-${releaseVersion}`);

        logger.info(`Publishing package ${name}@${releaseVersion}`);

        const npmcommand = "npm publish";
        if (dryRun)
            logger.log(npmcommand);
        else {
            await run(npmcommand);
        }

        logger.info("Done.");
    } finally {
        await run(`rm -rf "${tmp}"`);
    }


});

runRoot(module.exports, require("minimist")(process.argv.slice(2)));
