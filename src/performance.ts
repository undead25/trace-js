import { makeRequest } from './request';
import { triggerEvent } from './util';

export default class Performance {
  public collection: Object;
  public config: Trace.Config;

  /**
   * Creates an instance of Performance.
   * @param {Trace.Config} config 
   */
  constructor(config: Trace.Config) {
    this.config = config;
    this.getCollection();
  }

  /**
   * Sending performance payload using xhr or beacon
   * @returns {void} 
   */
  public payloadSending(): void {
    if (!this.collection || this.collection['dom'] < 0) return;

    const data = JSON.stringify(this.collection);
    if (window.navigator && window.navigator.sendBeacon) {
      console.log('url change')
      window.navigator.sendBeacon(this.config.performanceUrl, data);
    } else {
      const requestOptions = {
        url: this.config.performanceUrl,
        data,
        onSuccess: () => {
          triggerEvent('success', {
            data,
            src: this.config.performanceUrl
          })
          return new Promise(() => { });
        },
        OnError: (error) => {
          triggerEvent('failure', {
            data,
            src: this.config.performanceUrl
          })
          error = error || new Error(`发送上报请求失败`);
          return new Promise(resolve => resolve(error))
        }
      }
      // 发送报告请求
      makeRequest(requestOptions);
    }
  }

  /**
   * Collect performance metrics data
   * @returns {void} 
   */
  private getCollection(): void {
    if (!window.performance) return;

    const timing = window.performance.timing;
    const navigation = window.performance.navigation;
    const resource: Array<any> = window.performance.getEntriesByType('resource');

    // 重定向时间
    const redirect = timing.redirectEnd - timing.redirectStart;
    // DNS 解析耗时
    const dns = timing.domainLookupEnd - timing.domainLookupStart;
    // TCP 链接耗时
    const tcp = timing.connectEnd - timing.connectStart;
    // TLS 耗时
    const tls = timing.secureConnectionStart === 0 ? 0 : timing.secureConnectionStart - timing.connectStart;
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

    let resources: Array<any> = [];
    resource.forEach(item => {
      const { initiatorType, name, duration, transferSize } = item;
      resources.push({
        url: name,
        tag: initiatorType,
        duration: duration.toFixed(2),
        size: transferSize
      })
    });

    this.collection = {
      redirect, dns, tcp, tls, firstPaint, network, dom, firstScreen, interactive, pageLoad,
      redirectCount, navigationType,
      resources,
      userAgent: window.navigator.userAgent,
      url: window.location.href,
      protocol: window.location.protocol,
      apiKey: this.config.apiKey,
      domain: window.location.protocol + '//' + window.location.host,
      timing: JSON.stringify(timing)
    }
  }
}
