class Action {
  private data: Array<any> = [];
  private _store: any;
  private clickEventSelectors: Array<string>;
  private changeEventSelectors: Array<string>;

  constructor(config: Trace.Config, store: any) {
    this._store = store;

    if (config.autoBreadcrumbs) {
      this.clickEventSelectors = ['a', 'button', 'input[button]', 'input[submit]', 'input[radio]', 'input[checkbox]']
      this.changeEventSelectors = ['input[text]', 'input[password]', 'textarea', 'select']
      this.init();
    }
  }

  private init() {
    window.addEventListener('click', (event) => {
      this.eventHandler('click', this.clickEventSelectors, event);
    }, true);
    window.addEventListener('blur', (event) => {
      this.eventHandler('input', this.changeEventSelectors, event);
    }, true);
  }

  /**
   * 事件处理
   * @private
   * @param {string} action - 事件名称
   * @param {Array<string>} selectorFilter - 需要过滤的标签类型 
   * @param {Event} event - 事件对象
   */
  private eventHandler(action: string, selectorFilter: Array<string>, event: Event): void {
    const target = event.target || event.srcElement;
    if (target == document || target == window || target == document.documentElement || target == document.body) {
      return
    }
    const tag: string = (target as HTMLElement).tagName.toLowerCase();

    if (this.acceptTag(target as HTMLElement, selectorFilter)) {
      this.record(target as HTMLElement, tag, action);
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
   * 根据不同的元素，记录不同的内容
   * @private
   * @param {HTMLElement} element - 需要记录的元素
   * @param {string} tagName - 小写的 html 标签
   * @param {*} action - 动作标识
   * @returns - 返回 result 的 guid
   */
  private record(element: HTMLElement, tagName: string, action: any): void {
    const attributes = this.getAttributes(element);
    let result: any = {
      tag: tagName,
      action,
      time: new Date().getTime(),
      attributes,
      extra: {}
    }

    let _element = element as HTMLInputElement;

    if (tagName === 'input') {
      switch (element.nodeName) {
        case 'text':
          result.extra.length = _element.value.length;
          break;
        case 'checkbox':
        case 'radio':
          result.extra.checked = _element.checked;
          break;
      }
    } else if (tagName === 'textarea') {
      result.extra.length = _element.value.length;
    } else if (tagName === 'select') {
      const _element = element as HTMLSelectElement;
      result.extra.selectIndex = _element.selectedIndex;
      result.extra.value = _element.value;
    }

    return this._store.add(result, 'act');
  }

  /**
   * 获取元素的属性值 
   * @private
   * @param {HTMLElement} element  - 需要获取属性的元素
   * @returns {Object} - 属性键值对象
   */
  private getAttributes(element: HTMLElement): Object {
    const result: Object = {};
    const attributes: NamedNodeMap = element.attributes;

    for (let i = 0; i < attributes.length; i++) {
      const item = attributes[i];
      result[item.name] = item.value;
    }

    return result;
  }

}

export default Action;
