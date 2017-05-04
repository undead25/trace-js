import { defaultConfig } from './config';
import { Report } from './report';
import { joinRegExp, isError } from './util';
import Tracekit from './tracekit';
const objectAssign = Object.assign || require('object-assign');

export default class Trace {
  private computeStackTrace: TraceKit.ComputeStackTrace = Tracekit['computeStackTrace'];
  private globalConfig: Trace.Config = defaultConfig;
  private onError: Report;

  public config(config?: Trace.Config) {
    this.globalConfig = objectAssign({}, this.globalConfig, config);
    this.processConfig();
    this.onError = new Report(this.globalConfig);
  }

  public captureException(exception: Error): void {
    if (!isError(exception)) {
      return this.captureMessage(exception as any);
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

  private processConfig() {
    const ignoreErrors = this.globalConfig.ignoreErrors as Array<RegExp>;
    const ignoreUrls = this.globalConfig.ignoreErrors as Array<RegExp>;

    ignoreErrors.push(/^Script error\.?$/);
    ignoreErrors.push(/^Javascript error: Script error\.? on line 0$/);
    this.globalConfig.ignoreErrors = joinRegExp(ignoreErrors);

    this.globalConfig.ignoreUrls = ignoreUrls.length && joinRegExp(ignoreUrls);
  }
}
