
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

module.exports = {
    logger,
    run,
    failIf
};
