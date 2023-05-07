const CloudScraper = require("./dist/index").default;
const cloud = new CloudScraper();

cloud.get("https://www.google.com").then(console.log)