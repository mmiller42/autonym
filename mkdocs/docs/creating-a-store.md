# Creating a Store

Stores are a way of separating specific code for persisting data from models to make it more reusable and keep it from
cluttering your business logic.

Stores define a lot of the same methods as models, so they're easy to implement if you have built a model. A model that
uses a store can instantiate it in the `_init` method and then clone the methods from the store onto the model if they
are named the same by using `_implementDefaultStoreCrudMethods​`.

Like model methods, stores should depend on `autonym-client-errors` and throw subclasses of ClientError when applicable.

Stores can define any methods they want, but if they implement the methods defined in the list below, they can be
automatically copied to the model that uses the store, which reduces the amount of scaffolding developers need to get it
up and running.

The methods in this list can be automatically copied to models that are using the store. They have identical
signatures to the methods described in the [Model Implementation API](../model#implementation-api), but they are
not prefixed with an `_` like the model methods.

## Methods

* \#find(query, filter)
* \#findOne(resourceId, filter)
* \#create(attributes)
* \#findOneAndUpdate(resourceId, attributes, filter, completeResource)
* \#findOneAndDelete(resourceId, filter)
* \#serialize(attributes)
* \#unserialize(attributes)

## Example

This is a simple example of an in-memory store implementation and usage.

### Store

```js
import {NotFoundError} from 'autonym-client-errors';

class InMemoryStore {
  constructor () {
    this._records = [];
    this._recordsById = {};
    this._counter = 0;
  }

  create (attributes) {
    const id = ++this._counter;
    const record = {...attributes, id};
    this._records.push(record);
    this._recordsById[id] = record;
    return Promise.resolve(record);
  }

  find (query) {
    return Promise.resolve(this._records);
  }

  findOne (id) {
    const record = this._recordsById[id];
    if (record) {
      return Promise.resolve(record);
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }

  findOneAndUpdate (id, attributes) {
    const record = this._recordsById[id];
    if (record) {
      return Promise.resolve(Object.assign(record, attributes));
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }

  findOneAndDelete (id) {
    const record = this._recordsById[id];
    const index = this._records.indexOf(record);
    if (index > -1) {
      this._records.splice(index, 1);
      delete this._recordsById[id];
      return Promise.resolve(null);
    } else {
      return Promise.reject(new NotFoundError('No resource found that meets the given criteria.'));
    }
  }
}

export default InMemoryStore;
```

### Model

```js
import {Model} from 'autonym';
import InMemoryStore from '../stores/in-memory.store';

class Person extends Model {
  static _init () {
    super._implementDefaultStoreCrudMethods(new InMemoryStore());
  }
}

export default Person;
```
