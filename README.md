# autonym [![CircleCI](https://circleci.com/gh/mmiller42/autonym.svg?style=svg)](https://circleci.com/gh/mmiller42/autonym) [![Greenkeeper badge](https://badges.greenkeeper.io/mmiller42/autonym.svg)](https://greenkeeper.io/)

A KISS JSON REST API framework that can be mounted to your Express application.

## How it works

This plugin is very simple and just encapsulates two other Webpack plugins to do the heavy lifting. It:

1. modifies your Webpack config at runtime to add your vendor modules to the [`externals`](https://webpack.js.org/configuration/externals/) property.
1. runs the [`copy-webpack-plugin`](https://github.com/kevlened/copy-webpack-plugin) to copy your vendor module assets into the output path.
1. runs the [`html-webpack-include-assets-plugin`](https://github.com/jharris4/html-webpack-include-assets-plugin) to add your vendor module bundles to the HTML output.

## Installation

```sh
npm install --save-dev html-webpack-externals-plugin
```

## Usage

Require the plugin in your Webpack config file.

```js
const HtmlWebpackExternalsPlugin = require('html-webpack-externals-plugin')
```

Then instantiate it in the `plugins` array, after your instance of `html-webpack-plugin`.

```js
plugins: [
  new HtmlWebpackPlugin(),
  new HtmlWebpackExternalsPlugin(
    // See API section
  ),
]
```

## API

The constructor takes a configuration object with the following properties.

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `externals` | array&lt;object&gt; | An array of vendor modules that will be excluded from your Webpack bundle and added as `script` or `link` tags in your HTML output. | *None* |
| `externals[].module` | string | The name of the vendor module. This should match the package name, e.g. if you are writing `import React from 'react'`, this would be `react`. | *None* |
| `externals[].entry` | string \| array&lt;string&gt; \| object \| array&lt;object \| string&gt; | The path, relative to the vendor module directory, to its pre-bundled distro file. e.g. for React, use `dist/react.js`, since the file exists at `node_modules/react/dist/react.js`. Specify an array if there are multiple CSS/JS files to inject. To use a CDN instead, simply use a fully qualified URL beginning with `http://`, `https://`, or `//`.<br><br>For entries whose type (JS or CSS) cannot be inferred by file extension, pass an object such as `{ path: 'https://some/url', type: 'css' }` (or `type: 'js'`). | *None* |
| `externals[].global` | string \| null | For JavaScript modules, this is the name of the object globally exported by the vendor's dist file. e.g. for React, use `React`, since `react.js` creates a `window.React` global. For modules without an export (such as CSS), omit this property or use `null`. | `null` |
| `externals[].supplements` | array&lt;string&gt; | For modules that require additional resources, specify globs of files to copy over to the output. e.g. for Bootstrap CSS, use `['dist/fonts/']`, since Glyphicon fonts are referenced in the CSS and exist at `node_modules/bootstrap/dist/fonts/`. | `[]` |
| `externals[].append` | boolean | Set to true to inject this module after your Webpack bundles. | `false` |
| `hash` | boolean | Set to true to append the injected module distro paths with a unique hash for cache-busting. | `false` |
| `outputPath` | string | The path (relative to your Webpack `outputPath`) to store externals copied over by this plugin. | `vendor` |
| `publicPath` | string \| null | Override Webpack config's `publicPath` for the externals files, or `null` to use the default `output.publicPath` value. | `null` |
| `files` | string \| array&lt;string&gt; \| null | If you have multiple instances of HtmlWebpackPlugin, use this to specify globs of which files you want to inject assets into. Will add assets to all files by default. | `null` |
| `enabled` | boolean | Set to `false` to disable the plugin (useful for disabling in development mode). | `true` |

## Examples

### Local JS external example

This example assumes `jquery` is installed in the app. It:

1. adds `jquery` to your Webpack config's `externals` object to exclude it from your bundle, telling it to expect a global object called `jQuery` (on the `window` object)
1. copies `node_modules/jquery/dist/jquery.min.js` to `<output path>/vendor/jquery/dist/jquery.min.js`
1. adds `<script type="text/javascript" src="<public path>/vendor/jquery/dist/jquery.min.js"></script>` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'jquery',
      entry: 'dist/jquery.min.js',
      global: 'jQuery',
    },
  ],
})
```

### Local CSS external example

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
    },
  ],
})
```

