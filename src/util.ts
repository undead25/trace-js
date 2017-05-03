
/**
 * 是否为IE浏览器
 * @export
 * @returns {boolean} 
 */
export function isIE(): boolean {
  return navigator.appVersion.indexOf("MSIE") !== -1;
}

export function isError(value: any): boolean {
  switch (Object.prototype.toString.call(value)) {
    case '[object Error]': return true;
    case '[object Exception]': return true;
    case '[object DOMException]': return true;
    default: return value instanceof Error;
  }
}

/**
 * 生产唯一ID
 * @export
 * @returns {string} - 唯一guid
 */
export function guid(): string {
  var crypto = window.crypto || window['msCrypto'];

  if (crypto && crypto.getRandomValues) {
    // Use window.crypto API if available
    var arr = new Uint16Array(8);
    crypto.getRandomValues(arr);

    // set 4 in byte 7
    arr[3] = arr[3] & 0xFFF | 0x4000;
    // set 2 most significant bits of byte 9 to '10'
    arr[4] = arr[4] & 0x3FFF | 0x8000;

    var pad = function (num) {
      var v = num.toString(16);
      while (v.length < 4) {
        v = '0' + v;
      }
      return v;
    };

    return pad(arr[0]) + pad(arr[1]) + pad(arr[2]) + pad(arr[3]) + pad(arr[4]) +
      pad(arr[5]) + pad(arr[6]) + pad(arr[7]);
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
export function triggerEvent(eventType: string, options: Object = {}): void {
  if (!document) return;

  let _event: Event;
  let key: string;

  eventType = eventType.substr(0, 1).toUpperCase + eventType.substr(1);

  if (document.createEvent) {
    _event = document.createEvent('HTMLEvents');
    _event.initEvent(eventType, true, true);
  } else {
    // IE8-9
    _event = document['createEventObject']();
    (_event as any).eventType = eventType;
  }

  for (key in options) {
    if (options.hasOwnProperty(key)) {
      _event[key] = options[key];
    }
  }

  if (document.createEvent) {
    document.dispatchEvent(_event);
  } else {
    document['fireEvent']('on' + (_event as any).eventType.toLowerCase(), _event);
  }
}

/**
 * 原生方法垫片
 * @param {Object} obj - 内置对象，例：`window`, `document`
 * @param {string} name - 内置对象的函数名称，例：`addEventListener`
 * @param {Function} replacement - 替换后的函数
 * @param {*} [track] - record instrumentation to an array
 */
export function polyfill(obj: Object, name: string, replacement: Function, track?: any): void {
  const origin = obj[name];
  obj[name] = replacement(origin);
  if (track) {
    track.push([obj, name, origin]);
  }
}

export function wrap(options: any, func?: any, origin?: any) {
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
    let trace, inner;
    var args = [], i = arguments.length,
      deep = !options || options && options.deep !== false;

    if (origin && typeof origin === 'function') {
      origin.apply(this, arguments);
    }

    while (i--) args[i] = deep ? wrap(options, arguments[i]) : arguments[i];

    try {
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
export function joinRegExp(patterns: Array<RegExp>): RegExp {
  let sources = [];
  let pattern;
  for (let i = 0; i < patterns.length; i++) {
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
export function htmlTreeAsString(element: HTMLElement): string {
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
    if (nextStr === 'html' || height > 1 && len + (out.length * sepLength) + nextStr.length >= MAX_OUTPUT_LEN) {
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
function htmlElementAsString(element: HTMLElement): string {
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
export function parseUrl(url: string) {
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
export function getAttributes(element: HTMLElement): Object {
  const result: Object = {};
  const attributes: NamedNodeMap = element.attributes;

  for (let i = 0; i < attributes.length; i++) {
    const item = attributes[i];
    result[item.name] = item.value;
  }

  return result;
}