import { defaultConfig } from './config';
import { Report } from './report';
import { joinRegExp, isError } from './util';
import Tracekit from './tracekit';
import Perf from './performance';
import { Exception } from './exception';

export default class Trace {
  // private computeStackTrace: TraceKit.ComputeStackTrace = Tracekit['computeStackTrace'];
  private analyzeErrorStack = new Exception().analyzeErrorStack;
  private globalConfig: Trace.Config = defaultConfig;
  private onError: Report;

  public config(config?: Trace.Config) {
    this.globalConfig = Object.assign({}, this.globalConfig, config);
    this.processConfig();
    this.onError = new Report(this.globalConfig);
    window.addEventListener('beforeunload', () => {
      const perf = new Perf(this.globalConfig);
      perf.payloadSending();
    });
  }

  public captureException(exception: Error): void {
    if (!isError(exception)) {
      return this.captureMessage(exception as any);
    }

    try {
      const stackInfo: Trace.StackInfo = this.analyzeErrorStack(exception);
      this.onError.handleStackInfo(stackInfo);
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

    let stack = this.analyzeErrorStack(exception);
    let frames: Trace.StackFrame[] = this.onError.prepareFrames(stack);

    let catchedException: Trace.CatchedException = {
      stacktrace: { frames },
      message
    }

    this.onError.handlePayload(catchedException);
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
