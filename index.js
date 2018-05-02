#!/usr/bin/node

const {promisify} = require("util");
const logger = require('loglevel');
const {exec} = require('child_process');

const {
    _: [version],
    m: message
} = require('minimist')(process.argv.slice(2));

if (process.env.SRT_DEBUG) {
    logger.enableAll();
} else {
    logger.setLevel("info");
}

const run = async (cmd, options = {}) => {
    logger.debug("Executing command:", cmd);
    return new Promise((res, rej) => {
        exec(cmd, options, (err, stdout, stderr) => {
            if (err) rej(err);
            logger.debug("Last command output", stdout);
            res({stdout, stderr});
        });
    });
};

const failIf = (test, message) => {
    if (!test)
        return;
        
    logger.debug("Assumed that ", JSON.stringify(test), "should be falsy...");
    throw new Error(message);
};

(async () => {
    console.log(process.argv);
    if (!version || !message) {
        logger.error("Usage: scramjet-release-tool <version> -m '<message>'");
        process.exit(1);
    }
    
    logger.info("Checking local git repo status.");
    
    failIf(!version.match(/^(minor|major|patch|\d\.\d\.\d)$/), "Version must be minor|major|patch or semver.");
    
    const package = JSON.parse((await run('cat package.json')).stdout);
    
    await run('git status');
    await run('npm version');
    
    const {stdout: dirty} = await run('git status --porcelain');
    failIf(dirty.trim(), "Git repo dirty. Commit all changes before attempting release.");
    
    logger.info(" ... Current working copy clean and correct.");
    
    const {stdout: branchData} = await run('git branch -v');
    const currentBranch = branchData.split('\n').find(b => b.startsWith('*'));
    
    failIf(currentBranch.substr(2,3) !== 'dev', "Release is done only from development branch.");
    failIf(branchData.match(/\[(ahead|behind) \d\]/), "There are branches not in sync with upstream.");
        
    logger.info(" ... Branch correct.");
    
    logger.info("Checks done, merging to master...");
    
    await run('git checkout master');
    await run('git merge --no-ff -');
    
    logger.info("Merged to master... attempting to build version");
    await run('npm version ' + version + ' -m "'+message.replace('"', '"\'"\'"')+'"');
    
    logger.info("Version released, merging back to dev");
    
    await run('git checkout -');
    await run('git merge --no-ff master');
    
    logger.info('Pushing to upstream...');
    
    await run('git push --all --follow-tags');
    
    logger.info("Done!");
    
})().catch(
    (err) => logger.error(err) && process.exit(100)
);