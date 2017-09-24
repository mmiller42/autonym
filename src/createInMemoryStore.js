import AutonymError from './AutonymError'

/**
 * Creates a store that reads and writes data in memory.
 * @returns {Store} A complete set of store methods.
 * @example
 * const Person = new Model({
 *   name: 'person',
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       firstName: { type: 'string' },
 *       lastName: { type: 'string' },
 *     },
 *     required: ['firstName', 'lastName'],
 *   },
 *   store: createInMemoryStore(),
 * })
 *
 * const data = await Person.create({ firstName: 'Matt', lastName: 'Miller' })
 * console.log(data) // { id: '1', firstName: 'Matt', lastName: 'Miller' }
 *
 * const data = await Person.find()
 * console.log(data) // [{ id: '1', firstName: 'Matt', lastName: 'Miller' }]
 *
 * const data = await Person.findOne('1')
 * console.log(data) // { id: '1', firstName: 'Matt', lastName: 'Miller' }
 *
 * const data = await Person.findOneAndUpdate('1', { firstName: 'Matthew' })
 * console.log(data) // { id: '1', firstName: 'Matthew', lastName: 'Miller' }
 *
 * const data = await Person.findOneAndDelete('1')
 * console.log(data) // { id: '1' }
 *
 * try {
 *   await Person.findOne('1')
 * } catch (err) {
 *   console.log(err) // '[NOT_FOUND] Record not found.'
 * }
 */
const createInMemoryStore = () => {
  const records = []
  let counter = 0
  const findRecordIndex = id => {
    const index = records.findIndex(record => record.id === id)
    if (index < 0) {
      throw new AutonymError(AutonymError.NOT_FOUND, 'Record not found')
    }
    return index
  }

  return {
    create: data => records[records.push({ ...data, id: String(++counter) }) - 1],
    find: () => records,
    findOne: id => records[findRecordIndex(id)],
    findOneAndUpdate: (id, data) => Object.assign(records[findRecordIndex(id)], data),
    findOneAndDelete: id => records.splice(findRecordIndex(id), 1)[0],
  }
}

export default createInMemoryStore
