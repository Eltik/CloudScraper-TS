# cloudscraper-ts
Node.JS library to bypass some of Cloudflare's anti-ddos page. All credit goes to the original author [here](https://github.com/codemanki/cloudscraper).

## About CloudScraper
There are some anti-bot pages such as [NovelUpdates](https://novelupdates.com) that can be bypassed via the normal [CloudScraper](https://npmjs.com/package/cloudscraper) package. I simply rewrote it and added TypeScript types to it.

## Usage
This is pretty scuffed, so I suggest you take a look at the original GitHub page for more documentation. Essentially, all that the function does is the following:
```typescript
const request = require("./dist/index").default;

const body = {
    action: "nd_ajaxsearchmain",
    strType: "desktop",
    strOne: "Mushoku Tensei",
    strSearchType: "series"
}
request({
    uri: "https://www.novelupdates.com/wp-admin/admin-ajax.php",
    method: "POST",
    formData: body
}, {
    challengesToSolve: 3
}).then(res => {
    console.log(res.body);
});
```