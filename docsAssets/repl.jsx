const source = `
require('express')
const express = require('@runkit/runkit/express-endpoint/1.0.0') // Needed for RunKit
const bodyParser = require('body-parser')
const cors = require('cors')
const { Model, createInMemoryStore, createModelMiddleware, createResponderMiddleware } = require('autonym')

const app = express(module.exports) // Needed for RunKit

// Mount other Express middleware
app.use(cors())
app.use(bodyParser.json({}))

// Create a new model
const Person = new Model({
  name: 'person',
  schema: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
    required: ['firstName', 'lastName'],
  },
  // A simple store implementation that saves data in memory
  store: createInMemoryStore(),
})

// Mount Autonym middleware
app.use(createModelMiddleware({ models: [Person] }))
app.use(createResponderMiddleware())

// Express' default error middleware prints errors; if an uncaught exception is thrown (that wasn't a client error),
// we should crash the app.
app.use((err, req, res, next) => {
  if (!err.isAutonymError || !err.isClientError()) {
    console.error(err)
    process.exit(1)
  }
})
`.trim()

class Repl extends React.PureComponent {
  constructor(props) {
    super(props)

    this.state = { endpointUrl: null }
    this.handleUrlChange = this.handleUrlChange.bind(this)
  }

  handleUrlChange(event) {
    this.setState({ endpointUrl: event.endpointURL })
  }

  render() {
    const { endpointUrl } = this.state

    return (
      <div className="grid">
        <div className="grid-cell">
          <RunkitComponent
            options={{
              source,
              mode: 'endpoint',
              nodeVersion: '^8.5.0',
              onURLChanged: this.handleUrlChange,
            }}
          />
        </div>
        <div className="grid-cell">
          {endpointUrl && <Curler endpointUrl={endpointUrl} />}
        </div>
      </div>
    )
  }
}

class RunkitComponent extends React.Component {
  constructor(props) {
    super(props)

    this.bindRef = this.bindRef.bind(this)
  }

  shouldComponentUpdate() {
    return false
  }

  componentDidMount() {
    const { options } = this.props

    this.notebook = RunKit.createNotebook(Object.assign({}, options, { element: this.container }))
  }

  componentWillUnmount() {
    this.notebook.destroy()
    this.notebook = null
  }

  bindRef(ref) {
    this.container = ref
  }

  render() {
    return (
      <div className="runkit" ref={this.bindRef} />
    )
  }
}

