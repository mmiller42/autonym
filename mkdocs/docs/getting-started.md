# Getting Started

The quickest way to get started is by using the [Yeoman generator](https://github.com/mmiller42/generator-autonym),
which scaffolds the structure of an Autonym app for you. However, this guide will take you through building an API from
scratch, so we can walk through line by line how it works.

## Prerequisites

In these examples, we'll touch on each feature of Autonym by building an API for managing Person objects that are stored
in a Postgres database. Needless to say, you'll want to have a recent version of Node/NPM installed as well as Postgres.

In addition, all examples of Autonym use features of ES6 that will require running with [Babel](http://babeljs.io/).
This tutorial does include what is needed to get a Babel application running, but we don't cover ES6 features here. We
recommend checking out [the ES6 features list by lukehoban](http://git.io/es6features) as a guide for any unfamiliar
syntax. You should also be comfortable with Express and understand concepts like middleware, request/response handling,
and callbacks. Last, Autonym uses JSON schems. A complete example is included in this walkthrough, but you'll want to
get comfortable writing your own schemas when you build a production API. We recommend the
[thorough documentation](https://spacetelescope.github.io/understanding-json-schema/) provided by the Space Telescope
Science Institute.

## Installation

Let's start with a totally blank application. Create a new directory, change into it, and `npm init` and follow the
wizard to create a new `package.json` in your project.

Next, we'll install some dependencies to transpile the Babel source into ES5 at runtime. We'll also install
[nodemon](http://nodemon.io/), which is just a convenient tool that watches your source code for changes and
automatically restarts the API server.

```bash
mkdir new-api && cd $_
npm init
npm install --save-dev babel-cli babel-preset-node5 babel-preset-stage-2 nodemon
```

To run this app, you can use the `nodemon` executable instead of just `node`. However, we want to override the command
that nodemon executes when the watched files change -- instead of running the `node` executable, it needs to run
`babel-node` to transpile our ES6.

Let's open up `package.json`. Under the `scripts` section, we can add a `start` script that will serve as an aliased
shortcut to our command.

```json
"scripts": {
  "start": "nodemon ./lib/app.js --exec babel-node"
}
```

The last thing we need to do is create a file called `.babelrc` in our project directory and populate it with:

```json
{
  "presets": ["node5", "stage-2"]
}
```

This is enough to get a Babel app running; now let's install our normal dependencies. Autonym is just Express
middleware, so we will need to install Express and its JSON-parsing companion body-parser. We'll install Autonym and the
Postgres extension to make building models that connect to Postgres easier. Finally, we'll need some utility packages
for error handling; we'll cover what the last two dependencies are used for later in this guide.

```bash
npm install --save express body-parser autonym autonym-postgres-store autonym-client-errors instance-of-name
```

## Coding

Let's organize our app by placing source code in a `lib` directory, and we'll create the entry point to our app as
`app.js` like we specified in the `npm start` script.

### A simple Express app

In `lib/app.js` we'll start by just creating a typical Express server.

```js
// lib/app.js

import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';

const app = express();
app.use(bodyParser.json({}));

app.get('/', (req, res) => res.json({message: 'Hello world!'}));

http.createServer(app).listen(3000, err => {
  if (err) { throw err; }
  console.log('Listening on port 3000');
});
```

This is a bare-bones Express application. If you run this app with `npm start` and everything goes well, you'll see a
`Listening on port 3000` in your stdout. Visiting `http://localhost:3000/` in your browser or favorite REST client
(we're fans of [Postman](https://www.getpostman.com/)) should yield the JSON `{"message":"Hello world!"}`.

### Refactoring our Express app

Let's make a few improvements before we continue: we'll replace the literal `3000` with an environment variable so it
can be controlled by the service running our app. We'll replace `throw err;` with a reusable `handleError` function for
our application. And we'll register a listener for the `unhandledRejection` event, which will fire if any promises throw
exceptions that aren't caught elsewhere in the application (just in case -- Node swallows up unhandled promise
rejections, unlike synchronous exceptions, which will crash the application).

```js
// lib/app.js

import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import handleError from './handle-error';

process.on('unhandledRejection', handleError);

const app = express();
app.use(bodyParser.json({}));

app.get('/', (req, res) => res.json({message: 'Hello world!'}));

http.createServer(app).listen(process.env.PORT, err => {
  if (err) { return handleError(err); }
  console.log(`Listening on port ${process.env.PORT}`);
});
```

Now, of course, `PORT` is an environment variable, so we should export it or save it to our shell profile.

```bash
export PORT=3000
```

And we'll need to create our error handler as well, so create a new `handle-error.js`.

This will just be a small file exporting a reusable function. This function will be called when errors occur and can
choose to log them out, send alerts to your on-call team, or crash the application.

For now, we're just going to throw the error, which will crash the app.

```js
// lib/handle-error.js

function handleError (err) {
  setImmediate(() => { throw err; });
}

export default handleError;
```

Note that we wrapped it in a `setImmediate` call. This is because Express' default error when an exception is thrown
during a request is to catch it and pass it to a generic "error middleware", which simply logs the exception and carries
on. If an error makes it this far, we'd like to crash the app to reset its state. If we wrap the code in a
`setImmediate` call, it can't be caught by Express, since it will be thrown after Express finishes with the request.

### Integrating Autonym

Alright, let's actually start integrating Autonym into our Express application.

Because Autonym is just Express middleware, we can simply add an `app.use()` call with a new instance of Autonym.

```js
// lib/app.js

import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import Autonym, {AutonymResponder} from 'autonym';
import handleError from './handle-error';

process.on('unhandledRejection', handleError);

const app = express();
app.use(bodyParser.json({}));

app.get('/', (req, res) => res.json({message: 'Hello world!'}));

app.use(new Autonym(__dirname).middleware);
app.use(new AutonymResponder(handleError).middleware);

http.createServer(app).listen(process.env.PORT, err => {
  if (err) { return handleError(err); }
  console.log(`Listening on port ${process.env.PORT}`);
});
```

A few things are going on here:

* We created a new instance of the `Autonym` class, passing `__dirname` into the constructor. `__dirname` is a Node.js
  constant that refers to the absolute path to the currently executing file (i.e. the path to `./lib`). Autonym will
  attempt to import various "components" from this given directory by searching for files that match a pattern.

* We mounted the `autonym.middleware` middleware onto the app. Now, all requests will pass through the instance of
  Autonym at this stage in the middleware stack. Of course, since we mounted it after our `app.get()` middleware (which
  does not call `next`), our hello world example will not pass through Autonym. The best way to adapt existing
  applications with Autonym is to add the Autonym middleware near the bottom of the stack, so as to not affect existing
  APIs.

* We also mounted `new AutonymResponder(handleError).middleware`. The `autonym.middleware` will validate and process the
  request, but the `autonymResponder.middleware` middleware will actually send it to the client. These are deliberately
  kept separate so that you can tweak the response however you like in between these two handlers. Note that the
  `AutonymResponder` constructor takes a `handleError` function. In addition to passing the error to the client, this
  function can be used to capture and handle errors that happened during the request/response life cycle.

Autonym is now going to look for files in the directory we passed into the constructor, in this case the absolute path
to `./lib`. Autonym will check for three subdirectories in the path provided to it: `models`, `policies`, and `schemas`.
Go ahead and create these three directories in the `lib` folder. Next, we'll describe and build each of these
components.

### Our first model

Let's create a model that represents a person. Models are just classes that extend from the `Model` abstract class that
is exported by Autonym.

```js
// lib/models/person.model.js

import {Model} from 'autonym';

class Person extends Model {
}

export default Person;
```

This model doesn't do much yet! But, if we create some static methods with specific names, we can start to add
functionality to our model. Let's start with the `_find()` method, which should return a list of people.

```js
// lib/models/person.model.js

import {Model} from 'autonym';

class Person extends Model {
  static _find (query) {
    return Promise.resolve([
      {
        id: '1',
        firstName: 'John',
        lastName: 'Galt',
        employerId: '42'
      }
    ]);
  }
}

export default Person;
```

By defining this function, we've now added the ability for our API to "get people." The abstract Model class noticed
that the `_find()` function was defined, so it will call it any time you make a GET request to `/people`. Your function
*must* return a promise and that promise *must* pass back an array. For now, that array is just static data.

There are four other CRUD methods (`_create()`, `_findOne()`, `_findOneAndUpdate()`, `_findOneAndDelete()`) which are
described in more detail in the API reference. Note that if any of them aren't set on your model, it's okay -- your user
will just receive a method not allowed error. However, note that `_findOne()` *must* be set up in order for
`_findOneAndUpdate()` and `_findOneAndDelete()` to work.

Go ahead! Hit `http://localhost:3000/people` in your browser or Postman and you should get back the array.

Behind the scenes, Autonym processes a GET request, parses the incoming data, forwards the relevant parts of the request
to `_find()`, then reformats the results and passes them onto the next middleware in the stack. In this case, the next
middleware is the AutonymResponder, which just returns the response. However, if you wanted to, for example, wrap that
array inside an object (e.g. `{"data": []}`) or add some specific headers, you could add more middleware in between --
all Autonym does is add some properties to the `req` and `res` objects from Express with additional information. More
information about how this works and how to hook into this process is available in the API section.

### Using the Postgres Store

We could define the additional methods like `_create()` and `_findOne()`, but that might seem tedious. If we had a
custom datastore, we might implement these methods manually. But since we're using Postgres, we can automate that work.

First, let's create a Postgres database and add a new table to hold people. Let's create a Postgres database and a new
table.

```bash
createdb autonym_app
psql autonym_app
> CREATE TABLE people (
  id BIGSERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  employer_id BIGINT NOT NULL
);
```

Note that the primary key has to be a column called `id` for Autonym to work.

We also need to tell Autonym how to connect to our Postgres store. This is done with another environment variable, so
you let's export another environment variable.

```bash
export POSTGRES_CONNECTION="postgres://$USER@localhost:5432/autonym_app"
```

Now we can leverage the Postgres store extension in our model.

```js
// lib/models/person.model.js

import {Model} from 'autonym';
import PostgresStoreFactory from 'autonym-postgres-store';

const PostgresStore = PostgresStoreFactory();

class Person extends Model {
  static _init () {
    this.store = new PostgresStore('people');
    super._implementDefaultStoreCrudMethods(this.store);
  }
}

export default Person;
```

Here, we've attached a static `_init()` method. It creates a new property on the class called `store` and instantiates a
`PostgresStore`, passing in the name of our table. Then, we call `_implementDefaultStoreCrudMethods()`, which is a
function on the abstract Model class, providing our store instance. All this fancy function does is copy the `create()`,
`find()`, `findOne()`, `findOneAndUpdate()`, `findOneAndDelete()`, `serialize()`, and `unserialize()` functions from the
store to our model class. This is basically just a quicker way of doing something like:

```js
static _create () { return this.store.create(...arguments); }
static _find () { return this.store.find(...arguments); }
static _findOne () { return this.store.findOne(...arguments); }
// ...
```

At this point, we've essentially defined our Person model, and it's fully integrated with Postgres. Using a REST client,
try some requests:

* POST http://localhost:3000/people

**Request**

```json
{"firstName":"John","lastName":"Galt","employerId":"42"}
```

**Response**

```json
{"id":1,"firstName":"John","lastName":"Galt","employerId":"42"}
```

* POST http://localhost:3000/people

**Request**

```json
{"firstName":"Dagny","lastName":"Taggart","employerId":"42"}
```

**Response**

```json
{"id":2,"firstName":"Dagny","lastName":"Taggart","employerId":"42"}
```

* GET http://localhost:3000/people

**Response**

```json
[{"id":1,"firstName":"John","lastName":"Galt","employerId":"42"},{"id":2,"firstName":"Dagny","lastName":"Taggart","employerId":"42"}]
```

* GET http://localhost:3000/people/1

**Response**

```json
{"id":1,"firstName":"John","lastName":"Galt","employerId":"42"}
```

* PATCH http://localhost:3000/people/2

**Request**

```json
{"lastName":"Galt"}
```

**Response**

```json
{"id":2,"firstName":"Dagny","lastName":"Galt","employerId":"42"}
```

* GET http://localhost:3000/people?search[firstName][~]=dag

**Response**

```json
[{"id":2,"firstName":"Dagny","lastName":"Galt","employerId":"42"}]
```

* GET http://localhost:3000/people?sort=+firstName

**Response**

```json
[{"id":2,"firstName":"Dagny","lastName":"Galt","employerId":"42"},{"id":1,"firstName":"John","lastName":"Galt","employerId":"42"}]
```

* DELETE http://localhost:3000/people/1

**Response**

*no content*

### Adding a JSON schema

So there we have a working model! However, you should probably see in your stdout a warning about missing a schema.
Without JSON schema validation, this is a huge security violation. Any data can be sent to our API and the Postgres
store will try to insert it, even if the columns don't exist, are of the wrong type, or worse -- are columns users
shouldn't be allowed to write to (like `id`)!

Let's create a JSON schema for our Person model. Properties that aren't defined in the schema will be automatically
discarded from the request, and the defined properties will be properly validated.

```json
// lib/schemas/person.schema.json

{
  "id": "Person",
  "type": "object",
  "properties": {
    "firstName": {"type": "string", "minLength": 1, "maxLength": 20},
    "lastName": {"type": "string", "minLength": 1, "maxLength": 20},
    "employerId": {"type": "string", "minLength": 1, "maxLength": 10}
  },
  "required": ["firstName", "lastName", "employerId"]
}
```

Now, JSON schema validation will be properly enforced against any operations to the model. The schema is automatically
matched to the model because its `id` is `Person`, which is the same as the name of our model.

If you try sending an invalid request, you'll notice your app crashes. That's because the `handleError` method is
crashing it when *any* error occurs. Let's make some adjustments.

```js
// lib/handle-error.js

import instanceOf from 'instance-of-name';

function handleError (err) {
  if ('internalQuery' in err) {
    console.error(err);
  } else if (instanceOf(err, 'ClientError')) {
    console.log(err.message);
  } else {
    setImmediate(() => { throw err; });
  }
}

export default handleError;
```

Here we'll walk through some changes we made:

* We're "duck-typing" the error to see if it has an `internalQuery` property. If that property exists, it probably means
  the error originated from the Postgres database driver. This could mean something bad, but generally an erroneous
  query doesn't mean the app has to crash, it might be due to a misconfigured model or a search query that just wouldn't
  work. Let's log it out to stderr, but we'll keep the app going.
* The next condition checks if the error was derived from a class called `ClientError`. `ClientError` is a special class
  that Autonym uses for any errors that are the result of a bad request on behalf of the client. The app is totally fine,
  but the user got back an error message. Here, we're printing it out just for verbosity, but we could safely ignore
  these errors.
* Otherwise we'll continue with our default behavior and crash the app.

### Creating a policy

The last feature we'll explore in this guide is policies. Policies are a lot like Express middleware and are simply
functions that perform sanitization and validation on requests that are beyond the capabilities of JSON schemas. Common
functions of policies are:

* add a timestamp to every resource
* add hard-coded filters to searches to restrict result sets
* validate that the user has permission to perform the action

We're going to only allow people to make updates if they are editing themselves. Let's create a policy that checks some
property on the request to see if it matches the resource being updated.

```js
// lib/policies/is-self.policy.js

import {ForbiddenError} from 'autonym-client-errors';

function isSelf (req) {
  if (req.query.userId !== req.resourceId) {
    throw new ForbiddenError('You do not have permission to update this resource');
  }
}

export default isSelf;
```

In this contrived example, our way of telling if the current user is the user being updated, we're simply checking a
`userId` parameter in the query string. Horribly insecure, but easy to test. Note that we are throwing an instance of
`ForbiddenError`. It is important that your policy throw some subclass from the autonym-client-errors package, such as
`ForbiddenError`. If an internal error occurred (like a rejected database connection or a timeout), just throw it and
AutonymResponder will return a 500 error and pass it onto your `handleError` method; but if the error just indicates
something the client did wrong, always make sure to throw a subclass of ClientError.

It doesn't matter what the function *returns*, unless it is a promise. If it's a promise, then the promise can resolve
with anything, or reject and it will be treated just like the throw example.

You may also have noticed the `req.resourceId` property, which is nonstandard on the `req` object in Express. Autonym
aggregates the `req` object with many properties, which are documented in the API reference.

Let's attach this policy to the `findOneAndUpdate` action, which we can do by modifying our schema.

```json
// lib/schemas/person.schema.json

{
  "id": "Person",
  "type": "object",
  "policies": {
    "findOneAndUpdate": "isAdmin"
  },
  "properties": {
    "firstName": {"type": "string", "minLength": 1, "maxLength": 20},
    "lastName": {"type": "string", "minLength": 1, "maxLength": 20},
    "employeeId": {"type": "string", "minLength": 1, "maxLength": 10}
  },
  "required": ["firstName", "lastName", "clientId"]
}
```

Now if we reattempt a PATCH request on `/people/42`, we should get back a forbidden error. However, if try a request to
`/people/42?userId=42`, we should get a success (assuming a person with id 42 exists). Obviously this is just a simple
example and not a valid means of authentication.

The `policies` object on the schema can have `*`, `create`, `find`, `findOne`, `findOneAndUpdate`, and
`findOneAndDelete` definitions. The `*` applies to *all* CRUD operations and is always evaluated first.

The values in the `policies` object are actually "asynchronous boolean expressions." At their simplest, they're just
names of policies. However, you can actually mix and match policies by using the syntax defined in
[async-boolean-expression-evaluator](https://github.com/mmiller42/async-boolean-expression-evaluator). This allows you
to combine policies, like `{"or": ["isAdmin", "isSelf"]}` or
`{"and": ["isLoggedIn", {"or": ["isAdmin", "canChangePassword"]}]}`.

## Afterword

Hopefully this tutorial helped you get started with your first Autonym app! There's a lot more to it, and also a lot
more work for us to do. Please let us know what you think in the Issues section, and as always, pull requests are
welcome!
