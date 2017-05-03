import { getAttributes, htmlTreeAsString, polyfill, wrap, parseUrl } from './util';
import { OnError } from './onError';
const objectAssign = Object.assign || require('object-assign');

export class BreadCrumbs {
  public crumbsData: Array<Trace.BreadCrumb> = [];

  private _config: Trace.Config;
  private wrappedBuiltIns: Array<any> = [];

  private clickEventSelectors: Array<string>;
  private changeEventSelectors: Array<string>;

  private lastEvent: Event = null;
  private lastHref: string = '';

  constructor(config: Trace.Config) {
    this._config = config;
    this.getDomBreadcrumbs();
    this.getXhrBreadcrumbs();
    this.getLocationBreadcurmbs();
    this.getConsoleBreadcrumbs();
  }

  /**
   * 获取事件操作并写入面包屑
   * @private
   */
  private getDomBreadcrumbs(): void {
    if (!this._config.autoBreadcrumbs.dom) return;

    this.clickEventSelectors = ['a', 'button', 'input[button]', 'input[submit]', 'input[radio]', 'input[checkbox]'];
    this.changeEventSelectors = ['input[text]', 'input[password]', 'textarea', 'select'];

    if (document.addEventListener) {
      document.addEventListener('click', (event: MouseEvent) => {
        this.eventHandler('click', this.clickEventSelectors, event);
      }, true);
      document.addEventListener('blur', (event: MouseEvent) => {
        this.eventHandler('input', this.changeEventSelectors, event)
      }, true);
    } else {
      // IE8
      document['attachEvent']('onclick', (event: MouseEvent) => {
        this.eventHandler('click', this.clickEventSelectors, event);
      });
      document['attachEvent']('onblur', (event: MouseEvent) => {
        this.eventHandler('click', this.clickEventSelectors, event);
      })
    }
  }

  /**
   * 
   * @private
   * @param {string} eventName 
   * @param {Array<string>} selectorFilters 
   * @param {MouseEvent} event 
   */
  private eventHandler(eventName: string, selectorFilters: Array<string>, event: MouseEvent): void {
    const target = event.target || event.srcElement;
    const tagName: string = (target as HTMLElement).tagName.toLowerCase();

    if (this.acceptTag(target as HTMLElement, selectorFilters)) {
      const attributes = getAttributes(target as HTMLElement);
      let inputElement = target as HTMLInputElement;

      const result: Trace.BreadCrumb = {
        category: `ui.${eventName}`,
        htmlTree: htmlTreeAsString(target as HTMLElement)
      }

      this.captureBreadcrumb(result);
    }
  }

  /**
   * 查看某个元素是否在要监控的元素类型列表中
   * @private
   * @param {HTMLElement} element - 要检测的元素
   * @param {Array<string>} selectors - 元素列表字符串
   * @returns {boolean} - 检测结果
   */
  private acceptTag(element: HTMLElement, selectors: Array<string>): boolean {
    let tag: string = element.tagName.toLowerCase();
    if (tag === 'input' && element.getAttribute('type')) {
      tag += `[${element.getAttribute('type')}]`
    }
    return selectors.indexOf(tag) > -1;
  }


  /**
   * 获取事件操作并写入面包屑
   */
  private getXhrBreadcrumbs() {
    if (!this._config.autoBreadcrumbs.xhr) return;

    const self = this;
    const autoBreadcrumbs = this._config.autoBreadcrumbs;
    const wrappedBuiltIns = this.wrappedBuiltIns;
    const xhrproto = XMLHttpRequest.prototype;

    function wrapProp(prop, xhr) {
      if (prop in xhr && typeof (xhr[prop]) === 'function') {
        polyfill(xhr, prop, function (origin) {
          return wrap(origin);
        });
      }
    }

    // 复制改下 xhr open 用于监听
    polyfill(xhrproto, 'open', function (origOpen: any) {
      return function (method: string, url: string) {

        this._trace_xhr = {
          method: method,
          url: url,
          statusCode: null
        };
        return origOpen.apply(this, arguments);
      };
    }, wrappedBuiltIns);

    // 复制改下 xhr send 用于监听
    polyfill(xhrproto, 'send', function (origSend) {
      return function (data) {
        var xhr = this;
        function onreadystatechangeHandler() {
          if (xhr._trace_xhr && (xhr.readyState === 1 || xhr.readyState === 4)) {
            xhr._trace_xhr.statusCode = xhr.status;
            self.captureBreadcrumb({
              type: 'http',
              category: 'xhr',
              data: xhr._trace_xhr
            });
          }
        }

        const props = ['onload', 'onerror', 'onprogress'];
        for (var j = 0; j < props.length; j++) {
          wrapProp(props[j], xhr);
        }

        if ('onreadystatechange' in xhr && typeof xhr.onreadystatechange === 'function') {
          polyfill(xhr, 'onreadystatechange', function (origin) {
            return wrap(origin, undefined, onreadystatechangeHandler);
          })
        } else {
          xhr.onreadystatechange = onreadystatechangeHandler;
        }
        return origSend.apply(this, arguments);
      };
    }, wrappedBuiltIns);
  }

