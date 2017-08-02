class Stack {
  public exception: Object = null;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
  private ERROR_TYPES: RegExp = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;

  public handleWindowOnError() {
    const originOnError: ErrorEventHandler = window.onerror;
    window.onerror = function (message: string, source: string, lineno: number, colno: number, error: Error) {
      if (error) {

      }
      const frame: Object = { source, lineno, colno, func: '?' };

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
      this.exception = {
        type,
        message: msg,
        source,
        stacktrace: {
          frames: [frame]
        }
      }

      // apply original window.onerror
      originOnError && originOnError.apply(window, arguments);

      // for console
      return false;
    }
  }

  private analysisErrorStack(error: Error, depth?: number) {
    depth = (depth == null ? 0 : +depth);
    
  }
}