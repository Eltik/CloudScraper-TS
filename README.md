# cloudscraper-ts
Node.JS library to bypass some of Cloudflare's anti-ddos page. All credit goes to the original author [here](https://github.com/codemanki/cloudscraper).

## About CloudScraper
There are some anti-bot pages such as [NovelUpdates](https://novelupdates.com) that can be bypassed via the normal [CloudScraper](https://npmjs.com/package/cloudscraper) package. I simply rewrote it and added TypeScript types to it.

## Usage
This is pretty scuffed, so I suggest you take a look at the original GitHub page for more documentation. The only change is that everything is stored in an object and you need to call the `request()` function.
```typescript
import CloudScraper from "cloudscraper-ts"

new CloudScraper().request({
  url: "https://novelupdates.com",
  method: "POST",
  formData: "somethinghere"
});
```