
const logger = require('loglevel');
const {exec} = require('child_process');
const execspawn = require('execspawn');
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const rf = promisify(fs.readFile);
const {StringStream} = require('scramjet');

const streamFile = (file) => fs.createReadStream(path.resolve(process.cwd(), file)).pipe(new StringStream);

const readFile = async (file) => {
    return rf(path.resolve(process.cwd(), file));
};

if (process.env.SRT_DEBUG) {
    logger.enableAll();
} else {
    logger.setLevel(process.env.LEVEL || "info");
}

const runStream = (cmd, options = {}, input = null) => {
    const stdin = input ? "pipe" : "ignore";
    const out = new StringStream();
    const child = execspawn(cmd, Object.assign(options, {
        stdio: [stdin, "pipe", 2]
    }));

    child.on("error", e => out.emit("error", e));

    if (input) {
        input.pipe(child.stdin);
    }
    return child.stdout.pipe(out);
};

const getJSON = async (url) => {
    logger.debug(`Fetching ${url} as JSON`);
    return fetch(url)
        .then(res => res.json());
};

const getText = async (url) => {
    logger.debug(`Fetching ${url} as Text`);
    return fetch(url)
        .then(res => res.text());
};

const run = async (cmd, options = {}) => {
    return new Promise((res, rej) => {
        exec(cmd, options, (err, stdout, stderr) => {
            logger.debug("Command:", cmd, "code:", err ? err.code : 0);

            if (err && !options.allowError) return rej(err);
            else res({code: err ? err.code : 0, stdout, stderr});
        });
    });
};

const scmClean = async () => (await run('git diff --quiet', {allowError: 1})).code === 0;

const failIf = (test, message) => {
    if (!test)
        return;

    logger.debug("Assumed that ", JSON.stringify(test), "should be falsy...");
    throw new Error(message);
};

const jsonFile = async (file) => JSON.parse(await readFile(file));

const packageFile = async () => jsonFile('package.json');

const defer = async (ms = 1) => new Promise(res => setTimeout(res, ms));

let ran = 0;
const runRoot = async (func, ...options) => {
    if (ran) return;
    ran = 1;
    try {
        await func(...options);
    } catch(e) {
        logger.error(e.stack);
        process.exit(e.code || 100);
    }
};

module.exports = {
    logger,
    run,
    defer,
    failIf,
    packageFile,
    streamFile,
    runStream,
    readFile,
    jsonFile,
    scmClean,
    getJSON,
    getText,
    runRoot
};