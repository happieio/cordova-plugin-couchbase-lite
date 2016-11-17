/// <reference path="../../../../typedefs/tsd.d.ts" />
///<reference path="typedefs/cblsubtypes.d.ts" />

import Promise = require('bluebird');

class cblDB {

    dbName = '';
    lastChange = 0;

    static eventTypes = {
        active: 'active', change: 'change', complete: 'complete', denied: 'denied', error: 'error', paused: 'paused'
    };

    dbUrl:string = '';
    localServerUrl = '';
    syncUrl = '';

    constructor(dbName:string, syncUrl?:string) {
        this.dbName = dbName.replace(/[^a-z0-9$_()+-/]/g, '');
        this.syncUrl = syncUrl;
    }

    initDB(syncUrl?:string) {
        return new Promise((resolve, reject)=> {
            if (syncUrl) this.syncUrl = syncUrl;
            cbl.getServerURL((url)=> {
                    this.localServerUrl = url;
                    this.dbUrl = new URI(this.localServerUrl).directory(this.dbName).toString();
                    this.processRequest('PUT', this.dbUrl.toString(), null, null,
                        (err, response)=> {
                            if (err.status == 412) resolve(err.response);
                            else if (response) resolve(true);
                            else if (err) reject(this.buildError('Error From DB PUT Request with status: ' + err.status, err));
                            else reject(this.buildError('Unknown Error From DB PUT Request', {
                                    res: response,
                                    err: err
                                }));
                        });
                },
                (err)=> {throw new Error(err); });
        });
    }

