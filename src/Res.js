import HTTP from 'http-status-codes'
import { defaultsDeep } from 'lodash'

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
   * @returns {Resource} The data.
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
   * @param {Resource} data The new properties to set.
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

    this._data = replace || Array.isArray(data) ? data : defaultsDeep(this._data, data)
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