class Curler extends React.PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      method: 'GET',
      route: 'people',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      body: '{}',
      result: null,
    }

    this.codeMirror = null

    this.handleMethodChange = this.handleMethodChange.bind(this)
    this.handleRouteChange = this.handleRouteChange.bind(this)
    this.handleBodyChange = this.handleBodyChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.addHeader = this.addHeader.bind(this)
    this.removeHeader = this.removeHeader.bind(this)
    this.changeHeaderName = this.changeHeaderName.bind(this)
    this.changeHeaderValue = this.changeHeaderValue.bind(this)
  }

  handleMethodChange(event) {
    this.setState({ method: event.target.value })
  }

  handleRouteChange(event) {
    this.setState({ route: event.target.value })
  }

  handleBodyChange(body) {
    this.setState({ body })
  }

  handleSubmit(event) {
    event.preventDefault()
    const { endpointUrl } = this.props
    const { headers, route, method, body } = this.state

    const requestHeaders = new Headers()
    headers.forEach(header => {
      if (header.name !== '') {
        requestHeaders.append(header.name, header.value)
      }
    })

    fetch(`${endpointUrl}/${route}`, {
      method: method,
      headers: requestHeaders,
      body: ['POST', 'PATCH'].indexOf(method) > -1 ? body : undefined,
    })
      .then(response =>
        response.json().then(data => ({ status: response.status, statusText: response.statusText, data }))
      )
      .then(result => this.setState({ result }))
  }

  addHeader() {
    this.setState(state => ({ headers: [...state.headers, { name: '', value: '' }] }))
  }

  removeHeader(index) {
    this.setState(state => ({ headers: state.headers.filter((header, i) => i !== index) }))
  }

  changeHeaderName(index, name) {
    this.setState(state => ({
      headers: state.headers.map((header, i) => i === index ? { ...header, name } : header)
    }))
  }

  changeHeaderValue(index, value) {
    this.setState(state => ({
      headers: state.headers.map((header, i) => i === index ? { ...header, value } : header)
    }))
  }

  render() {
    const { method, route, headers, body, result } = this.state

    return (
      <form onSubmit={this.handleSubmit} className="curler">
        <div className="inputGroup">
          <select value={method} onChange={this.handleMethodChange} required className="input input_large curler-method">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <div className="curler-divider curler-divider_hugRight">/</div>
          <input type="text" value={route} onChange={this.handleRouteChange} className="input input_large curler-route" value="people" />
          <button type="submit" title="Send" className="button button_large button_primary curler-submit">⇨</button>
        </div>
        <fieldset className="fieldset">
          <legend>
            <div className="bar">
              <div className="bar-cell"><h5>Headers</h5></div>
              <div className="bar-cell">
                <button title="Add header" type="button" onClick={this.addHeader} className="button curler-addHeader">+</button>
              </div>
            </div>
          </legend>
          <ul className="plainList curler-headers">
            {headers.map((header, i) => (
              <li key={i} className="curler-header">
                <div className="inputGroup">
                  <input type="text" value={headers[i].name} onChange={event => this.changeHeaderName(i, event.target.value)} required={headers[i].value !== ''} className="input curler-header-name" placeholder="Name" />
                  <span className="curler-divider curler-divider_hugLeft">:</span>
                  <input type="text" value={headers[i].value} onChange={event => this.changeHeaderValue(i, event.target.value)} required={headers[i].name !== ''} className="input curler-header-value" placeholder="Value" />
                  <button type="button" onClick={() => this.removeHeader(i)} className="button curler-removeHeader">−</button>
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="grid">
          <div className="grid-cell grid-cell_1of2 grid-cell_flush">
            <div className={`codemirror ${['POST', 'PATCH'].indexOf(method) === -1 ? ' hidden': ''}`}>
              <h5>Body</h5>
              <CodeMirrorComponent
                value={body}
                onChange={this.handleBodyChange}
                options={{
                  mode: { name: "javascript", json: true },
                  tabSize: 2,
                  matchBrackets: true,
                  autoCloseBrackets: true,
                }}
              />
            </div>
          </div>
          {result
            ? (
              <div className="grid-cell grid-cell_1of2 grid-cell_flush">
                <div className="width100">
                  <h5>Result</h5>
                  <div className={`curler-result curler-result_${String(result.status).charAt(0) === '2' ? 'success' : 'error'}`}>
                    <div className="width100">
                      <div className="curler-result-status">
                        <div className="curler-result-status-code">{result.status}</div>
                        <div className="curler-result-status-text">{result.statusText}</div>
                      </div>
                      <pre className="curler-result-data">{JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )
            : (
              <div className="grid-cell grid-cell_1of2 grid-cell_flush" />
            )
          }
        </div>
      </form>
    )
  }
}

function normalizeLineEndings(str) {
  return str ? str.replace(/\r\n|\r/g, '\n') : ''
}

class CodeMirrorComponent extends React.Component {
  constructor(props) {
    super(props)

    this.handleChange = this.handleChange.bind(this)
    this.bindRef = this.bindRef.bind(this)
  }

  shouldComponentUpdate() {
    return false
  }

  componentDidMount() {
    const { value, options } = this.props

    this.codeMirror = CodeMirror.fromTextArea(this.textarea, options)
    this.codeMirror.on('change', this.handleChange)
    this.codeMirror.setValue(value)
  }

  componentWillUnmount() {
    if (this.codeMirror) {
      this.codeMirror.toTextArea()
    }
  }

  handleChange(doc, change) {
    const { onChange } = this.props
    if (onChange && change.origin !== 'setValue') {
      onChange(doc.getValue(), change)
    }
  }

  bindRef(ref) {
    this.textarea = ref
  }

  render() {
    const { value } = this.props
    return (
      <div className="codeMirror">
        <textarea
          ref={this.bindRef}
          defaultValue={value}
          autoComplete="off"
        />
      </div>
    );
  }
}

const header = document.querySelector('body > header')
const anchor = document.createElement('a')
anchor.appendChild(document.createTextNode('REPL'))
anchor.setAttribute('href', '#repl')
header.insertBefore(anchor, header.children[1])

window.addEventListener('hashchange', showRepl)
showRepl()

function showRepl() {
  if (location.hash !== '#repl') {
    return
  }

  document.title = 'REPL | Autonym'

  document.querySelectorAll('body > nav, body > .content, body > footer').forEach(element => element.parentNode.removeChild(element))
  const replContainer = document.createElement('div')
  replContainer.setAttribute('class', 'repl')
  document.querySelector('body').appendChild(replContainer)

  ReactDOM.render(<Repl />, replContainer)
}
