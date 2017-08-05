import { Report } from './report';

/**
 * Most of all are borrowed from Tracekit
 * @see https://github.com/occ/TraceKit
 * @class Exception
 */
export class Exception {
  private originOnError: ErrorEventHandler = window.onerror;
  private report: Report;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
  private ERROR_TYPES: RegExp = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;

  constructor(config: Trace.Config) {
    this.handleWindowOnError();
    this.report = new Report(config);
  }

  private handleWindowOnError() {
    let self = this;
    let stackInfo: Trace.StackInfo = null;

    window.onerror = function (message: string, fileName: string, lineNumber: number, columnNumber: number, error: Error) {
      if (error) {
        stackInfo = self.analyzeErrorStack(error);
      } else {
        const frame: Trace.StackFrame = { fileName, lineNumber, columnNumber, func: '?' };
        let type, msg = message;
        if (Object.prototype.toString.call(message) === '[object String]') {
          // example: ['Uncaught TypeError: blah blah blah', 'TypeError' 'blah blah blah']
          const msgGroup: Array<string> = message.match(self.ERROR_TYPES);
          if (msgGroup) {
            type = msgGroup[1];
            msg = msgGroup[2];
          }
        }

        // set exception data
        stackInfo = {
          type,
          message: msg,
          lineNumber,
          columnNumber,
          stacktrace: {
            frames: [frame]
          }
        }
      }

      // apply original window.onerror
      self.originOnError && self.originOnError.apply(window, arguments);
      self.report.handleStackInfo(stackInfo);
      // for console
      return false;
    }
  }

  /**
   * Analyze stack information from Error object
   * @param {Error} error 
   * @param {number} [depth] 
   */
  public analyzeErrorStack(error: Error, depth?: number): Trace.StackInfo {
    const { name, message } = error;
    depth = (depth == null ? 0 : +depth);
    let stackInfo: Trace.StackInfo;

    try {
      stackInfo = this.analyzeStackFromProp(error);
      if (stackInfo) return stackInfo;
    } catch (e) { }

    try {
      stackInfo = this.analyzeStackFromCaller(error, depth + 1);
      if (stackInfo) return stackInfo;
    } catch (e) { }

    return {
      type: name,
      message,
      url: window.location.href
    }
  }

  /**
   * Analyze stack from error object properties
   * @param {Error} error 
   * @returns {Trace.StackInfo} 
   * @memberof Exception
   */
  private analyzeStackFromProp(error: Error): Trace.StackInfo {
    const { name, stack, message } = error;
    if (typeof stack === 'undefined' || !stack) return;

    const chrome = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
    const gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?)(?::(\d+))?(?::(\d+))?\s*$/i;
    const winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;

    const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;
    const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
    const lines = stack.split('\n');
    const reference = /^(.*) is undefined$/.exec(message);

    let frames: Array<Trace.StackFrame> = [], submatch, parts, element: Trace.StackFrame;

    for (let i = 0, j = lines.length; i < j; ++i) {
      if ((parts = chrome.exec(lines[i]))) {
        const isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
        const isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
        if (isEval && (submatch = chromeEval.exec(parts[2]))) {
          // throw out eval line/column and use top-most line/column number
          parts[2] = submatch[1]; // url
          parts[3] = submatch[2]; // line
          parts[4] = submatch[3]; // column
        }
        element = {
          fileName: !isNative ? parts[2] : null,
          func: parts[1] || '?',
          args: isNative ? [parts[2]] : [],
          lineNumber: parts[3] ? +parts[3] : null,
          columnNumber: parts[4] ? +parts[4] : null
        };
      } else if (parts = winjs.exec(lines[i])) {
        element = {
          fileName: parts[2],
          func: parts[1] || '?',
          args: [],
          lineNumber: +parts[3],
          columnNumber: parts[4] ? +parts[4] : null
        };
      } else if ((parts = gecko.exec(lines[i]))) {
        var isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
        if (isEval && (submatch = geckoEval.exec(parts[3]))) {
          // throw out eval line/column and use top-most line number
          parts[3] = submatch[1];
          parts[4] = submatch[2];
          parts[5] = null; // no column when eval
        } else if (i === 0 && !parts[5] && typeof (error as any).columnNumber !== 'undefined') {
          // FireFox uses this awesome columnNumber property for its top frame
          // Also note, Firefox's column number is 0-based and everything else expects 1-based,
          // so adding 1
          // NOTE: this hack doesn't work if top-most frame is eval
          frames[0].columnNumber = (error as any).columnNumber + 1;
        }
        element = {
          fileName: parts[3],
          func: parts[1] || '?',
          args: parts[2] ? parts[2].split(',') : [],
          lineNumber: parts[4] ? +parts[4] : null,
          columnNumber: parts[5] ? +parts[5] : null
        };
      } else {
        continue;
      }

      if (!element.func && element.lineNumber) element.func = '?';
      if (element.args.length === 0) delete element.args;
      frames.push(element);
    }

    if (!frames.length) return null;

    return {
      type: name,
      message,
      stacktrace: {
        frames
      }
    };
  }

  /**
   * Analyze stack from arguments.caller chain
   * @param {Error} error 
   * @param {number} depth 
   * @returns {Trace.StackInfo} 
   */
  private analyzeStackFromCaller(error: Error, depth: number): Trace.StackInfo {
    const { name, message } = error;
    const functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;

    let frames: Array<Trace.StackFrame> = [], funcs = {}, recursion = false, parts, frame: Trace.StackFrame, source;

    for (let curr = this.analyzeStackFromCaller.caller; curr && !recursion; curr = curr.caller) {
      if (curr === this.analyzeStackFromProp) {
        continue;
      }

      frame = {
        fileName: null,
        func: '?',
        lineNumber: null,
        columnNumber: null
      };

      if (curr.name) {
        frame.func = curr.name;
      } else if ((parts = functionName.exec(curr.toString()))) {
        frame.func = parts[1];
      }

      typeof frame.func === 'undefined' && (frame.func = (parts.input as string).substring(0, parts.indexOf('{')));

      funcs['' + curr] ? recursion = true : funcs['' + curr] = true;

      frames.push(frame);
    }

    depth && frames.splice(0, depth);

    let stackInfo: Trace.StackInfo = {
      type: name,
      message,
      stacktrace: { frames }
    }

    const err: any = error;
    this.analyzeFirstFrame(stackInfo, err.sourceURL || err.fileName, err.line || err.lineNumber, err.message || err.description)

    return stackInfo;
  }

  /**
   * Adds information about the first frame to incomplete stack traces.
   * Safari and IE require this to get complete data on the first frame.
   * @param {*} stackInfo 
   * @param {string} url 
   * @param {number} line 
   * @param {string} message 
   * @returns {boolean} 
   */
  private analyzeFirstFrame(stackInfo: any, url: string, line: number, message: string): boolean {
    let initial = { url, line, func: '?' };

    if (initial.url && initial.line) {
      stackInfo.incomplete = false;

      if (stackInfo.stack.length > 0) {
        if (stackInfo.stack[0].url === initial.url) {
          if (stackInfo.stack[0].line === initial.line) {
            return false; // already in stack trace
          } else if (!stackInfo.stack[0].line && stackInfo.stack[0].func === initial.func) {
            stackInfo.stack[0].line = initial.line;
            return false;
          }
        }
      }

      stackInfo.stack.unshift(initial);
      stackInfo.partial = true;
      return true;
    } else {
      stackInfo.incomplete = true;
    }

    return false;
  }
}