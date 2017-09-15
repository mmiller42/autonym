import AsyncBooleanExpressionEvaluator from 'async-boolean-expression-evaluator'
import AutonymError from '../AutonymError'
import Req from '../Req'
import Res from '../Res'
import { Router as createRouter } from 'express'
import { mapValues } from 'lodash'
import { maybePromise } from '../utils/index'

export default function createStoreMiddleware(model) {
  const modelWithHooks = model.withHooks(createPolicyHooks())

  const router = createRouter({ mergeParams: true })

  router.route('/').post((req, res, next) => callStoreMethod(create, req, res, next))
  router.route('/').get((req, res, next) => callStoreMethod(find, req, res, next))
  router.route('/:id').get((req, res, next) => callStoreMethod(findOne, req, res, next))
  router.route('/:id').patch((req, res, next) => callStoreMethod(findOneAndUpdate, req, res, next))
  router.route('/:id').put((req, res, next) => callStoreMethod(findOneAndUpdate, req, res, next))
  router.route('/:id').delete((req, res, next) => callStoreMethod(findOneAndDelete, req, res, next))

  return router

  function createPolicyHooks() {
    return mapValues(model.getPolicies(), (methods, hook) =>
      mapValues(methods, expression => (req, res, meta, data) => {
        if (hook === 'postStore') {
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
              `Policy operands for model "${model.getName()}" are invalid. Operands may be functions or booleans, received ${typeof operand}.`
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

  function callStoreMethod(method, _req, _res, next) {
    const meta = model.getInitialMeta()
    const req = new Req(_req, model, meta)
    const res = new Res(_res, model, meta)
    method(req, res, meta)
      .then(({ status }) => {
        if (res.getStatus() === null) {
          res.setStatus(status)
        }
        next()
      })
      .catch(err => AutonymError.fromError(err).toClientError())
  }

  function create(req, res, meta) {
    return modelWithHooks.create(req.getData(), meta, [...arguments]).then(() => ({ status: Res.CREATED }))
  }

  function find(req, res, meta) {
    modelWithHooks.find(req.getQuery(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }

  function findOne(req, res, meta) {
    modelWithHooks.findOne(req.getId(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }

  function findOneAndUpdate(req, res, meta) {
    modelWithHooks
      .findOneAndUpdate(req.getId(), req.getData(), req.getCompleteData(), meta, [...arguments])
      .then(() => ({ status: Res.OK }))
  }

  function findOneAndDelete(req, res, meta) {
    modelWithHooks.findOneAndDelete(req.getId(), meta, [...arguments]).then(() => ({ status: Res.OK }))
  }
}
