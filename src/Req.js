import { cloneDeep, defaultsDeep, get, set } from 'lodash'

export default class Req {
  constructor(raw, model, meta) {
    raw.autonym = this
    raw.autonymMeta = meta

    this._raw = raw
    this._model = model
    this._data = this.hasBody() ? cloneDeep(raw.body) : null
    this._originalData = null
  }

  getRaw() {
    return this._raw
  }

  getData(key = null) {
    if (!this.hasBody()) {
      throw new ReferenceError('Cannot get request data from readonly request.')
    }
    return key ? get(this._data, key) : this._data
  }

  setData(...args) {
    if (!this.hasBody()) {
      throw new ReferenceError('Cannot set request data on readonly request.')
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

  getOriginalData() {
    if (!this.isWriting()) {
      throw new ReferenceError('Cannot get original data on readonly request.')
    }
    if (!this._originalData) {
      this._originalData = this.isCreating() ? Promise.resolve({}) : this.getModel().findOne(this.getId())
    }
    return this._originalData
  }

  getCompleteData() {
    return this.getOriginalData().then(data => defaultsDeep({}, this.getData(), data))
  }

  getModel() {
    return this._model
  }

  getQuery() {
    return this.getRaw().query
  }

  getId() {
    if (!this.hasId()) {
      throw new ReferenceError('Cannot get id of request that creates or finds multiple.')
    }
    return this.getRaw().params.id
  }

  getHeader(header) {
    return this.getRaw().get(header)
  }

  isFinding() {
    return this.getRaw().method === 'GET' && !this.getRaw().params.id
  }

  isFindingOne() {
    return this.getRaw().method === 'GET' && this.getRaw().params.id
  }

  isCreating() {
    return this.getRaw().method === 'POST'
  }

  isFindingOneAndUpdating() {
    return this.getRaw().method === 'PATCH' || this.getRaw().method === 'PUT'
  }

  isFindingOneAndDeleting() {
    return this.getRaw().method === 'DELETE'
  }

  isGetting() {
    return this.isFinding() || this.isFindingOne()
  }

  isReading() {
    return !this.isFindingOneAndDeleting()
  }

  hasBody() {
    return this.isCreating() || this.isFindingOneAndUpdating()
  }

  isWriting() {
    return this.hasBody() || this.isFindingOneAndDeleting()
  }

  hasId() {
    return this.isFindingOne() || this.isFindingOneAndUpdating() || this.isFindingOneAndDeleting()
  }
}
