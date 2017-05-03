import { defaultConfig } from './config';
import { OnError } from './onError';
import { joinRegExp } from './util';
const objectAssign = Object.assign || require('object-assign');

class Trace {
  private globalConfig: Trace.Config = defaultConfig;

  constructor(config?: Trace.Config) {
    this.globalConfig = objectAssign({}, this.globalConfig, config);
    this.handleConfig();
    new OnError(this.globalConfig);
  }

  private handleConfig() {
    // "Script error." is hard coded into browsers for errors that it can't read.
    // this is the result of a script being pulled in from an external domain and CORS.
    const ignoreErrors = this.globalConfig.ignoreErrors as Array<RegExp>;
    const ignoreUrls = this.globalConfig.ignoreErrors as Array<RegExp>;

    ignoreErrors.push(/^Script error\.?$/);
    ignoreErrors.push(/^Javascript error: Script error\.? on line 0$/);
    this.globalConfig.ignoreErrors = joinRegExp(ignoreErrors);

    this.globalConfig.ignoreUrls = ignoreUrls.length && joinRegExp(ignoreUrls);
  }
}

export default Trace;

const environment: any = window || this;
environment.Trace = Trace;