### Local external with supplemental assets example

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. copies all contents of `node_modules/bootstrap/dist/fonts/` to `<output path>/vendor/bootstrap/dist/fonts/`
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
      supplements: ['dist/fonts/'],
    },
  ],
})
```

### CDN example

This example does not require the `jquery` module to be installed. It:

1. adds `jquery` to your Webpack config's `externals` object to exclude it from your bundle, telling it to expect a global object called `jQuery` (on the `window` object)
1. adds `<script type="text/javascript" src="https://unpkg.com/jquery@3.2.1/dist/jquery.min.js"></script>` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'jquery',
      entry: 'https://unpkg.com/jquery@3.2.1/dist/jquery.min.js',
      global: 'jQuery',
    },
  ],
})
```

### URL without implicit extension example

Some CDN URLs don't have file extensions, so the plugin cannot determine whether to use a `link` tag or a `script` tag. In these situations, you can pass an object in place of the `entry` property that specifies the path and type explicitly.

This example uses the Google Fonts API to load the Roboto font. It:

1. adds `<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'google-roboto',
      entry: {
        path: 'https://fonts.googleapis.com/css?family=Roboto',
        type: 'css',
      },
    },
  ],
})
```

### Module with multiple entry points example

Some modules require more than one distro file to be loaded. For example, Bootstrap has a normal and a theme CSS entry point.

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. copies `node_modules/bootstrap/dist/css/bootstrap-theme.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap-theme.min.css`
1. copies all contents of `node_modules/bootstrap/dist/fonts/` to `<output path>/vendor/bootstrap/dist/fonts/`
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, before your chunks
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap-theme.min.css" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: ['dist/css/bootstrap.min.css', 'dist/css/bootstrap-theme.min.css'],
      supplements: ['dist/fonts/'],
    },
  ],
})
```

### Appended assets example

Sometimes you want to load the external after your Webpack chunks instead of before.

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, *after* your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
      append: true,
    },
  ],
})
```

### Cache-busting with hashes example

You can configure the plugin to append hashes to the query string on the HTML tags so that, when upgrading modules, a new hash is computed, busting your app users' caches. **Do not use this in tandem with CDNs, only when using local externals.**

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="<public path>/vendor/bootstrap/dist/css/bootstrap.min.css?<unique hash>" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
    },
  ],
  hash: true,
})
```

### Customizing output path example

By default, local externals are copied into the Webpack output directory, into a subdirectory called `vendor`. This is configurable.

Do not include a trailing slash or leading slash in your output path, they are concatenated automatically by the plugin.

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/thirdparty/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="<public path>/thirdparty/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
    },
  ],
  outputPath: 'thirdparty',
})
```

### Customizing public path example

By default, local externals are resolved from the same root path as your Webpack configuration file's `output.publicPath`, concatenated with the `outputPath` variable. This is configurable.

You should include a trailing slash in your public path, and a leading slash if you want it to resolve assets from the domain root.

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="/assets/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to your HTML file, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
    },
  ],
  publicPath: '/assets/',
})
```

### Specifying which HTML files to affect example

If you are using multiple instances of html-webpack-plugin, by default the assets will be injected into every file. This is configurable.

This example assumes `bootstrap` is installed in the app. It:

1. copies `node_modules/bootstrap/dist/css/bootstrap.min.css` to `<output path>/vendor/bootstrap/dist/css/bootstrap.min.css`
1. adds `<link href="/public/vendor/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">` to *only the `about.html` file*, before your chunks

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'bootstrap',
      entry: 'dist/css/bootstrap.min.css',
    },
  ],
  files: ['about.html'],
})
```

### Disabling the plugin

Sometimes you only want the plugin to be activated in certain environments. Rather than create separate Webpack configs or mess with splicing the plugins array, simply set the `enabled` option to `false` to disable the externals plugin entirely.

```js
new HtmlWebpackExternalsPlugin({
  externals: [
    {
      module: 'jquery',
      entry: 'dist/jquery.min.js',
      global: 'jQuery',
    },
  ],
  enabled: process.env.NODE_ENV === 'production',
})
```
