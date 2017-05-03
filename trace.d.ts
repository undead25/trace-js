export = Trace;
export as namespace Trace;
declare namespace Trace {

  export function init(config?: Config): void;

  export function captureException(exception: any): void;

  export function captureMessage(message: string): void;

  interface Config {
    /** 是否开启监控 */
    enabled: boolean;
    /** 监控上报地址 */
    readonly reportUrl: string;
    /** 客户端的 API key，由后端生成，客户端唯一标识符 */
    readonly apiKey: string;
    /** 最大堆栈长度 */
    maxStackDepth: number;
    /** 忽略某个错误 */
    ignoreErrors: RegExp | Array<RegExp>;
    /** 忽略某个错误 */
    ignoreUrls: RegExp | Array<RegExp>;
    /** 自动记录用户操作面包屑 */
    autoBreadcrumbs: autoBreadcrumbs;
    /** 是否捕获 ajax 请求 */
    catchAjax: boolean;
    /** 是否捕获 console error 信息 */
    catchConsole: boolean;
    /** 发布版本，`production` | `test` | `developement` */
    releaseStage: string;
    /** 客户端版本 */
    version?: string;
    /** 用户信息 */
    userInfo?: Object;
    /** 异常捕捉后是否不允许控制台输出，默认 false */
    disableLog: boolean;
    /** 是否不允许发送重复报告，默认 false */
    repeatReport: boolean;
    /** 最大用户操作数*/
    maxBreadcrumbs: number;
  }

  interface autoBreadcrumbs {
    /** 异步请求操作 */
    xhr: boolean;
    /** dom事件 */
    dom: boolean;
    /** location变动 */
    location: boolean;
    /** 调试，默认 false */
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
