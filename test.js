const CloudScraper = require("./dist/index").default;
const cloud = new CloudScraper();

const body = {
    action: "nd_ajaxsearchmain",
    strType: "desktop",
    strOne: "Mushoku Tensei",
    strSearchType: "series"
}
cloud.request({
    url: "https://www.novelupdates.com/wp-admin/admin-ajax.php",
    method: "POST",
    formData: body
}).then(res => {
    console.log(res);
});