import { makeRequest } from './request';
import { environment } from './environment';
import { BreadCrumbs } from './breadcrumbs';
import { triggerEvent, guid } from './util';
const objectAssign = Object.assign || require('object-assign');
import Tracekit from './tracekit';

export class OnError {
  private _config: Trace.Config;
  private Tracekit = Tracekit;
  private breadcrumbs: BreadCrumbs;

  private lastGuid: string = null;
  private lastReport: Trace.Report = null;

  constructor(config: Trace.Config) {
    this._config = config;
    Tracekit['report'].subscribe((errorReport: any) => {
      this.handleStackInfo(errorReport)
    })
    this.breadcrumbs = new BreadCrumbs(config);
  }

  /**
   * 处理栈信息
   * @private
   * @param {TraceKit.StackTrace} stackInfo TraceKit获取的栈信息
   */
  public handleStackInfo(stackInfo: TraceKit.StackTrace): void {
    let frames: Array<Trace.StackFrame> = this.prepareFrames(stackInfo);

    triggerEvent('handle', { stackInfo });

    this.processException(stackInfo.name, stackInfo.message, stackInfo.url, frames)
  }

  /**
   * 设置栈帧数据集
   * @private
   * @param {TraceKit.StackTrace} stackInfo TraceKit获取的栈信息
   * @returns {Trace.StackFrame[]} 
   */
  public prepareFrames(stackInfo: TraceKit.StackTrace): Trace.StackFrame[] {
    let frames: Array<Trace.StackFrame> = [];
    if (stackInfo.stack && stackInfo.stack.length) {
      stackInfo.stack.forEach(item => {
        let frame = this.normalizeFrame(item);
        if (frame) frames.push(frame)
      });
    }
    frames = frames.slice(0, this._config.maxStackDepth);
    return frames;
  }

  /**
   * 统一自定义栈帧结构
   * @private
   * @param {TraceKit.StackFrame} frame - TraceKit获取的栈帧
   * @returns {Trace.StackFrame} - 统一后的栈帧对象
   */
  private normalizeFrame(frame: TraceKit.StackFrame): Trace.StackFrame {
    if (!frame.url) return;
    const normalized = {
      fileName: frame.url,
      lineNumber: frame.line,
      columnNumber: frame.column,
      function: frame.func || '?'
    }
    return normalized;
  }

  /**
   * 处理异常
   * @private
   * @param {string} type - 异常类型
   * @param {string} message - 异常信息
   * @param {string} fileName - 异常路径
   * @param {Array<Trace.StackFrame>} frames - 异常栈帧数据集
   */
  private processException(type: string, message: string, fileName: string, frames: Array<Trace.StackFrame>): void {
    let config = this._config;
    let stacktrace: Array<Trace.StackFrame> = [];
    if (!!(config.ignoreErrors as RegExp).test && (config.ignoreErrors as RegExp).test(message)) return;

    message += '';

    if (frames && frames.length) {
      fileName = frames[0].fileName || fileName;
      frames.reverse(); // 倒序排列
      stacktrace = frames;
    } else if (fileName) {
      stacktrace.push({
        fileName
      })
    }

    if (!!(config.ignoreUrls as RegExp).test && (config.ignoreUrls as RegExp).test(fileName)) return;

    let exception: Array<Trace.CatchedException> = [{ type, message, stacktrace }];

    // 处理报告数据
    this.handlePayload(exception);
  }

  /**
   * 处理报告数据
   * @private
   * @param {Array<Trace.CatchedException>} exception 
   */
  public handlePayload(exception: Array<Trace.CatchedException>) {
    // 合并报告
    const reportData: Trace.Report = {
      url: location.href,
      title: document.title,
      environment,
      exception,
      version: this._config.version,
      apiKey: this._config.apiKey,
      timestamp: new Date().getTime(),
      guid: guid(),
      breadcrumbs: this.breadcrumbs.crumbsData,
    }
    // 发送报告
    this.sendPayload(reportData)
  }

  /**
   * 发送报告
   * @private
   * @param {Trace.Report} payload
   */
  private sendPayload(payload: Trace.Report) {
    this.lastGuid = payload.guid;
    if (!this._config.repeatReport && this.isRepeatReport(payload)) return;

    this.lastReport = payload;
    const requestOptions = {
      url: this._config.exceptionUrl,
      data: payload,
      onSuccess: () => {
        triggerEvent('success', {
          data: payload,
          src: this._config.exceptionUrl
        })
        return new Promise(() => { });
      },
      OnError: (error) => {
        triggerEvent('failure', {
          data: payload,
          src: this._config.exceptionUrl
        })
        error = error || new Error(`发送上报请求失败`);
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
  private isSameException(arrayEx1: Trace.CatchedException[], arrayEx2: Trace.CatchedException[]): boolean {
    if (!arrayEx1.length || !arrayEx2.length) return false;

    const ex1: Trace.CatchedException = arrayEx1[0];
    const ex2: Trace.CatchedException = arrayEx2[0];

    if (ex1.type !== ex2.type || ex1.message !== ex2.message) return false;

    return this.isSameStacktrace(ex1.stacktrace, ex2.stacktrace);
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
      if (item.fileName !== stacktrace2[index].fileName ||
        item.columnNumber !== stacktrace2[index].columnNumber ||
        item.lineNumber !== stacktrace2[index].lineNumber ||
        item.function !== stacktrace2[index].function) return false;
    })

    return true;
  }
}
