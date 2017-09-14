import AsyncBooleanExpressionEvaluator from 'async-boolean-expression-evaluator'
import { mapValues } from 'lodash'
import maybePromiseFactory from 'maybe-promise-factory'
import { Router as createRouter } from 'express'
import Req from '../Req'
import Res from '../Res'
import { POST_STORE } from '../utils/policyHookConstants'
import AutonymError from '../AutonymError'

const maybePromise = maybePromiseFactory()

export class ModelMiddleware {
  constructor(model) {
    this._model = model
    this._modelWithHooks = model.withHooks(this._createPolicyHooks())
    this._createRouter()
  }

  getModel() {
    return this._model
  }

  getRouter() {
    return this._router
  }

  _createPolicyHooks() {
    return mapValues(this.getModel().getPolicies(), (methods, hook) =>
      mapValues(methods, expression => (req, res, meta, data) => {
        if (hook === POST_STORE) {
          res.setData(req.isFindingOneAndDeleting() ? { id: req.getId() } : data)
          res._isPopulated = true
        }

        let lastError = null
        const evaluator = new AsyncBooleanExpressionEvaluator(operand => {
          let policy = null
          if (typeof operand === 'function') {
            policy = maybePromise(() => operand(req, res, meta))
              .then(() => Promise.resolve(true))
              .catch(err => {
                // `err` may be undefined if this is the result of a `not` expression
                lastError = err
                return Promise.resolve(false)
              })
          } else if (typeof operand === 'boolean') {
            policy = Promise.resolve(operand).then(() => {
              if (!operand) {
                // If operand is just false, use generic error
                lastError = new AutonymError(AutonymError.FORBIDDEN, 'This action may not be performed.')
              }
            })
          } else {
            throw new TypeError(
              `Policy operands for model "${this.getModel().getName()}" are invalid. Operands may be functions or booleans, received ${typeof operand}.`
            )
          }

          return policy
        })
        return evaluator.execute(expression).then(result => {
          if (!result) {
            throw lastError || new AutonymError(AutonymError.FORBIDDEN, 'This action may not be performed.')
          }
        })
      })
    )
  }

  _createRouter() {
    this._router = createRouter({ mergeParams: true })

    this._router.route('/').post((req, res, next) => this._callStoreMethod('create', req, res, next))
    this._router.route('/').get((req, res, next) => this._callStoreMethod('find', req, res, next))
    this._router.route('/:id').get((req, res, next) => this._callStoreMethod('findOne', req, res, next))
    this._router.route('/:id').patch((req, res, next) => this._callStoreMethod('findOneAndUpdate', req, res, next))
    this._router.route('/:id').put((req, res, next) => this._callStoreMethod('findOneAndUpdate', req, res, next))
    this._router.route('/:id').delete((req, res, next) => this._callStoreMethod('findOneAndDelete', req, res, next))
  }

  _callStoreMethod(method, _req, _res, next) {
    const meta = this.getModel().getInitialMeta()
    const req = new Req(_req, this.getModel(), meta)
    const res = new Res(_res, this.getModel(), meta)
    this[`_${method}`](req, res, meta)
      .then(({ status }) => {
        if (res.getStatus() === null) {
          res.setStatus(status)
        }
        next()
      })
      .catch(err => AutonymError.fromError(err).toClientError())
  }

  _create(req, res, meta) {
    return this._modelWithHooks.create(req.getData(), meta, [...arguments]).then(() => ({ status: Res.CREATED }))
  }

  _find(req, res, meta) {
    this._modelWithHooks.find(req.getQuery(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }

  _findOne(req, res, meta) {
    this._modelWithHooks.findOne(req.getId(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }

  _findOneAndUpdate(req, res, meta) {
    this._modelWithHooks
      .findOneAndUpdate(req.getId(), req.getData(), req.getCompleteData(), meta, [...arguments])
      .then(() => ({ status: Res.OK }))
  }

  _findOneAndDelete(req, res, meta) {
    this._modelWithHooks.findOneAndDelete(req.getId(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }
}

export default function modelMiddleware(model) {
  return new ModelMiddleware(model).getRouter()
}
