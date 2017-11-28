import { difference, forEach, get, isPlainObject, reduce, set } from 'lodash'

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

export function filterToProperties(fullObject, partialObject, additionalProperties = []) {
  const filteredObject = reduce(
    fullObject,
    (result, value, key) => {
      if (key in partialObject) {
        const partialValue = partialObject[key]
        if (isPlainObject(value) && isPlainObject(partialValue)) {
          result[key] = filterToProperties(value, partialValue, null)
        } else if (Array.isArray(value) && Array.isArray(partialValue)) {
          result[key] = partialValue.map((partialValueItem, i) => {
            if (isPlainObject(partialValueItem)) {
              return filterToProperties(value[i], partialValueItem, null)
            } else {
              return partialValueItem
            }
          })
        } else {
          result[key] = partialValue
        }
      }

      return result
    },
    {}
  )

  if (additionalProperties != null) {
    additionalProperties.forEach(property => {
      const value = get(partialObject, property)
      if (value !== undefined) {
        set(filteredObject, property, value)
      }
    })
  }

  return filteredObject
}
