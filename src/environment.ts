
export const environment: Trace.Environment = {
  /** 屏幕宽度 */
  screenWidth: (document.documentElement ? document.documentElement.clientWidth : document.body.clientWidth),
  /** 屏幕高度 */
  screenHeigth: (document.documentElement ? document.documentElement.clientHeight : document.body.clientHeight),
  /** 浏览器信息 */
  userAgent: navigator.userAgent,
  /** 浏览器语言 */
  language: navigator.language
}
