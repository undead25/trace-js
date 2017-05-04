export function makeRequest(options: any):void {
  let request:XMLHttpRequest = new XMLHttpRequest();
  const hasCORS:boolean = 'withCredentials' in request || typeof window['XDomainRequest'] !== 'undefined';

  if (!hasCORS) return;

  let url = options.url;
  if ('withCredentials' in request) {
    request.onreadystatechange = () => {
      if (request.readyState !== 4) {
        return;
      } else if (request.status === 200) {
        options.onSuccess = options.onSuccess();
      } else if (options.onError) {
        let error: any = new Error(`Error: ${request.status}`);
        error.request = request;
        options.onError(error);
      }
    }
  } else {
    // xdomainrequest cannot go http -> https (or vice versa),
    // so always use protocol relative
    request = new (window as any).XDomainRequest();
    url = url.replace(/^https?:/, '');

    // onreadystatechange not supported by XDomainRequest
    if(options.onSuccess) request.onload = options.onSuccess;
    if(options.onError) {
      request.onerror = () => {
        let error: any = new Error(`Error: XDomainRequest`);
        error.request = request;
        options.onError(error);
      }
    }
  }

  request.open('POST', url, true);
  request.send(JSON.stringify(options.data));
}
