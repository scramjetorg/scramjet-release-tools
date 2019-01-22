# scramjet-release-tools

Set of tools used to release scramjet and releated projects.

This package may come in useful, but it's not intended for any particular purpose.

## Install

```shell
npm i -g scramjet-release-tools
```

## Usage

Here's how you use this package.

### Update

Update all dependencies with a test after each one:

```shell
$ scramjet-tool-update [-x] [-n]
# -x = no test after each update
# -n = no push to default upstream
```

### Release

Release a package (test well, merge develop to master and create a version tag)

```shell
$ scramjet-tool-release -m "Version information" [patch|minor|major|<version>]
```

### Publish

Publish package to npm (you need to be authenticated already) after checking if the lastest repo version has been properly built by travis.

```shell
$ scramjet-tool-publish -i
# -i = do not check travis before publishing
```


### Changelog

Update changelog file adding all commits from history and separating them with tags

```shell
$ scramjet-tool-changelog
```
