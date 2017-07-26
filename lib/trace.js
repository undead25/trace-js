
/*!
 * trace-js v0.0.8
 * Licensed under the MIT License.
 */
var _Trace = (function () {
'use strict';

var defaultConfig = {
    apiKey: '',
    reportUrl: 'http://localhost:3001/tracer/error',
    ignoreErrors: [],
    ignoreUrls: [],
    autoBreadcrumbs: {
        dom: true,
        xhr: true,
        location: true,
        console: false
    },
    releaseStage: 'production',
    catchAjax: true,
    catchConsole: true,
    maxStackDepth: 10,
    repeatReport: false,
    maxBreadcrumbs: 100
};

function makeRequest(options) {
    var request = new XMLHttpRequest();
    var hasCORS = 'withCredentials' in request || typeof window['XDomainRequest'] !== 'undefined';
    if (!hasCORS) return;
    var url = options.url;
    if ('withCredentials' in request) {
        request.onreadystatechange = function () {
            if (request.readyState !== 4) {
                return;
            } else if (request.status === 200) {
                options.onSuccess = options.onSuccess();
            } else if (options.onError) {
                var error = new Error('Error: ' + request.status);
                error.request = request;
                options.onError(error);
            }
        };
    } else {
        // xdomainrequest cannot go http -> https (or vice versa),
        // so always use protocol relative
        request = new window.XDomainRequest();
        url = url.replace(/^https?:/, '');
        // onreadystatechange not supported by XDomainRequest
        if (options.onSuccess) request.onload = options.onSuccess;
        if (options.onError) {
            request.onerror = function () {
                var error = new Error('Error: XDomainRequest');
                error.request = request;
                options.onError(error);
            };
        }
    }
    request.open('POST', url, true);
    request.send(JSON.stringify(options.data));
}

var environment = {
    /** 屏幕宽度 */
    screenWidth: document.documentElement ? document.documentElement.clientWidth : document.body.clientWidth,
    /** 屏幕高度 */
    screenHeigth: document.documentElement ? document.documentElement.clientHeight : document.body.clientHeight,
    /** 浏览器信息 */
    userAgent: navigator.userAgent,
    /** 浏览器语言 */
    language: navigator.language
};

/**
 * 是否为IE浏览器
 * @export
 * @returns {boolean}
 */

function isError(value) {
    switch (Object.prototype.toString.call(value)) {
        case '[object Error]':
            return true;
        case '[object Exception]':
            return true;
        case '[object DOMException]':
            return true;
        default:
            return value instanceof Error;
    }
}
/**
 * 生产唯一ID
 * @export
 * @returns {string} - 唯一guid
 */
function guid() {
    var crypto = window.crypto || window['msCrypto'];
    if (crypto && crypto.getRandomValues) {
        // Use window.crypto API if available
        var arr = new Uint16Array(8);
        crypto.getRandomValues(arr);
        // set 4 in byte 7
        arr[3] = arr[3] & 0xFFF | 0x4000;
        // set 2 most significant bits of byte 9 to '10'
        arr[4] = arr[4] & 0x3FFF | 0x8000;
        var pad = function pad(num) {
            var v = num.toString(16);
            while (v.length < 4) {
                v = '0' + v;
            }
            return v;
        };
        return pad(arr[0]) + pad(arr[1]) + pad(arr[2]) + pad(arr[3]) + pad(arr[4]) + pad(arr[5]) + pad(arr[6]) + pad(arr[7]);
    } else {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        });
    }
}
/**
 * 文档绑定自定义事件
 * @export
 * @param {string} eventType
 * @param {Object} [options={}]
 * @returns {void}
 */
function triggerEvent(eventType) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!document) return;
    var _event = void 0;
    var key = void 0;
    eventType = eventType.substr(0, 1).toUpperCase + eventType.substr(1);
    if (document.createEvent) {
        _event = document.createEvent('HTMLEvents');
        _event.initEvent(eventType, true, true);
    } else {
        // IE8-9
        _event = document['createEventObject']();
        _event.eventType = eventType;
    }
    for (key in options) {
        if (options.hasOwnProperty(key)) {
            _event[key] = options[key];
        }
    }
    if (document.createEvent) {
        document.dispatchEvent(_event);
    } else {
        document['fireEvent']('on' + _event.eventType.toLowerCase(), _event);
    }
}
/**
 * 原生方法垫片
 * @param {Object} obj - 内置对象，例：`window`, `document`
 * @param {string} name - 内置对象的函数名称，例：`addEventListener`
 * @param {Function} replacement - 替换后的函数
 * @param {*} [track] - record instrumentation to an array
 */
function polyfill(obj, name, replacement, track) {
    var origin = obj[name];
    obj[name] = replacement(origin);
    if (track) {
        track.push([obj, name, origin]);
    }
}
function wrap(options, func, origin) {
    if (!func && typeof options !== 'function') return options;
    if (typeof options === 'function') {
        func = options;
        options = undefined;
    }
    if (typeof func !== 'function') return func;
    try {
        if (func.trace) return func;
        if (func.track_wrapper) return func.track_wrapper;
    } catch (e) {
        return func;
    }
    function wrapped() {
        var trace = void 0,
            inner = void 0;
        var args = [],
            i = arguments.length,
            deep = !options || options && options.deep !== false;
        if (origin && typeof origin === 'function') {
            origin.apply(this, arguments);
        }
        while (i--) {
            args[i] = deep ? wrap(options, arguments[i]) : arguments[i];
        }try {
            return func.apply(this, args);
        } catch (e) {
            // self._ignoreNextOnError();
            // self.captureException(e, options);
            throw e;
        }
    }
    // copy over properties of the old function
    for (var property in func) {
        if (func.hasOwnProperty(process)) {
            wrapped[property] = func[property];
        }
    }
    wrapped.prototype = func.prototype;
    func.track_wrapper = wrapped;
    // Signal that this function has been wrapped already
    // for both debugging and to prevent it to being wrapped twice
    // wrapped.trace = true;
    // wrapped.inner = func;
    return wrapped;
}
/**
 *
 * @param {Array<RegExp>} patterns
 * @returns {RegExp}
 */
