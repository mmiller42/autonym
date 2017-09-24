const fs = require('fs')
const ghPages = require('gh-pages')
const parseArgs = require('minimist')
const promisify = require('es6-promisify')
const rimraf = require('rimraf')
const sortVersions = require('semver-sort').asc
const { spawn } = require('child_process')

const INVALID_TAG = new Error('Tag is not a version tag')

const publish = promisify(ghPages.publish)
const mkdir = promisify(fs.mkdir)
const readFile = promisify(fs.readFile)
const rename = promisify(fs.rename)
const rmdir = promisify(rimraf)
const writeFile = promisify(fs.writeFile)
const exec = (() => {
  return function exec(command, args, capture = false) {
    return new Promise((resolve, reject) => {
      let output = ''
      const childProcess = spawn(command, args, capture ? undefined : { stdio: 'inherit' })
      if (capture) {
        childProcess.stdout.on('data', data => (output += data))
      }
      childProcess.on('error', err => reject(err))
      childProcess.on('exit', code => {
        if (code === 0) {
          resolve(capture ? output : undefined)
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

  await rmdir('tmp')

  const pkg = JSON.parse(await readFile('package.json'))
  const versions = sortVersions(JSON.parse(await exec('npm', ['view', pkg.name, 'versions', '--json'], true)))
  const latestVersion = versions[versions.length - 1]

  await exec('npm', ['run', 'generate-docs'])
  await mkdir('tmp')
  await rename('docs', `tmp/${version}`)
  await writeFile(
    'tmp/index.html',
    `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <script>
      var version = ${JSON.stringify(latestVersion)}
      var port = location.port ? ':' + location.port : ''
      var pathname = location.pathname.split('index.html')[0]
      location.href = location.protocol + '//' + location.hostname + port + pathname + version
    </script>
  </head>
</html>
    `.trim()
  )

  await publish('tmp', {
    add: true,
    message: `Publishing docs for v${version}`,
    user: {
      name: 'CircleCI',
      email: 'me@mmiller.me',
    },
  })

  await rmdir('tmp')
}

run().catch(err => {
  if (err === INVALID_TAG) {
    console.log(err)
  } else {
    console.error(err)
    process.exit(1)
  }
})
