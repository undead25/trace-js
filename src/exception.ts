
/**
 * Most of all are borrowed from Tracekit
 * @see https://github.com/occ/TraceKit
 * @class Exception
 */
export class Exception {
  public stackInfo: Trace.StackInfo = null;
  private originOnError: ErrorEventHandler = window.onerror;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
  private ERROR_TYPES: RegExp = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;

  constructor() {
    this.handleWindowOnError = this.handleWindowOnError.bind(this);
  }

  public handleWindowOnError(message: string, source: string, lineno: number, colno: number, error: Error) {
    if (error) {
      this.stackInfo = this.analyzeErrorStack(error);
    } else {
      const frame: Trace.StackFrame = { source, lineno, colno, function: '?' };
      let type, msg = message;
      if (Object.prototype.toString.call(message) === '[object String]') {
        // example: ['Uncaught TypeError: blah blah blah', 'TypeError' 'blah blah blah']
        const msgGroup: Array<string> = message.match(this.ERROR_TYPES);
        if (msgGroup) {
          type = msgGroup[1];
          msg = msgGroup[2];
        }
      }

      // set exception data
      this.stackInfo = {
        type,
        message: msg,
        url: window.location.href,
        lineno,
        colno,
        stacktrace: {
          frames: [frame]
        }
      }

      console.log(this.stackInfo)
    }

    // apply original window.onerror
    this.originOnError && this.originOnError.apply(window, arguments);

    // for console
    return false;
  }

  /**
   * Analyze stack information from Error object
   * @param {Error} error 
   * @param {number} [depth] 
   */
  public analyzeErrorStack(error: Error, depth?: number) {
    const { name, message } = error;
    depth = (depth == null ? 0 : +depth);
    let errorStack;

    try {
      errorStack = this.analyzeErrorStack(error);
      if (errorStack) return errorStack;
    } catch (e) { }

    try {
      errorStack = this.analyzeStackFromCaller(error, depth + 1);
      if (errorStack) return errorStack;
    } catch (e) { }

    return {
      name,
      message,
      url: window.location.href
    }
  }

  /**
   * Analyze stack from error object properties
   * @param {Error} error 
   * @returns {{ name: string, message: string, url: string, stack: Array<any>}} 
   */
  private analyzeStackFromProp(error: Error): { name: string, message: string, url: string, stack: Array<any> } {
    const { name, stack, message } = error;
    if (typeof stack === 'undefined' || !stack) return;

    const chrome = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
    const gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?)(?::(\d+))?(?::(\d+))?\s*$/i;
    const winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;

    const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;
    const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
    const lines = stack.split('\n');
    const reference = /^(.*) is undefined$/.exec(message);

    let stackInfo = [], submatch, parts, element;

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
          'url': !isNative ? parts[2] : null,
          'func': parts[1] || '?',
          'args': isNative ? [parts[2]] : [],
          'line': parts[3] ? +parts[3] : null,
          'column': parts[4] ? +parts[4] : null
        };
      } else if (parts = winjs.exec(lines[i])) {
        element = {
          'url': parts[2],
          'func': parts[1] || '?',
          'args': [],
          'line': +parts[3],
          'column': parts[4] ? +parts[4] : null
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
          stackInfo[0].column = (error as any).columnNumber + 1;
        }
        element = {
          'url': parts[3],
          'func': parts[1] || '?',
          'args': parts[2] ? parts[2].split(',') : [],
          'line': parts[4] ? +parts[4] : null,
          'column': parts[5] ? +parts[5] : null
        };
      } else {
        continue;
      }

      if (!element.func && element.line) {
        element.func = '?';
      }

      stackInfo.push(element);
    }

    if (!stackInfo.length) return null;

    return {
      name,
      message,
      url: window.location.href,
      stack: stackInfo
    };
  }

  /**
   * Analyze stack from arguments.caller chain
   * @param {Error} error 
   * @param {number} depth 
   * @returns {{ name: string, message: string, url: string, stack: Array<any> }} 
   */
  private analyzeStackFromCaller(error: Error, depth: number): { name: string, message: string, url: string, stack: Array<any> } {
    const { name, message } = error;
    const functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;

    let stackInfo = [], funcs = {}, recursion = false, parts, item, source;

    for (let curr = this.analyzeStackFromCaller.caller; curr && !recursion; curr = curr.caller) {
      if (curr === this.analyzeStackFromProp) {
        continue;
      }

      item = {
        url: null,
        func: '?',
        line: null,
        column: null
      };

      if (curr.name) {
        item.func = curr.name;
      } else if ((parts = functionName.exec(curr.toString()))) {
        item.func = parts[1];
      }

      typeof item.func === 'undefined' && (item.func = (parts.input as string).substring(0, parts.indexOf('{')));

      funcs['' + curr] ? recursion = true : funcs['' + curr] = true;

      stackInfo.push(item);
    }

    depth && stackInfo.splice(0, depth);

    let result = {
      name,
      message,
      url: window.location.href,
      stack: stackInfo
    }

    const err: any = error;
    this.analyzeFirstFrame(result, err.sourceURL || err.fileName, err.line || err.lineNumber, err.message || err.description)

    return result;
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