  private getLocationBreadcurmbs() {
    if (!this._config.autoBreadcrumbs.location) return;

    const wrappedBuiltIns = this.wrappedBuiltIns;
    const self = this;
    const chrome = window['chrome'];
    const isChromePackagedApp = chrome && chrome.app && chrome.app.runtime;
    const hasPushState = !isChromePackagedApp && window.history && history.pushState;
    if (hasPushState) {
      var oldOnPopState = window.onpopstate;
      window.onpopstate = function () {
        var currentHref = location.href;
        self.captureUrlChange(self.lastHref, currentHref);
        if (oldOnPopState) {
          return oldOnPopState.apply(this, arguments);
        }
      };

      polyfill(history, 'pushState', function (origPushState) {
        // note history.pushState.length is 0; intentionally not declaring
        // params to preserve 0 arity
        return function (/* state, title, url */) {
          var url = arguments.length > 2 ? arguments[2] : undefined;

          // url argument is optional
          if (url) {
            // coerce to string (this is what pushState does)
            self.captureUrlChange(self.lastHref, url + '');
          }

          return origPushState.apply(this, arguments);
        };
      }, wrappedBuiltIns);
    }
  }

  /**
   * Captures a breadcrumb of type "navigation", normalizing input URLs
   * @param to the originating URL
   * @param from the target URL
   * @private
   */
  private captureUrlChange(from, to) {
    var parsedLoc = parseUrl(location.href);
    var parsedTo = parseUrl(to);
    var parsedFrom = parseUrl(from);

    // because onpopstate only tells you the "new" (to) value of location.href, and
    // not the previous (from) value, we need to track the value of the current URL
    // state ourselves
    this.lastHref = to;

    // Use only the path component of the URL if the URL matches the current
    // document (almost all the time when using pushState)
    if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host)
      to = parsedTo.relative;
    if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host)
      from = parsedFrom.relative;

    this.captureBreadcrumb({
      category: 'navigation',
      data: {
        to: to,
        from: from
      }
    });
  }

  private getConsoleBreadcrumbs() {
    if (!this._config.autoBreadcrumbs.console) return;
    if ('console' in window && console.log) {
      const consoleMethodCallback = (msg, data) => {
        this.captureBreadcrumb({
          message: msg,
          level: data.level,
          category: 'console'
        });
      };
      ['debug', 'info', 'warn', 'error', 'log'].forEach((item) => {
        this.wrapConsole(console, item, consoleMethodCallback);
      })
    }
  }

  private wrapConsole(console, level, callback) {
    const originalConsoleLevel = console[level];
    const originalConsole = console;

    if (!(level in console)) {
      return;
    }

    var sentryLevel = level === 'warn'
      ? 'warning'
      : level;

    console[level] = function () {
      var args = [].slice.call(arguments);

      var msg = '' + args.join(' ');
      var data = { level: sentryLevel, logger: 'console', extra: { 'arguments': args } };
      callback && callback(msg, data);

      // this fails for some browsers. :(
      if (originalConsoleLevel) {
        // IE9 doesn't allow calling apply on console functions directly
        // See: https://stackoverflow.com/questions/5472938/does-ie9-support-console-log-and-is-it-a-real-function#answer-5473193
        Function.prototype.apply.call(
          originalConsoleLevel,
          originalConsole,
          args
        );
      }
    };
  };

  /**
   * 写入面包屑
   * @private
   * @param {Trace.BreadCrumb} crumb 
   */
  private captureBreadcrumb(crumb: Trace.BreadCrumb): void {
    let _crumb = objectAssign({}, crumb, { timestamp: new Date().getTime() });
    this.crumbsData.push(_crumb);

    // 超出后删除最先记录的一个
    if (this.crumbsData.length > this._config.maxBreadcrumbs) {
      this.crumbsData.shift()
    }
  }
}