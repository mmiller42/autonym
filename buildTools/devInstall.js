if (process.env.NODE_ENV !== 'development' || process.env.INIT_CWD === process.env.PWD) {
  process.exit(0)
}

console.log(
  'When NODE_ENV=development, Autonym will install its build dependencies and generate a custom build in your ' +
    'environment. It takes a little longer, but the build will target your current version of Node, meaning a much ' +
    'better debugging experience.'
)

const spawn = require('child_process').spawn
const fs = require('fs')
const map = require('lodash').map
const path = require('path')
const lodash = require('lodash')
const pwd = process.env.PWD

const omitBy = lodash.omitBy
const pickBy = lodash.pickBy

function run() {
  return Promise.all([installBabelDependencies(), rewriteBabelrc()]).then(build)
}

function installBabelDependencies() {
  const filePath = path.resolve(pwd, 'package.json')
  return readFile(filePath)
    .then(json => JSON.parse(json))
    .then(pkg => {
      const babelDependencies = pickBy(pkg.devDependencies, (version, module) => /^babel/.test(module))
      const modules = map(babelDependencies, (version, module) => module + '@' + version)
      return exec('npm', ['install', '--no-save'].concat(modules))
    })
}

function rewriteBabelrc() {
  const filePath = path.resolve(pwd, '.babelrc')
  return readFile(filePath)
    .then(json => JSON.parse(json))
    .then(babelrc =>
      Object.assign({}, babelrc, {
        env: Object.assign({}, babelrc.env, {
          development: Object.assign(
            {},
            babelrc.env.development,
            omitBy(
              {
                presets:
                  babelrc.env.development.presets &&
                  babelrc.env.development.presets.map(preset => {
                    if (Array.isArray(preset) && preset[0] === 'babel-preset-env') {
                      return ['babel-preset-env', Object.assign({}, preset[1], { targets: { node: 'current' } })]
                    }
                    return preset
                  }),
              },
              val => val === undefined
            )
          ),
        }),
      })
    )
    .then(devBabelrc => JSON.stringify(devBabelrc, null, 2))
    .then(json => writeFile(filePath, json))
}

function build() {
  return exec(npm, ['run', 'build'])
}

const exec = (() => {
  return function exec(command, args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, { cwd: pwd, stdio: 'inherit' })
      childProcess.on('error', err => reject(err))
      childProcess.on('exit', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error('Command `' + command + ' ' + args.join(' ') + '` returned a non-zero status code.'))
        }
      })
    })
  }
})()

function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function writeFile(filePath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function crash(err) {
  console.warn('Autonym failed to run dev install')
  console.error(err)
  process.exit(0)
}

run().catch(crash)
