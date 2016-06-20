# Autonym
A KISS JSON REST API framework that can be mounted to your Express application.

Autonym is another framework built on top of Express to simplify building REST APIs for your resources. However, its philosophy sets it apart from most other Node.js API frameworks.

## Philosophy
* **It's just middleware.** Most frameworks take over your entire application, making it difficult to adjust an existing app to the new framework's setup. This also results in endless frustration when trying to do something the framework isn't designed to do. Autonym is just mounted like any other middleware, so you can add other middleware and handlers before or after Autonym to do whatever you want, the way you normally would.
* **No bloat.** Autonym follows the single responsibility principle and seeks to do just one thing well: map requests to CRUD actions. Following from the previous principle, if your server needs to serve static assets as well, just mount middleware beside Autonym for your other routes. If you authenticate with JWTs, mount your JWT middleware before Autonym.
* **Your API, your response.** Autonym makes a habit of never sending the response to the user directly. This allows you to intercept the response to make any adjustments. If you want to let Autonym handle the response, it exposes another middleware to mount after that will send the response.
* **Data validation is standardized.** Autonym validates JSON documents using the JSON schema spec. Since JSON schemas are JSON documents themselves, they can be exposed to API clients who can do pre-emptive validation on their end. For more comprehensive validation beyond JSON schemas, Autonym allows you to define validation and sanitization *policies* and map them to CRUD actions.
* **For better or for worse, database schemas are not document schemas.** In real life, there is rarely a perfect 1:1 relationship between properties on the request body and column names in a table. Autonym doesn't attempt to unify data models -- in fact, it doesn't care about databases at all! However, data store implementations are free to define mapping functions to translate documents to queries.
* **It has no opinion about ORMs.** Many REST frameworks are tightly coupled to ORMs, but, like the previous point, we recognized that sometimes in the real world you fight ORMs more than you love them. Autonym lets you integrate them to whatever extent you want. Autonym just expects a model to implement methods called `find`, `findOne`, `create`, `findOneAndUpdate`, and `findOneAndDelete`, and what those methods do is up to you.
* **Isolation for testability.** Each component of an Autonym app is designed to be unit testable: JSON schemas can be tested independently, policies are just simple JavaScript functions that can be imported directly, models are simple, isolated classes that never deal with request or response objects.
* **Embrace ES6.** Autonym app components are heavily class-based and Autonym and its sister projects are written with Babel. You can always write components with ES5, but Autonym is designed for modern apps. As a downside, it *does* require higher versions of Node.

### Drawbacks
It is important to point out some of the limitations of Autonym as well.

* Autonym has no intrinsic understanding of related resources. The API does not understand foreign references and will only use resource ids.
* Autonym requires all resources to have a primary key that is named `id`. Composite primary keys or primary keys named something different are not currently supported.

## Quick Start (Postgres)
### Installation
```shell
npm install --save express bodyparser autonym autonym-postgres-store
export POSTGRES_CONNECTION="postgres://yourusername@localhost:5432/db"
export PORT=3000
```

### Database schema
```sql
CREATE TABLE "users" (
  "id" BIGSERIAL PRIMARY KEY,
  "first_name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255) NOT NULL
);
```

### File structure
#### `./app.js`
```js
import http from 'http';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import Autonym, {respond} from 'autonym';

// Don't suppress uncaught rejected promises
process.on('unhandledRejection', err => { throw err; });

const app = express();
app.use(bodyParser.json({}));

// Create an Autonym app by pointing it to the directory containing components
// Second argument is a function for handling errors
const autonym = new Autonym(path.join(__dirname, 'autonym'), err => { throw err; });
// Mount the middleware for requests
app.use(autonym.middleware);
// Manipulate the response here, or remove the following line to implement your own responder
app.use(respond(autonym).middleware);

http.createServer(app).listen(process.env.PORT);
```

