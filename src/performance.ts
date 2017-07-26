export default class Performance {
  public collection = {};

  constructor() {
    this.getCollection();
  }

  private getCollection() {
    if (!window.performance) return;

    const timing = window.performance.timing;
    const navigation = window.performance.navigation;

    // 重定向时间
    const redirect = timing.redirectEnd - timing.redirectStart;
    // DNS 解析耗时
    const dns = timing.domainLookupEnd - timing.domainLookupStart;
    // TCP 链接耗时
    const tcp = timing.connectEnd - timing.connectStart;
    // TLS 耗时
    const tls = timing.secureConnectionStart === 0 ? 0 :  timing.secureConnectionStart - timing.connectStart;
    // 白屏时间
    const firstPaint = timing.responseStart - timing.navigationStart;
    // 总体网络交互耗时
    const network = timing.responseEnd - timing.navigationStart;
    // DOM解析时间
    const dom = timing.domComplete - timing.responseEnd;
    // 首屏时间 (暂不靠谱)
    const firstScreen = timing.domContentLoadedEventEnd - timing.navigationStart;
    // 用户可操作时间
    const interactive = timing.domInteractive - timing.navigationStart;
    // 页面加载时间
    const pageLoad = timing.loadEventStart - timing.navigationStart;

    // 重定向次数
    const redirectCount = navigation.redirectCount;
    // 网页的加载来源
    const navigationType = navigation.type;


    this.collection = {
      timing, redirect, dns, tcp, tls, firstPaint, network, dom, firstScreen, interactive, pageLoad,
      redirectCount, navigationType
    }
    
  }
}
