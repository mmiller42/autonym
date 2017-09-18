const path = require('path')

module.exports = {
  opts: {
    template: path.resolve(__dirname, 'node_modules', 'ink-docstrap', 'template'),
    recurse: true,
    readme: path.resolve(__dirname, 'README.md'),
  },
  templates: {
    systemName: 'Autonym',
    copyright: '&copy; 2017 <a href="https://mmiller.me/">Matt Miller</a>',
    includeDate: false,
    theme: 'yeti',
    outputSourceFiles: true,
  },
  plugins: ['plugins/markdown', 'plugins/partial', 'plugins/underscore'],
}
