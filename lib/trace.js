
/*!
 * trace-js v0.0.8
 * Licensed under the MIT License.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global._Trace = factory());
}(this, (function () { 'use strict';

var defaultConfig = {
    apiKey: '',
    exceptionUrl: 'http://localhost:3001/tracer/error',
    performanceUrl: 'http://localhost:3001/api/perf/create',
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

/**
 * 是否为IE浏览器
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

var Performance = function () {
    /**
     * Creates an instance of Performance.
     * @param {Trace.Config} config
     */
    function Performance(config) {
        classCallCheck(this, Performance);

        this.config = config;
        this.getCollection();
    }
    /**
     * Sending performance payload using xhr or beacon
     * @returns {void}
     */


    createClass(Performance, [{
        key: 'payloadSending',
        value: function payloadSending() {
            var _this = this;

            if (!this.collection || this.collection['dom'] < 0) return;
            var data = JSON.stringify(this.collection);
            if (window.navigator && window.navigator.sendBeacon) {
                console.log('url change');
                window.navigator.sendBeacon(this.config.performanceUrl, data);
            } else {
                var requestOptions = {
                    url: this.config.performanceUrl,
                    data: data,
                    onSuccess: function onSuccess() {
                        triggerEvent('success', {
                            data: data,
                            src: _this.config.performanceUrl
                        });
                        return new Promise(function () {});
                    },
                    OnError: function OnError(error) {
                        triggerEvent('failure', {
                            data: data,
                            src: _this.config.performanceUrl
                        });
                        error = error || new Error('\u53D1\u9001\u4E0A\u62A5\u8BF7\u6C42\u5931\u8D25');
                        return new Promise(function (resolve) {
                            return resolve(error);
                        });
                    }
                };
                console.log('url change');
                // 发送报告请求
                makeRequest(requestOptions);
            }
        }
        /**
         * Collect performance metrics data
         * @returns {void}
         */

    }, {
        key: 'getCollection',
        value: function getCollection() {
            if (!window.performance) return;
            var timing = window.performance.timing;
            var navigation = window.performance.navigation;
            var resource = window.performance.getEntriesByType('resource');
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
            var resources = [];
            resource.forEach(function (item) {
                var initiatorType = item.initiatorType,
                    name = item.name,
                    duration = item.duration,
                    transferSize = item.transferSize;

                resources.push({
                    url: name,
                    tag: initiatorType,
                    duration: duration.toFixed(2),
                    size: transferSize
                });
            });
            this.collection = {
                redirect: redirect, dns: dns, tcp: tcp, tls: tls, firstPaint: firstPaint, network: network, dom: dom, firstScreen: firstScreen, interactive: interactive, pageLoad: pageLoad,
                redirectCount: redirectCount, navigationType: navigationType,
                resources: resources,
                userAgent: window.navigator.userAgent,
                url: window.location.href,
                protocol: window.location.protocol,
                apiKey: this.config.apiKey,
                domain: window.location.protocol + '//' + window.location.host,
                timing: JSON.stringify(timing)
            };
        }
    }]);
    return Performance;
}();

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
            if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host) {
                to = parsedTo.relative;
            }
            if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host) {
                from = parsedFrom.relative;
            }
            var perf = new Performance(this._config);
            perf.payloadSending();
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
            var _crumb = Object.assign({}, crumb, { timestamp: new Date().getTime() });
            this.crumbsData.push(_crumb);
            // 超出后删除最先记录的一个
            if (this.crumbsData.length > this._config.maxBreadcrumbs) {
                this.crumbsData.shift();
            }
        }
    }]);
    return BreadCrumbs;
}();

/**
 * Most of all are borrowed from Tracekit
 * @see https://github.com/occ/TraceKit
 * @class Exception
 */
