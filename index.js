const {promisify} = require("util");
const logger = require('loglevel');
const {exec} = require('child_process');

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
    logger.info("Checking local git repo status.");
    
    await run('git status');
    await run('npm version');
    
    const {stdout: dirty} = await run('git status --porcelain');
    failIf(dirty.trim(), "Git repo dirty. Commit all changes before attempting release.");
    
    logger.info(" = Current working copy clean and correct.");
    
    const {stdout: branchData} = await run('git branch -v');
    const currentBranch = branchData.split('\n').find(b => b.startsWith('*'));
    
    failIf(currentBranch.substr(2,3) !== 'dev', "Release is done only from development branch")
        
    logger.info(" = Branch correct.");
    
})().catch(
    (err) => logger.error(err) && process.exit(100)
);