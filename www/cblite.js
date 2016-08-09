function getServerURL(success, failure) {
    cordova.exec(
        function (url) {
            success(url);
        }, function (err) {
            failure(err);
        }, "CBLite", "getURL", []);
}

function launchCouchbaseLite(success, failure) {
    cordova.exec(
        function (url) {
            success(url);
        },
        function (err) {
            failure(err);
        },
        "CBLite",
        "launchCouchbaseLite",
        []);
}

function stopReplication(dbName, success, failure) {
    cordova.exec(
        function (url) {
            success(url);
        },
        function (err) {
            failure(err);
        },
        "CBLite",
        "stopReplication",
        [dbName]);
}

module.exports = {
    getServerURL: getServerURL,
    stopReplication: stopReplication
};