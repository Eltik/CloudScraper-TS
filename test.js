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