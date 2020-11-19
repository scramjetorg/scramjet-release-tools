#!/usr/bin/env node

const semver = require("semver");
const {StringStream} = require("scramjet");
const {logger, streamFile, packageFile, runStream, runRoot} = require("../lib");
const {inc, valid} = require("semver");

module.exports = (async ({v: release, m: msg}) => {
    logger.info("Reading package and current changelog");

    const pkg = (await packageFile());
    const newVersion = valid(release) ? release : inc(pkg.version, release);
    const niceName = pkg.niceName || pkg.name.replace(/(^|-)(\w)/g, (d, s, x) => (s ? " " : "") + x.toUpperCase());

    let i = 0;
    const changeLogs = (await
    streamFile("CHANGELOG.md")
        .lines(/\s*\r?\n/)
        .parse(x => ([
            x,
            i++
        ]))
        .filter(([x]) => x.match(/^#/))
        .map(([x, i]) => {
            const z = x.match(/(\d+\.\d+(?:\.\d+)?)(?:\s-\s(\d+\.\d+(?:\.\d+)?))?(:.*)?$/);
            if (!z) return false;
            return [z[1], z[2], x, i];
        })
        .filter(x => x)
        .toArray()
    ).sort(([a1, a2],[b1, b2]) => !a2 || !b2 || a2 === b2 ? (a1 === b1 ? 0 : semver.gt(a1,b1) ? -1 : 1) : semver.gt(a2,b2) ? -1 : 1);

    const logLatest = changeLogs[0];

    logger.info(`Found ${changeLogs.length} versions, newest is: ${logLatest[1] || logLatest[0]} in line ${logLatest[3]} `);

    const gitData = await (runStream("git log --no-merges --format=\"%h %d %s\"")
        .lines(/\r?\n/)
        .parse(
            (line) => {
                const [, sha, branch, message] = line.match(/^([\w\d]+)\s+(?:\(([^)]+)\))?\s+(.*)/) || [];
                const tagString = branch && branch.split(/\s*,\s*/).find(x => x.startsWith("tag: v"));
                const version = tagString && tagString.substr(6);

                return {line, sha, version, message};
            }
        )
        .while(({version}) => !version || semver.gt(version, logLatest[1] || logLatest[0]))
        .toStringStream(async ({sha, version, message}) => {
            if (message.indexOf(version) === 0) {
                return `+\n+## ${niceName} ${message}\n+\n`;
            } else if (version) {
                return `+\n+## ${niceName} ${version}${message !== version ? " - " + message : ""}\n+\n`;
            } else {
                return `+* ${sha} - ${message}\n`;
            }
        }, new StringStream)
        .use(stream => newVersion && msg
            ? stream.unshift(`+\n+## ${niceName} ${newVersion} - ${msg}\n+\n`)
            : stream
        )
        .toArray());

    gitData.push("+\n");
    gitData.push(" " + logLatest[2] + "\n");

    const newlines = gitData.join("").split("\n").length;
    gitData.unshift(`--- a/CHANGELOG.md\n+++ b/CHANGELOG.md\n@@ -${logLatest[3]},1 +${logLatest[3]},${newlines - 1} @@\n`);

    await (
        runStream("patch -t CHANGELOG.md", {}, StringStream.fromArray(gitData).stringify(x => x))
            .toArray()
    );

    logger.info("Changelog patched!");

});

runRoot(module.exports, {help: {
    usage: "$0 [-m releaseMessage] [-v releaseName]",
    options: [
        ["m", "release message"]
    ]
}});