function joinRegExp(patterns) {
    var sources = [];
    var pattern = void 0;
    for (var i = 0; i < patterns.length; i++) {
        pattern = patterns[i];
        if (typeof pattern === 'string') {
            sources.push(pattern.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'));
        } else if (pattern && pattern.source) {
            // If it's a regexp already, we want to extract the source
            sources.push(pattern.source);
        }
    }
    return new RegExp(sources.join('|'), 'i');
}
/**
 * Given a child DOM element, returns a query-selector statement describing that
 * and its ancestors
 * e.g. [HTMLElement] => body > div > input#foo.btn[name=baz]
 * @param elem
 * @returns {string}
 */
function htmlTreeAsString(element) {
    var MAX_TRAVERSE_HEIGHT = 5,
        MAX_OUTPUT_LEN = 80,
        out = [],
        height = 0,
        len = 0,
        separator = ' > ',
        sepLength = separator.length,
        nextStr;
    while (element && height++ < MAX_TRAVERSE_HEIGHT) {
        nextStr = htmlElementAsString(element);
        if (nextStr === 'html' || height > 1 && len + out.length * sepLength + nextStr.length >= MAX_OUTPUT_LEN) {
            break;
        }
        out.push(nextStr);
        len += nextStr.length;
        element = element.parentElement;
    }
    return out.reverse().join(separator);
}
/**
 * Returns a simple, query-selector representation of a DOM element
 * e.g. [HTMLElement] => input#foo.btn[name=baz]
 * @param HTMLElement
 * @returns {string}
 */
function htmlElementAsString(element) {
    var out = [],
        className,
        classes,
        key,
        attr,
        i;
    if (!element || !element.tagName) {
        return '';
    }
    out.push(element.tagName.toLowerCase());
    if (element.id) {
        out.push('#' + element.id);
    }
    className = element.className;
    if (className && typeof className === 'string') {
        classes = className.split(/\s+/);
        for (i = 0; i < classes.length; i++) {
            out.push('.' + classes[i]);
        }
    }
    var attrWhitelist = ['type', 'name', 'title', 'alt'];
    for (i = 0; i < attrWhitelist.length; i++) {
        key = attrWhitelist[i];
        attr = element.getAttribute(key);
        if (attr) {
            out.push('[' + key + '="' + attr + '"]');
        }
    }
    return out.join('');
}
// borrowed from https://tools.ietf.org/html/rfc3986#appendix-B
// intentionally using regex and not <a/> href parsing trick because React Native and other
// environments where DOM might not be available
function parseUrl(url) {
    var match = url.match(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
    if (!match) return;
    // coerce to undefined values to empty string so we don't get 'undefined'
    var query = match[6] || '';
    var fragment = match[8] || '';
    return {
        protocol: match[2],
        host: match[4],
        path: match[5],
        relative: match[5] + query + fragment // everything minus origin
    };
}
/**
 * 获取元素的属性值
 * @param {HTMLElement} element  - 需要获取属性的元素
 * @returns {Object} - 属性键值对象
 */
function getAttributes(element) {
    var result = {};
    var attributes = element.attributes;
    for (var i = 0; i < attributes.length; i++) {
        var item = attributes[i];
        result[item.name] = item.value;
    }
    return result;
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var objectAssign$2 = Object.assign || require('object-assign');

var BreadCrumbs = function () {
    function BreadCrumbs(config) {
        classCallCheck(this, BreadCrumbs);

        this.crumbsData = [];
        this.wrappedBuiltIns = [];
        this.lastEvent = null;
        this.lastHref = '';
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


    createClass(BreadCrumbs, [{
        key: 'getDomBreadcrumbs',
        value: function getDomBreadcrumbs() {
            var _this = this;

            if (!this._config.autoBreadcrumbs.dom) return;
            this.clickEventSelectors = ['a', 'button', 'input[button]', 'input[submit]', 'input[radio]', 'input[checkbox]'];
            this.changeEventSelectors = ['input[text]', 'input[password]', 'textarea', 'select'];
            if (document.addEventListener) {
                document.addEventListener('click', function (event) {
                    _this.eventHandler('click', _this.clickEventSelectors, event);
                }, true);
                document.addEventListener('blur', function (event) {
                    _this.eventHandler('input', _this.changeEventSelectors, event);
                }, true);
            } else {
                // IE8
                document['attachEvent']('onclick', function (event) {
                    _this.eventHandler('click', _this.clickEventSelectors, event);
                });
                document['attachEvent']('onblur', function (event) {
                    _this.eventHandler('click', _this.clickEventSelectors, event);
                });
            }
        }
        /**
         *
         * @private
         * @param {string} eventName
         * @param {Array<string>} selectorFilters
         * @param {MouseEvent} event
         */

    }, {
        key: 'eventHandler',
        value: function eventHandler(eventName, selectorFilters, event) {
            var target = event.target || event.srcElement;
            var tagName = target.tagName.toLowerCase();
            if (this.acceptTag(target, selectorFilters)) {
                var attributes = getAttributes(target);
                var inputElement = target;
                var result = {
                    category: 'ui.' + eventName,
                    htmlTree: htmlTreeAsString(target)
                };
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

    }, {
        key: 'acceptTag',
        value: function acceptTag(element, selectors) {
            var tag = element.tagName.toLowerCase();
            if (tag === 'input' && element.getAttribute('type')) {
                tag += '[' + element.getAttribute('type') + ']';
            }
            return selectors.indexOf(tag) > -1;
        }
        /**
         * 获取事件操作并写入面包屑
         */

    }, {
        key: 'getXhrBreadcrumbs',
        value: function getXhrBreadcrumbs() {
            if (!this._config.autoBreadcrumbs.xhr) return;
            var self = this;
            var autoBreadcrumbs = this._config.autoBreadcrumbs;
            var wrappedBuiltIns = this.wrappedBuiltIns;
            var xhrproto = XMLHttpRequest.prototype;
            function wrapProp(prop, xhr) {
                if (prop in xhr && typeof xhr[prop] === 'function') {
                    polyfill(xhr, prop, function (origin) {
                        return wrap(origin);
                    });
                }
            }
            // 复制改下 xhr open 用于监听
            polyfill(xhrproto, 'open', function (origOpen) {
                return function (method, url) {
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
                    var props = ['onload', 'onerror', 'onprogress'];
                    for (var j = 0; j < props.length; j++) {
                        wrapProp(props[j], xhr);
                    }
                    if ('onreadystatechange' in xhr && typeof xhr.onreadystatechange === 'function') {
                        polyfill(xhr, 'onreadystatechange', function (origin) {
                            return wrap(origin, undefined, onreadystatechangeHandler);
                        });
                    } else {
                        xhr.onreadystatechange = onreadystatechangeHandler;
                    }
                    return origSend.apply(this, arguments);
                };
            }, wrappedBuiltIns);
        }
    }, {
        key: 'getLocationBreadcurmbs',
        value: function getLocationBreadcurmbs() {
            if (!this._config.autoBreadcrumbs.location) return;
            var wrappedBuiltIns = this.wrappedBuiltIns;
            var self = this;
            var chrome = window['chrome'];
            var isChromePackagedApp = chrome && chrome.app && chrome.app.runtime;
            var hasPushState = !isChromePackagedApp && window.history && history.pushState;
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
                    return function () {
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

    }, {
        key: 'captureUrlChange',
        value: function captureUrlChange(from, to) {
            var parsedLoc = parseUrl(location.href);
            var parsedTo = parseUrl(to);
            var parsedFrom = parseUrl(from);
            // because onpopstate only tells you the "new" (to) value of location.href, and
            // not the previous (from) value, we need to track the value of the current URL
            // state ourselves
            this.lastHref = to;
            // Use only the path component of the URL if the URL matches the current
            // document (almost all the time when using pushState)
            if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host) to = parsedTo.relative;
            if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host) from = parsedFrom.relative;
            this.captureBreadcrumb({
                category: 'navigation',
                data: {
                    to: to,
                    from: from
                }
            });
        }
    }, {
        key: 'getConsoleBreadcrumbs',
        value: function getConsoleBreadcrumbs() {
            var _this2 = this;

            if (!this._config.autoBreadcrumbs.console) return;
            if ('console' in window && console.log) {
                var consoleMethodCallback = function consoleMethodCallback(msg, data) {
                    _this2.captureBreadcrumb({
                        message: msg,
                        level: data.level,
                        category: 'console'
                    });
                };
                ['debug', 'info', 'warn', 'error', 'log'].forEach(function (item) {
                    _this2.wrapConsole(console, item, consoleMethodCallback);
                });
            }
        }
    }, {
        key: 'wrapConsole',
        value: function wrapConsole(console, level, callback) {
            var originalConsoleLevel = console[level];
            var originalConsole = console;
            if (!(level in console)) {
                return;
            }
            var sentryLevel = level === 'warn' ? 'warning' : level;
            console[level] = function () {
                var args = [].slice.call(arguments);
                var msg = '' + args.join(' ');
                var data = { level: sentryLevel, logger: 'console', extra: { 'arguments': args } };
                callback && callback(msg, data);
                // this fails for some browsers. :(
                if (originalConsoleLevel) {
                    // IE9 doesn't allow calling apply on console functions directly
                    // See: https://stackoverflow.com/questions/5472938/does-ie9-support-console-log-and-is-it-a-real-function#answer-5473193
                    Function.prototype.apply.call(originalConsoleLevel, originalConsole, args);
                }
            };
        }
    }, {
        key: 'captureBreadcrumb',

        /**
         * 写入面包屑
         * @private
         * @param {Trace.BreadCrumb} crumb
         */
        value: function captureBreadcrumb(crumb) {
            var _crumb = objectAssign$2({}, crumb, { timestamp: new Date().getTime() });
            this.crumbsData.push(_crumb);
            // 超出后删除最先记录的一个
            if (this.crumbsData.length > this._config.maxBreadcrumbs) {
                this.crumbsData.shift();
            }
        }
    }]);
    return BreadCrumbs;
}();

/*
 TraceKit - Cross brower stack traces

 This was originally forked from github.com/occ/TraceKit, but has since been
 largely re-written and is now maintained as part of raven-js.  Tests for
 this are in test/vendor.

 MIT license
*/

var TraceKit = {
    collectWindowErrors: true,
    debug: false
};

// This is to be defensive in environments where window does not exist (see https://github.com/getsentry/raven-js/pull/785)
var _window = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

// global reference to slice
var _slice = [].slice;
var UNKNOWN_FUNCTION = '?';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
var ERROR_TYPES_RE = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;

function getLocationHref() {
    if (typeof document === 'undefined' || typeof document.location === 'undefined') return '';

    return document.location.href;
}

/**
 * TraceKit.report: cross-browser processing of unhandled exceptions
 *
 * Syntax:
 *   TraceKit.report.subscribe(function(stackInfo) { ... })
 *   TraceKit.report.unsubscribe(function(stackInfo) { ... })
 *   TraceKit.report(exception)
 *   try { ...code... } catch(ex) { TraceKit.report(ex); }
 *
 * Supports:
 *   - Firefox: full stack trace with line numbers, plus column number
 *              on top frame; column number is not guaranteed
 *   - Opera:   full stack trace with line and column numbers
 *   - Chrome:  full stack trace with line and column numbers
 *   - Safari:  line and column number for the top frame only; some frames
 *              may be missing, and column number is not guaranteed
 *   - IE:      line and column number for the top frame only; some frames
 *              may be missing, and column number is not guaranteed
 *
 * In theory, TraceKit should work on all of the following versions:
 *   - IE5.5+ (only 8.0 tested)
 *   - Firefox 0.9+ (only 3.5+ tested)
 *   - Opera 7+ (only 10.50 tested; versions 9 and earlier may require
 *     Exceptions Have Stacktrace to be enabled in opera:config)
 *   - Safari 3+ (only 4+ tested)
 *   - Chrome 1+ (only 5+ tested)
 *   - Konqueror 3.5+ (untested)
 *
 * Requires TraceKit.computeStackTrace.
 *
 * Tries to catch all unhandled exceptions and report them to the
 * subscribed handlers. Please note that TraceKit.report will rethrow the
 * exception. This is REQUIRED in order to get a useful stack trace in IE.
 * If the exception does not reach the top of the browser, you will only
 * get a stack trace from the point where TraceKit.report was called.
 *
 * Handlers receive a stackInfo object as described in the
 * TraceKit.computeStackTrace docs.
 */
TraceKit.report = function reportModuleWrapper() {
    var handlers = [],
        lastArgs = null,
        lastException = null,
        lastExceptionStack = null;

    /**
     * Add a crash handler.
     * @param {Function} handler
     */
    function subscribe(handler) {
        installGlobalHandler();
        handlers.push(handler);
    }

    /**
     * Remove a crash handler.
     * @param {Function} handler
     */
    function unsubscribe(handler) {
        for (var i = handlers.length - 1; i >= 0; --i) {
            if (handlers[i] === handler) {
                handlers.splice(i, 1);
            }
        }
    }

    /**
     * Remove all crash handlers.
     */
    function unsubscribeAll() {
        uninstallGlobalHandler();
        handlers = [];
    }

    /**
     * Dispatch stack information to all handlers.
     * @param {Object.<string, *>} stack
     */
    function notifyHandlers(stack, isWindowError) {
        var exception = null;
        if (isWindowError && !TraceKit.collectWindowErrors) {
            return;
        }
        for (var i in handlers) {
            if (handlers.hasOwnProperty(i)) {
                try {
                    handlers[i].apply(null, [stack].concat(_slice.call(arguments, 2)));
                } catch (inner) {
                    exception = inner;
                }
            }
        }

        if (exception) {
            throw exception;
        }
    }

    var _oldOnerrorHandler, _onErrorHandlerInstalled;

    /**
     * Ensures all global unhandled exceptions are recorded.
     * Supported by Gecko and IE.
     * @param {string} message Error message.
     * @param {string} url URL of script that generated the exception.
     * @param {(number|string)} lineNo The line number at which the error
     * occurred.
     * @param {?(number|string)} colNo The column number at which the error
     * occurred.
     * @param {?Error} ex The actual Error object.
     */
    function traceKitWindowOnError(message, url, lineNo, colNo, ex) {
        var stack = null;

        if (lastExceptionStack) {
            TraceKit.computeStackTrace.augmentStackTraceWithInitialElement(lastExceptionStack, url, lineNo, message);
            processLastException();
        } else if (ex) {
            // non-string `ex` arg; attempt to extract stack trace

            // New chrome and blink send along a real error object
            // Let's just report that like a normal error.
            // See: https://mikewest.org/2013/08/debugging-runtime-errors-with-window-onerror
            stack = TraceKit.computeStackTrace(ex);
            notifyHandlers(stack, true);
        } else {
            var location = {
                'url': url,
                'line': lineNo,
                'column': colNo
            };

            var name = undefined;
            var msg = message; // must be new var or will modify original `arguments`
            var groups;
            if ({}.toString.call(message) === '[object String]') {
                var groups = message.match(ERROR_TYPES_RE);
                if (groups) {
                    name = groups[1];
                    msg = groups[2];
                }
            }

            location.func = UNKNOWN_FUNCTION;

            stack = {
                'name': name,
                'message': msg,
                'url': getLocationHref(),
                'stack': [location]
            };
            notifyHandlers(stack, true);
        }

        if (_oldOnerrorHandler) {
            return _oldOnerrorHandler.apply(this, arguments);
        }

        return false;
    }

    function installGlobalHandler() {
        if (_onErrorHandlerInstalled) {
            return;
        }
        _oldOnerrorHandler = _window.onerror;
        _window.onerror = traceKitWindowOnError;
        _onErrorHandlerInstalled = true;
    }

    function uninstallGlobalHandler() {
        if (!_onErrorHandlerInstalled) {
            return;
        }
        _window.onerror = _oldOnerrorHandler;
        _onErrorHandlerInstalled = false;
        _oldOnerrorHandler = undefined;
    }

    function processLastException() {
        var _lastExceptionStack = lastExceptionStack,
            _lastArgs = lastArgs;
        lastArgs = null;
        lastExceptionStack = null;
        lastException = null;
        notifyHandlers.apply(null, [_lastExceptionStack, false].concat(_lastArgs));
    }

    /**
     * Reports an unhandled Error to TraceKit.
     * @param {Error} ex
     * @param {?boolean} rethrow If false, do not re-throw the exception.
     * Only used for window.onerror to not cause an infinite loop of
     * rethrowing.
     */
    function report(ex, rethrow) {
        var args = _slice.call(arguments, 1);
        if (lastExceptionStack) {
            if (lastException === ex) {
                return; // already caught by an inner catch block, ignore
            } else {
                processLastException();
            }
        }

        var stack = TraceKit.computeStackTrace(ex);
        lastExceptionStack = stack;
        lastException = ex;
        lastArgs = args;

        // If the stack trace is incomplete, wait for 2 seconds for
        // slow slow IE to see if onerror occurs or not before reporting
        // this exception; otherwise, we will end up with an incomplete
        // stack trace
        setTimeout(function () {
            if (lastException === ex) {
                processLastException();
            }
        }, stack.incomplete ? 2000 : 0);

        if (rethrow !== false) {
            throw ex; // re-throw to propagate to the top level (and cause window.onerror)
        }
    }

    report.subscribe = subscribe;
    report.unsubscribe = unsubscribe;
    report.uninstall = unsubscribeAll;
    return report;
}();

/**
 * TraceKit.computeStackTrace: cross-browser stack traces in JavaScript
 *
 * Syntax:
 *   s = TraceKit.computeStackTrace(exception) // consider using TraceKit.report instead (see below)
 * Returns:
 *   s.name              - exception name
 *   s.message           - exception message
 *   s.stack[i].url      - JavaScript or HTML file URL
 *   s.stack[i].func     - function name, or empty for anonymous functions (if guessing did not work)
 *   s.stack[i].args     - arguments passed to the function, if known
 *   s.stack[i].line     - line number, if known
 *   s.stack[i].column   - column number, if known
 *
 * Supports:
 *   - Firefox:  full stack trace with line numbers and unreliable column
 *               number on top frame
 *   - Opera 10: full stack trace with line and column numbers
 *   - Opera 9-: full stack trace with line numbers
 *   - Chrome:   full stack trace with line and column numbers
 *   - Safari:   line and column number for the topmost stacktrace element
 *               only
 *   - IE:       no line numbers whatsoever
 *
 * Tries to guess names of anonymous functions by looking for assignments
 * in the source code. In IE and Safari, we have to guess source file names
 * by searching for function bodies inside all page scripts. This will not
 * work for scripts that are loaded cross-domain.
 * Here be dragons: some function names may be guessed incorrectly, and
 * duplicate functions may be mismatched.
 *
 * TraceKit.computeStackTrace should only be used for tracing purposes.
 * Logging of unhandled exceptions should be done with TraceKit.report,
 * which builds on top of TraceKit.computeStackTrace and provides better
 * IE support by utilizing the window.onerror event to retrieve information
 * about the top of the stack.
 *
 * Note: In IE and Safari, no stack trace is recorded on the Error object,
 * so computeStackTrace instead walks its *own* chain of callers.
 * This means that:
 *  * in Safari, some methods may be missing from the stack trace;
 *  * in IE, the topmost function in the stack trace will always be the
 *    caller of computeStackTrace.
 *
 * This is okay for tracing (because you are likely to be calling
 * computeStackTrace from the function you want to be the topmost element
 * of the stack trace anyway), but not okay for logging unhandled
 * exceptions (because your catch block will likely be far away from the
 * inner function that actually caused the exception).
 *
 */
TraceKit.computeStackTrace = function computeStackTraceWrapper() {
    // Contents of Exception in various browsers.
    //
    // SAFARI:
    // ex.message = Can't find variable: qq
    // ex.line = 59
    // ex.sourceId = 580238192
    // ex.sourceURL = http://...
    // ex.expressionBeginOffset = 96
    // ex.expressionCaretOffset = 98
    // ex.expressionEndOffset = 98
    // ex.name = ReferenceError
    //
    // FIREFOX:
    // ex.message = qq is not defined
    // ex.fileName = http://...
    // ex.lineNumber = 59
    // ex.columnNumber = 69
    // ex.stack = ...stack trace... (see the example below)
    // ex.name = ReferenceError
    //
    // CHROME:
    // ex.message = qq is not defined
    // ex.name = ReferenceError
    // ex.type = not_defined
    // ex.arguments = ['aa']
    // ex.stack = ...stack trace...
    //
    // INTERNET EXPLORER:
    // ex.message = ...
    // ex.name = ReferenceError
    //
    // OPERA:
    // ex.message = ...message... (see the example below)
    // ex.name = ReferenceError
    // ex.opera#sourceloc = 11  (pretty much useless, duplicates the info in ex.message)
    // ex.stacktrace = n/a; see 'opera:config#UserPrefs|Exceptions Have Stacktrace'

    /**
     * Computes stack trace information from the stack property.
     * Chrome and Gecko use this property.
     * @param {Error} ex
     * @return {?Object.<string, *>} Stack trace information.
     */
    function computeStackTraceFromStackProp(ex) {
        if (typeof ex.stack === 'undefined' || !ex.stack) return;

        var chrome = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,
            gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?)(?::(\d+))?(?::(\d+))?\s*$/i,
            winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i,


        // Used to additionally parse URL/line/column from eval frames
        geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i,
            chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/,
            lines = ex.stack.split('\n'),
            stack = [],
            submatch,
            parts,
            element,
            reference = /^(.*) is undefined$/.exec(ex.message);

        for (var i = 0, j = lines.length; i < j; ++i) {
            if (parts = chrome.exec(lines[i])) {
                var isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
                var isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
                if (isEval && (submatch = chromeEval.exec(parts[2]))) {
                    // throw out eval line/column and use top-most line/column number
                    parts[2] = submatch[1]; // url
                    parts[3] = submatch[2]; // line
                    parts[4] = submatch[3]; // column
                }
                element = {
                    'url': !isNative ? parts[2] : null,
                    'func': parts[1] || UNKNOWN_FUNCTION,
                    'args': isNative ? [parts[2]] : [],
                    'line': parts[3] ? +parts[3] : null,
                    'column': parts[4] ? +parts[4] : null
                };
            } else if (parts = winjs.exec(lines[i])) {
                element = {
                    'url': parts[2],
                    'func': parts[1] || UNKNOWN_FUNCTION,
                    'args': [],
                    'line': +parts[3],
                    'column': parts[4] ? +parts[4] : null
                };
            } else if (parts = gecko.exec(lines[i])) {
                var isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
                if (isEval && (submatch = geckoEval.exec(parts[3]))) {
                    // throw out eval line/column and use top-most line number
                    parts[3] = submatch[1];
                    parts[4] = submatch[2];
                    parts[5] = null; // no column when eval
                } else if (i === 0 && !parts[5] && typeof ex.columnNumber !== 'undefined') {
                    // FireFox uses this awesome columnNumber property for its top frame
                    // Also note, Firefox's column number is 0-based and everything else expects 1-based,
                    // so adding 1
                    // NOTE: this hack doesn't work if top-most frame is eval
                    stack[0].column = ex.columnNumber + 1;
                }
                element = {
                    'url': parts[3],
                    'func': parts[1] || UNKNOWN_FUNCTION,
                    'args': parts[2] ? parts[2].split(',') : [],
                    'line': parts[4] ? +parts[4] : null,
                    'column': parts[5] ? +parts[5] : null
                };
            } else {
                continue;
            }

            if (!element.func && element.line) {
                element.func = UNKNOWN_FUNCTION;
            }

            stack.push(element);
        }

        if (!stack.length) {
            return null;
        }

        return {
            'name': ex.name,
            'message': ex.message,
            'url': getLocationHref(),
            'stack': stack
        };
    }

    /**
     * Adds information about the first frame to incomplete stack traces.
     * Safari and IE require this to get complete data on the first frame.
     * @param {Object.<string, *>} stackInfo Stack trace information from
     * one of the compute* methods.
     * @param {string} url The URL of the script that caused an error.
     * @param {(number|string)} lineNo The line number of the script that
     * caused an error.
     * @param {string=} message The error generated by the browser, which
     * hopefully contains the name of the object that caused the error.
     * @return {boolean} Whether or not the stack information was
     * augmented.
     */
    function augmentStackTraceWithInitialElement(stackInfo, url, lineNo, message) {
        var initial = {
            'url': url,
            'line': lineNo
        };

        if (initial.url && initial.line) {
            stackInfo.incomplete = false;

            if (!initial.func) {
                initial.func = UNKNOWN_FUNCTION;
            }

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

    /**
     * Computes stack trace information by walking the arguments.caller
     * chain at the time the exception occurred. This will cause earlier
     * frames to be missed but is the only way to get any stack trace in
     * Safari and IE. The top frame is restored by
     * {@link augmentStackTraceWithInitialElement}.
     * @param {Error} ex
     * @return {?Object.<string, *>} Stack trace information.
     */
    function computeStackTraceByWalkingCallerChain(ex, depth) {
        var functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i,
            stack = [],
            funcs = {},
            recursion = false,
            parts,
            item,
            source;

        for (var curr = computeStackTraceByWalkingCallerChain.caller; curr && !recursion; curr = curr.caller) {
            if (curr === computeStackTrace || curr === TraceKit.report) {
                // console.log('skipping internal function');
                continue;
            }

            item = {
                'url': null,
                'func': UNKNOWN_FUNCTION,
                'line': null,
                'column': null
            };

            if (curr.name) {
                item.func = curr.name;
            } else if (parts = functionName.exec(curr.toString())) {
                item.func = parts[1];
            }

            if (typeof item.func === 'undefined') {
                try {
                    item.func = parts.input.substring(0, parts.input.indexOf('{'));
                } catch (e) {}
            }

            if (funcs['' + curr]) {
                recursion = true;
            } else {
                funcs['' + curr] = true;
            }

            stack.push(item);
        }

        if (depth) {
            // console.log('depth is ' + depth);
            // console.log('stack is ' + stack.length);
            stack.splice(0, depth);
        }

        var result = {
            'name': ex.name,
            'message': ex.message,
            'url': getLocationHref(),
            'stack': stack
        };
        augmentStackTraceWithInitialElement(result, ex.sourceURL || ex.fileName, ex.line || ex.lineNumber, ex.message || ex.description);
        return result;
    }

    /**
     * Computes a stack trace for an exception.
     * @param {Error} ex
     * @param {(string|number)=} depth
     */
    function computeStackTrace(ex, depth) {
        var stack = null;
        depth = depth == null ? 0 : +depth;

        try {
            stack = computeStackTraceFromStackProp(ex);
            if (stack) {
                return stack;
            }
        } catch (e) {
            if (TraceKit.debug) {
                throw e;
            }
        }

        try {
            stack = computeStackTraceByWalkingCallerChain(ex, depth + 1);
            if (stack) {
                return stack;
            }
        } catch (e) {
            if (TraceKit.debug) {
                throw e;
            }
        }
        return {
            'name': ex.name,
            'message': ex.message,
            'url': getLocationHref()
        };
    }

    computeStackTrace.augmentStackTraceWithInitialElement = augmentStackTraceWithInitialElement;
    computeStackTrace.computeStackTraceFromStackProp = computeStackTraceFromStackProp;

    return computeStackTrace;
}();

var objectAssign$1 = Object.assign || require('object-assign');
var Report = function () {
    function Report(config) {
        var _this = this;

        classCallCheck(this, Report);

        this.Tracekit = TraceKit;
        this.lastGuid = null;
        this.lastReport = null;
        this._config = config;
        TraceKit['report'].subscribe(function (errorReport) {
            _this.handleStackInfo(errorReport);
        });
        this.breadcrumbs = new BreadCrumbs(config);
    }
    /**
     * 处理栈信息
     * @private
     * @param {TraceKit.StackTrace} stackInfo TraceKit获取的栈信息
     */


    createClass(Report, [{
        key: 'handleStackInfo',
        value: function handleStackInfo(stackInfo) {
            var frames = this.prepareFrames(stackInfo);
            triggerEvent('handle', { stackInfo: stackInfo });
            this.processException(stackInfo.name, stackInfo.message, stackInfo.url, frames);
        }
        /**
         * 设置栈帧数据集
         * @private
         * @param {TraceKit.StackTrace} stackInfo TraceKit获取的栈信息
         * @returns {Trace.StackFrame[]}
         */

    }, {
        key: 'prepareFrames',
        value: function prepareFrames(stackInfo) {
            var _this2 = this;

            var frames = [];
            if (stackInfo.stack && stackInfo.stack.length) {
                stackInfo.stack.forEach(function (item) {
                    var frame = _this2.normalizeFrame(item);
                    if (frame) frames.push(frame);
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

    }, {
        key: 'normalizeFrame',
        value: function normalizeFrame(frame) {
            if (!frame.url) return;
            var normalized = {
                fileName: frame.url,
                lineNumber: frame.line,
                columnNumber: frame.column,
                function: frame.func || '?'
            };
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

    }, {
        key: 'processException',
        value: function processException(type, message, fileName, frames) {
            var config = this._config;
            var stacktrace = [];
            if (!!config.ignoreErrors.test && config.ignoreErrors.test(message)) return;
            message += '';
            if (frames && frames.length) {
                fileName = frames[0].fileName || fileName;
                frames.reverse(); // 倒序排列
                stacktrace = frames;
            } else if (fileName) {
                stacktrace.push({
                    fileName: fileName
                });
            }
            if (!!config.ignoreUrls.test && config.ignoreUrls.test(fileName)) return;
            var exception = [{ type: type, message: message, stacktrace: stacktrace }];
            // 处理报告数据
            this.handlePayload(exception);
        }
        /**
         * 处理报告数据
         * @private
         * @param {Array<Trace.CatchedException>} exception
         */

    }, {
        key: 'handlePayload',
        value: function handlePayload(exception) {
            // 合并报告
            var reportData = {
                url: location.href,
                title: document.title,
                environment: environment,
                exception: exception,
                version: this._config.version,
                apiKey: this._config.apiKey,
                timestamp: new Date().getTime(),
                guid: guid(),
                breadcrumbs: this.breadcrumbs.crumbsData
            };
            // 发送报告
            this.sendPayload(reportData);
        }
        /**
         * 发送报告
         * @private
         * @param {Trace.Report} payload
         */

    }, {
        key: 'sendPayload',
        value: function sendPayload(payload) {
            var _this3 = this;

            this.lastGuid = payload.guid;
            if (!this._config.repeatReport && this.isRepeatReport(payload)) return;
            this.lastReport = payload;
            var requestOptions = {
                url: this._config.reportUrl,
                data: payload,
                onSuccess: function onSuccess() {
                    triggerEvent('success', {
                        data: payload,
                        src: _this3._config.reportUrl
                    });
                    return new Promise(function () {});
                },
                OnError: function OnError(error) {
                    triggerEvent('failure', {
                        data: payload,
                        src: _this3._config.reportUrl
                    });
                    error = error || new Error('Trace: report sending failed!');
                    return new Promise(function (resolve) {
                        return resolve(error);
                    });
                }
            };
            // 发送报告请求
            makeRequest(requestOptions);
        }
        /**
         * 判断两份报告是否重复
         * @private
         * @param {Trace.Report} current
         * @returns {boolean}
         */

    }, {
        key: 'isRepeatReport',
        value: function isRepeatReport(current) {
            var last = this.lastReport;
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

    }, {
        key: 'isSameException',
        value: function isSameException(arrayEx1, arrayEx2) {
            if (!arrayEx1.length || !arrayEx2.length) return false;
            var ex1 = arrayEx1[0];
            var ex2 = arrayEx2[0];
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

    }, {
        key: 'isSameStacktrace',
        value: function isSameStacktrace(stacktrace1, stacktrace2) {
            if (!stacktrace1.length || !stacktrace2.length) return false;
            stacktrace1.forEach(function (item, index) {
                if (item.fileName !== stacktrace2[index].fileName || item.columnNumber !== stacktrace2[index].columnNumber || item.lineNumber !== stacktrace2[index].lineNumber || item.function !== stacktrace2[index].function) return false;
            });
            return true;
        }
    }]);
    return Report;
}();

var Performance = function () {
    function Performance() {
        classCallCheck(this, Performance);

        this.collection = {};
        this.getCollection();
    }

    createClass(Performance, [{
        key: 'getCollection',
        value: function getCollection() {
            if (!window.performance) return;
            var timing = window.performance.timing;
            var navigation = window.performance.navigation;
            // 重定向时间
            var redirect = timing.redirectEnd - timing.redirectStart;
            // DNS 解析耗时
            var dns = timing.domainLookupEnd - timing.domainLookupStart;
            // TCP 链接耗时
            var tcp = timing.connectEnd - timing.connectStart;
            // TLS 耗时
            var tls = timing.secureConnectionStart === 0 ? 0 : timing.secureConnectionStart - timing.connectStart;
            // 白屏时间
            var firstPaint = timing.responseStart - timing.navigationStart;
            // 总体网络交互耗时
            var network = timing.responseEnd - timing.navigationStart;
            // DOM解析时间
            var dom = timing.domComplete - timing.responseEnd;
            // 首屏时间 (暂不靠谱)
            var firstScreen = timing.domContentLoadedEventEnd - timing.navigationStart;
            // 用户可操作时间
            var interactive = timing.domInteractive - timing.navigationStart;
            // 页面加载时间
            var pageLoad = timing.loadEventStart - timing.navigationStart;
            // 重定向次数
            var redirectCount = navigation.redirectCount;
            // 网页的加载来源
            var navigationType = navigation.type;
            this.collection = {
                timing: timing, redirect: redirect, dns: dns, tcp: tcp, tls: tls, firstPaint: firstPaint, network: network, dom: dom, firstScreen: firstScreen, interactive: interactive, pageLoad: pageLoad,
                redirectCount: redirectCount, navigationType: navigationType
            };
        }
    }]);
    return Performance;
}();

var objectAssign = Object.assign || require('object-assign');
window.addEventListener('load', function () {
    var analyticsData = new Performance().collection;
    console.log(analyticsData);
    window.navigator.sendBeacon('http://localhost:3001/statistic/', JSON.stringify(analyticsData));
});

var Trace = function () {
    function Trace() {
        classCallCheck(this, Trace);

        this.computeStackTrace = TraceKit['computeStackTrace'];
        this.globalConfig = defaultConfig;
    }

    createClass(Trace, [{
        key: 'config',
        value: function config(_config) {
            this.globalConfig = objectAssign({}, this.globalConfig, _config);
            this.processConfig();
            this.onError = new Report(this.globalConfig);
        }
    }, {
        key: 'captureException',
        value: function captureException(exception) {
            if (!isError(exception)) {
                return this.captureMessage(exception);
            }
            try {
                var stack = this.computeStackTrace(exception);
                this.onError.handleStackInfo(stack);
            } catch (e) {
                if (exception !== e) throw e;
            }
        }
    }, {
        key: 'captureMessage',
        value: function captureMessage(message) {
            if (!!this.globalConfig.ignoreErrors.test && this.globalConfig.ignoreErrors.test(message)) return;
            var exception = void 0;
            try {
                throw new Error(message);
            } catch (e) {
                exception = e;
            }
            var stack = this.computeStackTrace(exception);
            var frames = this.onError.prepareFrames(stack);
            var catchedException = {
                stacktrace: frames,
                message: message
            };
            this.onError.handlePayload([catchedException]);
        }
    }, {
        key: 'processConfig',
        value: function processConfig() {
            var ignoreErrors = this.globalConfig.ignoreErrors;
            var ignoreUrls = this.globalConfig.ignoreErrors;
            ignoreErrors.push(/^Script error\.?$/);
            ignoreErrors.push(/^Javascript error: Script error\.? on line 0$/);
            this.globalConfig.ignoreErrors = joinRegExp(ignoreErrors);
            this.globalConfig.ignoreUrls = ignoreUrls.length && joinRegExp(ignoreUrls);
        }
    }]);
    return Trace;
}();

return Trace;

}());
//# sourceMappingURL=trace.js.map
