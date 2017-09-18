const path = require('path')
const childProcess = require('child_process')
const promisify = require('es6-promisify')
const ghPages = require('gh-pages')
const parseArgs = require('minimist')

const INVALID_TAG = new Error('Tag is not a version tag')

const publish = promisify(ghPages.publish)

async function run() {
  const [, , ...argv] = process.argv
  const [tag] = parseArgs(argv)._
  if (!tag) {
    throw new Error('No tag specified')
  }

  await exec(`git checkout ${tag}`)

  const match = tag.match(/v([0-9]+\.[0-9]+\.[0-9]+)$/)
  if (!match) {
    throw INVALID_TAG
  }
  const [, version] = match

  await exec('npm run generate-docs')

  await publish(DOCS_PATH, {
    dest: version,
    add: true,
    message: `Publishing docs for v${version}`,
  })
}

const _exec = promisify(childProcess.exec, { multiArgs: true })
async function exec(command, options) {
  const [stdout, stderr] = await _exec(command, options)
  if (stdout) {
    console.log(stdout)
  }
  if (stderr) {
    console.error(stderr)
  }
}

run().catch(err => {
  if (err === INVALID_TAG) {
    console.log(err)
  } else {
    console.error(err)
    process.exit(1)
  }
})
