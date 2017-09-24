const ghPages = require('gh-pages')
const parseArgs = require('minimist')
const promisify = require('es6-promisify')
const { spawn } = require('child_process')

const INVALID_TAG = new Error('Tag is not a version tag')

const publish = promisify(ghPages.publish)
const exec = (() => {
  return function exec(command, args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, { stdio: 'inherit' })
      childProcess.on('error', err => reject(err))
      childProcess.on('exit', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command ${command} ${args.join(' ')} returned a non-zero status code.`))
        }
      })
    })
  }
})()

async function run() {
  const [, , ...argv] = process.argv
  const [tag] = parseArgs(argv)._
  if (!tag) {
    throw new Error('No tag specified')
  }

  await exec('git', ['checkout', tag])

  const match = tag.match(/v([0-9]+\.[0-9]+\.[0-9]+)$/)
  if (!match) {
    throw INVALID_TAG
  }
  const [, version] = match

  await exec('npm', ['run', 'generate-docs'])

  await publish('docs', {
    dest: version,
    add: true,
    message: `Publishing docs for v${version}`,
  })
}

run().catch(err => {
  if (err === INVALID_TAG) {
    console.log(err)
  } else {
    console.error(err)
    process.exit(1)
  }
})
