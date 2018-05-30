
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
    logger.setLevel("info");
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

const getJSON = (url) => fetch(url)
    .then(res => res.json());

const getText = (url) => fetch(url)
    .then(res => res.text());

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

const jsonFile = async (file) => JSON.parse(await readFile(file));

const packageFile = async () => jsonFile('package.json');

const defer = async (ms = 1) => new Promise(res => setTimeout(res, ms));

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
    getJSON,
    getText
};
