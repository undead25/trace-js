import { BreadCrumbs } from './breadcrumbs';
import { Exception } from './exception';
import { environment } from './environment';
import { makeRequest } from './request';
import { triggerEvent, guid } from './util';
// import Tracekit from './tracekit';

export class Report {
  private config: Trace.Config;
  // private Tracekit = Tracekit;
  private breadcrumbs: BreadCrumbs;

  private lastGuid: string = null;
  private lastReport: Trace.Report = null;

  constructor(config: Trace.Config) {
    this.config = config;
    // Tracekit['report'].subscribe((errorReport: any) => {
    //   this.handleStackInfo(errorReport)
    // })
    const exception = new Exception();
    window.onerror = exception.handleWindowOnError;
    // this.handleStackInfo(exception.stackInfo);
    this.breadcrumbs = new BreadCrumbs(config);
  }

  /**
   * 处理栈信息
   * @private
   * @param {Trace.StackInfo} stackInfo TraceKit获取的栈信息
   */
  public handleStackInfo(stackInfo: Trace.StackInfo): void {
    let frames: Array<Trace.StackFrame> = this.prepareFrames(stackInfo);

    triggerEvent('handle', { stackInfo });
    const { type, message, url, lineno } = stackInfo;
    this.handleException(type, message, url, lineno, frames)
  }

  /**
   * 处理报告数据
   * @private
   * @param {Trace.CatchedException} exception 
   */
  public handlePayload(exception: Trace.CatchedException) {
    // 合并报告
    const reportData: Trace.Report = {
      url: location.href,
      title: document.title,
      environment,
      exception,
      version: this.config.version,
      apiKey: this.config.apiKey,
      timestamp: new Date().getTime(),
      guid: guid(),
      breadcrumbs: this.breadcrumbs.crumbsData,
    }
    // 发送报告
    this.sendPayload(reportData)
  }

  /**
   * 设置栈帧数据集
   * @private
   * @param {Trace.StackInfo} stackInfo TraceKit获取的栈信息
   * @returns {Trace.StackFrame[]} 
   */
  public prepareFrames(stackInfo: Trace.StackInfo): Trace.StackFrame[] {
    const { stacktrace } = stackInfo
    let frames: Array<Trace.StackFrame> = [];
    if (stacktrace.frames && stacktrace.frames.length) {
      stacktrace.frames.forEach(item => {
        frames.push(item)
      });
    }
    frames = frames.slice(0, this.config.maxStackDepth);
    return frames;
  }

  /**
   * Handle exception
   * @param {string} type 
   * @param {string} message 
   * @param {string} url 
   * @param {number} lineno 
   * @param {Array<Trace.StackFrame>} frames 
   * @returns {void} 
   */
  private handleException(type: string, message: string, url: string, lineno: number, frames: Array<Trace.StackFrame>): void {
    let config = this.config;
    let stacktrace: Trace.StackTrace;
    if (!!(config.ignoreErrors as RegExp).test && (config.ignoreErrors as RegExp).test(message)) return;

    message += '';

    if (frames && frames.length) {
      url = frames[0].source || url;
      frames.reverse(); // 倒序排列
      stacktrace.frames = frames;
    } else if (url) {
      stacktrace.frames = [
        { source: url, lineno }
      ]
    }

    if (!!(config.ignoreUrls as RegExp).test && (config.ignoreUrls as RegExp).test(url)) return;

    let exception: Trace.CatchedException = {
      type,
      message,
      stacktrace
    }

    // 处理报告数据
    this.handlePayload(exception);
  }

  /**
   * 发送报告
   * @private
   * @param {Trace.Report} payload
   */
  private sendPayload(payload: Trace.Report) {
    this.lastGuid = payload.guid;
    if (!this.config.repeatReport && this.isRepeatReport(payload)) return;

    this.lastReport = payload;
    const requestOptions = {
      url: this.config.exceptionUrl,
      data: payload,
      onSuccess: () => {
        triggerEvent('success', {
          data: payload,
          src: this.config.exceptionUrl
        })
        return new Promise(() => { });
      },
      OnError: (error) => {
        triggerEvent('failure', {
          data: payload,
          src: this.config.exceptionUrl
        })
        error = error || new Error(`Trace: report sending failed!`);
        return new Promise(resolve => resolve(error))
      }
    }
    // 发送报告请求
    makeRequest(requestOptions);
  }

  /**
   * 判断两份报告是否重复
   * @private
   * @param {Trace.Report} current 
   * @returns {boolean} 
   */
  private isRepeatReport(current: Trace.Report): boolean {
    const last = this.lastReport;

    // 如果最后一次报告没有或者两个 report 的 URL 都不相同直接返回 false
    if (!last || current.url !== last.url) return false;

    if (current.exception || last.exception) {
      return this.isSameException(current.exception, last.exception);
    }
    return true;
  }

  /**
   * 判断两个异常数据集是否重复
   * @private
   * @param {Trace.CatchedException[]} arrayEx1 
   * @param {Trace.CatchedException[]} arrayEx2 
   * @returns {boolean} 
   */
  private isSameException(arrayEx1: Trace.CatchedException, arrayEx2: Trace.CatchedException): boolean {
    if (!arrayEx1 || !arrayEx2) return false;

    const ex1: Trace.CatchedException = arrayEx1;
    const ex2: Trace.CatchedException = arrayEx2;

    if (ex1.type !== ex2.type || ex1.message !== ex2.message) return false;

    return this.isSameStacktrace(ex1.stacktrace.frames, ex2.stacktrace.frames);
  }

  /**
   * 判断两个栈帧数据集是否重复
   * @private
   * @param {Trace.StackFrame[]} stacktrace1 
   * @param {Trace.StackFrame[]} stacktrace2 
   * @returns {boolean} 
   */
  private isSameStacktrace(stacktrace1: Trace.StackFrame[], stacktrace2: Trace.StackFrame[]): boolean {
    if (!stacktrace1.length || !stacktrace2.length) return false;

    stacktrace1.forEach((item, index) => {
      if (item.source !== stacktrace2[index].source ||
        item.colno !== stacktrace2[index].colno ||
        item.lineno !== stacktrace2[index].lineno ||
        item.function !== stacktrace2[index].function) return false;
    })

    return true;
  }
}
