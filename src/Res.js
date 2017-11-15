import HTTP from 'http-status-codes'
import assignDeep from 'assign-deep'
import { deleteUndefineds } from './utils'
import { isPlainObject } from 'lodash'

/**
 * A wrapper for the response object with helper methods and access to Autonym model data.
 */
export default class Res {
  /**
   * The status code for successful find, findOne, findOneAndUpdate, and findOneAndDelete calls.
   * @type {number}
   * @constant
   */
  static OK = HTTP.OK

  /**
   * The status code for successful create calls.
   * @type {number}
   * @constant
   */
  static CREATED = HTTP.CREATED

  /**
   * @param {http.ServerResponse} raw The raw ServerResponse object.
   * @param {Model} model The Autonym model instance.
   * @param {Meta} meta The meta object aggregated by policies during the request.
   * @example
   * const res = new AutonymRes(response, Post, meta)
   */
  constructor(raw, model, meta) {
    raw.autonym = this
    raw.autonymMeta = meta

    this._raw = raw
    this._model = model
    this._data = null
    this._status = null
    this._isPopulated = false
  }

  /**
   * Gets the raw response.
   * @returns {http.ServerResponse} The raw response.
   */
  getRaw() {
    return this._raw
  }

  /**
   * Gets the data currently set for the response body.
   * @returns {Record} The data.
   * @throws {ReferenceError} If the store method has not been called yet.
   */
  getData() {
    if (!this.isPopulated()) {
      throw new ReferenceError('Cannot get response data before store method has been called.')
    }
    return this._data
  }

  /**
   * Merges the currently set response data with the given data.
   * @param {Record} data The new properties to set.
   * @param {boolean} [replace] If true, replaces the data on the response instead of merging it.
   * @returns {void}
   * @throws {ReferenceError} If the store method has not been called yet.
   * @example
   * console.log(res.getData()) // { title: 'Hello World' }
   * res.setData({ name: 'Test' })
   * console.log(res.getData()) // { name: 'Test', title: 'Hello World' }
   * @example
   * console.log(res.getData()) // { title: 'Hello World' }
   * res.setData({ name: 'Test' }, true)
   * console.log(res.getData()) // { name: 'Test' }
   */
  setData(data, replace = false) {
    if (!this.isPopulated()) {
      throw new ReferenceError('Cannot set response data before store method has been called.')
    }

    if (replace) {
      this._data = data
      deleteUndefineds(this._data)
    } else if (Array.isArray(this._data)) {
      if (!Array.isArray(data)) {
        throw new TypeError('The data must be an array.')
      }

      this._data.forEach((record, i) => {
        assignDeep(record, data[i] || {})
        deleteUndefineds(record)
      })
    } else {
      if (!isPlainObject(data)) {
        throw new TypeError('The data must be a plain object.')
      }
      this._data = assignDeep(this._data, data)
      deleteUndefineds(this._data)
    }
  }

  _setErrorData(data) {
    this._data = data
  }

  /**
   * Gets the currently set status code.
   * @returns {number|null} The status code.
   */
  getStatus() {
    return this._status
  }

  /**
   * Sets the status code.
   * @param {number} status The status code.
   * @returns {void}
   */
  setStatus(status) {
    if (typeof status !== 'number') {
      throw new TypeError('The status must be a number.')
    }
    this._status = status
  }

  /**
   * Gets the model instance.
   * @returns {Model} The model.
   */
  getModel() {
    return this._model
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
   * Sets the given header.
   * @param {string} header The header to set.
   * @param {string} value The value to set to.
   * @returns {void}
   */
  setHeader(header, value) {
    if (typeof header !== 'string') {
      throw new TypeError('The header must be a string')
    }
    if (typeof value !== 'string') {
      throw new TypeError('The value must be a string')
    }
    return this.getRaw().set(header, value)
  }

  /**
   * Whether the store method has populated the response data yet.
   * @returns {boolean} True if the store method has been called.
   */
  isPopulated() {
    return this._isPopulated
  }

  /**
   * Whether the response has been sent to the client.
   * @returns {boolean} True if the response has been sent.
   */
  isSent() {
    return this.getRaw().headerSent
  }
}
