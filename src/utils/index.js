import { difference, forEach, isPlainObject, reduce } from 'lodash'

export function checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
  if (!object) {
    return
  }

  const invalidKeys = difference(Object.keys(object), expectedProperties)
  if (invalidKeys.length !== 0) {
    throw new TypeError(`Unexpected properties on ${parameterName} parameter: "${invalidKeys.join('", "')}".`)
  }
}

export function cloneInstance(instance, newProps) {
  return Object.assign(Object.create(Object.getPrototypeOf(instance)), instance, newProps)
}

export function deleteUndefineds(object) {
  forEach(object, (value, key) => {
    if (typeof value === 'object' && value !== null) {
      deleteUndefineds(value)
    } else if (value === undefined) {
      delete object[key]
    }
  })
}

export function filterToProperties(fullObject, partialObject) {
  return reduce(
    fullObject,
    (result, value, key) => {
      if (key in partialObject) {
        const partialValue = partialObject[key]
        if (isPlainObject(value) && isPlainObject(partialValue)) {
          result[key] = filterToProperties(value, partialValue)
        } else if (Array.isArray(value) && Array.isArray(partialValue)) {
          result[key] = partialValue.map((partialValueItem, i) => filterToProperties(value[i], partialValueItem))
        } else {
          result[key] = partialValue
        }
      }
      return result
    },
    {}
  )
}
