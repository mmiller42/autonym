import AsyncBooleanExpressionEvaluator from 'async-boolean-expression-evaluator'
import AutonymError from '../AutonymError'
import Req from '../Req'
import Res from '../Res'
import { Router as createRouter } from 'express'
import { mapValues } from 'lodash'

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
      mapValues(methods, expression => async (req, res, meta, data) => {
        if (hook === 'postSchema') {
          if (data) {
            req.setData(data, true)
          }
          req._isValidated = true
        } else if (hook === 'postStore') {
          res.setData(data)
          res._isPopulated = true
        }

        return evaluatePolicies(expression, req, res, meta)
      })
    )
  }

  async function evaluatePolicies(expression, req, res, meta) {
    let lastError = null
    const evaluator = new AsyncBooleanExpressionEvaluator(async operand => {
      if (typeof operand === 'function') {
        try {
          await operand(req, res, meta)
          return true
        } catch (err) {
          // `err` may be undefined if this is the result of a `not` expression
          lastError = err
          return false
        }
      } else if (typeof operand === 'boolean') {
        if (operand) {
          return true
        } else {
          // If operand is just false, use generic error
          lastError = new AutonymError(AutonymError.FORBIDDEN, 'This action may not be performed.')
          return false
        }
      } else {
        throw new TypeError(
          `Policy operands for model "${model.getName()}" are invalid. Operands may be functions or booleans, received ${typeof operand}.`
        )
      }
    })

    const result = await evaluator.execute(expression)
    if (!result) {
      throw lastError || new AutonymError(AutonymError.FORBIDDEN, 'This action may not be performed.')
    }
    return true
  }

  async function callStoreMethod(method, _req, _res, next) {
    const meta = model.getInitialMeta()
    const req = new Req(_req, model, meta)
    const res = new Res(_res, model, meta)

    let err = null
    try {
      const { status } = await method(req, res, meta)
      if (res.getStatus() === null) {
        res.setStatus(status)
      }
    } catch (_err) {
      err = AutonymError.fromError(_err).toClientError()
    }

    next(err)
  }

  async function create(req, res, meta) {
    await modelWithHooks.create(req.getData(), meta, [req, res, meta])
    return { status: Res.CREATED }
  }

  async function find(req, res, meta) {
    await modelWithHooks.find(req.getQuery(), meta, [req, res, meta])
    return { status: Res.OK }
  }

  async function findOne(req, res, meta) {
    await modelWithHooks.findOne(req.getId(), meta, [req, res, meta])
    return { status: Res.OK }
  }

  async function findOneAndUpdate(req, res, meta) {
    const completeData = await req.getCompleteData()
    await modelWithHooks.findOneAndUpdate(req.getId(), req.getData(), completeData, meta, [req, res, meta])
    return { status: Res.OK }
  }

  async function findOneAndDelete(req, res, meta) {
    await modelWithHooks.findOneAndDelete(req.getId(), meta, [req, res, meta])
    return { status: Res.OK }
  }
}
