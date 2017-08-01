
export const defaultConfig: Trace.Config = {
  apiKey: '',
  exceptionUrl: 'http://localhost:3001/tracer/error',
  performanceUrl: 'http://localhost:3001/api/perf/create',
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
  maxStackDepth: 10,
  repeatReport: false,
  maxBreadcrumbs: 100
}
