# autonym [![CircleCI](https://circleci.com/gh/mmiller42/autonym.svg?style=svg)](https://circleci.com/gh/mmiller42/autonym) [![Greenkeeper badge](https://badges.greenkeeper.io/mmiller42/autonym.svg)](https://greenkeeper.io/)

A KISS JSON REST API framework that can be mounted to your Express application.

<!-- toc -->

- [Philosophy](#philosophy)
  * [Limitations](#limitations)
- [Guide](#guide)
  * [Glossary](#glossary)
  * [Hello World](#hello-world)
- [API](#api)

<!-- tocstop -->

## Philosophy

Autonym is another framework built on top of [Express](https://expressjs.com/) to simplify building REST APIs for your resources. However, its philosophy sets it apart from most other Node.js API frameworks.

It is extremely lightweight and written in ES6. By design, it eliminates the need to scaffold controllers in your API, because they can be inferred automatically from your models. Models are driven by simple configuration objects and in many cases can just forward their arguments to an ORM. As a result, APIs built in Autonym require little coding but still offer total control over each CRUD action for a resource, and are very easy to understand at a glance.

* **It's just middleware.** Most frameworks take over your entire application, making it difficult to adjust an existing app to the new framework's setup. This also results in endless frustration when trying to do something the framework isn't designed to do. Autonym is just mounted like any other middleware, so you can add other middleware and handlers before or after Autonym to do whatever you want, the way you normally would.

* **No bloat.** Autonym follows the single responsibility principle and seeks to do just one thing well: map requests to CRUD actions. Following from the previous principle, if your server needs to serve static assets as well, just mount middleware beside Autonym for your other routes. If you authenticate with JWTs, simply mount your JWT middleware before Autonym.

* **Your API, your response.** Autonym makes a habit of never sending the response to the user directly. This allows you to intercept the response to make any adjustments. If you want to let Autonym handle the response, it exposes another middleware to mount after that will send the response.

* **Data validation is standardized.** Autonym validates JSON documents using the JSON schema spec. JSON schemas are an industry standard and, being JSON documents themselves, are completely portable and ingestable by other clients, even written in other languages. For more comprehensive validation beyond JSON schemas, Autonym allows you to define validation and sanitization policies and map them to CRUD actions.

* **For better or for worse, database schemas are not document schemas.** In real life, there is rarely a perfect 1:1 relationship between properties on the request body and column names in a table. Autonym doesn't attempt to unify data models -- in fact, it doesn't care about databases at all! However, data store implementations are free to define mapping functions to translate documents to queries.

* **It has no opinion about ORMs.** Many REST frameworks are tightly coupled to ORMs, but, like the previous point, we recognized that sometimes in the real world you fight ORMs more than you love them, because one size never fits all. Autonym lets you integrate them to whatever extent you want. Autonym just expects a model to implement five CRUD methods. Whether those methods forward the data to an ORM or just run some queries or ops directly is up to you. Some models might directly correspond to a Mongo collection or SQL table, while other models might be virtual representations of more complex data. That distinction is completely up to you.

* **A clear distinction between a programmatic API and REST API, but without controllers.** Autonym splits the work of validating into two distinct phases: schemas and policies. You define them together, but policies, which only are applicable to your REST API, are not run when you just want to import your model and insert a record. This means you don't have to split up your resource definition into a separate model and controller, but you can still access your model directly without mocking a request.

* **Isolation for testability.** Each component of an Autonym app is designed to be unit testable: JSON schemas can be tested independently, policies are just simple JavaScript functions that can be imported directly, and models are simple, isolated objects that never deal with request or response objects.

* **Error handling is a snap.** Autonym ships with its own error class that allows you to throw errors like you normally would, without being conscious of when they are runtime errors or simply bad requests. Errors thrown when using the programmatic API are passed on to error-handling middleware, while errors that occur during an HTTP request are intelligently (but still explicitly) handled and returned to the client.

* **Embrace ES6.** Autonym app components are heavily class-based and Autonym and its sister projects are written with Babel. You can always write components with ES5, but Autonym is designed for modern apps.

### Limitations

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

### Hello World

This is a barebones app using Autonym. Please see the [`autonym-demo`](https://github.com/mmiller42/autonym-demo) repository for a better example using best practices.

Here, we create a basic store that simply persists the records to memory, in an internal array, and using auto-incrementing ids. Then we build a Person model with two basic fields, that uses the in-memory store. Finally, we mount the appropriate middleware.

```js
import { AutonymError, Model, createModelMiddleware, createResponderMiddleware } from 'autonym'
import bodyParser from 'body-parser'
import express from 'express'

// Example store implementation
const inMemoryStore = () => {
  const records = []
  let counter = 0
  const findRecordIndex = id => {
    const index = records.findIndex(record => record.id === id)
    if (index < 0) {
      throw new AutonymError(AutonymError.NOT_FOUND, 'Record not found')
    }
    return index
  }
  
  return {
    create: data => records[records.push({ ...data, id: ++counter }) - 1],
    find: () => records,
    findOne: id => records[findRecordIndex(id)],
    findOneAndUpdate: (id, data) => Object.assign(records[findRecordIndex(id)], data),
    findOneAndDelete: id => records.splice(findRecordIndex(id), 1)[0],
  }
}

// Example model
const Person = new Model({
  name: 'Person',
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

// Initialize express app
const app = express()
app.use(bodyParser.json({}))

// Mount Autonym middleware
app.use(createModelMiddleware([ Person ]))
app.use(createResponderMiddleware())

// Start HTTP server
app.listen(3000, () => console.log('App is ready'))
```

At this point, we should be able to run the app and make some requests:

```bash
# create
curl -H 'Content-Type: application/json' -X POST -d '{"firstName":"Matt","lastName":"Miller"}' http://localhost:3000/people
# {"firstName":"Matt","lastName":"Miller","id":1}

# create schema error
curl -H 'Content-Type: application/json' -X POST -d '{"firstName":"Matt"}' http://localhost:3000/people
# {"errors":[{"keyword":"required","dataPath":"","schemaPath":"#/required","params":{"missingProperty":"lastName"},"message":"should have required property 'lastName'"}],"message":"Schema validation for model \"Person\" failed."}

# find
curl http://localhost:3000/people
# [{"firstName":"Matt","lastName":"Miller","id":1}]

# findOne
curl http://localhost:3000/people/1
# {"firstName":"Matt","lastName":"Miller","id":1}

# findOneAndUpdate
curl -H 'Content-Type: application/json' -X PATCH -d '{"firstName":"Matthew"}' http://localhost:3000/people/1
# {"firstName":"Matthew","lastName":"Miller","id":1}

# findOneAndDelete
curl -X DELETE http://localhost:3000/people/1
# {"firstName":"Matthew","lastName":"Miller","id":1}

# findOne thrown error
curl http://localhost:3000/people/1
# {"message":"Record not found"}
```

## API

###