    activeTasks():any {
        return new Promise((resolve, reject)=> {
            var verb = 'GET';
            var uri = new URI(this.localServerUrl).segment('_active_tasks');
            this.processRequest(verb, uri.toString(), null, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From activeTasks Request', err));
                    else resolve(success);
                });
        });
    }

    allDocs(params?:cbl.IAllDocsParams) {
        return new Promise((resolve, reject)=> {
            var verb = 'GET';
            var body = null;
            var requestParams:cbl.IDbDesignViewName = <cbl.IDbDesignViewName>{};
            if (params && params.keys) {
                verb = 'POST';
                body = {keys: params.keys};
                delete params.keys
            }
            requestParams = <cbl.IDbDesignViewName>_.assign(requestParams, params);

            var uri = new URI(this.dbUrl).segment('_all_docs').search(requestParams);
            this.processRequest(verb, uri.toString(), body, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From allDocs Request', err));
                    else resolve(success);
                });
        });
    }

    bulkDocs(body:cbl.IPostDbBulkDocs) {
        return new Promise((resolve, reject)=> {
            var uri = new URI(this.dbUrl).segment('_bulk_docs');
            this.processRequest('POST', uri.toString(), body, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From bulkDocs Request, ensure docs array is in request', err));
                    else resolve(success);
                })
        });
    }

    changes(params?:cbl.IGetDbChangesParams):Promise<any> {
        return this.info()
            .then((info:cbl.IGetDbChangesResponse)=> {
                if (this.lastChange === 0) this.lastChange = info.update_seq > 0 ? info.update_seq - 1 : 0;
                if (params.since === 'now') {
                    params.since = this.lastChange;
                }
                this.lastChange = info.update_seq;

                if (!params)params = {feed: 'normal'};
                else params.feed = 'normal';
                var uri = new URI(this.dbUrl).segment('_changes').search(params);
                return new Promise((resolve, reject)=> {
                    this.processRequest('GET', uri.toString(), null, null,
                        (err, success)=> {
                            if (err) reject(this.buildError('Error From _changes request', err));
                            else resolve(success);
                        });
                })
            })
            .catch((err)=> { this.buildError('Error From changes request for db info', err) })
    }

    compact() {
        return new Promise((resolve, reject)=> {
            var uri = new URI(this.dbUrl).segment('_compact');
            this.processRequest('POST', uri.toString(), null, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From bulkDocs Request', err));
                    else resolve(success);
                });
        });
    }

    destroy() {
        return new Promise((resolve, reject)=> {
            var uri = new URI(this.dbUrl);
            this.processRequest('DELETE', uri.toString(), null, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From bulkDocs Request', err));
                    else resolve(success);
                });
        });
    }

    get(docId:string, params?:cbl.IGetDbDocParams) {
        return new Promise((resolve, reject)=> {
            var headers:cbl.IHeaders = {'Accept': 'application/json'};
            var uri = new URI(this.dbUrl).segment(docId);
            var requestParams:cbl.IGetDbDocParams = <cbl.IGetDbDocParams>{};
            if (params) {
                requestParams = <cbl.IGetDbDocParams>_.assign(requestParams, params);
                uri.search(requestParams);
            }
            this.processRequest('GET', uri.toString(), null, headers,
                (err, doc)=> {
                    if (err) reject(this.buildError('Error From GET Request', err));
                    else resolve(doc);
                });
        });
    }

    getAttachment(docId:string, attachmentName:string, params?:cbl.IBatchRevParams) {
        return new Promise((resolve, reject)=> {
            var uri:uri.URI = new URI(this.dbUrl).segment(docId).segment(attachmentName);
            if (params.rev) uri.search({rev: params.rev});

            this.processRequest('GET', uri.toString(), null, null,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From bulkDocs Request', err));
                    else resolve(success);
                }, true);
        });
    }

    info() {
        return new Promise((resolve, reject)=> {
            this.processRequest('GET', this.dbUrl, null, null, (err, info)=> {
                if (err) reject(this.buildError('Error From db info Request', err));
                else resolve(info);
            });
        });
    }

    infoRemote(remoteDBUrl?:string) {
        return new Promise((resolve, reject)=> {
            if (!remoteDBUrl) remoteDBUrl = this.syncUrl;
            this.processRequest('GET', remoteDBUrl, null, null, (err, info)=> {
                if (err) reject(this.buildError('Error From db info remote Request', err));
                else resolve(info);
            });
        });
    }

    post(doc:cbl.IDoc, params?:cbl.IPostDbDocParams) {
        return new Promise((resolve, reject)=> {
            var uri = new URI(this.dbUrl);
            if (_.includes(params.batch, 'ok')) uri.search({batch: 'ok'});
            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            this.processRequest('POST', uri.toString(), doc, headers,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From POST Doc Request', err));
                    else resolve(success);
                });
        });
    }


    put(doc:cbl.IDoc, params?:cbl.IBatchRevParams) {
        return new Promise((resolve, reject)=> {
            if (!doc._id) reject(this.buildError('doc does not have _id for PUT request', doc));
            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            var requestParams:cbl.IBatchRevParams = <cbl.IBatchRevParams>{};
            if (params) {
                if (!params.rev) requestParams.rev = doc._rev;
                requestParams = <cbl.IBatchRevParams>_.assign(requestParams, params);
            }

            var uri = new URI(this.dbUrl).segment(doc._id).search(requestParams);
            this.processRequest('PUT', uri.toString(), doc, headers,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From PUT Request: ensure doc or params is providing the rev if updating a doc', err));
                    else resolve(success);
                });
        });
    }

    putAttachment(docId:string, attachmentId:string, attachment:any, mimeType:string, rev?:string) {
        return new Promise((resolve, reject)=> {
            var headers:cbl.IHeaders = {'Content-Type': mimeType};
            var uri = new URI(this.dbUrl).segment(docId).segment(attachmentId);
            if (rev) uri.search({rev: rev});
            this.processRequest('PUT', uri.toString(), attachment, headers,
                (err, success)=> {
                    if (err) reject(this.buildError('Error From PUT Attachment Request, if document exists ensure the rev is provided', err));
                    else resolve(success);
                }, true);
        });
    }

    query(view:string, params?:cbl.IDbDesignViewName) {
        return new Promise((resolve, reject)=> {
            var verb = 'GET';
            var data = null;
            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            var jsonParams = [];
            var viewParts = view.split('/');
            var uri = new URI(this.dbUrl).segment('_design').segment(viewParts[0]).segment('_view').segment(viewParts[1]);
            var fullURI = uri.toString();
            var requestParams:cbl.IDbDesignViewName = <cbl.IDbDesignViewName>{};
            if (params) {
                if (params.keys) {
                    verb = 'POST';
                    data = params;
                }
                else {
                    if (params.start_key) params.startkey = params.start_key;
                    if (params.end_key) params.endkey = params.end_key;
                    requestParams = <cbl.IDbDesignViewName>_.assign(requestParams, params);
                    requestParams.update_seq = true;
                    if (params.key) {
                        if (_.isArray(params.key)) jsonParams.push('key=' + JSON.stringify(params.key));
                        else if (_.isString) jsonParams.push('key="' + params.key + '"');
                        else if (_.isNumber) jsonParams.push('key=' + params.key);
                        requestParams = _.omit(requestParams, 'key');
                    }
                    if (params.startkey || _.isNull(params.startkey)) {
                        if (_.isArray(params.startkey)) jsonParams.push('startkey=' + JSON.stringify(params.startkey));
                        else if (_.isString(params.startkey)) jsonParams.push('startkey="' + params.startkey + '"');
                        else if (_.isNumber(params.startkey)) jsonParams.push('startkey=' + params.startkey);
                        else if (_.isObject(params.startkey) || _.isNull(params.startkey)) jsonParams.push('startkey=' + JSON.stringify(params.startkey));
                        requestParams = _.omit(requestParams, ['startkey', 'start_key']);
                    }
                    if (params.endkey || _.isNull(params.startkey)) {
                        if (_.isArray(params.endkey)) jsonParams.push('endkey=' + JSON.stringify(params.endkey));
                        else if (_.isString(params.endkey)) jsonParams.push('endkey="' + params.endkey + '"');
                        else if (_.isNumber(params.endkey)) jsonParams.push('endkey=' + params.endkey);
                        else if (_.isObject(params.endkey) || _.isNull(params.endkey)) jsonParams.push('endkey=' + JSON.stringify(params.endkey));
                        requestParams = _.omit(requestParams, ['endkey', 'end_key']);
                    }
                    fullURI = uri.search(requestParams).toString();
                    _.each(jsonParams, (param)=> { fullURI += '&' + param; })
                }
            }

            this.processRequest(verb, fullURI, data, headers,
                (err, response)=> {
                    if (err) reject(this.buildError('Error From Query Request', err));
                    else resolve(response);
                });
        });
    }

    replicateTo(bodyRequest?:cbl.IPostReplicateParams, otherDB?:string) {
        return new Promise((resolve, reject)=> {
            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            //options override the default behavior
            var defaults = {source: this.dbName, target: otherDB ? otherDB : this.syncUrl, continuous: false};
            if(bodyRequest){
                _.assign(defaults, bodyRequest);
            }
            if (!defaults.source || !defaults.target) reject(new Error('no sync url available to replicate to: ' + this.dbName));
            var uri = new URI(this.localServerUrl).segment('_replicate');
            this.processRequest('POST', uri.toString(), defaults, headers,
                (err, response)=> {
                    if (err) reject(this.buildError('Error: replicate to Request', err));
                    else resolve(response);
                });
        });
    }

    replicateFrom(bodyRequest?:cbl.IPostReplicateParams, otherDB?:string) {
        return new Promise((resolve, reject)=> {
            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            //options override the default behavior
            var defaults = {source: otherDB ? otherDB : this.syncUrl, target: this.dbName, continuous: false};
            if(bodyRequest){
                _.assign(defaults, bodyRequest);
            }
            if (!defaults.source || !defaults.target) reject(new Error('no sync url available to replicate from: ' + this.dbName));

            var uri = new URI(this.localServerUrl).segment('_replicate');
            this.processRequest('POST', uri.toString(), defaults, headers,
                (err, response)=> {
                    if (err) reject(this.buildError('Error: replicate from Request', err));
                    else resolve(response);
                });
        });
    }

    remove(doc:cbl.IDoc, params?:cbl.IBatchRevParams) {
        return new Promise((resolve, reject)=> {
            var verb = 'DELETE';
            var requestParams:cbl.IBatchRevParams = <cbl.IBatchRevParams>{};
            if (params) requestParams = <cbl.IDbDesignViewName>_.assign(requestParams, params);
            if (!params.rev) requestParams.rev = doc._rev;

            var uri = new URI(this.dbUrl).segment(doc._id).search(requestParams);
            this.processRequest(verb, uri.toString(), null, null,
                (err, response)=> {
                    if (err) reject(this.buildError('Error From remove Request', err));
                    else resolve(response);
                });
        });
    }

    removeAttachment(docId:string, attachmentId:string, rev:string) {
        return new Promise((resolve, reject)=> {
            var verb = 'DELETE';
            var uri = new URI(this.dbUrl).segment(docId).segment(attachmentId).search({rev: rev});
            this.processRequest(verb, uri.toString(), null, null,
                (err, response)=> {
                    if (err) reject(this.buildError('Error From remove Request', err));
                    else resolve(response);
                });
        });
    }

    revsDiff() {
        return new Promise((resolve, reject)=> {
            reject(this.buildError('revsDiff not implemented yet'));
            /** TODO: NEEDS IMPLEMENTATION */
        });
    }

    upsert(doc:cbl.IDoc, params?:cbl.IBatchRevParams) {
        return new Promise((resolve, reject)=> {
            var put = (upsertDoc) => {
                if (!upsertDoc._id) reject(this.buildError('doc does not have _id for Upsert request', doc));
                this.processRequest('PUT', uri.toString(), upsertDoc, headers,
                    (err, success)=> {
                        if (err) reject(this.buildError('Error From Upsert Request', err));
                        else resolve(success);
                    });
            };

            var headers:cbl.IHeaders = {'Content-Type': 'application/json'};
            var uri = new URI(this.dbUrl).segment(doc._id);
            var requestParams:cbl.IBatchRevParams = <cbl.IBatchRevParams>{};
            if (params) {
                requestParams = <cbl.IBatchRevParams>_.assign(requestParams, params);
                uri.search(requestParams);
            }

            this.get(doc._id)
                .then((dbDoc:cbl.IDoc)=> {
                    requestParams.rev = dbDoc._rev;
                    doc._rev = dbDoc._rev;
                    uri.search(requestParams);
                    return put(doc);
                })
                .catch((error)=> {
                    if (error.status === 404) put(doc);
                    else return error;
                });
        });
    }

    viewCleanup() {
        return new Promise((resolve, reject)=> {
            reject(this.buildError('viewCleanup not implemented yet'));
            /** TODO: NEEDS IMPLEMENTATION */
        });
    }

    buildError(msg:string, err?) {
        var error:any = new Error(msg);
        if (_.isObject(err))error = _.assign(error, err);
        else if (err) error.errorValue = err;
        error.dbName = this.dbName;
        return error;
    }

    processRequest(verb:string, url:string, data:any, headers:Object, cb:Function, isAttach?:boolean):void {
        var http = new XMLHttpRequest();
        http.open(verb, url, true);
        if (headers) _.forOwn(headers, (value:any, key)=> { http.setRequestHeader(key, value); });
        if (isAttach)http.responseType = 'blob'; //options "arraybuffer", "blob", "document", "json", and "text"

        //state change callback
        http.onreadystatechange = () => {
            if (http.readyState == 4 && http.status >= 200 && http.status <= 299) {
                if (isAttach) cb(false, http.response);
                else cb(false, JSON.parse(http.responseText), http);
            }
            else if (http.readyState == 4) cb({status: http.status, response: http.responseText});
            else if (http.readyState !== 1 && http.readyState !== 2 && http.readyState !== 3){
                cb({status: http.status, response: http.responseText});
            }
        };

        //send request variations
        if (verb === 'PUT' && isAttach) http.send(data);
        else if (verb === 'GET' || verb === 'DELETE')http.send();
        else if (verb === 'POST' || verb === 'PUT' && !_.isNull(data))http.send(JSON.stringify(data));
        else http.send();
    }
}

export = cblDB;