import { defaultConfig } from './config';
import { OnError } from './onError';
import { joinRegExp, isError } from './util';
import Tracekit from './tracekit';
const objectAssign = Object.assign || require('object-assign');

export default class Trace {
  private computeStackTrace: TraceKit.ComputeStackTrace = Tracekit['computeStackTrace'];
  private globalConfig: Trace.Config = defaultConfig;
  private onError: OnError;

  constructor(config?: Trace.Config) {
    this.globalConfig = objectAssign({}, this.globalConfig, config);
    this.handleConfig();
    this.onError = new OnError(this.globalConfig);
  }

  public captureException(exception: any): void {
    if (!isError(exception)) {
      return this.captureMessage(exception);
    }

    try {
      const stack: TraceKit.StackTrace = this.computeStackTrace(exception);
      this.onError.handleStackInfo(stack);
    } catch (e) {
      if (exception !== e) throw e;
    }
  }

  public captureMessage(message: string): void {
    if (!!(this.globalConfig.ignoreErrors as RegExp).test
      && (this.globalConfig.ignoreErrors as RegExp).test(message)) return;

    let exception: any;
    try {
      throw new Error(message);
    } catch (e) {
      exception = e;
    }

    let stack = this.computeStackTrace(exception);
    let frames: Trace.StackFrame[] = this.onError.prepareFrames(stack);

    let catchedException: Trace.CatchedException = {
      stacktrace: frames,
      message
    }

    this.onError.handlePayload([catchedException]);
  }

  private handleConfig() {
    const ignoreErrors = this.globalConfig.ignoreErrors as Array<RegExp>;
    const ignoreUrls = this.globalConfig.ignoreErrors as Array<RegExp>;

    ignoreErrors.push(/^Script error\.?$/);
    ignoreErrors.push(/^Javascript error: Script error\.? on line 0$/);
    this.globalConfig.ignoreErrors = joinRegExp(ignoreErrors);

    this.globalConfig.ignoreUrls = ignoreUrls.length && joinRegExp(ignoreUrls);
  }
}
