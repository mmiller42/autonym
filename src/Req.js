import { cloneDeep, isPlainObject } from 'lodash'
import assignDeep from 'assign-deep'
import defaultsDeep from '@nodeutils/defaults-deep'
import { deleteUndefineds } from './utils'

/**
 * A wrapper for the request object with helper methods and access to Autonym model data.
 */
export default class Req {
  /**
   * @param {http.IncomingMessage} raw The raw IncomingMessage object.
   * @param {Model} model The Autonym model instance.
   * @param {Meta} meta The meta object aggregated by policies during the request.
   * @example
   * const req = new AutonymReq(request, Post, meta)
   */
  constructor(raw, model, meta) {
    raw.autonym = this
    raw.autonymMeta = meta

    this._raw = raw
    this._model = model
    this._data = this.hasBody() ? cloneDeep(raw.body) : null
    this._originalData = null
    this._isValidated = false
  }

  /**
   * Gets the raw request.
   * @returns {http.IncomingMessage} The raw request.
   */
  getRaw() {
    return this._raw
  }

  /**
   * Gets the request payload.
   * @returns {Record} The data.
   * @throws {ReferenceError} If the request does not have a body.
   */
  getData() {
    if (!this.hasBody()) {
      throw new ReferenceError('Cannot get request data from a request without a body.')
    }
    return this._data
  }

  /**
   * Merges the request data with the given data, without modifying the original request.
   * @param {Record} data The new properties to set.
   * @param {boolean} [replace] If true, replaces the data on the response instead of merging it.
   * @returns {void}
   * @throws {ReferenceError} If the request does not have a body.
   * @example
   * console.log(req.getData()) // { title: 'Hello World' }
   * req.setData({ name: 'Test' })
   * console.log(req.getData()) // { name: 'Test', title: 'Hello World' }
   * @example
   * console.log(req.getData()) // { title: 'Hello World' }
   * req.setData({ name: 'Test' }, true)
   * console.log(req.getData()) // { name: 'Test' }
   */
  setData(data, replace = false) {
    if (!isPlainObject(data)) {
      throw new TypeError('The data must be a plain object.')
    }
    if (!this.hasBody()) {
      throw new ReferenceError('Cannot set request data on a request without a body.')
    }

    if (replace) {
      this._data = data
    } else {
      assignDeep(this._data, data)
    }

    deleteUndefineds(this._data)
  }

  /**
   * Gets the data that was originally on the request body.
   * @returns {Record} The data.
   * @throws {ReferenceError} If the request does not have a body.
   */
  getRequestData() {
    if (!this.hasBody()) {
      throw new ReferenceError('Cannot get request data from a request without a body.')
    }
    return this.getRaw().body
  }

  /**
   * For update queries, gets the data of the original record to update. For create queries, gets an empty object.
   * @returns {Promise.<Record, AutonymError>} The original record data.
   * @throws {ReferenceError} If the request is not a create or update request.
   * @example
   * console.log(req.getData()) // { title: 'Test' }
   * const originalData = await req.getOriginalData()
   * console.log(originalData) // { title: 'Hello World', body: 'This is my first post.' }
   */
  async getOriginalData() {
    if (!this.isWriting()) {
      throw new ReferenceError('Cannot get original data on a request without a body.')
    }
    if (!this._originalData) {
      this._originalData = this.isCreating() ? {} : this.getModel().findOne(this.getId())
    }
    return this._originalData
  }

  /**
   * Gets the result of merging the original data (see `#getOriginalData`) with the request data.
   * @returns {Promise.<Record, AutonymError>} The merged data.
   * @example
   * console.log(req.getData()) // { title: 'Test' }
   * const originalData = await req.getCompleteData()
   * console.log(originalData) // { title: 'Test', body: 'This is my first post.' }
   */
  async getCompleteData() {
    const originalData = await this.getOriginalData()
    return defaultsDeep(this.getData(), originalData)
  }

  /**
   * Gets the model instance.
   * @returns {Model} The model.
   */
  getModel() {
    return this._model
  }

  /**
   * Gets the request query.
   * @returns {object} The query.
   */
  getQuery() {
    return this.getRaw().query
  }

  /**
   * Gets the requested record id.
   * @returns {string} The record id.
   * @throws {ReferenceError} If it is a create or find request.
   */
  getId() {
    if (!this.hasId()) {
      throw new ReferenceError('Cannot get id of request that creates or finds multiple.')
    }
    return this.getRaw().params.id
  }

  /**
   * Gets the given header.
   * @param {string} header The header to find.
   * @returns {string|undefined} The header value.
   */
  getHeader(header) {
    return this.getRaw().get(header)
  }

  /**
   * Whether this step is occurring with safe data, i.e. the data has been validated, filtered, and populated with
   * defaults.
   * @returns {boolean} True if it has passed the preSchema and validateAgainstSchema steps.
   */
  isValidated() {
    return this._isValidated
  }

  /**
   * Whether this is a create request.
   * @returns {boolean} True if it is a create request.
   */
  isCreating() {
    return this.getRaw().method === 'POST'
  }

  /**
   * Whether this is a find request.
   * @returns {boolean} True if it is a find request.
   */
  isFinding() {
    return this.getRaw().method === 'GET' && !this.getRaw().params.id
  }

  /**
   * Whether this is a findOne request.
   * @returns {boolean} True if it is a findOne request.
   */
  isFindingOne() {
    return this.getRaw().method === 'GET' && this.getRaw().params.id
  }

  /**
   * Whether this is a findOneAndUpdate request.
   * @returns {boolean} True if it is a findOneAndUpdate request.
   */
  isFindingOneAndUpdating() {
    return this.getRaw().method === 'PATCH' || this.getRaw().method === 'PUT'
  }

  /**
   * Whether this is a findOneAndDelete request.
   * @returns {boolean} True if it is a findOneAndDelete request.
   */
  isFindingOneAndDeleting() {
    return this.getRaw().method === 'DELETE'
  }

  /**
   * Whether this is a readonly request to fetch data.
   * @returns {boolean} True if it is a find or findOne request.
   */
  isGetting() {
    return this.isFinding() || this.isFindingOne()
  }

  /**
   * Whether this is a request that will return response data.
   * @returns {boolean} True if it is a create, find, findOne, or findOneAndUpdate request.
   */
  isReading() {
    return !this.isFindingOneAndDeleting()
  }

  /**
   * Whether this request has a body.
   * @returns {boolean} True if it is a create or findOneAndUpdate request.
   */
  hasBody() {
    return this.isCreating() || this.isFindingOneAndUpdating()
  }

  /**
   * Whether this is a request that will modify the data store.
   * @returns {boolean} True if it is a create, findOneAndUpdate, or findOneAndDelete request.
   */
  isWriting() {
    return this.hasBody() || this.isFindingOneAndDeleting()
  }

  /**
   * Whether this is a request for a particular record.
   * @returns {boolean} True if it is a findOne, findOneAndUpdate, or findOneAndDelete request.
   */
  hasId() {
    return this.isFindingOne() || this.isFindingOneAndUpdating() || this.isFindingOneAndDeleting()
  }
}
