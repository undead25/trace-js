## Usage

### Augular
> Angular means Angular 2+
Trace can be configured to catch any Angular-specific (2.x) exceptions reported through the [@angular/core/ErrorHandler](https://angular.io/docs/js/latest/api/core/index/ErrorHandler-class.html) component. 

#### Installation
```bash
$ npm install trace-js --save
```
#### Configuration
In your main module file (where `@NgModule` is called, e.g. `app.module.ts`)

```typescript
import Trace = require('trace-js');
import { BrowserModule } from '@angular/platform-browser';
import { NgModule, ErrorHandler } from '@angular/core';
import { AppComponent } from './app.component';

Trace.config({
  apiKey: 'your apikey from your server client', // it can be empty string if your server do not configured
  reportUrl: 'http://example.com/api/error' // your server api url to reveive the report
  
  //... other configuration options, see api reference
});

export class TraceErrorHandler implements ErrorHandler {
  handleError(err:any) : void {
    Trace.captureException(err.originalError || err);
  }
}

@NgModule({
  imports: [ BrowserModule ],
  declarations: [ AppComponent ],
  bootstrap: [ AppComponent ],
  providers: [ { provide: ErrorHandler, useClass: TraceErrorHandler } ]
})
export class AppModule { }
```

### Browser
Trace distributed in a few different methods, and should get included after any other libraries are included, but before your own scripts.

So for example:
```html
<script src="jquery.js"></script>
<script src="trace.min.js"></script>
<script>
  Trace.config({
    apiKey: 'your apikey from your server client', // it can be empty string if your server do not configured
    reportUrl: 'http://example.com/api/error' // your server api url to reveive the report
    
    //... other configuration options, see api reference
  });
</script>
<script src="app.js"></script>
```