#### `./autonym/models/person.model.js`
```js
import {Model} from 'autonym';
import PostgresStoreFactory from 'autonym-postgres-store';
const PostgresStore = PostgresStoreFactory();

class Person extends Model {
  static _init () {
    // While bootstrapping the application, create a new store for the corresponding table
    this.store = new PostgresStore('people');
  }
  
  static _find (query) {
    // These methods are called by the abstract model class. Simply forward them to the
    // corresponding method on PostgresStore or implement your own. You can also choose not
    // to implement these methods at all, and the API client will receive a method not
    // allowed error
    return this.store.find(query);
  }
  
  static _findOne (personId) {
    return this.store.findOne(personId);
  }
  
  static _create (attributes) {
    return this.store.create(attributes);
  }
  
  static _findOneAndUpdate (personId, attributes) {
    return this.store.findOneAndUpdate(personId, attributes);
  }
  
  static _findOneAndDelete (personId) {
    return this.store.findOneAndDelete(personId);
  }
  
  static _serialize (attributes) {
    return this.store.serialize(attributes);
  }
  
  static _unserialize (attributes) {
    return this.store.unserialize(attributes);
  }
}

export default Person;
```

#### `./autonym/schemas/person.schema.json`
```json
{
  "id": "person",
  "type": "object",
  "properties": {
    "firstName": {"type": "string", "minLength": 1, "maxLength": 255},
    "lastName": {"type": "string", "minLength": 1, "maxLength": 255}
  },
  "required": ["firstName", "lastName"]
}
```

### Running
```shell
node ./app.js

# Get a schema
curl http://localhost:3000/_schemas/person.json # {"id":"person","type":"object",...}
# Attempt to create a resource without matching schema
curl -H "Content-Type: application/json" -X POST -d '{"firstName":"Joe","lastName":""}' http://localhost:3000/people # {"status":"badRequest","message":{...}}
# Create resource
curl -H "Content-Type: application/json" -X POST -d '{"firstName":"Joe","lastName":"Schmoe"}' http://localhost:3000/people # {"id":1,"firstName":"Joe","lastName":"Schmoe"}
# Get all resources
curl http://localhost:3000/people # [{"id":1,"firstName":"Joe","lastName":"Schmoe"}]
# Get resource by id
curl http://localhost:3000/people/1 # {"id":1,"firstName":"Joe","lastName":"Schmoe"}
# Update resource by id
curl -H "Content-Type: application/json" -X PATCH -d '{"firstName":"Jane"}' http://localhost:3000/people/1 # {"id":1,"firstName":"Jane","lastName":"Schmoe"}
# Delete resource by id
curl -X DELETE http://localhost:3000/people/1
```

## Concepts
### Models
Models are classes that live in the `models` directory and extend the abstract `Model` class. They must be named `model-name.model.js`, where `model-name` will be the name of the model. The name of the class will be used internally, while the kebab-case version of the name will be pluralized for use in routes.

```js
import {Model} from 'autonym';

class Person extends Model {
}

export default Person;
```

Models can define the following static methods and properties. All of them are optional.

