# Model

Autonym requests resolve to create, read, update, and delete actions against a model specified in the route. Autonym
takes a model class and generates a thin controller on top of it, which manages HTTP requests and automates common tasks
like validation and routing.

Developer-defined models in Autonym extend from the abstract `Model` class, which is exported from the library. If the
model class defines properties and methods with certain names, then Autonym will use them when actions are requested.

Autonym model classes have only static methods and are never instantiated.

## Implementation API

### .models

A static property that is already set by Autonym. It has references to the other models so that you can call methods on
other models within this model's functions, e.g. `this.models.Animal.findOne('123').then(...)`.

### .route

A static property called `route` can be used to define the part of the URL path that is the root for CRUD actions
against this model. For example:

```js
class Person extends Model {}
Person.route = 'persons';

export default Person;
```

Autonym will define routes like `/persons/` and `/persons/:id` that will map to this model's actions. Note that this
property must be unique per model, or the first model defined with the given route will override any others.

If this property is not set, it defaults to "pluralizing" the model's name using the
[inflection](https://github.com/dreamerslab/node.inflection) library, so in the previous example, the default value is
`people`.

### ._init()

If the class has a static method named `_init`, it will be called by Autonym when the app is starting up. This function
is only called once on the model. A common use case is to establish a connection with a database. If this method returns
a promise, then the app will not be considered "ready" until the promise resolves.

### ._implementDefaultStoreCrudMethods​(store, methods)

Unlike the other methods in this section, this is inherited from the abstract Model class. This method can be called in
`_init`.

Copies methods on the store object onto the class. Copies the given methods, or defaults to copying `find`, `findOne`,
`create`, `findOneAndUpdate`, `findOneAndDelete`, `serialize`, and `unserialize`. It will not copy the method if it does
not exist on the store, and it will not copy any methods explicitly defined on the class already (e.g. it will not
overwrite `_find` if it is already defined).

### ._create(attributes)

If the class has a static method named `_create`, it will be called by Autonym during a POST request to `/:modelRoute`
after all validation has passed. It accepts a parameter `attributes`, which is all the attributes to add to the new
resource. This object has been filtered by the JSON schema. It has also been passed through the `serialize` function
(see `_serialize` in this section).

This method *must* return a promise. If the promise resolves, it must return an object that is the complete
representation of the resource, which will be passed to `unserialize` (see `_unserialize` in this section). It can also
reject with an error. If the error was client-caused, it should reject with a subclass of
`autonym-client-errors.ClientError`.

If this method is not set, then the client will receive a 405 method not allowed error.

### ._find(query, filter)

If the class has a static method named `_find`, it will be called by Autonym during a GET request to `/:modelRoute`
after all validation has passed. It accepts an object `query`, which is simply the query string parameters for
searching, sorting, and paginating. It is also passed a `filter` object, which contains an array of "filters," which can
be added by policies. Neither of these objects has a set definition; the query is everything from the query string and
the filter is an array containing anything that was added by policies.

This method *must* return a promise. If the promise resolves, it must return an array of resources, each of which will
be passed to `unserialize` (see `_unserialize` in this section). It can also reject with an error. If the error was
client-caused, it should reject with a subclass of `autonym-client-errors.ClientError`.

If this method is not set, then the client will receive a 405 method not allowed error.

### ._findOne(resourceId, filter)

If the class has a static method named `_findOne`, it will be called by Autonym during a GET request to
`/:modelRoute/:resourceId` after all validation has passed. It accepts a parameter `resourceId`, which is the id of the
resource to fetch. It is also passed a `filter` object, which contains an array of "filters," which can be added by
policies.

This method *must* return a promise. If the promise resolves, it must return an object that is the complete
representation of the resource, which will be passed to `unserialize` (see `_unserialize` in this section). It can also
reject with an error. If the error was client-caused, it should reject with a subclass of
`autonym-client-errors.ClientError`.

If this method is not set, then the client will receive a 405 method not allowed error. **Note:** This method is a
prerequisite for `_findOneAndUpdate`, which will not work if this function is not defined.

### ._findOneAndUpdate(resourceId, attributes, filter, completeResource)

If the class has a static method named `_findOneAndUpdate`, it will be called by Autonym during a PATCH or PUT request
to `/:modelRoute/:resourceId` after all validation has passed. It accepts a parameter `resourceId`, which is the id of
the resource to fetch. It accepts a second parameter `attributes`, which is all the attributes to be updated. This
object has been filtered by the JSON schema. It has also been passed through the `serialize` function (see `_serialize`
in this section). Third, it is passed a `filter` object, which contains an array of "filters," which can be added by
policies. Finally, it accepts the `completeResource`, which is the changed attributes merged with the results of
`_findOne()`.

This method *must* return a promise. If the promise resolves, it must return an object that is the complete
representation of the resource, which will be passed to `unserialize` (see `_unserialize` in this section). It can also
reject with an error. If the error was client-caused, it should reject with a subclass of
`autonym-client-errors.ClientError`.

If this method is not set, then the client will receive a 405 method not allowed error.

### ._findOneAndDelete(resourceId, filter)

If the class has a static method named `_findOneAndDelete`, it will be called by Autonym during a DELETE request to
`/:modelRoute/:resourceId` after all validation has passed. It accepts a parameter `resourceId`, which is the id of the
resource to delete. It is also passed a `filter` object, which contains an array of "filters," which can be added by
policies.

This method *must* return a promise. If the promise resolves, the client will be sent no content. It can also reject
with an error. If the error was client-caused, it should reject with a subclass of `autonym-client-errors.ClientError`.

If this method is not set, then the client will receive a 405 method not allowed error.

### ._serialize(attributes)

If the class has a static method named `_serialize`, it will be called by Autonym for create and update actions after
all validation is passed. It is a convenience method that should return a new object that will be passed to the
`_create` and `_findOneAndUpdate` functions. A common use case for this function is to map fields on the request object
to column names. It must return a new object.

### ._unserialize(attributes)

If the class has a static method named `_unserialize`, it will be called by Autonym for all actions that return
resources to the client after successful operations. It is a convenience method that should return a new object that
will be sent to the client. A common use case for this function is to map column names from a database to model
attributes. It must return a new object.

### ._preValidateAgainstSchema(req)

If the class has a static method named `_preValidateAgainstSchema`, it will be called by Autonym *before* validation
against the JSON schema is performed. This method is called for operations that create a new resource or update an
existing resource and therefore have a body to validate. *It is called even if the model has no schema.* A common use
case is to add a computed property to the body of the request. It can return a promise for asynchronous operations. It
is passed the `req` object.

### ._postValidateAgainstSchema(req)

If the class has a static method named `_postValidateAgainstSchema`, it will be called by Autonym *after* validation
against the JSON schema is performed. This method is called for operations that create a new resource or update an
existing resource and therefore have a body to validate. *It is called even if the model has no schema.* Generally
post-schema validation should be handled by policies instead of this hook. It can return a promise for asynchronous
operations. It is passed the `req` object.

### ._preValidateAgainstPolicies(req)

If the class has a static method named `_preValidateAgainstPolicies`, it will be called by Autonym *before* validation
against policies is performed. This method is called for any operation. (For create and update operations, it is called
after schema validation and hooks.) *It is called even if the operation has no corresponding policies.* It can return a
promise for asynchronous operations. It is passed the `req` object.

### ._postValidateAgainstPolicies(req)

If the class has a static method named `_postValidateAgainstPolicies`, it will be called by Autonym *after* validation
against policies is performed. This method is called for any operation. *It is called even if the operation has no
corresponding policies.* It can return a promise for asynchronous operations. It is passed the `req` object.

## Public API

The model inherits from the abstract Model class, which has a number of methods on it which can be called in your code
when you want to interact with a model programmatically.

### .validate(req)

This function performs schema and policy validation, given a request, and returns a promise that resolves or rejects
with an error.

### .doSchemaValidation(req)

This function performs schema validation, given a request, along with the pre- and post-hooks if they are defined. It
returns a promise that resolves or rejects with an error. For create and update actions, it adds a `data` property on
the request object. For update actions, it also adds a `completeResource` object, which represents the full resource
(contrasted to `data`, which is only the attributes the user specified in the request).

### .doPolicyValidation(req)

This function performs policy validation, given a request, along with pre- and post-hooks if they are defined. It
returns a promise that resolves or rejects with an error.

### .create(body, filter)

Calls `_create` with the serialized body and filter and returns the promise after unserializing the result, or rejects
with a method not implemented error.

### .find(query, filter)

Calls `_find` with given query and filter and returns the promise after unserializing the results, or rejects with a
method not implemented error.

### .findOne(resourceId, filter)

Calls `_findOne` with the id and filter and returns the promise after unserializing the result, or rejects with a method
not implemented error.

### .findOneAndUpdate(resourceId, body, filter, completeResource)

Calls `_findOneAndUpdate` with the id, serialized body, and filter and returns the promise after unserializing the
result, or rejects with a method not implemented error.

### .findOneAndDelete(resourceId, filter)

Calls `_findOneAndDelete` with the id and filter and returns the promise, or rejects with a method not implemented
error.

### .serialize(attributes)

Clones the given attributes and passes them to `_serialize` (if defined) before returning the result.

### .unserialize(attributes)

Clones the given attributes and passes them to `_unserialize` (if defined) before returning the result.

### .evaluatePolicies(expression, req)

Evaluates the given asynchronous boolean expression against the request. Returns a promise that resolves or rejects with
a policy error.

## In-memory model example

This is an example of a model that simply stores person objects in memory.

```js
import {Model} from 'autonym';
import {NotFoundError} from 'autonym-client-errors';

class Todo extends Model {
  static _create (attributes) {
    const id = ++Todo._counter;
    const todo = {...attributes, id};
    Todo._todos.push(todo);
    Todo._todosById[id] = todo;
    return Promise.resolve(todo);
  }
  
  static _find (query) {
    return Promise.resolve(Todo._todos);
  }
  
  static _findOne (id) {
    const todo = Todo._todosById[id];
    if (todo) {
      return Promise.resolve(todo);
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }
  
  static _findOneAndUpdate (id, attributes) {
    const todo = Todo._todosById[id];
    if (todo) {
      return Promise.resolve(Object.assign(todo, attributes));
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }
  
  static _findOneAndDelete (id) {
    const todo = Todo._todosById[id];
    const index = Todo._todos.indexOf(todo);
    if (index > -1) {
      Todo._todos.splice(index, 1);
      delete Todo._todosById[id];
      return Promise.resolve(null);
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }
}

Todo._todos = [];
Todo._todosById = {};
Todo._counter = 0;

export default Todo;
```

