import { defaultsDeep, get, set } from 'lodash'
import HTTP from 'http-status-codes'

export default class Res {
  static OK = HTTP.OK
  static CREATED = HTTP.CREATED

  constructor(raw, model, meta) {
    raw.autonym = this
    raw.autonymMeta = meta

    this._raw = raw
    this._model = model
    this._data = null
    this._status = null
    this._isPopulated = false
  }

  getRaw() {
    return this._raw
  }

  getData(key = null) {
    if (!this.isPopulated()) {
      throw new ReferenceError('Cannot get response data before store method has been called.')
    }
    return key ? get(this._data, key) : this._data
  }

  setData(...args) {
    if (!this.isPopulated()) {
      throw new ReferenceError('Cannot set response data before store method has been called.')
    }

    if (args.length === 1) {
      const [data] = args
      this._data = defaultsDeep(this._data, data)
    } else {
      const [key, value] = args
      set(this._data, key, value)
    }

    return this._data
  }

  getStatus() {
    return this._status
  }

  setStatus(status) {
    this._status = status
  }

  getModel() {
    return this._model
  }

  getHeader(header) {
    return this.getRaw().get(header)
  }

  setHeader(header, value) {
    return this.getRaw().set(header, value)
  }

  isPopulated() {
    return this._isPopulated
  }

  isSent() {
    return this.getRaw().headerSent
  }
}