#### `.plural`
This property represents the name of the resource in API routes. By default, it uses the [inflection](https://github.com/dreamerslab/node.inflection) library to pluralize the filename.

```js
class Person extends Model {
}
Person.plural = 'people';
```

#### `.name`
This property represents the internal name of the model. It will attempt to use the name of the exported class. If the exported class is anonymous, it will convert the filename to PascalCase.

```js
class Person extends Model {
}
Person.name = 'Person';
```

#### `._init()`
This function is called once while the app boots up. It can be used to define any dynamic methods or properties on the class. Commonly it is used to initialize a connection to a database. If it is asynchronous, it should return a promise. If it throws an error or rejects the promise, the error will be passed onto the app's response and error handlers.

```js
import PostgresStoreFactory from 'autonym-postgres-store';
const PostgresStore = PostgresStoreFactory();

class Person extends Model {
  static _init () {
    this.store = new PostgresStore('people');
  }
}
```

#### `._preValidateAgainstSchema(req)`
This function is called during validation before JSON schema validation. It is commonly used to modify the sanitize or normalize the request prior to validating against the schema. If it is asynchronous, it should return a promise. If it throws an error or rejects the promise, the error will be passed onto the app's response and error handlers.

```js
class Person extends Model {
  static _preValidateAgainstSchema (req) {
    req.body.userId = req.user.id;
    req.body.clientId = req.params.clientId;
  }
}
```

#### `._postValidateAgainstSchema(req)`
This function is called during validation after JSON schema validation. At this point, a property named `data` is added to the `req` object, which includes the validated and filtered request body. If it is asynchronous, it should return a promise. If it throws an error or rejects the promise, the error will be passed onto the app's response and error handlers. **Note:** Generally additional manipulation and validation after JSON schemas should be done with *policies* instead of directly in the model class.

```js
class Person extends Model {
  static _postValidateAgainstSchema (req) {
    req.body.updatedAt = new Date();
    if (req.creating) { req.body.createdAt = req.body.updatedAt; }
  }
}
```

#### `._find(query)`
GET requests made to the plural route's root are validated by schemas and policies, then passed through this function. This function accepts the query string, which has been converted to an object by the query string parser. This method *must* return a promise, which should resolve with an array to pass to the client, or reject with an error. If this method is not defined, the client will receive a method not allowed error.

```js
const staticData = [{id: 1, firstName: 'Joe', lastName: 'Schmoe'}, ...];
const limit = 10;

class Person extends Model {
  static _find (query) {
    let page = /^[1-9][0-9]*$/.test(query.page) ? parseInt(query.page, 10) : 1;
    let offset = limit * (page - 1);
    return Promise.resolve(staticData.slice(offset, offset + limit));
  }
}
```

#### `._create(attributes)`
POST requests made to the plural route are validated by schemas and policies, then passed through this function. This function accepts the attributes of the resource to create. This method *must* return a promise, which should resolve to the complete created resource, or reject with an error. If this method is not defined, the client will receive a method not allowed error.

```js
class Person extends Model {
  static _create (attributes) {
    let person = attributes;
    person.id = Date.now();
    staticData.push(person);
    return Promise.resolve(person);
  }
}
```

#### `._findOne(id)`
GET requests made to the plural route followed by a resource id are validated by policies, then passed through this function. This function accepts the resource id. This method *must* return a promise, which should resolve with a singular resource, or reject with an error. If this method is not defined, the client will receive a method not allowed error.

```js
import {NotFoundError} from 'autonym-client-errors';

class Person extends Model {
  static _findOne (id) {
    let id = parseInt(id, 10);
    let person = staticData.filter(p => p.id === id)[0];
    return person ? Promise.resolve(person) : Promise.reject(new NotFoundError(`Person ${id} not found.`));
  }
}
```

#### `._findOneAndUpdate(id, attributes)`
PATCH requests made to the plural route followed by a resource id are validated by schemas and policies, then passed through this function. This function accepts the resource id and an object containing the properties to update. The resource id was already passed to `_findOne()` so the function does not need to verify the resource exists. This method *must* return a promise, which should resolve to the complete updated resource, or reject with an error. If this method is not defined, the client will receive a method not allowed error. **Note:** This function will not work if `_findOne(id)` is not defined.

```js
class Person extends Model {
  static _findOneAndUpdate (id, attributes) {
    let id = parseInt(id, 10);
    let person = staticData.filter(p => p.id === id)[0];
    Object.assign(person, attributes);
    return Promise.resolve(person);
  }
}
```

#### `._findOneAndDelete(id)`
DELETE requests made to the plural route followed by the resource id are validated by policies, then passed through this function. This function accepts the resource id. The method *must* return a promise, which should resolve or reject with an error. If this method is not defined, the client will receive a method not allowed error.

```js
class Person extends Model {
  static _findOneAndDelete (id) {
    let id = parseInt(id, 10);
    for (let i = staticData.length - 1; i--;) {
      if (staticData[i].id === id) {
        staticData.splice(i, 1);
      }
    }
    return Promise.resolve();
  }
}
```

#### `._unserialize(attributes)`
The results of `._find(query)` (each element in the array), `._findOne(id)`, `._create(attributes)`, and `._findOneAndUpdate(id, attributes)` are passed through this function. It should return a new object where the properties have been reformatted to meet the expectations of the API client. A common use case of this function is to convert snake_case column names from a database to camelCase field names.

```js
class Person extends Model {
  static _unserialize (attributes) {
    let object = {};
    for (let attribute in attributes) {
      if (attributes.hasOwnProperty(attribute)) {
        object[attribute.toLowerCase()] = attributes[attribute];
      }
    }
    return object;
  }
}
```

#### `._serialize(attributes)`
The attributes passed into `._create(attributes)` and `._findOneAndUpdate(id, attributes)` are passed through this function. It should return a new object where the properties have been reformatted for storage. A common use case of this function is to convert camelCase field names to snake_case column names for a database.

```js
class Person extends Model {
  static _serialize (attributes) {
    let object = {};
    for (let attribute in attributes) {
      if (attributes.hasOwnProperty(attribute)) {
        object[attribute.toUpperCase()] = attributes[attribute];
      }
    }
    return object;
  }
}
```