var Exception = function () {
    function Exception() {
        classCallCheck(this, Exception);

        this.stackInfo = null;
        this.originOnError = window.onerror;
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
        this.ERROR_TYPES = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;
        this.handleWindowOnError = this.handleWindowOnError.bind(this);
    }

    createClass(Exception, [{
        key: 'handleWindowOnError',
        value: function handleWindowOnError(message, source, lineno, colno, error) {
            if (error) {
                this.stackInfo = this.analyzeErrorStack(error);
            } else {
                var frame = { source: source, lineno: lineno, colno: colno, function: '?' };
                var type = void 0,
                    msg = message;
                if (Object.prototype.toString.call(message) === '[object String]') {
                    // example: ['Uncaught TypeError: blah blah blah', 'TypeError' 'blah blah blah']
                    var msgGroup = message.match(this.ERROR_TYPES);
                    if (msgGroup) {
                        type = msgGroup[1];
                        msg = msgGroup[2];
                    }
                }
                // set exception data
                this.stackInfo = {
                    type: type,
                    message: msg,
                    url: window.location.href,
                    lineno: lineno,
                    colno: colno,
                    stacktrace: {
                        frames: [frame]
                    }
                };
                console.log(this.stackInfo);
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

    }, {
        key: 'analyzeErrorStack',
        value: function analyzeErrorStack(error, depth) {
            var name = error.name,
                message = error.message;

            depth = depth == null ? 0 : +depth;
            var errorStack = void 0;
            try {
                errorStack = this.analyzeErrorStack(error);
                if (errorStack) return errorStack;
            } catch (e) {}
            try {
                errorStack = this.analyzeStackFromCaller(error, depth + 1);
                if (errorStack) return errorStack;
            } catch (e) {}
            return {
                name: name,
                message: message,
                url: window.location.href
            };
        }
        /**
         * Analyze stack from error object properties
         * @param {Error} error
         * @returns {{ name: string, message: string, url: string, stack: Array<any>}}
         */

    }, {
        key: 'analyzeStackFromProp',
        value: function analyzeStackFromProp(error) {
            var name = error.name,
                stack = error.stack,
                message = error.message;

            if (typeof stack === 'undefined' || !stack) return;
            var chrome = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
            var gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?)(?::(\d+))?(?::(\d+))?\s*$/i;
            var winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
            var chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;
            var geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
            var lines = stack.split('\n');
            var reference = /^(.*) is undefined$/.exec(message);
            var stackInfo = [],
                submatch = void 0,
                parts = void 0,
                element = void 0;
            for (var i = 0, j = lines.length; i < j; ++i) {
                if (parts = chrome.exec(lines[i])) {
                    var isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
                    var _isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
                    if (_isEval && (submatch = chromeEval.exec(parts[2]))) {
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
                } else if (parts = gecko.exec(lines[i])) {
                    var isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
                    if (isEval && (submatch = geckoEval.exec(parts[3]))) {
                        // throw out eval line/column and use top-most line number
                        parts[3] = submatch[1];
                        parts[4] = submatch[2];
                        parts[5] = null; // no column when eval
                    } else if (i === 0 && !parts[5] && typeof error.columnNumber !== 'undefined') {
                        // FireFox uses this awesome columnNumber property for its top frame
                        // Also note, Firefox's column number is 0-based and everything else expects 1-based,
                        // so adding 1
                        // NOTE: this hack doesn't work if top-most frame is eval
                        stackInfo[0].column = error.columnNumber + 1;
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
                name: name,
                message: message,
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

    }, {
        key: 'analyzeStackFromCaller',
        value: function analyzeStackFromCaller(error, depth) {
            var name = error.name,
                message = error.message;

            var functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;
            var stackInfo = [],
                funcs = {},
                recursion = false,
                parts = void 0,
                item = void 0,
                source = void 0;
            for (var curr = this.analyzeStackFromCaller.caller; curr && !recursion; curr = curr.caller) {
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
                } else if (parts = functionName.exec(curr.toString())) {
                    item.func = parts[1];
                }
                typeof item.func === 'undefined' && (item.func = parts.input.substring(0, parts.indexOf('{')));
                funcs['' + curr] ? recursion = true : funcs['' + curr] = true;
                stackInfo.push(item);
            }
            depth && stackInfo.splice(0, depth);
            var result = {
                name: name,
                message: message,
                url: window.location.href,
                stack: stackInfo
            };
            var err = error;
            this.analyzeFirstFrame(result, err.sourceURL || err.fileName, err.line || err.lineNumber, err.message || err.description);
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

    }, {
        key: 'analyzeFirstFrame',
        value: function analyzeFirstFrame(stackInfo, url, line, message) {
            var initial = { url: url, line: line, func: '?' };
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
    }]);
    return Exception;
}();

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

// import Tracekit from './tracekit';

var Report = function () {
    function Report(config) {
        classCallCheck(this, Report);

        this.lastGuid = null;
        this.lastReport = null;
        this.config = config;
        // Tracekit['report'].subscribe((errorReport: any) => {
        //   this.handleStackInfo(errorReport)
        // })
        var exception = new Exception();
        window.onerror = exception.handleWindowOnError;
        // this.handleStackInfo(exception.stackInfo);
        this.breadcrumbs = new BreadCrumbs(config);
    }
    /**
     * 处理栈信息
     * @private
     * @param {Trace.StackInfo} stackInfo TraceKit获取的栈信息
     */


    createClass(Report, [{
        key: 'handleStackInfo',
        value: function handleStackInfo(stackInfo) {
            var frames = this.prepareFrames(stackInfo);
            triggerEvent('handle', { stackInfo: stackInfo });
            var type = stackInfo.type,
                message = stackInfo.message,
                url = stackInfo.url,
                lineno = stackInfo.lineno;

            this.handleException(type, message, url, lineno, frames);
        }
        /**
         * 处理报告数据
         * @private
         * @param {Trace.CatchedException} exception
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
                version: this.config.version,
                apiKey: this.config.apiKey,
                timestamp: new Date().getTime(),
                guid: guid(),
                breadcrumbs: this.breadcrumbs.crumbsData
            };
            // 发送报告
            this.sendPayload(reportData);
        }
        /**
         * 设置栈帧数据集
         * @private
         * @param {Trace.StackInfo} stackInfo TraceKit获取的栈信息
         * @returns {Trace.StackFrame[]}
         */

    }, {
        key: 'prepareFrames',
        value: function prepareFrames(stackInfo) {
            var stacktrace = stackInfo.stacktrace;

            var frames = [];
            if (stacktrace.frames && stacktrace.frames.length) {
                stacktrace.frames.forEach(function (item) {
                    frames.push(item);
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

    }, {
        key: 'handleException',
        value: function handleException(type, message, url, lineno, frames) {
            var config = this.config;
            var stacktrace = void 0;
            if (!!config.ignoreErrors.test && config.ignoreErrors.test(message)) return;
            message += '';
            if (frames && frames.length) {
                url = frames[0].source || url;
                frames.reverse(); // 倒序排列
                stacktrace.frames = frames;
            } else if (url) {
                stacktrace.frames = [{ source: url, lineno: lineno }];
            }
            if (!!config.ignoreUrls.test && config.ignoreUrls.test(url)) return;
            var exception = {
                type: type,
                message: message,
                stacktrace: stacktrace
            };
            // 处理报告数据
            this.handlePayload(exception);
        }
        /**
         * 发送报告
         * @private
         * @param {Trace.Report} payload
         */

    }, {
        key: 'sendPayload',
        value: function sendPayload(payload) {
            var _this = this;

            this.lastGuid = payload.guid;
            if (!this.config.repeatReport && this.isRepeatReport(payload)) return;
            this.lastReport = payload;
            var requestOptions = {
                url: this.config.exceptionUrl,
                data: payload,
                onSuccess: function onSuccess() {
                    triggerEvent('success', {
                        data: payload,
                        src: _this.config.exceptionUrl
                    });
                    return new Promise(function () {});
                },
                OnError: function OnError(error) {
                    triggerEvent('failure', {
                        data: payload,
                        src: _this.config.exceptionUrl
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
            if (!arrayEx1 || !arrayEx2) return false;
            var ex1 = arrayEx1;
            var ex2 = arrayEx2;
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

    }, {
        key: 'isSameStacktrace',
        value: function isSameStacktrace(stacktrace1, stacktrace2) {
            if (!stacktrace1.length || !stacktrace2.length) return false;
            stacktrace1.forEach(function (item, index) {
                if (item.source !== stacktrace2[index].source || item.colno !== stacktrace2[index].colno || item.lineno !== stacktrace2[index].lineno || item.function !== stacktrace2[index].function) return false;
            });
            return true;
        }
    }]);
    return Report;
}();

var Trace = function () {
    function Trace() {
        classCallCheck(this, Trace);

        // private computeStackTrace: TraceKit.ComputeStackTrace = Tracekit['computeStackTrace'];
        this.analyzeErrorStack = new Exception().analyzeErrorStack;
        this.globalConfig = defaultConfig;
    }

    createClass(Trace, [{
        key: 'config',
        value: function config(_config) {
            var _this = this;

            this.globalConfig = Object.assign({}, this.globalConfig, _config);
            this.processConfig();
            this.onError = new Report(this.globalConfig);
            window.addEventListener('beforeunload', function () {
                var perf = new Performance(_this.globalConfig);
                perf.payloadSending();
            });
        }
    }, {
        key: 'captureException',
        value: function captureException(exception) {
            if (!isError(exception)) {
                return this.captureMessage(exception);
            }
            try {
                var stackInfo = this.analyzeErrorStack(exception);
                this.onError.handleStackInfo(stackInfo);
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
            var stack = this.analyzeErrorStack(exception);
            var frames = this.onError.prepareFrames(stack);
            var catchedException = {
                stacktrace: { frames: frames },
                message: message
            };
            this.onError.handlePayload(catchedException);
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

})));
window.Trace = new _Trace()
//# sourceMappingURL=trace.js.map
