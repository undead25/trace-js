export = Trace;
export as namespace Trace;
declare namespace Trace {

  /**
   * Configuration of Trace which will install a global error handler by window.onerror
   * This is needed to enable Trace
   * @param {Config} [config] 
   */
  export function config(config?: Config): void;

  /**
   * Manually capture exception
   * @param {Error} exception - Error information to be captured
   */
  export function captureException(exception: Error): void;

  /**
   * Manually capture message
   * @param {string} message - plain message to be captured
   */
  export function captureMessage(message: string): void;

  interface Config {
    /** Server side API url to get the report */
    readonly reportUrl: string;
    /** 客户端的 API key，由后端生成，客户端唯一标识符 */
    readonly apiKey: string;
    /** 最大堆栈长度 */
    readonly maxStackDepth?: number;
    /** 忽略某个错误 */
    ignoreErrors?: RegExp | Array<RegExp>;
    /** 忽略某个错误 */
    ignoreUrls?: RegExp | Array<RegExp>;
    /** 自动记录用户操作面包屑 */
    readonly autoBreadcrumbs?: autoBreadcrumbs;
    /** 是否捕获 ajax 请求 */
    readonly catchAjax?: boolean;
    /** 是否捕获 console error 信息 */
    readonly catchConsole?: boolean;
    /** 发布版本，`production` | `test` | `developement` */
    readonly releaseStage?: string;
    /** 客户端版本 */
    readonly version?: string;
    /** User information */
    readonly userInfo?: Object;
    /** 是否不允许发送重复报告，默认 false */
    readonly repeatReport?: boolean;
    /** Max user actions to be stored to send. Default: 100 */
    readonly maxBreadcrumbs?: number;
  }

  interface autoBreadcrumbs {
    /** xhr request */
    xhr: boolean;
    /** Dom events */
    dom: boolean;
    /** Location change */
    location: boolean;
    /** Console information */
    console: boolean;
  }

  interface Report {
    /** 路径名称 */
    readonly url: string;
    /** 页面标题 */
    readonly title: string;
    /** 异常数据集 */
    readonly exception: Array<CatchedException>;
    /** 客户端环境 */
    readonly environment: Environment;
    /** 客户端用户信息 */
    readonly userInfo?: any;
    /** 客户端版本号 */
    readonly version: string;
    /** 客户端的 API key，由后端生成，客户端唯一标识符 */
    readonly apiKey: string;
    /** 上报 guid */
    readonly guid: string;
    /** 上报时间戳 */
    readonly timestamp: number;
    /** 用户行为面包屑 */
    readonly breadcrumbs?: Array<BreadCrumb>;
  }

  interface CatchedException {
    /** 错误类型 */
    type?: string;
    /** 错误信息 */
    message: string;
    /** 错误栈数据集 */
    stacktrace: Array<StackFrame>;
  }

  interface StackFrame {
    /** 发生错误对应的脚本路径 */
    fileName: string;
    /** 发生错误行号 */
    lineNumber?: number;
    /** 发生错误列号 */
    columnNumber?: number;
    /** 发生错误对应的函数 */
    function?: string;
  }

  interface Environment {
    /** 屏幕宽度 */
    screenWidth: number;
    /** 屏幕高度 */
    screenHeigth: number;
    /** 浏览器信息 */
    userAgent: string;
    /** 浏览器语言 */
    language: string;
  }

  interface requestOptions {
    url: string;
    data: Report;
    onError: () => any;
    onSuccess: (error: any) => any;
  }

  interface BreadCrumb {
    /** 类别 `fetch`, `xhr`, `console`, `navigation`, */
    category: string;
    /** DOM结构 */
    htmlTree?: string;
    /** 信息 only console*/
    message?: string;
    /** 级别 only console*/
    level?: string;
    /** 类型，only for `xhr` or `fetch` */
    type?: string;
    /** 时间戳 */
    timestamp?: number;
    /** 数据信息 */
    data?: BreadCrumbData;
  }

  interface BreadCrumbData {
    /** http请求方式，`POST`, `GET`... */
    method?: string;
    /** http请求路径 */
    url?: string;
    /** http请求状态码 */
    statusCode?: number;
    /** 下个页面 */
    to?: string;
    /** 上个页面 */
    from?: string;
  }

}
