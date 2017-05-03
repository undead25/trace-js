
export const defaultConfig: Trace.Config = {
  apiKey: '',
  enabled: true,
  reportUrl: 'http://localhost:3001/tracer/error',
  ignoreErrors: [],
  ignoreUrls: [],
  autoBreadcrumbs: {
    dom: true,
    xhr: true,
    location: true,
    console: false
  },
  releaseStage: 'production',
  catchAjax: true,
  catchConsole: true,
  disableLog: false,
  maxStackDepth: 10,
  repeatReport: false,
  maxBreadcrumbs: 100
}
