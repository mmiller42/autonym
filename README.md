# autonym

[![CircleCI](https://circleci.com/gh/mmiller42/autonym.svg?style=svg)](https://circleci.com/gh/mmiller42/autonym) [![Greenkeeper badge](https://badges.greenkeeper.io/mmiller42/autonym.svg)](https://greenkeeper.io/)

A KISS JSON REST API framework that can be mounted to your Express application.

The API, guides, and examples are available on [our website](https://autonym.io/), which is generated using [ESDoc](https://esdoc.org/).

## Installation

```bash
npm install autonym
```

## Quick Start

```js
import { AutonymError, Model, createModelMiddleware, createResponderMiddleware } from 'autonym'
import inMemoryStore from 'autonym/inMemoryStore' // Simple store creator that persists resources to memory
import bodyParser from 'body-parser'
import express from 'express'

// Make sure we crash on uncaught rejections (default Node behavior is inconsistent with synchronous exceptions)
// See http://2ality.com/2016/04/unhandled-rejections.html#unhandled-rejections-in-nodejs
process.on('unhandledRejection', err => {
  console.error(err)
  process.exit(1)
})

const app = express()
app.use(bodyParser.json({}))

// Example model
const Person = new Model({
  name: 'person',
  schema: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
    required: ['firstName', 'lastName'],
  },
  store: inMemoryStore(),
})

const mountAutonym = async () => {
  // Mount Autonym middleware
  const modelMiddleware = await createModelMiddleware({ models: [Person] })
  app.use(modelMiddleware)
  app.use(createResponderMiddleware())
  console.log('Autonym is ready')
}

mountAutonym()

// Start HTTP server
app.listen(3000, () => console.log('API is ready'))
```

### Example REST API requests

#### Create a new person

```bash
curl -H 'Content-Type: application/json' -X POST -d '{"firstName":"Matt","lastName":"Miller"}' http://localhost:3000/people
```

```json
{
  "id": "1",
  "firstName": "Matt",
  "lastName": "Miller"
}
```

#### Schema validation error

```bash
curl -H 'Content-Type: application/json' -X POST -d '{"firstName":"Matt"}' http://localhost:3000/people
```

```json
{
  "message": "Schema validation for model \"person\" failed."
  "errors": [
    {
      "keyword": "required",
      "dataPath": "",
      "schemaPath": "#/required",
      "params": { "missingProperty": "lastName" },
      "message": "should have required property 'lastName'"
    }
  ]
}
```

#### Find people

```bash
curl http://localhost:3000/people
```

```json
[
  {
    "id": "1",
    "firstName": "Matt",
    "lastName": "Miller"
  }
]
```

#### Find one person

```bash
curl http://localhost:3000/people/1
```
```json
{
  "id": "1",
  "firstName": "Matt",
  "lastName": "Miller"
}
```

#### Update a property on a person

```bash
curl -H 'Content-Type: application/json' -X PATCH -d '{"firstName":"Matthew"}' http://localhost:3000/people/1
```

```json
{
  "id": "1",
  "firstName": "Matthew",
  "lastName": "Miller"
}
```

#### Delete a person

```bash
curl -X DELETE http://localhost:3000/people/1
```

```json
{ "id": "1" }
```

#### Not found error

```bash
curl http://localhost:3000/people/1
```

```json
{ "message": "Record not found" }
```

## Philosophy

Autonym is another framework built on top of <a href="https://expressjs.com/">Express</a> to simplify building REST APIs for your resources. However, its philosophy sets it apart from most other Node.js API frameworks.

It is extremely lightweight and written in ES6. By design, it eliminates the need to scaffold controllers in your API, because they can be inferred automatically from your models. Models are driven by simple configuration objects and in many cases can just forward their arguments to an ORM. As a result, APIs built in Autonym require little coding but still offer total control over each CRUD action for a resource, and are very easy to understand at a glance.

* **It's just middleware.** Most frameworks take over your entire application, making it difficult to adjust an existing app to the new framework's setup. This also results in endless frustration when trying to do something the framework isn't designed to do. Autonym is just mounted like any other middleware, so you can add other middleware and handlers before or after Autonym to do whatever you want, the way you normally would.

* **No bloat.** Autonym follows the single responsibility principle and seeks to do just one thing well: map requests to CRUD actions. Following from the previous principle, if your server needs to serve static assets as well, just mount middleware beside Autonym for your other routes. If you authenticate with JWTs, simply mount your JWT middleware before Autonym.

* **Your API, your response.** Autonym makes a habit of never sending the response to the user directly. This allows you to intercept the response to make any adjustments. If you want to let Autonym handle the response, it exposes another middleware to mount after that will send the response.

* **Data validation is standardized.** Autonym validates JSON documents using the JSON schema spec. JSON schemas are an industry standard and, being JSON documents themselves, are completely portable and ingestable by other clients, even written in other languages. For more comprehensive validation beyond JSON schemas, Autonym allows you to define validation and sanitization policies and map them to CRUD actions.

* **For better or for worse, database schemas are not document schemas.** In real life, there is rarely a perfect 1:1 relationship between properties on the request body and column names in a table. Autonym doesn't attempt to unify data models -- in fact, it doesn't care about databases at all! However, data store implementations are free to define mapping functions to translate documents to queries.

* **It has no opinion about ORMs.** Many REST frameworks are tightly coupled to ORMs, but, like the previous point, we recognized that sometimes in the real world you fight ORMs more than you love them, because one size never fits all. Autonym lets you integrate them to whatever extent you want. Autonym just expects a model to implement five CRUD methods. Whether those methods forward the data to an ORM or just run some queries or ops directly is up to you. Some models might directly correspond to a Mongo collection or SQL table, while other models might be virtual representations of more complex data. That distinction is completely up to you.

* **A clear distinction between a programmatic API and REST API, but without controllers.** Autonym splits the work of validating into two distinct phases: schemas and policies. You define them together, but policies, which only are applicable to your REST API, are not run when you just want to import your model and insert a record. This means you don't have to split up your resource definition into a separate model and controller, but you can still access your model directly without mocking a request.

* **Configuration is driven by plain objects.** This means that every piece that makes up a model -- the methods for persisting data to your database, the combinations of policies used to transform and validate requests, and the schemas that define your resource properties -- are all trivial to define, reuse, abstract, and assemble.

* **Isolation for testability.** Each component of an Autonym app is designed to be unit testable: JSON schemas can be tested independently, policies are just simple JavaScript functions that can be imported directly, and models are simple, isolated objects that never deal with request or response objects.

* **Error handling is a snap.** Autonym ships with its own error class that allows you to throw errors like you normally would, without being conscious of when they are runtime errors or simply bad requests. Errors thrown when using the programmatic API are passed on to error-handling middleware, while errors that occur during an HTTP request are intelligently (but still explicitly) handled and returned to the client.

* **Embrace ES6+.** Autonym app components are heavily class-based and Autonym and its sister projects are written with Babel. No more callback hell!

It's worth noting that the developers behind Autonym envisioned a simplistic data model, and as a result there are some definite drawbacks and limitations to the built-in behaviors of the framework.

* Autonym has no intrinsic understanding of related resources. The API does not understand foreign references and will only return resource ids. This means that establishing relationships between models must be handled at the database layer or manually in the API layer. However, this eliminates some of the complexity with setting up and consuming an API with intricate routing, unintentionally costly joins, and recursive embedding.

* Autonym requires all resources to have a primary key that is named id. Composite primary keys or primary keys named something different are not currently supported. This is to make REST calls trivial by using standard resource identifiers in the URL.

## Guide

### Glossary

These are high-level concepts and vocabulary for working with an Autonym application.

* **Model**: A model is an instance of the `Model` class provided by Autonym. Constructed with a configuration object, a model defines its schema, policies, store methods, and so on. A model instance has static methods on it that make it trivial to import elsewhere in the application to create, read, update, and delete resources programmatically. It's also designed to plug into the Autonym middleware to be evaluated in a HTTP request.

* **Schema**: A schema is part of a model's configuration. It is an object that follows the [JSON schema specification](http://json-schema.org/) for defining the properties of this type of resource.

* **Policy**: A policy is a function that is run when a request hits your API for a particular model action. Policies are like Express middleware, with the added advantage that they can be easily chained together in "and" and "or" statements. They can be used to validate the request, add computed properties, and manipulate the response before it is returned to the client. Since they are just functions, ideally they are defined in other parts of the application and imported into models for easy reuse between different models.

* **Store methods**: Store methods are the five core methods that are configured on a model that perform your CRUD operations: `create`, `find`, `findOne`, `findOneAndUpdate`, and `findOneAndDelete`. These methods are exposed on the programmatic API for the model and are called by the middleware, provided the policies permit the request. Oftentimes, these methods can be shared among many models, i.e. with an ORM. Reusable implementations of store methods are commonly referred to as stores.

* **`req` and `res`**: Policies are passed request and response objects, just like Express middleware; however, these are not the standard objects provided by Express. They are wrapped in the `AutonymReq` and `AutonymRes` classes, which are designed to place an emphasis on identifying the user's actions, retrieving data safely, working with the model's programmatic API, and safeguarding against common programming errors.

* **Meta**: Policies and store methods are also passed a `meta` object. This is a plain JavaScript object that is shared for the entire duration of the request, and is passed from policy to policy, in addition to being passed to each of the store methods. This object can be used to cache supplemental information about the request, e.g. the current user session or search keywords from the query string; information that might be useful in the store method, such as filters to apply to a SQL query; or any other metadata pertaining to the request. Unlike the request data, which must be serializable in order to pass schema validation, the meta object may contain class instances.

* **Model middleware**: A middleware that can be mounted on your Express app. Provided with your models, it will intercept requests to your model endpoints to perform the appropriate API actions.

* **Responder middleware**: A middleware that can be mounted on your Express app, after the `autonym` middleware. In between the two middleware, you may install your own middleware to quash errors, add response headers, manipulate the payload, and so on. This middleware sends the response to the client.

* **`AutonymError`**: A subclass of `Error`. Instances of `AutonymError` should be thrown whenever possible from policies and store methods. These errors have preset types that will determine the status code if they are thrown during an HTTP request; if not provided a code, it will be assumed that the error message should not be enclosed in the response.
