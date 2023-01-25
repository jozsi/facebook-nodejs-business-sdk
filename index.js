/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

// HTTP Status Code
var HTTP_STATUS = {
  OK: '200',
  NOT_MODIFIED: '304'
};

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
const requestPromise = {}; //require('request-promise');

/**
 * Isomorphic Http Promise Requests Class
 * 
 */
class Http {
  /**
   * Request
   * @param   {String}  method
   * @param   {String}  url
   * @param   {Object}  [data]
   * @return  {Promise}
   */
  static request(method, url, data, files, useMultipartFormData, showHeader) {
    if (typeof window !== 'undefined' && window.XMLHttpRequest) {
      return Http.xmlHttpRequest(method, url, data);
    }
    return Http.requestPromise(method, url, data, files, useMultipartFormData, showHeader);
  }

  /**
   * XmlHttpRequest request
   * @param   {String}  method
   * @param   {String}  url
   * @param   {Object}  [data]
   * @return  {Promise}
   */
  static xmlHttpRequest(method, url, data) {
    return new Promise((resolve, reject) => {
      const request = new window.XMLHttpRequest();
      request.open(method, url);
      request.onload = function () {
        let response;
        try {
          response = JSON.parse(request.response);
        } catch (e) {
          // JSON failed to parse. Create a placeholder response.
          response = {
            error: {
              message: 'Failed to parse response JSON.'
            }
          };
          reject(convertXhrErrorToRequestPromiseError(request, response));
          return;
        }
        if (request.status.toString() !== HTTP_STATUS.OK) {
          reject(convertXhrErrorToRequestPromiseError(request, response));
          return;
        }
        resolve(response);
      };
      request.setRequestHeader('Content-Type', 'application/json');
      request.setRequestHeader('Accept', 'application/json');
      request.send(JSON.stringify(data));
    });
  }

  /**
   * Request Promise
   * @param   {String}  method The HTTP method name (e.g. 'GET').
   * @param   {String}  url A full URL string.
   * @param   {Object}  [data] A mapping of request parameters where a key
   *   is the parameter name and its value is a string or an object
   *   which can be JSON-encoded.
   * @param   {Object}  [files] An optional mapping of file names to ReadStream
   *   objects. These files will be attached to the request.
   * @param   {Boolean} [useMultipartFormData] An optional flag to call with
   *   multipart/form-data.
   * @return  {Promise}
   */
  static requestPromise(method, url, data, files, useMultipartFormData = false, showHeader = false) {
    const options = {
      method: method,
      uri: url,
      json: !useMultipartFormData,
      headers: {
        'User-Agent': `fbbizsdk-nodejs-v${FacebookAdsApi.SDK_VERSION}`
      },
      body: Object,
      resolveWithFullResponse: showHeader
    };
    // Prevent null or undefined input
    // because it can be merged with the files argument later
    if (!data) {
      data = {};
    }
    options.body = data;

    // Handle file attachments if provided
    if (useMultipartFormData || files && Object.keys(files).length > 0) {
      // Use formData instead of body (required by the request-promise library)
      options.formData = Object.assign(data, files);
      delete options.body;
    }
    return requestPromise(options).catch(response => {
      throw response;
    });
  }
}

/**
 * Converts the given XHR error to an error that looks like one that would
 * be returned by the request-promise API.
 * @param {XMLHttpRequest} request
 * @param {any} response
 */
function convertXhrErrorToRequestPromiseError(request, response) {
  return {
    name: 'StatusCodeError',
    error: response,
    statusCode: request.status
  };
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

// request-promise error types
const REQUEST_ERROR = 'RequestError';
const STATUS_CODE_ERROR = 'StatusCodeError';
function FacebookError(error) {
  this.name = 'FacebookError';
  this.message = error.message;
  this.stack = new Error().stack;
}
FacebookError.prototype = Object.create(Error.prototype);
FacebookError.prototype.constructor = FacebookError;

/**
 * Raised when an api request fails.
 */
class FacebookRequestError extends FacebookError {
  /**
   * @param  {[Object}  response
   * @param  {String}   method
   * @param  {String}   url
   * @param  {Object}   data
   */
  constructor(response, method, url, data) {
    const errorResponse = constructErrorResponse(response);
    super(errorResponse);
    this.name = 'FacebookRequestError';
    this.message = errorResponse.message;
    this.status = errorResponse.status;
    this.response = errorResponse.body;
    this.headers = errorResponse.headers;
    this.method = method;
    this.url = url;
    if (data) {
      this.data = data;
    }
  }
}

/**
 * Error response has several structures depended on called APIs or errors.
 * This method contructs and formats the response into the same structure for
 * creating a FacebookRequestError object.
 */
function constructErrorResponse(response) {
  let body;
  let message;
  let status;
  let headers;

  // Batch request error contains code and body fields
  const isBatchResponse = response.code && response.body;
  if (isBatchResponse) {
    // Handle batch response
    body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    status = response.code;
    message = body.error.message;
    headers = response.headers;
  } else {
    // Handle single response
    if (response.name === STATUS_CODE_ERROR) {
      // Handle when we can get response error code
      body = response.error ? response.error : response;
      body = typeof body === 'string' ? JSON.parse(body) : body;
      // Construct an error message from subfields in body.error
      message = body.error.error_user_msg ? `${body.error.error_user_title}: ${body.error.error_user_msg}` : body.error.message;
      status = response.statusCode;
      if (response.response) {
        headers = response.response.headers;
      }
    } else if (response.name === REQUEST_ERROR) {
      // Handle network errors e.g. timeout, destination unreachable
      body = {
        error: response.error
      };
      // An error message is in the response already
      message = response.message;
      // Network errors have no status code
      status = null;
    }
  }
  return {
    body,
    message,
    status,
    headers
  };
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 * @format
 */
class CrashReporter {
  constructor() {
    this._active = true;
  }
  static enable() {
    if (this._instance == undefined || this._instance == null) {
      this._instance = new this();
      process.on('uncaughtException', err => {
        if (this._instance._active && err instanceof Error) {
          var params = privateMethods.parseParam(err);
          if (params != null) {
            console.log('CrashReporter: SDK crash detected!');
            privateMethods.processUncaughtException(err, params);
            return;
          }
        }
        console.log('CrashReporter: No SDK crash detected or crash reporter is disabled!');
        throw err;
      });
    }
  }
  static disable() {
    if (this._instance == undefined || this._instance == null) {
      return;
    }
    this._instance._active = false;
  }
}
const privateMethods = {
  processUncaughtException(err, params) {
    FacebookAdsApi.getDefaultApi().getAppID().then(data => {
      if (data["data"] !== undefined && data['data']['app_id'] !== undefined) {
        var appID = data['data']['app_id'];
        console.log("active uncaughtException : " + appID);
        var url = [FacebookAdsApi.GRAPH, FacebookAdsApi.VERSION, appID, 'instruments'].join('/');
        Http.request('POST', url, params).then(response => {
          console.log('Successfully sent crash report.');
        }).catch(response => {
          console.log('Failed to send crash report.');
        }).then(() => {
          throw err;
        });
      }
    }).catch(error => {
      console.log("Not be able to find appID, fail to send report to server.");
      throw err;
    });
  },
  parseParam(err) {
    var stack = err.stack.split('\n');
    var params = {};
    if (stack.length == 0) {
      return null;
    }
    var fln = stack[0].split(':');
    params['reason'] = fln[0];
    params['callstack'] = stack;
    params['platform'] = process.version;
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].includes('facebook-nodejs-business-sdk')) {
        return {
          'bizsdk_crash_report': params
        };
      }
    }
    return null;
  }
};

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 * @format
 */

/**
 * Facebook Ads API
 */
class FacebookAdsApi {
  static get VERSION() {
    return 'v15.0';
  }
  static get SDK_VERSION() {
    return '15.0.2';
  }
  static get GRAPH() {
    return 'https://graph.facebook.com';
  }
  static get GRAPH_VIDEO() {
    return 'https://graph-video.facebook.com';
  }

  /**
   * @param {String} accessToken
   * @param {String} [locale]
   */
  constructor(accessToken, locale = 'en_US', crash_log = true) {
    if (!accessToken) {
      throw new Error('Access token required');
    }
    this.accessToken = accessToken;
    this.locale = locale;
    this._debug = false;
    this._showHeader = false;
    if (crash_log) {
      CrashReporter.enable();
    }
  }

  /**
   * Instantiate an API and store it as the default
   * @param  {String} accessToken
   * @param  {String} [locale]
   * @return {FacebookAdsApi}
   */
  static init(accessToken, locale = 'en_US', crash_log = true) {
    const api = new this(accessToken, locale, crash_log);
    this.setDefaultApi(api);
    return api;
  }
  static setDefaultApi(api) {
    this._defaultApi = api;
  }
  static getDefaultApi() {
    return this._defaultApi;
  }
  getAppID() {
    let url = [FacebookAdsApi.GRAPH, FacebookAdsApi.VERSION, 'debug_token'].join('/');
    let params = {};
    params['access_token'] = this.accessToken;
    params['input_token'] = this.accessToken;
    params['fields'] = 'app_id';
    url += `?${FacebookAdsApi._encodeParams(params)}`;
    return Http.request('GET', url, {}, {}, false);
  }
  setDebug(flag) {
    this._debug = flag;
    return this;
  }
  setShowHeader(flag) {
    this._showHeader = flag;
    return this;
  }

  /**
   * Http Request
   * @param  {String} method
   * @param  {String} path
   * @param  {Object} [params]
   * @param  {Object} [files]
   * @return {Promise}
   */
  call(method, path, params = {}, files = {}, useMultipartFormData = false, urlOverride = '') {
    let url;
    let data = {};
    if (method === 'POST' || method === 'PUT') {
      data = params;
      params = {};
    }
    const domain = urlOverride || FacebookAdsApi.GRAPH;
    if (typeof path !== 'string' && !(path instanceof String)) {
      url = [domain, FacebookAdsApi.VERSION, ...path].join('/');
      params['access_token'] = this.accessToken;
      url += `?${FacebookAdsApi._encodeParams(params)}`;
    } else {
      url = path;
    }
    const strUrl = url;
    return Http.request(method, strUrl, data, files, useMultipartFormData, this._showHeader).then(response => {
      if (this._showHeader) {
        response.body['headers'] = response.headers;
        response = response.body;
      }
      if (this._debug) {
        console.log(`200 ${method} ${url} ${Object.keys(data).length > 0 ? JSON.stringify(data) : ""}`);
        console.log(`Response: ${response ? JSON.stringify(response) : ""}`);
      }
      return Promise.resolve(response);
    }).catch(response => {
      if (this._debug) {
        console.log(`${response.statusCode} ${method} ${url}
            ${Object.keys(data).length > 0 ? JSON.stringify(data) : ''}`);
      }
      throw new FacebookRequestError(response, method, url, data);
    });
  }
  static _encodeParams(params) {
    return Object.keys(params).map(key => {
      var param = params[key];
      if (typeof param === 'object') {
        param = param ? JSON.stringify(param) : '';
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(param)}`;
    }).join('&');
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Abstract Object
 * Manages object data fields and provides matching properties
 *
 * 
 * @format
 */
class AbstractObject {
  // This is a Flow workaround for setting `this[field]` in the set() function.

  static get Fields() {
    return Object.freeze({});
  }
  constructor() {
    this._data = {};
    if (this.constructor.Fields === undefined) {
      throw new Error('A "Fields" frozen object must be defined in the object class');
    }
    let fields = this.constructor.Fields;
    this._fields = Object.keys(fields);
    this._fields.forEach(field => {
      this._defineProperty(field);
    });
  }

  /**
   * Define data getter and setter field
   * @param {String} field
   */
  _defineProperty(field) {
    Object.defineProperty(this, field, {
      get: () => this._data[field],
      set: value => {
        this._data[field] = value;
      },
      enumerable: true
    });
  }

  /**
   * Set data field
   * @param {String} field
   * @param {Mixed} value
   * @return this
   */
  set(field, value) {
    if (this._fields.indexOf(field) < 0) {
      this._defineProperty(field);
    }
    this[field] = value;
    return this;
  }

  /**
   * Set multiple data fields
   * @param {Object} data
   * @return this
   */
  setData(data) {
    Object.keys(data).forEach(key => {
      this.set(key, data[key]);
    });
    return this;
  }

  /**
   * Export object data
   * @return {Object}
   */
  exportData() {
    return this._data;
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 * @format
 */
class Utils {
  static normalizeEndpoint(str) {
    return str.replace(/^\/|\/$/g, '');
  }
  static removePreceedingSlash(str) {
    return str.length && str[0] === '/' ? str.slice(1) : str;
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Cursor
 * Iterates over edge objects and controls pagination
 * 
 * @format
 */
class Cursor extends Array {
  /**
   * @param  {Object} sourceObject
   * @param  {Object} targetClass
   * @param  {Object} [params]
   * @param  {String} [endpoint]
   */
  constructor(sourceObject, targetClass, params, endpoint) {
    super();
    const next = [sourceObject.getId()];
    if (endpoint) {
      next.push(Utils.normalizeEndpoint(endpoint));
    } else {
      throw new Error('No endpoint specified for the target edge.');
    }
    this._api = sourceObject.getApi();
    this._targetClass = targetClass;
    this.paging = {
      next: next
    };
    this.clear = () => {
      this.length = 0;
    };
    this.set = array => {
      this.clear();
      this.push(...array);
    };
    this.next = () => {
      if (!this.hasNext()) {
        return Promise.reject(new RangeError('end of pagination'));
      }
      return this._loadPage(this.paging.next);
    };
    this.hasNext = () => {
      return Boolean(this.paging) && Boolean(this.paging.next);
    };
    this.previous = () => {
      if (!this.hasPrevious()) {
        return Promise.reject(new RangeError('start of pagination'));
      }
      return this._loadPage(this.paging.previous);
    };
    this.hasPrevious = () => {
      return Boolean(this.paging) && Boolean(this.paging.previous);
    };
    this._loadPage = path => {
      const promise = new Promise((resolve, reject) => {
        this._api.call('GET', path, params).then(response => {
          const objects = this._buildObjectsFromResponse(response);
          this.set(objects);
          this.paging = response.paging;
          this.summary = response.summary;
          resolve(this);
        }).catch(reject);
      });
      if (params) {
        params = undefined;
      }
      return promise;
    };
    this._buildObjectsFromResponse = response => {
      return response.data.map(item => {
        let That = this._targetClass;
        if (That.name === 'AbstractObject') {
          var result = new That();
          result.setData(item);
          return result;
        }
        return new That(item && item.id ? item.id : null, item, undefined, this._api);
      });
    };
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * @format
 * 
 */

/**
 * Abstract Crud Object
 * Facebook Object basic persistence functions
 * @extends AbstractObject
 * 
 */
class AbstractCrudObject extends AbstractObject {
  /**
   * @param  {Object} data
   * @param  {String} parentId
   * @param  {FacebookAdApi} [api]
   */
  constructor(id = null, data = {}, parentId, api) {
    super();
    this._parentId = parentId;
    this._api = api || FacebookAdsApi.getDefaultApi();
    if (id) {
      data.id = id;
    }
    if (data) {
      super.setData(data);
    }
  }

  /**
   * Define data getter and setter recording changes
   * @param {String} field
   */
  _defineProperty(field) {
    if (this._changes === undefined) {
      this._changes = {};
    }
    Object.defineProperty(this, field, {
      get: () => this._data[field],
      set: value => {
        this._changes[field] = value;
        this._data[field] = value;
      },
      enumerable: true
    });
  }

  /**
   * Set object data as if it were read from the server. Wipes related changes
   * @param {Object} data
   * @return this
   */
  setData(data) {
    super.setData(data);
    Object.keys(data).forEach(key => {
      delete this._changes[key];
    });
    return this;
  }

  /**
   * Export changed object data
   * @return {Object}
   */
  exportData() {
    return this._changes;
  }

  /**
   * Export object data
   * @return {Object}
   */
  exportAllData() {
    return this._data;
  }

  /**
   * Clear change history
   * @return this
   */
  clearHistory() {
    this._changes = {};
    return this;
  }

  /**
   * @throws {Error} if object has no id
   * @return {String}
   */
  getId() {
    if (!this.id) {
      throw new Error(`${this.constructor.name} Id not defined`);
    }
    return this.id;
  }

  /**
   * @throws {Error} if object has no parent id
   * @return {String}
   */
  getParentId() {
    if (!this._parentId) {
      throw new Error(`${this.constructor.name} parentId not defined`);
    }
    return this._parentId;
  }

  /**
   * @return {String}
   */
  getNodePath() {
    return this.getId();
  }

  /**
   * Return object API instance
   * @throws {Error} if object doesn't hold an API
   * @return {FacebookAdsApi}
   */
  getApi() {
    const api = this._api;
    if (!api) {
      throw new Error(`${this.constructor.name} does not yet have an
        associated api object.\n Did you forget to
        instantiate an API session with:
        "FacebookAdsApi.init"?`);
    }
    return api;
  }

  /**
   * Read object data
   * @param   {Array}   [fields]
   * @param   {Object}  [params]
   * @return  {Promise}
   */
  read(fields, params = {}) {
    const api = this.getApi();
    const path = [this.getNodePath()];
    if (fields) {
      params['fields'] = fields.join(',');
    }
    return new Promise((resolve, reject) => {
      api.call('GET', path, params).then(data => resolve(this.setData(data))).catch(reject);
    });
  }

  /**
   * Update object
   * @param   {Object}  [params]
   * @return  {Promise}
   */
  update(params = {}) {
    const api = this.getApi();
    const path = [this.getNodePath()];
    params = Object.assign(params, this.exportData());
    return new Promise((resolve, reject) => {
      api.call('POST', path, params).then(data => resolve(data)).catch(reject);
    });
  }

  /**
   * Delete object
   * @param   {Object}  [params]
   * @return  {Promise}
   */
  delete(params = {}) {
    const api = this.getApi();
    const path = [this.getNodePath()];
    params = Object.assign(params, this.exportData());
    return new Promise((resolve, reject) => {
      api.call('DELETE', path, params).then(data => resolve(data)).catch(reject);
    });
  }

  /**
   * Initialize Cursor to paginate on edges
   * @param  {Object}  targetClass
   * @param  {Array}   [fields]
   * @param  {Object}  [params]
   * @param  {Boolean} [fetchFirstPage]
   * @param  {String}  [endpoint]
   * @return {Cursor}
   */
  getEdge(targetClass, fields, params = {}, fetchFirstPage = true, endpoint) {
    if (params == null) {
      params = {};
    }
    if (fields) {
      params['fields'] = fields.join(',');
    }
    const sourceObject = this;
    const cursor = new Cursor(sourceObject, targetClass, params, endpoint);
    if (fetchFirstPage) {
      return cursor.next();
    }
    return cursor;
  }

  /**
   * Create edge object
   * @param   {String}  [endpoint]
   * @param   {Array}  [fields]
   * @param   {Object}  [params]
   * @param   {Function} [targetClassConstructor]
   * @return  {Promise}
   */
  createEdge(endpoint, fields, params = {}, targetClassConstructor = null, pathOverride = null) {
    if (params == null) {
      params = {};
    }
    if (fields && fields.length > 0) {
      params['fields'] = fields.join(',');
    }
    const api = this.getApi();
    const path = pathOverride != null ? pathOverride : [this.getNodePath(), Utils.removePreceedingSlash(endpoint)];
    params = Object.assign(params, this.exportData());
    return new Promise((resolve, reject) => {
      api.call('POST', path, params).then(data => {
        resolve( /* eslint new-cap: "off" */
        targetClassConstructor === null ? this.setData(data) : new targetClassConstructor(data.id, data));
      }).catch(reject);
    });
  }

  /**
   * Delete edge object
   * @param   {String}  [endpoint]
   * @param   {Object}  [params]
   * @return  {Promise}
   */
  deleteEdge(endpoint, params = {}) {
    const api = this.getApi();
    const path = [this.getNodePath(), Utils.removePreceedingSlash(endpoint)];
    params = Object.assign(params, this.exportData());
    return new Promise((resolve, reject) => {
      api.call('DELETE', path, params).then(data => resolve(data)).catch(reject);
    });
  }

  /**
   * Read Objects by Ids
   * @param  {Array}          ids
   * @param  {Array}          [fields]
   * @param  {Object}         [params]
   * @param  {FacebookAdsApi} [api]
   * @return {Promise}
   */
  static getByIds(ids, fields, params = {}, api) {
    api = api || FacebookAdsApi.getDefaultApi();
    if (fields) {
      params['fields'] = fields.join(',');
    }
    params['ids'] = ids.join(',');
    return new Promise((resolve, reject) => {
      return api.call('GET', [''], params).then(response => {
        var result = [];
        for (let id in response) {
          let data = response[id];
          let That = this;
          let object = new That(data);
          result.push(object);
        }
        resolve(result);
      }).catch(reject);
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdActivity
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdActivity extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      actor_id: 'actor_id',
      actor_name: 'actor_name',
      application_id: 'application_id',
      application_name: 'application_name',
      date_time_in_timezone: 'date_time_in_timezone',
      event_time: 'event_time',
      event_type: 'event_type',
      extra_data: 'extra_data',
      object_id: 'object_id',
      object_name: 'object_name',
      object_type: 'object_type',
      translated_event_type: 'translated_event_type'
    });
  }
  static get EventType() {
    return Object.freeze({
      account_spending_limit_reached: 'account_spending_limit_reached',
      ad_account_add_user_to_role: 'ad_account_add_user_to_role',
      ad_account_billing_charge: 'ad_account_billing_charge',
      ad_account_billing_charge_failed: 'ad_account_billing_charge_failed',
      ad_account_billing_chargeback: 'ad_account_billing_chargeback',
      ad_account_billing_chargeback_reversal: 'ad_account_billing_chargeback_reversal',
      ad_account_billing_decline: 'ad_account_billing_decline',
      ad_account_billing_refund: 'ad_account_billing_refund',
      ad_account_remove_spend_limit: 'ad_account_remove_spend_limit',
      ad_account_remove_user_from_role: 'ad_account_remove_user_from_role',
      ad_account_reset_spend_limit: 'ad_account_reset_spend_limit',
      ad_account_set_business_information: 'ad_account_set_business_information',
      ad_account_update_spend_limit: 'ad_account_update_spend_limit',
      ad_account_update_status: 'ad_account_update_status',
      ad_review_approved: 'ad_review_approved',
      ad_review_declined: 'ad_review_declined',
      add_funding_source: 'add_funding_source',
      add_images: 'add_images',
      billing_event: 'billing_event',
      campaign_ended: 'campaign_ended',
      campaign_spending_limit_reached: 'campaign_spending_limit_reached',
      conversion_event_updated: 'conversion_event_updated',
      create_ad: 'create_ad',
      create_ad_set: 'create_ad_set',
      create_audience: 'create_audience',
      create_campaign_group: 'create_campaign_group',
      create_campaign_legacy: 'create_campaign_legacy',
      delete_audience: 'delete_audience',
      delete_images: 'delete_images',
      di_ad_set_learning_stage_exit: 'di_ad_set_learning_stage_exit',
      edit_and_update_ad_creative: 'edit_and_update_ad_creative',
      edit_images: 'edit_images',
      first_delivery_event: 'first_delivery_event',
      funding_event_initiated: 'funding_event_initiated',
      funding_event_successful: 'funding_event_successful',
      lifetime_budget_spent: 'lifetime_budget_spent',
      merge_campaigns: 'merge_campaigns',
      receive_audience: 'receive_audience',
      remove_funding_source: 'remove_funding_source',
      remove_shared_audience: 'remove_shared_audience',
      share_audience: 'share_audience',
      unknown: 'unknown',
      unshare_audience: 'unshare_audience',
      update_ad_bid_info: 'update_ad_bid_info',
      update_ad_bid_type: 'update_ad_bid_type',
      update_ad_creative: 'update_ad_creative',
      update_ad_friendly_name: 'update_ad_friendly_name',
      update_ad_labels: 'update_ad_labels',
      update_ad_run_status: 'update_ad_run_status',
      update_ad_run_status_to_be_set_after_review: 'update_ad_run_status_to_be_set_after_review',
      update_ad_set_ad_keywords: 'update_ad_set_ad_keywords',
      update_ad_set_bid_adjustments: 'update_ad_set_bid_adjustments',
      update_ad_set_bid_strategy: 'update_ad_set_bid_strategy',
      update_ad_set_bidding: 'update_ad_set_bidding',
      update_ad_set_budget: 'update_ad_set_budget',
      update_ad_set_duration: 'update_ad_set_duration',
      update_ad_set_learning_stage_status: 'update_ad_set_learning_stage_status',
      update_ad_set_min_spend_target: 'update_ad_set_min_spend_target',
      update_ad_set_name: 'update_ad_set_name',
      update_ad_set_optimization_goal: 'update_ad_set_optimization_goal',
      update_ad_set_run_status: 'update_ad_set_run_status',
      update_ad_set_spend_cap: 'update_ad_set_spend_cap',
      update_ad_set_target_spec: 'update_ad_set_target_spec',
      update_ad_targets_spec: 'update_ad_targets_spec',
      update_adgroup_stop_delivery: 'update_adgroup_stop_delivery',
      update_audience: 'update_audience',
      update_campaign_ad_scheduling: 'update_campaign_ad_scheduling',
      update_campaign_budget: 'update_campaign_budget',
      update_campaign_budget_optimization_toggling_status: 'update_campaign_budget_optimization_toggling_status',
      update_campaign_delivery_type: 'update_campaign_delivery_type',
      update_campaign_group_ad_scheduling: 'update_campaign_group_ad_scheduling',
      update_campaign_group_delivery_type: 'update_campaign_group_delivery_type',
      update_campaign_group_spend_cap: 'update_campaign_group_spend_cap',
      update_campaign_name: 'update_campaign_name',
      update_campaign_run_status: 'update_campaign_run_status',
      update_campaign_schedule: 'update_campaign_schedule',
      update_delivery_type_cross_level_shift: 'update_delivery_type_cross_level_shift'
    });
  }
  static get Category() {
    return Object.freeze({
      account: 'ACCOUNT',
      ad: 'AD',
      ad_keywords: 'AD_KEYWORDS',
      ad_set: 'AD_SET',
      audience: 'AUDIENCE',
      bid: 'BID',
      budget: 'BUDGET',
      campaign: 'CAMPAIGN',
      date: 'DATE',
      status: 'STATUS',
      targeting: 'TARGETING'
    });
  }
  static get DataSource() {
    return Object.freeze({
      calypso: 'CALYPSO',
      tao: 'TAO',
      tao_ad_account: 'TAO_AD_ACCOUNT',
      tao_ad_status: 'TAO_AD_STATUS'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdPlacePageSet
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdPlacePageSet extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      id: 'id',
      location_types: 'location_types',
      name: 'name',
      pages_count: 'pages_count',
      parent_page: 'parent_page'
    });
  }
  static get LocationTypes() {
    return Object.freeze({
      home: 'home',
      recent: 'recent'
    });
  }
  static get TargetedAreaType() {
    return Object.freeze({
      custom_radius: 'CUSTOM_RADIUS',
      marketing_area: 'MARKETING_AREA',
      none: 'NONE'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdCreativeInsights
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdCreativeInsights extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      aesthetics: 'aesthetics'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdPreview
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdPreview extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      body: 'body'
    });
  }
  static get AdFormat() {
    return Object.freeze({
      audience_network_instream_video: 'AUDIENCE_NETWORK_INSTREAM_VIDEO',
      audience_network_instream_video_mobile: 'AUDIENCE_NETWORK_INSTREAM_VIDEO_MOBILE',
      audience_network_outstream_video: 'AUDIENCE_NETWORK_OUTSTREAM_VIDEO',
      audience_network_rewarded_video: 'AUDIENCE_NETWORK_REWARDED_VIDEO',
      biz_disco_feed_mobile: 'BIZ_DISCO_FEED_MOBILE',
      desktop_feed_standard: 'DESKTOP_FEED_STANDARD',
      facebook_reels_banner: 'FACEBOOK_REELS_BANNER',
      facebook_reels_banner_desktop: 'FACEBOOK_REELS_BANNER_DESKTOP',
      facebook_reels_mobile: 'FACEBOOK_REELS_MOBILE',
      facebook_reels_postloop: 'FACEBOOK_REELS_POSTLOOP',
      facebook_reels_sticker: 'FACEBOOK_REELS_STICKER',
      facebook_story_mobile: 'FACEBOOK_STORY_MOBILE',
      facebook_story_sticker_mobile: 'FACEBOOK_STORY_STICKER_MOBILE',
      instagram_explore_contextual: 'INSTAGRAM_EXPLORE_CONTEXTUAL',
      instagram_explore_grid_home: 'INSTAGRAM_EXPLORE_GRID_HOME',
      instagram_explore_immersive: 'INSTAGRAM_EXPLORE_IMMERSIVE',
      instagram_feed_web: 'INSTAGRAM_FEED_WEB',
      instagram_feed_web_m_site: 'INSTAGRAM_FEED_WEB_M_SITE',
      instagram_profile_feed: 'INSTAGRAM_PROFILE_FEED',
      instagram_reels: 'INSTAGRAM_REELS',
      instagram_reels_overlay: 'INSTAGRAM_REELS_OVERLAY',
      instagram_search_chain: 'INSTAGRAM_SEARCH_CHAIN',
      instagram_search_grid: 'INSTAGRAM_SEARCH_GRID',
      instagram_shop: 'INSTAGRAM_SHOP',
      instagram_standard: 'INSTAGRAM_STANDARD',
      instagram_story: 'INSTAGRAM_STORY',
      instagram_story_web: 'INSTAGRAM_STORY_WEB',
      instagram_story_web_m_site: 'INSTAGRAM_STORY_WEB_M_SITE',
      instant_article_recirculation_ad: 'INSTANT_ARTICLE_RECIRCULATION_AD',
      instant_article_standard: 'INSTANT_ARTICLE_STANDARD',
      instream_banner_desktop: 'INSTREAM_BANNER_DESKTOP',
      instream_banner_mobile: 'INSTREAM_BANNER_MOBILE',
      instream_video_desktop: 'INSTREAM_VIDEO_DESKTOP',
      instream_video_image: 'INSTREAM_VIDEO_IMAGE',
      instream_video_mobile: 'INSTREAM_VIDEO_MOBILE',
      job_browser_desktop: 'JOB_BROWSER_DESKTOP',
      job_browser_mobile: 'JOB_BROWSER_MOBILE',
      marketplace_mobile: 'MARKETPLACE_MOBILE',
      messenger_mobile_inbox_media: 'MESSENGER_MOBILE_INBOX_MEDIA',
      messenger_mobile_story_media: 'MESSENGER_MOBILE_STORY_MEDIA',
      mobile_banner: 'MOBILE_BANNER',
      mobile_feed_basic: 'MOBILE_FEED_BASIC',
      mobile_feed_standard: 'MOBILE_FEED_STANDARD',
      mobile_fullwidth: 'MOBILE_FULLWIDTH',
      mobile_interstitial: 'MOBILE_INTERSTITIAL',
      mobile_medium_rectangle: 'MOBILE_MEDIUM_RECTANGLE',
      mobile_native: 'MOBILE_NATIVE',
      right_column_standard: 'RIGHT_COLUMN_STANDARD',
      suggested_video_desktop: 'SUGGESTED_VIDEO_DESKTOP',
      suggested_video_mobile: 'SUGGESTED_VIDEO_MOBILE',
      watch_feed_home: 'WATCH_FEED_HOME',
      watch_feed_mobile: 'WATCH_FEED_MOBILE'
    });
  }
  static get RenderType() {
    return Object.freeze({
      fallback: 'FALLBACK'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdCreative
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdCreative extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      actor_id: 'actor_id',
      adlabels: 'adlabels',
      applink_treatment: 'applink_treatment',
      asset_feed_spec: 'asset_feed_spec',
      authorization_category: 'authorization_category',
      auto_update: 'auto_update',
      body: 'body',
      branded_content_sponsor_page_id: 'branded_content_sponsor_page_id',
      bundle_folder_id: 'bundle_folder_id',
      call_to_action_type: 'call_to_action_type',
      categorization_criteria: 'categorization_criteria',
      category_media_source: 'category_media_source',
      collaborative_ads_lsb_image_bank_id: 'collaborative_ads_lsb_image_bank_id',
      degrees_of_freedom_spec: 'degrees_of_freedom_spec',
      destination_set_id: 'destination_set_id',
      dynamic_ad_voice: 'dynamic_ad_voice',
      effective_authorization_category: 'effective_authorization_category',
      effective_instagram_media_id: 'effective_instagram_media_id',
      effective_instagram_story_id: 'effective_instagram_story_id',
      effective_object_story_id: 'effective_object_story_id',
      enable_direct_install: 'enable_direct_install',
      enable_launch_instant_app: 'enable_launch_instant_app',
      id: 'id',
      image_crops: 'image_crops',
      image_hash: 'image_hash',
      image_url: 'image_url',
      instagram_actor_id: 'instagram_actor_id',
      instagram_permalink_url: 'instagram_permalink_url',
      instagram_story_id: 'instagram_story_id',
      instagram_user_id: 'instagram_user_id',
      interactive_components_spec: 'interactive_components_spec',
      link_deep_link_url: 'link_deep_link_url',
      link_destination_display_url: 'link_destination_display_url',
      link_og_id: 'link_og_id',
      link_url: 'link_url',
      messenger_sponsored_message: 'messenger_sponsored_message',
      name: 'name',
      object_id: 'object_id',
      object_store_url: 'object_store_url',
      object_story_id: 'object_story_id',
      object_story_spec: 'object_story_spec',
      object_type: 'object_type',
      object_url: 'object_url',
      omnichannel_link_spec: 'omnichannel_link_spec',
      place_page_set_id: 'place_page_set_id',
      platform_customizations: 'platform_customizations',
      playable_asset_id: 'playable_asset_id',
      portrait_customizations: 'portrait_customizations',
      product_set_id: 'product_set_id',
      recommender_settings: 'recommender_settings',
      source_instagram_media_id: 'source_instagram_media_id',
      status: 'status',
      template_url: 'template_url',
      template_url_spec: 'template_url_spec',
      thumbnail_id: 'thumbnail_id',
      thumbnail_url: 'thumbnail_url',
      title: 'title',
      url_tags: 'url_tags',
      use_page_actor_override: 'use_page_actor_override',
      video_id: 'video_id'
    });
  }
  static get CallToActionType() {
    return Object.freeze({
      add_to_cart: 'ADD_TO_CART',
      apply_now: 'APPLY_NOW',
      audio_call: 'AUDIO_CALL',
      book_travel: 'BOOK_TRAVEL',
      buy: 'BUY',
      buy_now: 'BUY_NOW',
      buy_tickets: 'BUY_TICKETS',
      call: 'CALL',
      call_me: 'CALL_ME',
      call_now: 'CALL_NOW',
      contact: 'CONTACT',
      contact_us: 'CONTACT_US',
      donate: 'DONATE',
      donate_now: 'DONATE_NOW',
      download: 'DOWNLOAD',
      event_rsvp: 'EVENT_RSVP',
      find_a_group: 'FIND_A_GROUP',
      find_your_groups: 'FIND_YOUR_GROUPS',
      follow_news_storyline: 'FOLLOW_NEWS_STORYLINE',
      follow_page: 'FOLLOW_PAGE',
      follow_user: 'FOLLOW_USER',
      get_directions: 'GET_DIRECTIONS',
      get_offer: 'GET_OFFER',
      get_offer_view: 'GET_OFFER_VIEW',
      get_quote: 'GET_QUOTE',
      get_showtimes: 'GET_SHOWTIMES',
      get_started: 'GET_STARTED',
      install_app: 'INSTALL_APP',
      install_mobile_app: 'INSTALL_MOBILE_APP',
      learn_more: 'LEARN_MORE',
      like_page: 'LIKE_PAGE',
      listen_music: 'LISTEN_MUSIC',
      listen_now: 'LISTEN_NOW',
      message_page: 'MESSAGE_PAGE',
      mobile_download: 'MOBILE_DOWNLOAD',
      moments: 'MOMENTS',
      no_button: 'NO_BUTTON',
      open_instant_app: 'OPEN_INSTANT_APP',
      open_link: 'OPEN_LINK',
      order_now: 'ORDER_NOW',
      pay_to_access: 'PAY_TO_ACCESS',
      play_game: 'PLAY_GAME',
      play_game_on_facebook: 'PLAY_GAME_ON_FACEBOOK',
      purchase_gift_cards: 'PURCHASE_GIFT_CARDS',
      raise_money: 'RAISE_MONEY',
      record_now: 'RECORD_NOW',
      refer_friends: 'REFER_FRIENDS',
      request_time: 'REQUEST_TIME',
      say_thanks: 'SAY_THANKS',
      see_more: 'SEE_MORE',
      sell_now: 'SELL_NOW',
      send_a_gift: 'SEND_A_GIFT',
      send_gift_money: 'SEND_GIFT_MONEY',
      send_updates: 'SEND_UPDATES',
      share: 'SHARE',
      shop_now: 'SHOP_NOW',
      sign_up: 'SIGN_UP',
      sotto_subscribe: 'SOTTO_SUBSCRIBE',
      start_order: 'START_ORDER',
      subscribe: 'SUBSCRIBE',
      swipe_up_product: 'SWIPE_UP_PRODUCT',
      swipe_up_shop: 'SWIPE_UP_SHOP',
      update_app: 'UPDATE_APP',
      use_app: 'USE_APP',
      use_mobile_app: 'USE_MOBILE_APP',
      video_annotation: 'VIDEO_ANNOTATION',
      video_call: 'VIDEO_CALL',
      visit_pages_feed: 'VISIT_PAGES_FEED',
      watch_more: 'WATCH_MORE',
      watch_video: 'WATCH_VIDEO',
      whatsapp_message: 'WHATSAPP_MESSAGE',
      woodhenge_support: 'WOODHENGE_SUPPORT'
    });
  }
  static get ObjectType() {
    return Object.freeze({
      application: 'APPLICATION',
      domain: 'DOMAIN',
      event: 'EVENT',
      invalid: 'INVALID',
      offer: 'OFFER',
      page: 'PAGE',
      photo: 'PHOTO',
      post_deleted: 'POST_DELETED',
      privacy_check_fail: 'PRIVACY_CHECK_FAIL',
      share: 'SHARE',
      status: 'STATUS',
      store_item: 'STORE_ITEM',
      video: 'VIDEO'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      deleted: 'DELETED',
      in_process: 'IN_PROCESS',
      with_issues: 'WITH_ISSUES'
    });
  }
  static get ApplinkTreatment() {
    return Object.freeze({
      automatic: 'automatic',
      deeplink_with_appstore_fallback: 'deeplink_with_appstore_fallback',
      deeplink_with_web_fallback: 'deeplink_with_web_fallback',
      web_only: 'web_only'
    });
  }
  static get AuthorizationCategory() {
    return Object.freeze({
      none: 'NONE',
      political: 'POLITICAL'
    });
  }
  static get CategorizationCriteria() {
    return Object.freeze({
      brand: 'brand',
      category: 'category',
      product_type: 'product_type'
    });
  }
  static get CategoryMediaSource() {
    return Object.freeze({
      category: 'CATEGORY',
      mixed: 'MIXED',
      products_collage: 'PRODUCTS_COLLAGE',
      products_slideshow: 'PRODUCTS_SLIDESHOW'
    });
  }
  static get DynamicAdVoice() {
    return Object.freeze({
      dynamic: 'DYNAMIC',
      story_owner: 'STORY_OWNER'
    });
  }
  static get Operator() {
    return Object.freeze({
      all: 'ALL',
      any: 'ANY'
    });
  }
  createAdLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adlabels', fields, params, AdCreative, pathOverride);
  }
  getCreativeInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreativeInsights, fields, params, fetchFirstPage, '/creative_insights');
  }
  getPreviews(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPreview, fields, params, fetchFirstPage, '/previews');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdRuleHistory
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdRuleHistory extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      evaluation_spec: 'evaluation_spec',
      exception_code: 'exception_code',
      exception_message: 'exception_message',
      execution_spec: 'execution_spec',
      is_manual: 'is_manual',
      results: 'results',
      schedule_spec: 'schedule_spec',
      timestamp: 'timestamp'
    });
  }
  static get Action() {
    return Object.freeze({
      budget_not_redistributed: 'BUDGET_NOT_REDISTRIBUTED',
      changed_bid: 'CHANGED_BID',
      changed_budget: 'CHANGED_BUDGET',
      email: 'EMAIL',
      enable_autoflow: 'ENABLE_AUTOFLOW',
      endpoint_pinged: 'ENDPOINT_PINGED',
      error: 'ERROR',
      facebook_notification_sent: 'FACEBOOK_NOTIFICATION_SENT',
      message_sent: 'MESSAGE_SENT',
      not_changed: 'NOT_CHANGED',
      paused: 'PAUSED',
      unpaused: 'UNPAUSED'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdRule
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdRule extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      created_by: 'created_by',
      created_time: 'created_time',
      evaluation_spec: 'evaluation_spec',
      execution_spec: 'execution_spec',
      id: 'id',
      name: 'name',
      schedule_spec: 'schedule_spec',
      status: 'status',
      updated_time: 'updated_time'
    });
  }
  static get Status() {
    return Object.freeze({
      deleted: 'DELETED',
      disabled: 'DISABLED',
      enabled: 'ENABLED',
      has_issues: 'HAS_ISSUES'
    });
  }
  static get UiCreationSource() {
    return Object.freeze({
      am_account_overview_recommendations: 'AM_ACCOUNT_OVERVIEW_RECOMMENDATIONS',
      am_activity_history_table: 'AM_ACTIVITY_HISTORY_TABLE',
      am_ad_object_name_card: 'AM_AD_OBJECT_NAME_CARD',
      am_amfe_l3_recommendation: 'AM_AMFE_L3_RECOMMENDATION',
      am_auto_apply_widget: 'AM_AUTO_APPLY_WIDGET',
      am_editor_card: 'AM_EDITOR_CARD',
      am_info_card: 'AM_INFO_CARD',
      am_name_cell_dropdown: 'AM_NAME_CELL_DROPDOWN',
      am_performance_summary: 'AM_PERFORMANCE_SUMMARY',
      am_rule_landing_page_banner: 'AM_RULE_LANDING_PAGE_BANNER',
      am_toolbar_create_rule_dropdown: 'AM_TOOLBAR_CREATE_RULE_DROPDOWN',
      pe_campaign_structure_menu: 'PE_CAMPAIGN_STRUCTURE_MENU',
      pe_editor_card: 'PE_EDITOR_CARD',
      pe_info_card: 'PE_INFO_CARD',
      pe_toolbar_create_rule_dropdown: 'PE_TOOLBAR_CREATE_RULE_DROPDOWN',
      rules_management_page_action_dropdown: 'RULES_MANAGEMENT_PAGE_ACTION_DROPDOWN',
      rules_management_page_rule_group: 'RULES_MANAGEMENT_PAGE_RULE_GROUP',
      rules_management_page_rule_name: 'RULES_MANAGEMENT_PAGE_RULE_NAME',
      rules_management_page_top_nav: 'RULES_MANAGEMENT_PAGE_TOP_NAV',
      rules_view_active_rules_dialog: 'RULES_VIEW_ACTIVE_RULES_DIALOG',
      rule_creation_success_dialog: 'RULE_CREATION_SUCCESS_DIALOG',
      rule_syd_redirect: 'RULE_SYD_REDIRECT',
      rule_templates_dialog: 'RULE_TEMPLATES_DIALOG'
    });
  }
  createExecute(fields, params = {}, pathOverride = null) {
    return this.createEdge('/execute', fields, params, null, pathOverride);
  }
  getHistory(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdRuleHistory, fields, params, fetchFirstPage, '/history');
  }
  createPreview(fields, params = {}, pathOverride = null) {
    return this.createEdge('/preview', fields, params, AdRule, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdsInsights
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdsInsights extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_currency: 'account_currency',
      account_id: 'account_id',
      account_name: 'account_name',
      action_values: 'action_values',
      actions: 'actions',
      ad_bid_value: 'ad_bid_value',
      ad_click_actions: 'ad_click_actions',
      ad_id: 'ad_id',
      ad_impression_actions: 'ad_impression_actions',
      ad_name: 'ad_name',
      adset_bid_value: 'adset_bid_value',
      adset_end: 'adset_end',
      adset_id: 'adset_id',
      adset_name: 'adset_name',
      adset_start: 'adset_start',
      age_targeting: 'age_targeting',
      attribution_setting: 'attribution_setting',
      auction_bid: 'auction_bid',
      auction_competitiveness: 'auction_competitiveness',
      auction_max_competitor_bid: 'auction_max_competitor_bid',
      buying_type: 'buying_type',
      campaign_id: 'campaign_id',
      campaign_name: 'campaign_name',
      canvas_avg_view_percent: 'canvas_avg_view_percent',
      canvas_avg_view_time: 'canvas_avg_view_time',
      catalog_segment_actions: 'catalog_segment_actions',
      catalog_segment_value: 'catalog_segment_value',
      catalog_segment_value_mobile_purchase_roas: 'catalog_segment_value_mobile_purchase_roas',
      catalog_segment_value_omni_purchase_roas: 'catalog_segment_value_omni_purchase_roas',
      catalog_segment_value_website_purchase_roas: 'catalog_segment_value_website_purchase_roas',
      clicks: 'clicks',
      conversion_rate_ranking: 'conversion_rate_ranking',
      conversion_values: 'conversion_values',
      conversions: 'conversions',
      converted_product_quantity: 'converted_product_quantity',
      converted_product_value: 'converted_product_value',
      cost_per_15_sec_video_view: 'cost_per_15_sec_video_view',
      cost_per_2_sec_continuous_video_view: 'cost_per_2_sec_continuous_video_view',
      cost_per_action_type: 'cost_per_action_type',
      cost_per_ad_click: 'cost_per_ad_click',
      cost_per_conversion: 'cost_per_conversion',
      cost_per_dda_countby_convs: 'cost_per_dda_countby_convs',
      cost_per_estimated_ad_recallers: 'cost_per_estimated_ad_recallers',
      cost_per_inline_link_click: 'cost_per_inline_link_click',
      cost_per_inline_post_engagement: 'cost_per_inline_post_engagement',
      cost_per_one_thousand_ad_impression: 'cost_per_one_thousand_ad_impression',
      cost_per_outbound_click: 'cost_per_outbound_click',
      cost_per_thruplay: 'cost_per_thruplay',
      cost_per_unique_action_type: 'cost_per_unique_action_type',
      cost_per_unique_click: 'cost_per_unique_click',
      cost_per_unique_conversion: 'cost_per_unique_conversion',
      cost_per_unique_inline_link_click: 'cost_per_unique_inline_link_click',
      cost_per_unique_outbound_click: 'cost_per_unique_outbound_click',
      cpc: 'cpc',
      cpm: 'cpm',
      cpp: 'cpp',
      created_time: 'created_time',
      ctr: 'ctr',
      date_start: 'date_start',
      date_stop: 'date_stop',
      dda_countby_convs: 'dda_countby_convs',
      dda_results: 'dda_results',
      engagement_rate_ranking: 'engagement_rate_ranking',
      estimated_ad_recall_rate: 'estimated_ad_recall_rate',
      estimated_ad_recall_rate_lower_bound: 'estimated_ad_recall_rate_lower_bound',
      estimated_ad_recall_rate_upper_bound: 'estimated_ad_recall_rate_upper_bound',
      estimated_ad_recallers: 'estimated_ad_recallers',
      estimated_ad_recallers_lower_bound: 'estimated_ad_recallers_lower_bound',
      estimated_ad_recallers_upper_bound: 'estimated_ad_recallers_upper_bound',
      frequency: 'frequency',
      full_view_impressions: 'full_view_impressions',
      full_view_reach: 'full_view_reach',
      gender_targeting: 'gender_targeting',
      impressions: 'impressions',
      inline_link_click_ctr: 'inline_link_click_ctr',
      inline_link_clicks: 'inline_link_clicks',
      inline_post_engagement: 'inline_post_engagement',
      instant_experience_clicks_to_open: 'instant_experience_clicks_to_open',
      instant_experience_clicks_to_start: 'instant_experience_clicks_to_start',
      instant_experience_outbound_clicks: 'instant_experience_outbound_clicks',
      interactive_component_tap: 'interactive_component_tap',
      labels: 'labels',
      location: 'location',
      mobile_app_purchase_roas: 'mobile_app_purchase_roas',
      objective: 'objective',
      optimization_goal: 'optimization_goal',
      outbound_clicks: 'outbound_clicks',
      outbound_clicks_ctr: 'outbound_clicks_ctr',
      place_page_name: 'place_page_name',
      purchase_roas: 'purchase_roas',
      qualifying_question_qualify_answer_rate: 'qualifying_question_qualify_answer_rate',
      quality_ranking: 'quality_ranking',
      quality_score_ectr: 'quality_score_ectr',
      quality_score_ecvr: 'quality_score_ecvr',
      quality_score_organic: 'quality_score_organic',
      reach: 'reach',
      social_spend: 'social_spend',
      spend: 'spend',
      total_postbacks: 'total_postbacks',
      total_postbacks_detailed: 'total_postbacks_detailed',
      unique_actions: 'unique_actions',
      unique_clicks: 'unique_clicks',
      unique_conversions: 'unique_conversions',
      unique_ctr: 'unique_ctr',
      unique_inline_link_click_ctr: 'unique_inline_link_click_ctr',
      unique_inline_link_clicks: 'unique_inline_link_clicks',
      unique_link_clicks_ctr: 'unique_link_clicks_ctr',
      unique_outbound_clicks: 'unique_outbound_clicks',
      unique_outbound_clicks_ctr: 'unique_outbound_clicks_ctr',
      unique_video_continuous_2_sec_watched_actions: 'unique_video_continuous_2_sec_watched_actions',
      unique_video_view_15_sec: 'unique_video_view_15_sec',
      updated_time: 'updated_time',
      video_15_sec_watched_actions: 'video_15_sec_watched_actions',
      video_30_sec_watched_actions: 'video_30_sec_watched_actions',
      video_avg_time_watched_actions: 'video_avg_time_watched_actions',
      video_continuous_2_sec_watched_actions: 'video_continuous_2_sec_watched_actions',
      video_p100_watched_actions: 'video_p100_watched_actions',
      video_p25_watched_actions: 'video_p25_watched_actions',
      video_p50_watched_actions: 'video_p50_watched_actions',
      video_p75_watched_actions: 'video_p75_watched_actions',
      video_p95_watched_actions: 'video_p95_watched_actions',
      video_play_actions: 'video_play_actions',
      video_play_curve_actions: 'video_play_curve_actions',
      video_play_retention_0_to_15s_actions: 'video_play_retention_0_to_15s_actions',
      video_play_retention_20_to_60s_actions: 'video_play_retention_20_to_60s_actions',
      video_play_retention_graph_actions: 'video_play_retention_graph_actions',
      video_thruplay_watched_actions: 'video_thruplay_watched_actions',
      video_time_watched_actions: 'video_time_watched_actions',
      website_ctr: 'website_ctr',
      website_purchase_roas: 'website_purchase_roas',
      wish_bid: 'wish_bid'
    });
  }
  static get ActionAttributionWindows() {
    return Object.freeze({
      value_1d_click: '1d_click',
      value_1d_view: '1d_view',
      value_28d_click: '28d_click',
      value_28d_view: '28d_view',
      value_7d_click: '7d_click',
      value_7d_view: '7d_view',
      dda: 'dda',
      default: 'default',
      skan_click: 'skan_click',
      skan_view: 'skan_view'
    });
  }
  static get ActionBreakdowns() {
    return Object.freeze({
      action_canvas_component_name: 'action_canvas_component_name',
      action_carousel_card_id: 'action_carousel_card_id',
      action_carousel_card_name: 'action_carousel_card_name',
      action_destination: 'action_destination',
      action_device: 'action_device',
      action_reaction: 'action_reaction',
      action_target_id: 'action_target_id',
      action_type: 'action_type',
      action_video_sound: 'action_video_sound',
      action_video_type: 'action_video_type'
    });
  }
  static get ActionReportTime() {
    return Object.freeze({
      conversion: 'conversion',
      impression: 'impression',
      mixed: 'mixed'
    });
  }
  static get Breakdowns() {
    return Object.freeze({
      ad_format_asset: 'ad_format_asset',
      age: 'age',
      app_id: 'app_id',
      body_asset: 'body_asset',
      call_to_action_asset: 'call_to_action_asset',
      country: 'country',
      description_asset: 'description_asset',
      device_platform: 'device_platform',
      dma: 'dma',
      frequency_value: 'frequency_value',
      gender: 'gender',
      hourly_stats_aggregated_by_advertiser_time_zone: 'hourly_stats_aggregated_by_advertiser_time_zone',
      hourly_stats_aggregated_by_audience_time_zone: 'hourly_stats_aggregated_by_audience_time_zone',
      image_asset: 'image_asset',
      impression_device: 'impression_device',
      is_conversion_id_modeled: 'is_conversion_id_modeled',
      link_url_asset: 'link_url_asset',
      mmm: 'mmm',
      place_page_id: 'place_page_id',
      platform_position: 'platform_position',
      product_id: 'product_id',
      publisher_platform: 'publisher_platform',
      region: 'region',
      skan_campaign_id: 'skan_campaign_id',
      skan_conversion_id: 'skan_conversion_id',
      title_asset: 'title_asset',
      video_asset: 'video_asset'
    });
  }
  static get DatePreset() {
    return Object.freeze({
      data_maximum: 'data_maximum',
      last_14d: 'last_14d',
      last_28d: 'last_28d',
      last_30d: 'last_30d',
      last_3d: 'last_3d',
      last_7d: 'last_7d',
      last_90d: 'last_90d',
      last_month: 'last_month',
      last_quarter: 'last_quarter',
      last_week_mon_sun: 'last_week_mon_sun',
      last_week_sun_sat: 'last_week_sun_sat',
      last_year: 'last_year',
      maximum: 'maximum',
      this_month: 'this_month',
      this_quarter: 'this_quarter',
      this_week_mon_today: 'this_week_mon_today',
      this_week_sun_today: 'this_week_sun_today',
      this_year: 'this_year',
      today: 'today',
      yesterday: 'yesterday'
    });
  }
  static get Level() {
    return Object.freeze({
      account: 'account',
      ad: 'ad',
      adset: 'adset',
      campaign: 'campaign'
    });
  }
  static get SummaryActionBreakdowns() {
    return Object.freeze({
      action_canvas_component_name: 'action_canvas_component_name',
      action_carousel_card_id: 'action_carousel_card_id',
      action_carousel_card_name: 'action_carousel_card_name',
      action_destination: 'action_destination',
      action_device: 'action_device',
      action_reaction: 'action_reaction',
      action_target_id: 'action_target_id',
      action_type: 'action_type',
      action_video_sound: 'action_video_sound',
      action_video_type: 'action_video_type'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdReportRun
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdReportRun extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      async_percent_completion: 'async_percent_completion',
      async_status: 'async_status',
      date_start: 'date_start',
      date_stop: 'date_stop',
      emails: 'emails',
      friendly_name: 'friendly_name',
      id: 'id',
      is_bookmarked: 'is_bookmarked',
      is_running: 'is_running',
      schedule_id: 'schedule_id',
      time_completed: 'time_completed',
      time_ref: 'time_ref'
    });
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsInsights, fields, params, fetchFirstPage, '/insights');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
  constructor(id = null, data = {}, parentId, api) {
    super();
    this.id = data.report_run_id;
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Lead
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Lead extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_id: 'ad_id',
      ad_name: 'ad_name',
      adset_id: 'adset_id',
      adset_name: 'adset_name',
      campaign_id: 'campaign_id',
      campaign_name: 'campaign_name',
      created_time: 'created_time',
      custom_disclaimer_responses: 'custom_disclaimer_responses',
      field_data: 'field_data',
      form_id: 'form_id',
      home_listing: 'home_listing',
      id: 'id',
      is_organic: 'is_organic',
      partner_name: 'partner_name',
      platform: 'platform',
      retailer_item_id: 'retailer_item_id',
      vehicle: 'vehicle'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * TargetingSentenceLine
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class TargetingSentenceLine extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      params: 'params',
      targetingsentencelines: 'targetingsentencelines'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Ad
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Ad extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      ad_review_feedback: 'ad_review_feedback',
      adlabels: 'adlabels',
      adset: 'adset',
      adset_id: 'adset_id',
      bid_amount: 'bid_amount',
      bid_info: 'bid_info',
      bid_type: 'bid_type',
      campaign: 'campaign',
      campaign_id: 'campaign_id',
      configured_status: 'configured_status',
      conversion_domain: 'conversion_domain',
      conversion_specs: 'conversion_specs',
      created_time: 'created_time',
      creative: 'creative',
      demolink_hash: 'demolink_hash',
      display_sequence: 'display_sequence',
      effective_status: 'effective_status',
      engagement_audience: 'engagement_audience',
      failed_delivery_checks: 'failed_delivery_checks',
      id: 'id',
      issues_info: 'issues_info',
      last_updated_by_app_id: 'last_updated_by_app_id',
      name: 'name',
      preview_shareable_link: 'preview_shareable_link',
      priority: 'priority',
      recommendations: 'recommendations',
      source_ad: 'source_ad',
      source_ad_id: 'source_ad_id',
      status: 'status',
      targeting: 'targeting',
      tracking_and_conversion_with_defaults: 'tracking_and_conversion_with_defaults',
      tracking_specs: 'tracking_specs',
      updated_time: 'updated_time'
    });
  }
  static get BidType() {
    return Object.freeze({
      absolute_ocpm: 'ABSOLUTE_OCPM',
      cpa: 'CPA',
      cpc: 'CPC',
      cpm: 'CPM',
      multi_premium: 'MULTI_PREMIUM'
    });
  }
  static get ConfiguredStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get EffectiveStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      adset_paused: 'ADSET_PAUSED',
      archived: 'ARCHIVED',
      campaign_paused: 'CAMPAIGN_PAUSED',
      deleted: 'DELETED',
      disapproved: 'DISAPPROVED',
      in_process: 'IN_PROCESS',
      paused: 'PAUSED',
      pending_billing_info: 'PENDING_BILLING_INFO',
      pending_review: 'PENDING_REVIEW',
      preapproved: 'PREAPPROVED',
      with_issues: 'WITH_ISSUES'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get DatePreset() {
    return Object.freeze({
      data_maximum: 'data_maximum',
      last_14d: 'last_14d',
      last_28d: 'last_28d',
      last_30d: 'last_30d',
      last_3d: 'last_3d',
      last_7d: 'last_7d',
      last_90d: 'last_90d',
      last_month: 'last_month',
      last_quarter: 'last_quarter',
      last_week_mon_sun: 'last_week_mon_sun',
      last_week_sun_sat: 'last_week_sun_sat',
      last_year: 'last_year',
      maximum: 'maximum',
      this_month: 'this_month',
      this_quarter: 'this_quarter',
      this_week_mon_today: 'this_week_mon_today',
      this_week_sun_today: 'this_week_sun_today',
      this_year: 'this_year',
      today: 'today',
      yesterday: 'yesterday'
    });
  }
  static get ExecutionOptions() {
    return Object.freeze({
      include_recommendations: 'include_recommendations',
      synchronous_ad_review: 'synchronous_ad_review',
      validate_only: 'validate_only'
    });
  }
  static get Operator() {
    return Object.freeze({
      all: 'ALL',
      any: 'ANY'
    });
  }
  static get StatusOption() {
    return Object.freeze({
      active: 'ACTIVE',
      inherited_from_source: 'INHERITED_FROM_SOURCE',
      paused: 'PAUSED'
    });
  }
  getAdCreatives(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreative, fields, params, fetchFirstPage, '/adcreatives');
  }
  createAdLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adlabels', fields, params, Ad, pathOverride);
  }
  getAdRulesGoverned(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdRule, fields, params, fetchFirstPage, '/adrules_governed');
  }
  getCopies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/copies');
  }
  createCopy(fields, params = {}, pathOverride = null) {
    return this.createEdge('/copies', fields, params, Ad, pathOverride);
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsInsights, fields, params, fetchFirstPage, '/insights');
  }
  getInsightsAsync(fields, params = {}, pathOverride = null) {
    return this.createEdge('/insights', fields, params, AdReportRun, pathOverride);
  }
  getLeads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Lead, fields, params, fetchFirstPage, '/leads');
  }
  getPreviews(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPreview, fields, params, fetchFirstPage, '/previews');
  }
  getTargetingSentenceLines(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(TargetingSentenceLine, fields, params, fetchFirstPage, '/targetingsentencelines');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAsyncRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAsyncRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      async_request_set: 'async_request_set',
      created_time: 'created_time',
      id: 'id',
      input: 'input',
      result: 'result',
      scope_object_id: 'scope_object_id',
      status: 'status',
      type: 'type',
      updated_time: 'updated_time'
    });
  }
  static get Statuses() {
    return Object.freeze({
      canceled: 'CANCELED',
      canceled_dependency: 'CANCELED_DEPENDENCY',
      error: 'ERROR',
      error_conflicts: 'ERROR_CONFLICTS',
      error_dependency: 'ERROR_DEPENDENCY',
      initial: 'INITIAL',
      in_progress: 'IN_PROGRESS',
      pending_dependency: 'PENDING_DEPENDENCY',
      process_by_ad_async_engine: 'PROCESS_BY_AD_ASYNC_ENGINE',
      process_by_event_processor: 'PROCESS_BY_EVENT_PROCESSOR',
      success: 'SUCCESS',
      user_canceled: 'USER_CANCELED',
      user_canceled_dependency: 'USER_CANCELED_DEPENDENCY'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdCampaignDeliveryEstimate
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdCampaignDeliveryEstimate extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      daily_outcomes_curve: 'daily_outcomes_curve',
      estimate_dau: 'estimate_dau',
      estimate_mau_lower_bound: 'estimate_mau_lower_bound',
      estimate_mau_upper_bound: 'estimate_mau_upper_bound',
      estimate_ready: 'estimate_ready',
      targeting_optimization_types: 'targeting_optimization_types'
    });
  }
  static get OptimizationGoal() {
    return Object.freeze({
      ad_recall_lift: 'AD_RECALL_LIFT',
      app_installs: 'APP_INSTALLS',
      app_installs_and_offsite_conversions: 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS',
      conversations: 'CONVERSATIONS',
      derived_events: 'DERIVED_EVENTS',
      engaged_users: 'ENGAGED_USERS',
      event_responses: 'EVENT_RESPONSES',
      impressions: 'IMPRESSIONS',
      in_app_value: 'IN_APP_VALUE',
      landing_page_views: 'LANDING_PAGE_VIEWS',
      lead_generation: 'LEAD_GENERATION',
      link_clicks: 'LINK_CLICKS',
      messaging_appointment_conversion: 'MESSAGING_APPOINTMENT_CONVERSION',
      messaging_purchase_conversion: 'MESSAGING_PURCHASE_CONVERSION',
      none: 'NONE',
      offsite_conversions: 'OFFSITE_CONVERSIONS',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      quality_call: 'QUALITY_CALL',
      quality_lead: 'QUALITY_LEAD',
      reach: 'REACH',
      thruplay: 'THRUPLAY',
      value: 'VALUE',
      visit_instagram_profile: 'VISIT_INSTAGRAM_PROFILE'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdSet
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdSet extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      adlabels: 'adlabels',
      adset_schedule: 'adset_schedule',
      asset_feed_id: 'asset_feed_id',
      attribution_spec: 'attribution_spec',
      bid_adjustments: 'bid_adjustments',
      bid_amount: 'bid_amount',
      bid_constraints: 'bid_constraints',
      bid_info: 'bid_info',
      bid_strategy: 'bid_strategy',
      billing_event: 'billing_event',
      budget_remaining: 'budget_remaining',
      campaign: 'campaign',
      campaign_id: 'campaign_id',
      configured_status: 'configured_status',
      created_time: 'created_time',
      creative_sequence: 'creative_sequence',
      daily_budget: 'daily_budget',
      daily_min_spend_target: 'daily_min_spend_target',
      daily_spend_cap: 'daily_spend_cap',
      destination_type: 'destination_type',
      effective_status: 'effective_status',
      end_time: 'end_time',
      existing_customer_budget_percentage: 'existing_customer_budget_percentage',
      frequency_control_specs: 'frequency_control_specs',
      full_funnel_exploration_mode: 'full_funnel_exploration_mode',
      id: 'id',
      instagram_actor_id: 'instagram_actor_id',
      is_dynamic_creative: 'is_dynamic_creative',
      issues_info: 'issues_info',
      learning_stage_info: 'learning_stage_info',
      lifetime_budget: 'lifetime_budget',
      lifetime_imps: 'lifetime_imps',
      lifetime_min_spend_target: 'lifetime_min_spend_target',
      lifetime_spend_cap: 'lifetime_spend_cap',
      multi_optimization_goal_weight: 'multi_optimization_goal_weight',
      name: 'name',
      optimization_goal: 'optimization_goal',
      optimization_sub_event: 'optimization_sub_event',
      pacing_type: 'pacing_type',
      promoted_object: 'promoted_object',
      recommendations: 'recommendations',
      recurring_budget_semantics: 'recurring_budget_semantics',
      review_feedback: 'review_feedback',
      rf_prediction_id: 'rf_prediction_id',
      source_adset: 'source_adset',
      source_adset_id: 'source_adset_id',
      start_time: 'start_time',
      status: 'status',
      targeting: 'targeting',
      targeting_optimization_types: 'targeting_optimization_types',
      time_based_ad_rotation_id_blocks: 'time_based_ad_rotation_id_blocks',
      time_based_ad_rotation_intervals: 'time_based_ad_rotation_intervals',
      updated_time: 'updated_time',
      use_new_app_click: 'use_new_app_click'
    });
  }
  static get BidStrategy() {
    return Object.freeze({
      cost_cap: 'COST_CAP',
      lowest_cost_without_cap: 'LOWEST_COST_WITHOUT_CAP',
      lowest_cost_with_bid_cap: 'LOWEST_COST_WITH_BID_CAP'
    });
  }
  static get BillingEvent() {
    return Object.freeze({
      app_installs: 'APP_INSTALLS',
      clicks: 'CLICKS',
      impressions: 'IMPRESSIONS',
      link_clicks: 'LINK_CLICKS',
      listing_interaction: 'LISTING_INTERACTION',
      none: 'NONE',
      offer_claims: 'OFFER_CLAIMS',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      purchase: 'PURCHASE',
      thruplay: 'THRUPLAY'
    });
  }
  static get ConfiguredStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get EffectiveStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      campaign_paused: 'CAMPAIGN_PAUSED',
      deleted: 'DELETED',
      in_process: 'IN_PROCESS',
      paused: 'PAUSED',
      with_issues: 'WITH_ISSUES'
    });
  }
  static get OptimizationGoal() {
    return Object.freeze({
      ad_recall_lift: 'AD_RECALL_LIFT',
      app_installs: 'APP_INSTALLS',
      app_installs_and_offsite_conversions: 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS',
      conversations: 'CONVERSATIONS',
      derived_events: 'DERIVED_EVENTS',
      engaged_users: 'ENGAGED_USERS',
      event_responses: 'EVENT_RESPONSES',
      impressions: 'IMPRESSIONS',
      in_app_value: 'IN_APP_VALUE',
      landing_page_views: 'LANDING_PAGE_VIEWS',
      lead_generation: 'LEAD_GENERATION',
      link_clicks: 'LINK_CLICKS',
      messaging_appointment_conversion: 'MESSAGING_APPOINTMENT_CONVERSION',
      messaging_purchase_conversion: 'MESSAGING_PURCHASE_CONVERSION',
      none: 'NONE',
      offsite_conversions: 'OFFSITE_CONVERSIONS',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      quality_call: 'QUALITY_CALL',
      quality_lead: 'QUALITY_LEAD',
      reach: 'REACH',
      thruplay: 'THRUPLAY',
      value: 'VALUE',
      visit_instagram_profile: 'VISIT_INSTAGRAM_PROFILE'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get DatePreset() {
    return Object.freeze({
      data_maximum: 'data_maximum',
      last_14d: 'last_14d',
      last_28d: 'last_28d',
      last_30d: 'last_30d',
      last_3d: 'last_3d',
      last_7d: 'last_7d',
      last_90d: 'last_90d',
      last_month: 'last_month',
      last_quarter: 'last_quarter',
      last_week_mon_sun: 'last_week_mon_sun',
      last_week_sun_sat: 'last_week_sun_sat',
      last_year: 'last_year',
      maximum: 'maximum',
      this_month: 'this_month',
      this_quarter: 'this_quarter',
      this_week_mon_today: 'this_week_mon_today',
      this_week_sun_today: 'this_week_sun_today',
      this_year: 'this_year',
      today: 'today',
      yesterday: 'yesterday'
    });
  }
  static get DestinationType() {
    return Object.freeze({
      app: 'APP',
      applinks_automatic: 'APPLINKS_AUTOMATIC',
      facebook: 'FACEBOOK',
      messenger: 'MESSENGER',
      undefined: 'UNDEFINED',
      website: 'WEBSITE'
    });
  }
  static get ExecutionOptions() {
    return Object.freeze({
      include_recommendations: 'include_recommendations',
      validate_only: 'validate_only'
    });
  }
  static get FullFunnelExplorationMode() {
    return Object.freeze({
      extended_exploration: 'EXTENDED_EXPLORATION',
      limited_exploration: 'LIMITED_EXPLORATION',
      none_exploration: 'NONE_EXPLORATION'
    });
  }
  static get MultiOptimizationGoalWeight() {
    return Object.freeze({
      balanced: 'BALANCED',
      prefer_event: 'PREFER_EVENT',
      prefer_install: 'PREFER_INSTALL',
      undefined: 'UNDEFINED'
    });
  }
  static get OptimizationSubEvent() {
    return Object.freeze({
      none: 'NONE',
      travel_intent: 'TRAVEL_INTENT',
      travel_intent_bucket_01: 'TRAVEL_INTENT_BUCKET_01',
      travel_intent_bucket_02: 'TRAVEL_INTENT_BUCKET_02',
      travel_intent_bucket_03: 'TRAVEL_INTENT_BUCKET_03',
      travel_intent_bucket_04: 'TRAVEL_INTENT_BUCKET_04',
      travel_intent_bucket_05: 'TRAVEL_INTENT_BUCKET_05',
      travel_intent_no_destination_intent: 'TRAVEL_INTENT_NO_DESTINATION_INTENT',
      trip_consideration: 'TRIP_CONSIDERATION',
      video_sound_on: 'VIDEO_SOUND_ON'
    });
  }
  static get TuneForCategory() {
    return Object.freeze({
      credit: 'CREDIT',
      employment: 'EMPLOYMENT',
      housing: 'HOUSING',
      issues_elections_politics: 'ISSUES_ELECTIONS_POLITICS',
      none: 'NONE',
      online_gambling_and_gaming: 'ONLINE_GAMBLING_AND_GAMING'
    });
  }
  static get Operator() {
    return Object.freeze({
      all: 'ALL',
      any: 'ANY'
    });
  }
  static get StatusOption() {
    return Object.freeze({
      active: 'ACTIVE',
      inherited_from_source: 'INHERITED_FROM_SOURCE',
      paused: 'PAUSED'
    });
  }
  getActivities(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdActivity, fields, params, fetchFirstPage, '/activities');
  }
  getAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/ad_studies');
  }
  getAdCreatives(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreative, fields, params, fetchFirstPage, '/adcreatives');
  }
  deleteAdLabels(params = {}) {
    return super.deleteEdge('/adlabels', params);
  }
  createAdLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adlabels', fields, params, AdSet, pathOverride);
  }
  getAdRulesGoverned(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdRule, fields, params, fetchFirstPage, '/adrules_governed');
  }
  getAds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/ads');
  }
  getAsyncAdRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAsyncRequest, fields, params, fetchFirstPage, '/asyncadrequests');
  }
  getCopies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/copies');
  }
  createCopy(fields, params = {}, pathOverride = null) {
    return this.createEdge('/copies', fields, params, AdSet, pathOverride);
  }
  getDeliveryEstimate(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCampaignDeliveryEstimate, fields, params, fetchFirstPage, '/delivery_estimate');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsInsights, fields, params, fetchFirstPage, '/insights');
  }
  getInsightsAsync(fields, params = {}, pathOverride = null) {
    return this.createEdge('/insights', fields, params, AdReportRun, pathOverride);
  }
  getTargetingSentenceLines(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(TargetingSentenceLine, fields, params, fetchFirstPage, '/targetingsentencelines');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Campaign
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Campaign extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      ad_strategy_group_id: 'ad_strategy_group_id',
      ad_strategy_id: 'ad_strategy_id',
      adlabels: 'adlabels',
      bid_strategy: 'bid_strategy',
      boosted_object_id: 'boosted_object_id',
      brand_lift_studies: 'brand_lift_studies',
      budget_rebalance_flag: 'budget_rebalance_flag',
      budget_remaining: 'budget_remaining',
      buying_type: 'buying_type',
      can_create_brand_lift_study: 'can_create_brand_lift_study',
      can_use_spend_cap: 'can_use_spend_cap',
      configured_status: 'configured_status',
      created_time: 'created_time',
      daily_budget: 'daily_budget',
      effective_status: 'effective_status',
      has_secondary_skadnetwork_reporting: 'has_secondary_skadnetwork_reporting',
      id: 'id',
      is_skadnetwork_attribution: 'is_skadnetwork_attribution',
      issues_info: 'issues_info',
      last_budget_toggling_time: 'last_budget_toggling_time',
      lifetime_budget: 'lifetime_budget',
      name: 'name',
      objective: 'objective',
      pacing_type: 'pacing_type',
      primary_attribution: 'primary_attribution',
      promoted_object: 'promoted_object',
      recommendations: 'recommendations',
      smart_promotion_type: 'smart_promotion_type',
      source_campaign: 'source_campaign',
      source_campaign_id: 'source_campaign_id',
      special_ad_categories: 'special_ad_categories',
      special_ad_category: 'special_ad_category',
      special_ad_category_country: 'special_ad_category_country',
      spend_cap: 'spend_cap',
      start_time: 'start_time',
      status: 'status',
      stop_time: 'stop_time',
      topline_id: 'topline_id',
      updated_time: 'updated_time'
    });
  }
  static get BidStrategy() {
    return Object.freeze({
      cost_cap: 'COST_CAP',
      lowest_cost_without_cap: 'LOWEST_COST_WITHOUT_CAP',
      lowest_cost_with_bid_cap: 'LOWEST_COST_WITH_BID_CAP'
    });
  }
  static get ConfiguredStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get EffectiveStatus() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      in_process: 'IN_PROCESS',
      paused: 'PAUSED',
      with_issues: 'WITH_ISSUES'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      paused: 'PAUSED'
    });
  }
  static get DatePreset() {
    return Object.freeze({
      data_maximum: 'data_maximum',
      last_14d: 'last_14d',
      last_28d: 'last_28d',
      last_30d: 'last_30d',
      last_3d: 'last_3d',
      last_7d: 'last_7d',
      last_90d: 'last_90d',
      last_month: 'last_month',
      last_quarter: 'last_quarter',
      last_week_mon_sun: 'last_week_mon_sun',
      last_week_sun_sat: 'last_week_sun_sat',
      last_year: 'last_year',
      maximum: 'maximum',
      this_month: 'this_month',
      this_quarter: 'this_quarter',
      this_week_mon_today: 'this_week_mon_today',
      this_week_sun_today: 'this_week_sun_today',
      this_year: 'this_year',
      today: 'today',
      yesterday: 'yesterday'
    });
  }
  static get ExecutionOptions() {
    return Object.freeze({
      include_recommendations: 'include_recommendations',
      validate_only: 'validate_only'
    });
  }
  static get Objective() {
    return Object.freeze({
      app_installs: 'APP_INSTALLS',
      brand_awareness: 'BRAND_AWARENESS',
      conversions: 'CONVERSIONS',
      event_responses: 'EVENT_RESPONSES',
      lead_generation: 'LEAD_GENERATION',
      link_clicks: 'LINK_CLICKS',
      local_awareness: 'LOCAL_AWARENESS',
      messages: 'MESSAGES',
      offer_claims: 'OFFER_CLAIMS',
      outcome_app_promotion: 'OUTCOME_APP_PROMOTION',
      outcome_awareness: 'OUTCOME_AWARENESS',
      outcome_engagement: 'OUTCOME_ENGAGEMENT',
      outcome_leads: 'OUTCOME_LEADS',
      outcome_sales: 'OUTCOME_SALES',
      outcome_traffic: 'OUTCOME_TRAFFIC',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      product_catalog_sales: 'PRODUCT_CATALOG_SALES',
      reach: 'REACH',
      store_visits: 'STORE_VISITS',
      video_views: 'VIDEO_VIEWS'
    });
  }
  static get SmartPromotionType() {
    return Object.freeze({
      guided_creation: 'GUIDED_CREATION',
      smart_app_promotion: 'SMART_APP_PROMOTION'
    });
  }
  static get SpecialAdCategories() {
    return Object.freeze({
      credit: 'CREDIT',
      employment: 'EMPLOYMENT',
      housing: 'HOUSING',
      issues_elections_politics: 'ISSUES_ELECTIONS_POLITICS',
      none: 'NONE',
      online_gambling_and_gaming: 'ONLINE_GAMBLING_AND_GAMING'
    });
  }
  static get SpecialAdCategoryCountry() {
    return Object.freeze({
      ad: 'AD',
      ae: 'AE',
      af: 'AF',
      ag: 'AG',
      ai: 'AI',
      al: 'AL',
      am: 'AM',
      an: 'AN',
      ao: 'AO',
      aq: 'AQ',
      ar: 'AR',
      as: 'AS',
      at: 'AT',
      au: 'AU',
      aw: 'AW',
      ax: 'AX',
      az: 'AZ',
      ba: 'BA',
      bb: 'BB',
      bd: 'BD',
      be: 'BE',
      bf: 'BF',
      bg: 'BG',
      bh: 'BH',
      bi: 'BI',
      bj: 'BJ',
      bl: 'BL',
      bm: 'BM',
      bn: 'BN',
      bo: 'BO',
      bq: 'BQ',
      br: 'BR',
      bs: 'BS',
      bt: 'BT',
      bv: 'BV',
      bw: 'BW',
      by: 'BY',
      bz: 'BZ',
      ca: 'CA',
      cc: 'CC',
      cd: 'CD',
      cf: 'CF',
      cg: 'CG',
      ch: 'CH',
      ci: 'CI',
      ck: 'CK',
      cl: 'CL',
      cm: 'CM',
      cn: 'CN',
      co: 'CO',
      cr: 'CR',
      cu: 'CU',
      cv: 'CV',
      cw: 'CW',
      cx: 'CX',
      cy: 'CY',
      cz: 'CZ',
      de: 'DE',
      dj: 'DJ',
      dk: 'DK',
      dm: 'DM',
      do: 'DO',
      dz: 'DZ',
      ec: 'EC',
      ee: 'EE',
      eg: 'EG',
      eh: 'EH',
      er: 'ER',
      es: 'ES',
      et: 'ET',
      fi: 'FI',
      fj: 'FJ',
      fk: 'FK',
      fm: 'FM',
      fo: 'FO',
      fr: 'FR',
      ga: 'GA',
      gb: 'GB',
      gd: 'GD',
      ge: 'GE',
      gf: 'GF',
      gg: 'GG',
      gh: 'GH',
      gi: 'GI',
      gl: 'GL',
      gm: 'GM',
      gn: 'GN',
      gp: 'GP',
      gq: 'GQ',
      gr: 'GR',
      gs: 'GS',
      gt: 'GT',
      gu: 'GU',
      gw: 'GW',
      gy: 'GY',
      hk: 'HK',
      hm: 'HM',
      hn: 'HN',
      hr: 'HR',
      ht: 'HT',
      hu: 'HU',
      id: 'ID',
      ie: 'IE',
      il: 'IL',
      im: 'IM',
      in: 'IN',
      io: 'IO',
      iq: 'IQ',
      ir: 'IR',
      is: 'IS',
      it: 'IT',
      je: 'JE',
      jm: 'JM',
      jo: 'JO',
      jp: 'JP',
      ke: 'KE',
      kg: 'KG',
      kh: 'KH',
      ki: 'KI',
      km: 'KM',
      kn: 'KN',
      kp: 'KP',
      kr: 'KR',
      kw: 'KW',
      ky: 'KY',
      kz: 'KZ',
      la: 'LA',
      lb: 'LB',
      lc: 'LC',
      li: 'LI',
      lk: 'LK',
      lr: 'LR',
      ls: 'LS',
      lt: 'LT',
      lu: 'LU',
      lv: 'LV',
      ly: 'LY',
      ma: 'MA',
      mc: 'MC',
      md: 'MD',
      me: 'ME',
      mf: 'MF',
      mg: 'MG',
      mh: 'MH',
      mk: 'MK',
      ml: 'ML',
      mm: 'MM',
      mn: 'MN',
      mo: 'MO',
      mp: 'MP',
      mq: 'MQ',
      mr: 'MR',
      ms: 'MS',
      mt: 'MT',
      mu: 'MU',
      mv: 'MV',
      mw: 'MW',
      mx: 'MX',
      my: 'MY',
      mz: 'MZ',
      na: 'NA',
      nc: 'NC',
      ne: 'NE',
      nf: 'NF',
      ng: 'NG',
      ni: 'NI',
      nl: 'NL',
      no: 'NO',
      np: 'NP',
      nr: 'NR',
      nu: 'NU',
      nz: 'NZ',
      om: 'OM',
      pa: 'PA',
      pe: 'PE',
      pf: 'PF',
      pg: 'PG',
      ph: 'PH',
      pk: 'PK',
      pl: 'PL',
      pm: 'PM',
      pn: 'PN',
      pr: 'PR',
      ps: 'PS',
      pt: 'PT',
      pw: 'PW',
      py: 'PY',
      qa: 'QA',
      re: 'RE',
      ro: 'RO',
      rs: 'RS',
      ru: 'RU',
      rw: 'RW',
      sa: 'SA',
      sb: 'SB',
      sc: 'SC',
      sd: 'SD',
      se: 'SE',
      sg: 'SG',
      sh: 'SH',
      si: 'SI',
      sj: 'SJ',
      sk: 'SK',
      sl: 'SL',
      sm: 'SM',
      sn: 'SN',
      so: 'SO',
      sr: 'SR',
      ss: 'SS',
      st: 'ST',
      sv: 'SV',
      sx: 'SX',
      sy: 'SY',
      sz: 'SZ',
      tc: 'TC',
      td: 'TD',
      tf: 'TF',
      tg: 'TG',
      th: 'TH',
      tj: 'TJ',
      tk: 'TK',
      tl: 'TL',
      tm: 'TM',
      tn: 'TN',
      to: 'TO',
      tr: 'TR',
      tt: 'TT',
      tv: 'TV',
      tw: 'TW',
      tz: 'TZ',
      ua: 'UA',
      ug: 'UG',
      um: 'UM',
      us: 'US',
      uy: 'UY',
      uz: 'UZ',
      va: 'VA',
      vc: 'VC',
      ve: 'VE',
      vg: 'VG',
      vi: 'VI',
      vn: 'VN',
      vu: 'VU',
      wf: 'WF',
      ws: 'WS',
      xk: 'XK',
      ye: 'YE',
      yt: 'YT',
      za: 'ZA',
      zm: 'ZM',
      zw: 'ZW'
    });
  }
  static get Operator() {
    return Object.freeze({
      all: 'ALL',
      any: 'ANY'
    });
  }
  static get SpecialAdCategory() {
    return Object.freeze({
      credit: 'CREDIT',
      employment: 'EMPLOYMENT',
      housing: 'HOUSING',
      issues_elections_politics: 'ISSUES_ELECTIONS_POLITICS',
      none: 'NONE',
      online_gambling_and_gaming: 'ONLINE_GAMBLING_AND_GAMING'
    });
  }
  static get StatusOption() {
    return Object.freeze({
      active: 'ACTIVE',
      inherited_from_source: 'INHERITED_FROM_SOURCE',
      paused: 'PAUSED'
    });
  }
  getAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/ad_studies');
  }
  createAdLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adlabels', fields, params, Campaign, pathOverride);
  }
  getAdRulesGoverned(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdRule, fields, params, fetchFirstPage, '/adrules_governed');
  }
  getAds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/ads');
  }
  getAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/adsets');
  }
  getCopies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Campaign, fields, params, fetchFirstPage, '/copies');
  }
  createCopy(fields, params = {}, pathOverride = null) {
    return this.createEdge('/copies', fields, params, Campaign, pathOverride);
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsInsights, fields, params, fetchFirstPage, '/insights');
  }
  getInsightsAsync(fields, params = {}, pathOverride = null) {
    return this.createEdge('/insights', fields, params, AdReportRun, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdStudyCell
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdStudyCell extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_entities_count: 'ad_entities_count',
      control_percentage: 'control_percentage',
      id: 'id',
      name: 'name',
      treatment_percentage: 'treatment_percentage'
    });
  }
  static get CreationTemplate() {
    return Object.freeze({
      automatic_placements: 'AUTOMATIC_PLACEMENTS',
      brand_awareness: 'BRAND_AWARENESS',
      facebook: 'FACEBOOK',
      facebook_audience_network: 'FACEBOOK_AUDIENCE_NETWORK',
      facebook_instagram: 'FACEBOOK_INSTAGRAM',
      facebook_news_feed: 'FACEBOOK_NEWS_FEED',
      facebook_news_feed_in_stream_video: 'FACEBOOK_NEWS_FEED_IN_STREAM_VIDEO',
      high_frequency: 'HIGH_FREQUENCY',
      instagram: 'INSTAGRAM',
      in_stream_video: 'IN_STREAM_VIDEO',
      low_frequency: 'LOW_FREQUENCY',
      medium_frequency: 'MEDIUM_FREQUENCY',
      mobile_optimized_video: 'MOBILE_OPTIMIZED_VIDEO',
      page_post_engagement: 'PAGE_POST_ENGAGEMENT',
      reach: 'REACH',
      tv_commercial: 'TV_COMMERCIAL',
      tv_facebook: 'TV_FACEBOOK',
      video_view_optimization: 'VIDEO_VIEW_OPTIMIZATION'
    });
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/adaccounts');
  }
  getAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/adsets');
  }
  getCampaigns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Campaign, fields, params, fetchFirstPage, '/campaigns');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PrivateLiftStudyInstance
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PrivateLiftStudyInstance extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      breakdown_key: 'breakdown_key',
      created_time: 'created_time',
      feature_list: 'feature_list',
      id: 'id',
      issuer_certificate: 'issuer_certificate',
      latest_status_update_time: 'latest_status_update_time',
      run_id: 'run_id',
      server_hostnames: 'server_hostnames',
      server_ips: 'server_ips',
      status: 'status',
      tier: 'tier'
    });
  }
  static get Operation() {
    return Object.freeze({
      aggregate: 'AGGREGATE',
      cancel: 'CANCEL',
      compute: 'COMPUTE',
      id_match: 'ID_MATCH',
      next: 'NEXT',
      none: 'NONE'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AssignedUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AssignedUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business: 'business',
      id: 'id',
      name: 'name',
      user_type: 'user_type'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * DACheck
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class DACheck extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      action_uri: 'action_uri',
      description: 'description',
      key: 'key',
      result: 'result',
      title: 'title',
      user_message: 'user_message'
    });
  }
  static get ConnectionMethod() {
    return Object.freeze({
      all: 'ALL',
      app: 'APP',
      browser: 'BROWSER',
      server: 'SERVER'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdPlacement
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdPlacement extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      bundle_id: 'bundle_id',
      display_format: 'display_format',
      external_placement_id: 'external_placement_id',
      google_display_format: 'google_display_format',
      id: 'id',
      name: 'name',
      placement_group: 'placement_group',
      platform: 'platform',
      status: 'status'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdNetworkAnalyticsSyncQueryResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdNetworkAnalyticsSyncQueryResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      omitted_results: 'omitted_results',
      query_id: 'query_id',
      results: 'results'
    });
  }
  static get AggregationPeriod() {
    return Object.freeze({
      day: 'DAY',
      total: 'TOTAL'
    });
  }
  static get Breakdowns() {
    return Object.freeze({
      ad_server_campaign_id: 'AD_SERVER_CAMPAIGN_ID',
      ad_space: 'AD_SPACE',
      age: 'AGE',
      app: 'APP',
      clicked_view_tag: 'CLICKED_VIEW_TAG',
      country: 'COUNTRY',
      deal: 'DEAL',
      deal_ad: 'DEAL_AD',
      deal_page: 'DEAL_PAGE',
      delivery_method: 'DELIVERY_METHOD',
      display_format: 'DISPLAY_FORMAT',
      fail_reason: 'FAIL_REASON',
      gender: 'GENDER',
      instant_article_id: 'INSTANT_ARTICLE_ID',
      instant_article_page_id: 'INSTANT_ARTICLE_PAGE_ID',
      is_deal_backfill: 'IS_DEAL_BACKFILL',
      placement: 'PLACEMENT',
      placement_name: 'PLACEMENT_NAME',
      platform: 'PLATFORM',
      property: 'PROPERTY',
      sdk_version: 'SDK_VERSION'
    });
  }
  static get Metrics() {
    return Object.freeze({
      fb_ad_network_bidding_bid_rate: 'FB_AD_NETWORK_BIDDING_BID_RATE',
      fb_ad_network_bidding_request: 'FB_AD_NETWORK_BIDDING_REQUEST',
      fb_ad_network_bidding_response: 'FB_AD_NETWORK_BIDDING_RESPONSE',
      fb_ad_network_bidding_revenue: 'FB_AD_NETWORK_BIDDING_REVENUE',
      fb_ad_network_bidding_win_rate: 'FB_AD_NETWORK_BIDDING_WIN_RATE',
      fb_ad_network_click: 'FB_AD_NETWORK_CLICK',
      fb_ad_network_cpm: 'FB_AD_NETWORK_CPM',
      fb_ad_network_ctr: 'FB_AD_NETWORK_CTR',
      fb_ad_network_filled_request: 'FB_AD_NETWORK_FILLED_REQUEST',
      fb_ad_network_fill_rate: 'FB_AD_NETWORK_FILL_RATE',
      fb_ad_network_imp: 'FB_AD_NETWORK_IMP',
      fb_ad_network_impression_rate: 'FB_AD_NETWORK_IMPRESSION_RATE',
      fb_ad_network_request: 'FB_AD_NETWORK_REQUEST',
      fb_ad_network_revenue: 'FB_AD_NETWORK_REVENUE',
      fb_ad_network_show_rate: 'FB_AD_NETWORK_SHOW_RATE',
      fb_ad_network_video_guarantee_revenue: 'FB_AD_NETWORK_VIDEO_GUARANTEE_REVENUE',
      fb_ad_network_video_mrc: 'FB_AD_NETWORK_VIDEO_MRC',
      fb_ad_network_video_mrc_rate: 'FB_AD_NETWORK_VIDEO_MRC_RATE',
      fb_ad_network_video_view: 'FB_AD_NETWORK_VIDEO_VIEW',
      fb_ad_network_video_view_rate: 'FB_AD_NETWORK_VIDEO_VIEW_RATE'
    });
  }
  static get OrderingColumn() {
    return Object.freeze({
      metric: 'METRIC',
      time: 'TIME',
      value: 'VALUE'
    });
  }
  static get OrderingType() {
    return Object.freeze({
      ascending: 'ASCENDING',
      descending: 'DESCENDING'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdNetworkAnalyticsAsyncQueryResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdNetworkAnalyticsAsyncQueryResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      data: 'data',
      error: 'error',
      omitted_results: 'omitted_results',
      query_id: 'query_id',
      results: 'results',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProfilePictureSource
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProfilePictureSource extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      bottom: 'bottom',
      cache_key: 'cache_key',
      height: 'height',
      is_silhouette: 'is_silhouette',
      left: 'left',
      right: 'right',
      top: 'top',
      url: 'url',
      width: 'width'
    });
  }
  static get Type() {
    return Object.freeze({
      album: 'album',
      small: 'small',
      thumbnail: 'thumbnail'
    });
  }
  static get BreakingChange() {
    return Object.freeze({
      profile_picture: 'PROFILE_PICTURE'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Profile
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Profile extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      can_post: 'can_post',
      id: 'id',
      link: 'link',
      name: 'name',
      pic: 'pic',
      pic_crop: 'pic_crop',
      pic_large: 'pic_large',
      pic_small: 'pic_small',
      pic_square: 'pic_square',
      profile_type: 'profile_type',
      username: 'username'
    });
  }
  static get ProfileType() {
    return Object.freeze({
      application: 'application',
      event: 'event',
      group: 'group',
      page: 'page',
      user: 'user'
    });
  }
  static get Type() {
    return Object.freeze({
      angry: 'ANGRY',
      care: 'CARE',
      fire: 'FIRE',
      haha: 'HAHA',
      hundred: 'HUNDRED',
      like: 'LIKE',
      love: 'LOVE',
      none: 'NONE',
      pride: 'PRIDE',
      sad: 'SAD',
      thankful: 'THANKFUL',
      wow: 'WOW'
    });
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Comment
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Comment extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      admin_creator: 'admin_creator',
      application: 'application',
      attachment: 'attachment',
      can_comment: 'can_comment',
      can_hide: 'can_hide',
      can_like: 'can_like',
      can_remove: 'can_remove',
      can_reply_privately: 'can_reply_privately',
      comment_count: 'comment_count',
      created_time: 'created_time',
      from: 'from',
      id: 'id',
      is_hidden: 'is_hidden',
      is_private: 'is_private',
      like_count: 'like_count',
      live_broadcast_timestamp: 'live_broadcast_timestamp',
      message: 'message',
      message_tags: 'message_tags',
      object: 'object',
      parent: 'parent',
      permalink_url: 'permalink_url',
      private_reply_conversation: 'private_reply_conversation',
      user_likes: 'user_likes'
    });
  }
  static get CommentPrivacyValue() {
    return Object.freeze({
      declined_by_admin_assistant: 'DECLINED_BY_ADMIN_ASSISTANT',
      default_privacy: 'DEFAULT_PRIVACY',
      friends_and_post_owner: 'FRIENDS_AND_POST_OWNER',
      friends_only: 'FRIENDS_ONLY',
      graphql_multiple_value_hack_do_not_use: 'GRAPHQL_MULTIPLE_VALUE_HACK_DO_NOT_USE',
      owner_or_commenter: 'OWNER_OR_COMMENTER',
      pending_approval: 'PENDING_APPROVAL',
      removed_by_admin_assistant: 'REMOVED_BY_ADMIN_ASSISTANT',
      side_conversation: 'SIDE_CONVERSATION',
      side_conversation_and_post_owner: 'SIDE_CONVERSATION_AND_POST_OWNER',
      spotlight_tab: 'SPOTLIGHT_TAB'
    });
  }
  static get Filter() {
    return Object.freeze({
      stream: 'stream',
      toplevel: 'toplevel'
    });
  }
  static get LiveFilter() {
    return Object.freeze({
      filter_low_quality: 'filter_low_quality',
      no_filter: 'no_filter'
    });
  }
  static get Order() {
    return Object.freeze({
      chronological: 'chronological',
      reverse_chronological: 'reverse_chronological'
    });
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, Comment, pathOverride);
  }
  deleteLikes(params = {}) {
    return super.deleteEdge('/likes', params);
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/likes');
  }
  createLike(fields, params = {}, pathOverride = null) {
    return this.createEdge('/likes', fields, params, Comment, pathOverride);
  }
  getReactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/reactions');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InsightsResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InsightsResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      description: 'description',
      description_from_api_doc: 'description_from_api_doc',
      id: 'id',
      name: 'name',
      period: 'period',
      title: 'title',
      values: 'values'
    });
  }
  static get DatePreset() {
    return Object.freeze({
      data_maximum: 'data_maximum',
      last_14d: 'last_14d',
      last_28d: 'last_28d',
      last_30d: 'last_30d',
      last_3d: 'last_3d',
      last_7d: 'last_7d',
      last_90d: 'last_90d',
      last_month: 'last_month',
      last_quarter: 'last_quarter',
      last_week_mon_sun: 'last_week_mon_sun',
      last_week_sun_sat: 'last_week_sun_sat',
      last_year: 'last_year',
      maximum: 'maximum',
      this_month: 'this_month',
      this_quarter: 'this_quarter',
      this_week_mon_today: 'this_week_mon_today',
      this_week_sun_today: 'this_week_sun_today',
      this_year: 'this_year',
      today: 'today',
      yesterday: 'yesterday'
    });
  }
  static get Period() {
    return Object.freeze({
      day: 'day',
      days_28: 'days_28',
      lifetime: 'lifetime',
      month: 'month',
      total_over_range: 'total_over_range',
      week: 'week'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * RTBDynamicPost
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class RTBDynamicPost extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      child_attachments: 'child_attachments',
      created: 'created',
      description: 'description',
      id: 'id',
      image_url: 'image_url',
      link: 'link',
      message: 'message',
      owner_id: 'owner_id',
      place_id: 'place_id',
      product_id: 'product_id',
      title: 'title'
    });
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/likes');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Post
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Post extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      actions: 'actions',
      admin_creator: 'admin_creator',
      allowed_advertising_objectives: 'allowed_advertising_objectives',
      application: 'application',
      backdated_time: 'backdated_time',
      call_to_action: 'call_to_action',
      can_reply_privately: 'can_reply_privately',
      caption: 'caption',
      child_attachments: 'child_attachments',
      comments_mirroring_domain: 'comments_mirroring_domain',
      coordinates: 'coordinates',
      created_time: 'created_time',
      description: 'description',
      event: 'event',
      expanded_height: 'expanded_height',
      expanded_width: 'expanded_width',
      feed_targeting: 'feed_targeting',
      from: 'from',
      full_picture: 'full_picture',
      height: 'height',
      icon: 'icon',
      id: 'id',
      instagram_eligibility: 'instagram_eligibility',
      is_app_share: 'is_app_share',
      is_eligible_for_promotion: 'is_eligible_for_promotion',
      is_expired: 'is_expired',
      is_hidden: 'is_hidden',
      is_inline_created: 'is_inline_created',
      is_instagram_eligible: 'is_instagram_eligible',
      is_popular: 'is_popular',
      is_published: 'is_published',
      is_spherical: 'is_spherical',
      link: 'link',
      message: 'message',
      message_tags: 'message_tags',
      multi_share_end_card: 'multi_share_end_card',
      multi_share_optimized: 'multi_share_optimized',
      name: 'name',
      object_id: 'object_id',
      parent_id: 'parent_id',
      permalink_url: 'permalink_url',
      picture: 'picture',
      place: 'place',
      privacy: 'privacy',
      promotable_id: 'promotable_id',
      promotion_status: 'promotion_status',
      properties: 'properties',
      scheduled_publish_time: 'scheduled_publish_time',
      shares: 'shares',
      source: 'source',
      status_type: 'status_type',
      story: 'story',
      story_tags: 'story_tags',
      subscribed: 'subscribed',
      target: 'target',
      targeting: 'targeting',
      timeline_visibility: 'timeline_visibility',
      type: 'type',
      updated_time: 'updated_time',
      via: 'via',
      video_buying_eligibility: 'video_buying_eligibility',
      width: 'width'
    });
  }
  static get BackdatedTimeGranularity() {
    return Object.freeze({
      day: 'day',
      hour: 'hour',
      min: 'min',
      month: 'month',
      none: 'none',
      year: 'year'
    });
  }
  static get CheckinEntryPoint() {
    return Object.freeze({
      branding_checkin: 'BRANDING_CHECKIN',
      branding_other: 'BRANDING_OTHER',
      branding_photo: 'BRANDING_PHOTO',
      branding_status: 'BRANDING_STATUS'
    });
  }
  static get Formatting() {
    return Object.freeze({
      markdown: 'MARKDOWN',
      plaintext: 'PLAINTEXT'
    });
  }
  static get PlaceAttachmentSetting() {
    return Object.freeze({
      value_1: '1',
      value_2: '2'
    });
  }
  static get PostSurfacesBlacklist() {
    return Object.freeze({
      value_1: '1',
      value_2: '2',
      value_3: '3',
      value_4: '4',
      value_5: '5'
    });
  }
  static get PostingToRedspace() {
    return Object.freeze({
      disabled: 'disabled',
      enabled: 'enabled'
    });
  }
  static get TargetSurface() {
    return Object.freeze({
      story: 'STORY',
      timeline: 'TIMELINE'
    });
  }
  static get UnpublishedContentType() {
    return Object.freeze({
      ads_post: 'ADS_POST',
      draft: 'DRAFT',
      inline_created: 'INLINE_CREATED',
      published: 'PUBLISHED',
      reviewable_branded_content: 'REVIEWABLE_BRANDED_CONTENT',
      scheduled: 'SCHEDULED',
      scheduled_recurring: 'SCHEDULED_RECURRING'
    });
  }
  static get FeedStoryVisibility() {
    return Object.freeze({
      hidden: 'hidden',
      visible: 'visible'
    });
  }
  static get TimelineVisibility() {
    return Object.freeze({
      forced_allow: 'forced_allow',
      hidden: 'hidden',
      normal: 'normal'
    });
  }
  getAttachments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/attachments');
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, Comment, pathOverride);
  }
  getDynamicPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(RTBDynamicPost, fields, params, fetchFirstPage, '/dynamic_posts');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  deleteLikes(params = {}) {
    return super.deleteEdge('/likes', params);
  }
  createLike(fields, params = {}, pathOverride = null) {
    return this.createEdge('/likes', fields, params, Post, pathOverride);
  }
  getReactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/reactions');
  }
  getSharedPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Post, fields, params, fetchFirstPage, '/sharedposts');
  }
  getSponsorTags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/sponsor_tags');
  }
  getTo(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/to');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PagePost
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PagePost extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      actions: 'actions',
      admin_creator: 'admin_creator',
      allowed_advertising_objectives: 'allowed_advertising_objectives',
      application: 'application',
      backdated_time: 'backdated_time',
      call_to_action: 'call_to_action',
      can_reply_privately: 'can_reply_privately',
      child_attachments: 'child_attachments',
      comments_mirroring_domain: 'comments_mirroring_domain',
      coordinates: 'coordinates',
      created_time: 'created_time',
      event: 'event',
      expanded_height: 'expanded_height',
      expanded_width: 'expanded_width',
      feed_targeting: 'feed_targeting',
      from: 'from',
      full_picture: 'full_picture',
      height: 'height',
      icon: 'icon',
      id: 'id',
      instagram_eligibility: 'instagram_eligibility',
      is_app_share: 'is_app_share',
      is_eligible_for_promotion: 'is_eligible_for_promotion',
      is_expired: 'is_expired',
      is_hidden: 'is_hidden',
      is_inline_created: 'is_inline_created',
      is_instagram_eligible: 'is_instagram_eligible',
      is_popular: 'is_popular',
      is_published: 'is_published',
      is_spherical: 'is_spherical',
      message: 'message',
      message_tags: 'message_tags',
      multi_share_end_card: 'multi_share_end_card',
      multi_share_optimized: 'multi_share_optimized',
      parent_id: 'parent_id',
      permalink_url: 'permalink_url',
      picture: 'picture',
      place: 'place',
      privacy: 'privacy',
      promotable_id: 'promotable_id',
      promotion_status: 'promotion_status',
      properties: 'properties',
      scheduled_publish_time: 'scheduled_publish_time',
      shares: 'shares',
      status_type: 'status_type',
      story: 'story',
      story_tags: 'story_tags',
      subscribed: 'subscribed',
      target: 'target',
      targeting: 'targeting',
      timeline_visibility: 'timeline_visibility',
      updated_time: 'updated_time',
      via: 'via',
      video_buying_eligibility: 'video_buying_eligibility',
      width: 'width'
    });
  }
  static get With() {
    return Object.freeze({
      location: 'LOCATION'
    });
  }
  static get BackdatedTimeGranularity() {
    return Object.freeze({
      day: 'day',
      hour: 'hour',
      min: 'min',
      month: 'month',
      none: 'none',
      year: 'year'
    });
  }
  static get FeedStoryVisibility() {
    return Object.freeze({
      hidden: 'hidden',
      visible: 'visible'
    });
  }
  static get TimelineVisibility() {
    return Object.freeze({
      forced_allow: 'forced_allow',
      hidden: 'hidden',
      normal: 'normal'
    });
  }
  getAttachments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/attachments');
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, Comment, pathOverride);
  }
  getDynamicPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(RTBDynamicPost, fields, params, fetchFirstPage, '/dynamic_posts');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  deleteLikes(params = {}) {
    return super.deleteEdge('/likes', params);
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/likes');
  }
  createLike(fields, params = {}, pathOverride = null) {
    return this.createEdge('/likes', fields, params, PagePost, pathOverride);
  }
  getReactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/reactions');
  }
  getSharedPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Post, fields, params, fetchFirstPage, '/sharedposts');
  }
  getSponsorTags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/sponsor_tags');
  }
  getTo(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/to');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PageCallToAction
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PageCallToAction extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      android_app: 'android_app',
      android_deeplink: 'android_deeplink',
      android_destination_type: 'android_destination_type',
      android_package_name: 'android_package_name',
      android_url: 'android_url',
      created_time: 'created_time',
      email_address: 'email_address',
      from: 'from',
      id: 'id',
      intl_number_with_plus: 'intl_number_with_plus',
      iphone_app: 'iphone_app',
      iphone_deeplink: 'iphone_deeplink',
      iphone_destination_type: 'iphone_destination_type',
      iphone_url: 'iphone_url',
      status: 'status',
      type: 'type',
      updated_time: 'updated_time',
      web_destination_type: 'web_destination_type',
      web_url: 'web_url'
    });
  }
  static get AndroidDestinationType() {
    return Object.freeze({
      app_deeplink: 'APP_DEEPLINK',
      become_a_volunteer: 'BECOME_A_VOLUNTEER',
      email: 'EMAIL',
      facebook_app: 'FACEBOOK_APP',
      follow: 'FOLLOW',
      marketplace_inventory_page: 'MARKETPLACE_INVENTORY_PAGE',
      menu_on_facebook: 'MENU_ON_FACEBOOK',
      messenger: 'MESSENGER',
      mini_shop: 'MINI_SHOP',
      mobile_center: 'MOBILE_CENTER',
      none: 'NONE',
      phone_call: 'PHONE_CALL',
      shop_on_facebook: 'SHOP_ON_FACEBOOK',
      website: 'WEBSITE'
    });
  }
  static get IphoneDestinationType() {
    return Object.freeze({
      app_deeplink: 'APP_DEEPLINK',
      become_a_volunteer: 'BECOME_A_VOLUNTEER',
      email: 'EMAIL',
      facebook_app: 'FACEBOOK_APP',
      follow: 'FOLLOW',
      marketplace_inventory_page: 'MARKETPLACE_INVENTORY_PAGE',
      menu_on_facebook: 'MENU_ON_FACEBOOK',
      messenger: 'MESSENGER',
      mini_shop: 'MINI_SHOP',
      none: 'NONE',
      phone_call: 'PHONE_CALL',
      shop_on_facebook: 'SHOP_ON_FACEBOOK',
      website: 'WEBSITE'
    });
  }
  static get Type() {
    return Object.freeze({
      become_a_volunteer: 'BECOME_A_VOLUNTEER',
      book_appointment: 'BOOK_APPOINTMENT',
      book_now: 'BOOK_NOW',
      buy_tickets: 'BUY_TICKETS',
      call_now: 'CALL_NOW',
      charity_donate: 'CHARITY_DONATE',
      contact_us: 'CONTACT_US',
      donate_now: 'DONATE_NOW',
      email: 'EMAIL',
      follow_page: 'FOLLOW_PAGE',
      get_directions: 'GET_DIRECTIONS',
      get_offer: 'GET_OFFER',
      get_offer_view: 'GET_OFFER_VIEW',
      interested: 'INTERESTED',
      learn_more: 'LEARN_MORE',
      listen: 'LISTEN',
      local_dev_platform: 'LOCAL_DEV_PLATFORM',
      message: 'MESSAGE',
      mobile_center: 'MOBILE_CENTER',
      open_app: 'OPEN_APP',
      order_food: 'ORDER_FOOD',
      play_music: 'PLAY_MUSIC',
      play_now: 'PLAY_NOW',
      purchase_gift_cards: 'PURCHASE_GIFT_CARDS',
      request_appointment: 'REQUEST_APPOINTMENT',
      request_quote: 'REQUEST_QUOTE',
      shop_now: 'SHOP_NOW',
      shop_on_facebook: 'SHOP_ON_FACEBOOK',
      sign_up: 'SIGN_UP',
      view_inventory: 'VIEW_INVENTORY',
      view_menu: 'VIEW_MENU',
      view_shop: 'VIEW_SHOP',
      visit_group: 'VISIT_GROUP',
      watch_now: 'WATCH_NOW',
      woodhenge_support: 'WOODHENGE_SUPPORT'
    });
  }
  static get WebDestinationType() {
    return Object.freeze({
      become_a_volunteer: 'BECOME_A_VOLUNTEER',
      become_supporter: 'BECOME_SUPPORTER',
      email: 'EMAIL',
      follow: 'FOLLOW',
      messenger: 'MESSENGER',
      mobile_center: 'MOBILE_CENTER',
      none: 'NONE',
      shop_on_facebook: 'SHOP_ON_FACEBOOK',
      website: 'WEBSITE'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CanvasBodyElement
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CanvasBodyElement extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      element: 'element'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * TextWithEntities
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class TextWithEntities extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      text: 'text'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Canvas
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Canvas extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      background_color: 'background_color',
      body_elements: 'body_elements',
      business_id: 'business_id',
      canvas_link: 'canvas_link',
      collection_hero_image: 'collection_hero_image',
      collection_hero_video: 'collection_hero_video',
      collection_thumbnails: 'collection_thumbnails',
      dynamic_setting: 'dynamic_setting',
      element_payload: 'element_payload',
      elements: 'elements',
      fb_body_elements: 'fb_body_elements',
      id: 'id',
      is_hidden: 'is_hidden',
      is_published: 'is_published',
      last_editor: 'last_editor',
      linked_documents: 'linked_documents',
      name: 'name',
      owner: 'owner',
      property_list: 'property_list',
      source_template: 'source_template',
      store_url: 'store_url',
      style_list: 'style_list',
      tags: 'tags',
      ui_property_list: 'ui_property_list',
      unused_body_elements: 'unused_body_elements',
      update_time: 'update_time',
      use_retailer_item_ids: 'use_retailer_item_ids'
    });
  }
  getPreviews(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(TextWithEntities, fields, params, fetchFirstPage, '/previews');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ChatPlugin
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ChatPlugin extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      alignment: 'alignment',
      desktop_bottom_spacing: 'desktop_bottom_spacing',
      desktop_side_spacing: 'desktop_side_spacing',
      entry_point_icon: 'entry_point_icon',
      entry_point_label: 'entry_point_label',
      greeting_dialog_display: 'greeting_dialog_display',
      guest_chat_mode: 'guest_chat_mode',
      mobile_bottom_spacing: 'mobile_bottom_spacing',
      mobile_chat_display: 'mobile_chat_display',
      mobile_side_spacing: 'mobile_side_spacing',
      theme_color: 'theme_color',
      welcome_screen_greeting: 'welcome_screen_greeting'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * URL
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class URL extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      development_instant_article: 'development_instant_article',
      engagement: 'engagement',
      id: 'id',
      instant_article: 'instant_article',
      og_object: 'og_object',
      ownership_permissions: 'ownership_permissions',
      scopes: 'scopes'
    });
  }
  static get Scopes() {
    return Object.freeze({
      news_tab: 'NEWS_TAB',
      news_tab_dev_env: 'NEWS_TAB_DEV_ENV'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PageCommerceEligibility
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PageCommerceEligibility extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      offsite: 'offsite',
      onsite: 'onsite'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CommerceOrder
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CommerceOrder extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      buyer_details: 'buyer_details',
      channel: 'channel',
      created: 'created',
      estimated_payment_details: 'estimated_payment_details',
      id: 'id',
      is_group_buy: 'is_group_buy',
      is_test_order: 'is_test_order',
      last_updated: 'last_updated',
      merchant_order_id: 'merchant_order_id',
      order_status: 'order_status',
      selected_shipping_option: 'selected_shipping_option',
      ship_by_date: 'ship_by_date',
      shipping_address: 'shipping_address'
    });
  }
  static get Filters() {
    return Object.freeze({
      has_cancellations: 'HAS_CANCELLATIONS',
      has_fulfillments: 'HAS_FULFILLMENTS',
      has_refunds: 'HAS_REFUNDS',
      no_cancellations: 'NO_CANCELLATIONS',
      no_refunds: 'NO_REFUNDS',
      no_shipments: 'NO_SHIPMENTS'
    });
  }
  static get State() {
    return Object.freeze({
      completed: 'COMPLETED',
      created: 'CREATED',
      fb_processing: 'FB_PROCESSING',
      in_progress: 'IN_PROGRESS'
    });
  }
  static get ReasonCode() {
    return Object.freeze({
      buyers_remorse: 'BUYERS_REMORSE',
      damaged_goods: 'DAMAGED_GOODS',
      facebook_initiated: 'FACEBOOK_INITIATED',
      not_as_described: 'NOT_AS_DESCRIBED',
      quality_issue: 'QUALITY_ISSUE',
      refund_compromised: 'REFUND_COMPROMISED',
      refund_for_return: 'REFUND_FOR_RETURN',
      refund_reason_other: 'REFUND_REASON_OTHER',
      refund_sfi_fake: 'REFUND_SFI_FAKE',
      refund_sfi_real: 'REFUND_SFI_REAL',
      wrong_item: 'WRONG_ITEM'
    });
  }
  createAcknowledgeOrder(fields, params = {}, pathOverride = null) {
    return this.createEdge('/acknowledge_order', fields, params, CommerceOrder, pathOverride);
  }
  getCancellations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/cancellations');
  }
  createCancellation(fields, params = {}, pathOverride = null) {
    return this.createEdge('/cancellations', fields, params, CommerceOrder, pathOverride);
  }
  createFulfillOrder(fields, params = {}, pathOverride = null) {
    return this.createEdge('/fulfill_order', fields, params, CommerceOrder, pathOverride);
  }
  getItems(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/items');
  }
  getPayments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/payments');
  }
  getPromotionDetails(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/promotion_details');
  }
  getPromotions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/promotions');
  }
  getRefunds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/refunds');
  }
  createRefund(fields, params = {}, pathOverride = null) {
    return this.createEdge('/refunds', fields, params, CommerceOrder, pathOverride);
  }
  getReturns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/returns');
  }
  createReturn(fields, params = {}, pathOverride = null) {
    return this.createEdge('/returns', fields, params, CommerceOrder, pathOverride);
  }
  getShipments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/shipments');
  }
  createShipment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shipments', fields, params, CommerceOrder, pathOverride);
  }
  createUpdateShipment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/update_shipment', fields, params, CommerceOrder, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CommercePayout
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CommercePayout extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      amount: 'amount',
      payout_date: 'payout_date',
      payout_reference_id: 'payout_reference_id',
      status: 'status',
      transfer_id: 'transfer_id'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CommerceOrderTransactionDetail
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CommerceOrderTransactionDetail extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      net_payment_amount: 'net_payment_amount',
      order_details: 'order_details',
      payout_reference_id: 'payout_reference_id',
      processing_fee: 'processing_fee',
      tax_rate: 'tax_rate',
      transaction_date: 'transaction_date',
      transaction_type: 'transaction_type',
      transfer_id: 'transfer_id',
      id: 'id'
    });
  }
  getItems(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/items');
  }
  getTaxDetails(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/tax_details');
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AREffectsBatchStatus
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AREffectsBatchStatus extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      errors: 'errors',
      product_groups: 'product_groups',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CatalogItemChannelsToIntegrityStatus
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CatalogItemChannelsToIntegrityStatus extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      channels: 'channels',
      rejection_information: 'rejection_information'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AutomotiveModel
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AutomotiveModel extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      applinks: 'applinks',
      automotive_model_id: 'automotive_model_id',
      availability: 'availability',
      body_style: 'body_style',
      category_specific_fields: 'category_specific_fields',
      currency: 'currency',
      custom_label_0: 'custom_label_0',
      description: 'description',
      drivetrain: 'drivetrain',
      exterior_color: 'exterior_color',
      finance_description: 'finance_description',
      finance_type: 'finance_type',
      fuel_type: 'fuel_type',
      generation: 'generation',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      interior_color: 'interior_color',
      interior_upholstery: 'interior_upholstery',
      make: 'make',
      model: 'model',
      price: 'price',
      sanitized_images: 'sanitized_images',
      title: 'title',
      transmission: 'transmission',
      trim: 'trim',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility',
      year: 'year'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * StoreCatalogSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class StoreCatalogSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      page: 'page'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogCategory
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogCategory extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      criteria_value: 'criteria_value',
      description: 'description',
      destination_uri: 'destination_uri',
      image_url: 'image_url',
      name: 'name',
      num_items: 'num_items',
      tokens: 'tokens'
    });
  }
  static get CategorizationCriteria() {
    return Object.freeze({
      brand: 'BRAND',
      category: 'CATEGORY',
      product_type: 'PRODUCT_TYPE'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CheckBatchRequestStatus
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CheckBatchRequestStatus extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      errors: 'errors',
      errors_total_count: 'errors_total_count',
      handle: 'handle',
      ids_of_invalid_requests: 'ids_of_invalid_requests',
      status: 'status',
      warnings: 'warnings',
      warnings_total_count: 'warnings_total_count'
    });
  }
  static get ErrorPriority() {
    return Object.freeze({
      high: 'HIGH',
      low: 'LOW',
      medium: 'MEDIUM'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CatalogSegmentAllMatchCountLaser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CatalogSegmentAllMatchCountLaser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      date_start: 'date_start',
      date_stop: 'date_stop',
      event: 'event',
      source: 'source',
      total_matched_content_ids: 'total_matched_content_ids',
      unique_matched_content_ids: 'unique_matched_content_ids'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CollaborativeAdsShareSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CollaborativeAdsShareSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      agency_business: 'agency_business',
      id: 'id',
      product_catalog_proxy_id: 'product_catalog_proxy_id',
      utm_campaign: 'utm_campaign',
      utm_medium: 'utm_medium',
      utm_source: 'utm_source'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogDataSource
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogDataSource extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      app_id: 'app_id',
      id: 'id',
      ingestion_source_type: 'ingestion_source_type',
      name: 'name',
      upload_type: 'upload_type'
    });
  }
  static get IngestionSourceType() {
    return Object.freeze({
      all: 'ALL',
      primary: 'PRIMARY',
      supplementary: 'SUPPLEMENTARY'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Destination
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Destination extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      address: 'address',
      applinks: 'applinks',
      category_specific_fields: 'category_specific_fields',
      currency: 'currency',
      description: 'description',
      destination_id: 'destination_id',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      name: 'name',
      price: 'price',
      price_change: 'price_change',
      sanitized_images: 'sanitized_images',
      types: 'types',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogDiagnosticGroup
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogDiagnosticGroup extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      affected_channels: 'affected_channels',
      affected_entity: 'affected_entity',
      affected_features: 'affected_features',
      diagnostics: 'diagnostics',
      error_code: 'error_code',
      number_of_affected_entities: 'number_of_affected_entities',
      number_of_affected_items: 'number_of_affected_items',
      severity: 'severity',
      subtitle: 'subtitle',
      title: 'title',
      type: 'type'
    });
  }
  static get AffectedChannels() {
    return Object.freeze({
      business_inbox_in_messenger: 'business_inbox_in_messenger',
      shops: 'shops',
      test_capability: 'test_capability',
      universal_checkout: 'universal_checkout',
      us_marketplace: 'us_marketplace'
    });
  }
  static get AffectedEntity() {
    return Object.freeze({
      product_catalog: 'product_catalog',
      product_item: 'product_item',
      product_set: 'product_set'
    });
  }
  static get AffectedFeatures() {
    return Object.freeze({
      augmented_reality: 'augmented_reality',
      checkout: 'checkout'
    });
  }
  static get Severity() {
    return Object.freeze({
      must_fix: 'MUST_FIX',
      opportunity: 'OPPORTUNITY'
    });
  }
  static get Type() {
    return Object.freeze({
      ar_visibility_issues: 'AR_VISIBILITY_ISSUES',
      attributes_invalid: 'ATTRIBUTES_INVALID',
      attributes_missing: 'ATTRIBUTES_MISSING',
      category: 'CATEGORY',
      checkout: 'CHECKOUT',
      image_quality: 'IMAGE_QUALITY',
      low_quality_title_and_description: 'LOW_QUALITY_TITLE_AND_DESCRIPTION',
      policy_violation: 'POLICY_VIOLATION',
      shops_visibility_issues: 'SHOPS_VISIBILITY_ISSUES'
    });
  }
  static get AffectedEntities() {
    return Object.freeze({
      product_catalog: 'product_catalog',
      product_item: 'product_item',
      product_set: 'product_set'
    });
  }
  static get Severities() {
    return Object.freeze({
      must_fix: 'MUST_FIX',
      opportunity: 'OPPORTUNITY'
    });
  }
  static get Types() {
    return Object.freeze({
      ar_visibility_issues: 'AR_VISIBILITY_ISSUES',
      attributes_invalid: 'ATTRIBUTES_INVALID',
      attributes_missing: 'ATTRIBUTES_MISSING',
      category: 'CATEGORY',
      checkout: 'CHECKOUT',
      image_quality: 'IMAGE_QUALITY',
      low_quality_title_and_description: 'LOW_QUALITY_TITLE_AND_DESCRIPTION',
      policy_violation: 'POLICY_VIOLATION',
      shops_visibility_issues: 'SHOPS_VISIBILITY_ISSUES'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductEventStat
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductEventStat extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      date_start: 'date_start',
      date_stop: 'date_stop',
      device_type: 'device_type',
      event: 'event',
      event_source: 'event_source',
      total_content_ids_matched_other_catalogs: 'total_content_ids_matched_other_catalogs',
      total_matched_content_ids: 'total_matched_content_ids',
      total_unmatched_content_ids: 'total_unmatched_content_ids',
      unique_content_ids_matched_other_catalogs: 'unique_content_ids_matched_other_catalogs',
      unique_matched_content_ids: 'unique_matched_content_ids',
      unique_unmatched_content_ids: 'unique_unmatched_content_ids'
    });
  }
  static get DeviceType() {
    return Object.freeze({
      desktop: 'desktop',
      mobile_android_phone: 'mobile_android_phone',
      mobile_android_tablet: 'mobile_android_tablet',
      mobile_ipad: 'mobile_ipad',
      mobile_iphone: 'mobile_iphone',
      mobile_ipod: 'mobile_ipod',
      mobile_phone: 'mobile_phone',
      mobile_tablet: 'mobile_tablet',
      mobile_windows_phone: 'mobile_windows_phone',
      unknown: 'unknown'
    });
  }
  static get Event() {
    return Object.freeze({
      addtocart: 'AddToCart',
      addtowishlist: 'AddToWishlist',
      initiatecheckout: 'InitiateCheckout',
      lead: 'Lead',
      purchase: 'Purchase',
      search: 'Search',
      subscribe: 'Subscribe',
      viewcontent: 'ViewContent'
    });
  }
  static get Breakdowns() {
    return Object.freeze({
      device_type: 'DEVICE_TYPE'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ExternalEventSource
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ExternalEventSource extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      source_type: 'source_type'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Flight
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Flight extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      applinks: 'applinks',
      category_specific_fields: 'category_specific_fields',
      currency: 'currency',
      description: 'description',
      destination_airport: 'destination_airport',
      destination_city: 'destination_city',
      flight_id: 'flight_id',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      oneway_currency: 'oneway_currency',
      oneway_price: 'oneway_price',
      origin_airport: 'origin_airport',
      origin_city: 'origin_city',
      price: 'price',
      sanitized_images: 'sanitized_images',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * HomeListing
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class HomeListing extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ac_type: 'ac_type',
      additional_fees_description: 'additional_fees_description',
      address: 'address',
      agent_company: 'agent_company',
      agent_email: 'agent_email',
      agent_fb_page_id: 'agent_fb_page_id',
      agent_name: 'agent_name',
      agent_phone: 'agent_phone',
      applinks: 'applinks',
      area_size: 'area_size',
      area_unit: 'area_unit',
      availability: 'availability',
      category_specific_fields: 'category_specific_fields',
      co_2_emission_rating_eu: 'co_2_emission_rating_eu',
      currency: 'currency',
      days_on_market: 'days_on_market',
      description: 'description',
      energy_rating_eu: 'energy_rating_eu',
      furnish_type: 'furnish_type',
      group_id: 'group_id',
      heating_type: 'heating_type',
      home_listing_id: 'home_listing_id',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      laundry_type: 'laundry_type',
      listing_type: 'listing_type',
      max_currency: 'max_currency',
      max_price: 'max_price',
      min_currency: 'min_currency',
      min_price: 'min_price',
      name: 'name',
      num_baths: 'num_baths',
      num_beds: 'num_beds',
      num_rooms: 'num_rooms',
      num_units: 'num_units',
      parking_type: 'parking_type',
      partner_verification: 'partner_verification',
      pet_policy: 'pet_policy',
      price: 'price',
      property_type: 'property_type',
      sanitized_images: 'sanitized_images',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility',
      year_built: 'year_built'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogHotelRoomsBatch
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogHotelRoomsBatch extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      errors: 'errors',
      errors_total_count: 'errors_total_count',
      handle: 'handle',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * DynamicPriceConfigByDate
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class DynamicPriceConfigByDate extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      checkin_date: 'checkin_date',
      prices: 'prices',
      prices_pretty: 'prices_pretty',
      id: 'id'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * HotelRoom
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class HotelRoom extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      applinks: 'applinks',
      base_price: 'base_price',
      currency: 'currency',
      description: 'description',
      id: 'id',
      images: 'images',
      margin_level: 'margin_level',
      name: 'name',
      room_id: 'room_id',
      sale_price: 'sale_price',
      url: 'url'
    });
  }
  getPricingVariables(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(DynamicPriceConfigByDate, fields, params, fetchFirstPage, '/pricing_variables');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Hotel
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Hotel extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      address: 'address',
      applinks: 'applinks',
      brand: 'brand',
      category: 'category',
      category_specific_fields: 'category_specific_fields',
      currency: 'currency',
      description: 'description',
      guest_ratings: 'guest_ratings',
      hotel_id: 'hotel_id',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      lowest_base_price: 'lowest_base_price',
      loyalty_program: 'loyalty_program',
      margin_level: 'margin_level',
      name: 'name',
      phone: 'phone',
      sale_price: 'sale_price',
      sanitized_images: 'sanitized_images',
      star_rating: 'star_rating',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getHotelRooms(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(HotelRoom, fields, params, fetchFirstPage, '/hotel_rooms');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * MediaTitle
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class MediaTitle extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      applinks: 'applinks',
      category_specific_fields: 'category_specific_fields',
      content_category: 'content_category',
      currency: 'currency',
      description: 'description',
      fb_page_alias: 'fb_page_alias',
      fb_page_id: 'fb_page_id',
      genres: 'genres',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      kg_fb_id: 'kg_fb_id',
      media_title_id: 'media_title_id',
      price: 'price',
      sanitized_images: 'sanitized_images',
      title: 'title',
      title_display_name: 'title_display_name',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility',
      wiki_data_item: 'wiki_data_item'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  static get ContentCategory() {
    return Object.freeze({
      movie: 'MOVIE',
      music: 'MUSIC',
      tv_show: 'TV_SHOW'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogPricingVariablesBatch
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogPricingVariablesBatch extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      errors: 'errors',
      errors_total_count: 'errors_total_count',
      handle: 'handle',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VehicleOffer
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VehicleOffer extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      amount_currency: 'amount_currency',
      amount_percentage: 'amount_percentage',
      amount_price: 'amount_price',
      amount_qualifier: 'amount_qualifier',
      applinks: 'applinks',
      body_style: 'body_style',
      cashback_currency: 'cashback_currency',
      cashback_price: 'cashback_price',
      category_specific_fields: 'category_specific_fields',
      currency: 'currency',
      dma_codes: 'dma_codes',
      downpayment_currency: 'downpayment_currency',
      downpayment_price: 'downpayment_price',
      downpayment_qualifier: 'downpayment_qualifier',
      end_date: 'end_date',
      end_time: 'end_time',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      make: 'make',
      model: 'model',
      offer_description: 'offer_description',
      offer_disclaimer: 'offer_disclaimer',
      offer_type: 'offer_type',
      price: 'price',
      sanitized_images: 'sanitized_images',
      start_date: 'start_date',
      start_time: 'start_time',
      term_length: 'term_length',
      term_qualifier: 'term_qualifier',
      title: 'title',
      trim: 'trim',
      unit_price: 'unit_price',
      url: 'url',
      vehicle_offer_id: 'vehicle_offer_id',
      visibility: 'visibility',
      year: 'year'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Vehicle
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Vehicle extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      address: 'address',
      applinks: 'applinks',
      availability: 'availability',
      body_style: 'body_style',
      category_specific_fields: 'category_specific_fields',
      condition: 'condition',
      currency: 'currency',
      custom_label_0: 'custom_label_0',
      custom_number_0: 'custom_number_0',
      date_first_on_lot: 'date_first_on_lot',
      dealer_communication_channel: 'dealer_communication_channel',
      dealer_email: 'dealer_email',
      dealer_id: 'dealer_id',
      dealer_name: 'dealer_name',
      dealer_phone: 'dealer_phone',
      dealer_privacy_policy_url: 'dealer_privacy_policy_url',
      description: 'description',
      drivetrain: 'drivetrain',
      exterior_color: 'exterior_color',
      fb_page_id: 'fb_page_id',
      features: 'features',
      fuel_type: 'fuel_type',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      interior_color: 'interior_color',
      legal_disclosure_impressum_url: 'legal_disclosure_impressum_url',
      make: 'make',
      mileage: 'mileage',
      model: 'model',
      previous_currency: 'previous_currency',
      previous_price: 'previous_price',
      price: 'price',
      sale_currency: 'sale_currency',
      sale_price: 'sale_price',
      sanitized_images: 'sanitized_images',
      state_of_vehicle: 'state_of_vehicle',
      title: 'title',
      transmission: 'transmission',
      trim: 'trim',
      unit_price: 'unit_price',
      url: 'url',
      vehicle_id: 'vehicle_id',
      vehicle_registration_plate: 'vehicle_registration_plate',
      vehicle_specifications: 'vehicle_specifications',
      vehicle_type: 'vehicle_type',
      vin: 'vin',
      visibility: 'visibility',
      year: 'year'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING'
    });
  }
  static get Availability() {
    return Object.freeze({
      available: 'AVAILABLE',
      not_available: 'NOT_AVAILABLE',
      pending: 'PENDING'
    });
  }
  static get BodyStyle() {
    return Object.freeze({
      convertible: 'CONVERTIBLE',
      coupe: 'COUPE',
      crossover: 'CROSSOVER',
      estate: 'ESTATE',
      grandtourer: 'GRANDTOURER',
      hatchback: 'HATCHBACK',
      minibus: 'MINIBUS',
      minivan: 'MINIVAN',
      mpv: 'MPV',
      none: 'NONE',
      other: 'OTHER',
      pickup: 'PICKUP',
      roadster: 'ROADSTER',
      saloon: 'SALOON',
      sedan: 'SEDAN',
      small_car: 'SMALL_CAR',
      sportscar: 'SPORTSCAR',
      supercar: 'SUPERCAR',
      supermini: 'SUPERMINI',
      suv: 'SUV',
      truck: 'TRUCK',
      van: 'VAN',
      wagon: 'WAGON'
    });
  }
  static get Condition() {
    return Object.freeze({
      excellent: 'EXCELLENT',
      fair: 'FAIR',
      good: 'GOOD',
      none: 'NONE',
      other: 'OTHER',
      poor: 'POOR',
      very_good: 'VERY_GOOD'
    });
  }
  static get Drivetrain() {
    return Object.freeze({
      awd: 'AWD',
      four_wd: 'FOUR_WD',
      fwd: 'FWD',
      none: 'NONE',
      other: 'OTHER',
      rwd: 'RWD',
      two_wd: 'TWO_WD'
    });
  }
  static get FuelType() {
    return Object.freeze({
      diesel: 'DIESEL',
      electric: 'ELECTRIC',
      flex: 'FLEX',
      gasoline: 'GASOLINE',
      hybrid: 'HYBRID',
      none: 'NONE',
      other: 'OTHER',
      petrol: 'PETROL',
      plugin_hybrid: 'PLUGIN_HYBRID'
    });
  }
  static get StateOfVehicle() {
    return Object.freeze({
      cpo: 'CPO',
      new: 'NEW',
      used: 'USED'
    });
  }
  static get Transmission() {
    return Object.freeze({
      automatic: 'AUTOMATIC',
      manual: 'MANUAL',
      none: 'NONE',
      other: 'OTHER'
    });
  }
  static get VehicleType() {
    return Object.freeze({
      boat: 'BOAT',
      car_truck: 'CAR_TRUCK',
      commercial: 'COMMERCIAL',
      motorcycle: 'MOTORCYCLE',
      other: 'OTHER',
      powersport: 'POWERSPORT',
      rv_camper: 'RV_CAMPER',
      trailer: 'TRAILER'
    });
  }
  getAugmentedRealitiesMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/augmented_realities_metadata');
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getVideosMetadata(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/videos_metadata');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductSet
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductSet extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      auto_creation_url: 'auto_creation_url',
      filter: 'filter',
      id: 'id',
      latest_metadata: 'latest_metadata',
      live_metadata: 'live_metadata',
      name: 'name',
      ordering_info: 'ordering_info',
      product_catalog: 'product_catalog',
      product_count: 'product_count',
      retailer_id: 'retailer_id'
    });
  }
  getAutomotiveModels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AutomotiveModel, fields, params, fetchFirstPage, '/automotive_models');
  }
  getDestinations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Destination, fields, params, fetchFirstPage, '/destinations');
  }
  getFlights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Flight, fields, params, fetchFirstPage, '/flights');
  }
  getHomeListings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(HomeListing, fields, params, fetchFirstPage, '/home_listings');
  }
  getHotels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Hotel, fields, params, fetchFirstPage, '/hotels');
  }
  getMediaTitles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MediaTitle, fields, params, fetchFirstPage, '/media_titles');
  }
  getProducts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductItem, fields, params, fetchFirstPage, '/products');
  }
  getVehicleOffers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VehicleOffer, fields, params, fetchFirstPage, '/vehicle_offers');
  }
  getVehicles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Vehicle, fields, params, fetchFirstPage, '/vehicles');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductItem
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductItem extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      additional_image_cdn_urls: 'additional_image_cdn_urls',
      additional_image_urls: 'additional_image_urls',
      additional_variant_attributes: 'additional_variant_attributes',
      age_group: 'age_group',
      applinks: 'applinks',
      ar_data: 'ar_data',
      availability: 'availability',
      brand: 'brand',
      capability_to_review_status: 'capability_to_review_status',
      category: 'category',
      category_specific_fields: 'category_specific_fields',
      color: 'color',
      commerce_insights: 'commerce_insights',
      condition: 'condition',
      currency: 'currency',
      custom_data: 'custom_data',
      custom_label_0: 'custom_label_0',
      custom_label_1: 'custom_label_1',
      custom_label_2: 'custom_label_2',
      custom_label_3: 'custom_label_3',
      custom_label_4: 'custom_label_4',
      custom_number_0: 'custom_number_0',
      custom_number_1: 'custom_number_1',
      custom_number_2: 'custom_number_2',
      custom_number_3: 'custom_number_3',
      custom_number_4: 'custom_number_4',
      description: 'description',
      errors: 'errors',
      expiration_date: 'expiration_date',
      fb_product_category: 'fb_product_category',
      gender: 'gender',
      gtin: 'gtin',
      id: 'id',
      image_cdn_urls: 'image_cdn_urls',
      image_fetch_status: 'image_fetch_status',
      image_url: 'image_url',
      images: 'images',
      importer_address: 'importer_address',
      importer_name: 'importer_name',
      invalidation_errors: 'invalidation_errors',
      inventory: 'inventory',
      manufacturer_info: 'manufacturer_info',
      manufacturer_part_number: 'manufacturer_part_number',
      marked_for_product_launch: 'marked_for_product_launch',
      material: 'material',
      mobile_link: 'mobile_link',
      name: 'name',
      ordering_index: 'ordering_index',
      origin_country: 'origin_country',
      parent_product_id: 'parent_product_id',
      pattern: 'pattern',
      post_conversion_signal_based_enforcement_appeal_eligibility: 'post_conversion_signal_based_enforcement_appeal_eligibility',
      price: 'price',
      product_catalog: 'product_catalog',
      product_feed: 'product_feed',
      product_group: 'product_group',
      product_type: 'product_type',
      quantity_to_sell_on_facebook: 'quantity_to_sell_on_facebook',
      retailer_id: 'retailer_id',
      retailer_product_group_id: 'retailer_product_group_id',
      review_rejection_reasons: 'review_rejection_reasons',
      review_status: 'review_status',
      sale_price: 'sale_price',
      sale_price_end_date: 'sale_price_end_date',
      sale_price_start_date: 'sale_price_start_date',
      shipping_weight_unit: 'shipping_weight_unit',
      shipping_weight_value: 'shipping_weight_value',
      short_description: 'short_description',
      size: 'size',
      start_date: 'start_date',
      url: 'url',
      visibility: 'visibility',
      wa_compliance_category: 'wa_compliance_category'
    });
  }
  static get AgeGroup() {
    return Object.freeze({
      adult: 'adult',
      all_ages: 'all ages',
      infant: 'infant',
      kids: 'kids',
      newborn: 'newborn',
      teen: 'teen',
      toddler: 'toddler'
    });
  }
  static get Availability() {
    return Object.freeze({
      available_for_order: 'available for order',
      discontinued: 'discontinued',
      in_stock: 'in stock',
      out_of_stock: 'out of stock',
      pending: 'pending',
      preorder: 'preorder'
    });
  }
  static get Condition() {
    return Object.freeze({
      cpo: 'cpo',
      new: 'new',
      open_box_new: 'open_box_new',
      refurbished: 'refurbished',
      used: 'used',
      used_fair: 'used_fair',
      used_good: 'used_good',
      used_like_new: 'used_like_new'
    });
  }
  static get Gender() {
    return Object.freeze({
      female: 'female',
      male: 'male',
      unisex: 'unisex'
    });
  }
  static get ImageFetchStatus() {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH'
    });
  }
  static get ReviewStatus() {
    return Object.freeze({
      approved: 'approved',
      outdated: 'outdated',
      pending: 'pending',
      rejected: 'rejected'
    });
  }
  static get ShippingWeightUnit() {
    return Object.freeze({
      g: 'g',
      kg: 'kg',
      lb: 'lb',
      oz: 'oz'
    });
  }
  static get Visibility() {
    return Object.freeze({
      published: 'published',
      staging: 'staging'
    });
  }
  static get CommerceTaxCategory() {
    return Object.freeze({
      fb_animal: 'FB_ANIMAL',
      fb_animal_supp: 'FB_ANIMAL_SUPP',
      fb_aprl: 'FB_APRL',
      fb_aprl_accessories: 'FB_APRL_ACCESSORIES',
      fb_aprl_athl_unif: 'FB_APRL_ATHL_UNIF',
      fb_aprl_cases: 'FB_APRL_CASES',
      fb_aprl_clothing: 'FB_APRL_CLOTHING',
      fb_aprl_costume: 'FB_APRL_COSTUME',
      fb_aprl_cstm: 'FB_APRL_CSTM',
      fb_aprl_formal: 'FB_APRL_FORMAL',
      fb_aprl_handbag: 'FB_APRL_HANDBAG',
      fb_aprl_jewelry: 'FB_APRL_JEWELRY',
      fb_aprl_shoe: 'FB_APRL_SHOE',
      fb_aprl_shoe_acc: 'FB_APRL_SHOE_ACC',
      fb_aprl_swim: 'FB_APRL_SWIM',
      fb_aprl_swim_chil: 'FB_APRL_SWIM_CHIL',
      fb_aprl_swim_cvr: 'FB_APRL_SWIM_CVR',
      fb_arts: 'FB_ARTS',
      fb_arts_hobby: 'FB_ARTS_HOBBY',
      fb_arts_party: 'FB_ARTS_PARTY',
      fb_arts_party_gift_card: 'FB_ARTS_PARTY_GIFT_CARD',
      fb_arts_ticket: 'FB_ARTS_TICKET',
      fb_baby: 'FB_BABY',
      fb_baby_bath: 'FB_BABY_BATH',
      fb_baby_blanket: 'FB_BABY_BLANKET',
      fb_baby_diaper: 'FB_BABY_DIAPER',
      fb_baby_gift_set: 'FB_BABY_GIFT_SET',
      fb_baby_health: 'FB_BABY_HEALTH',
      fb_baby_nursing: 'FB_BABY_NURSING',
      fb_baby_potty_trn: 'FB_BABY_POTTY_TRN',
      fb_baby_safe: 'FB_BABY_SAFE',
      fb_baby_toys: 'FB_BABY_TOYS',
      fb_baby_transport: 'FB_BABY_TRANSPORT',
      fb_baby_transport_acc: 'FB_BABY_TRANSPORT_ACC',
      fb_bags: 'FB_BAGS',
      fb_bags_bkpk: 'FB_BAGS_BKPK',
      fb_bags_boxes: 'FB_BAGS_BOXES',
      fb_bags_brfcs: 'FB_BAGS_BRFCS',
      fb_bags_csmt_bag: 'FB_BAGS_CSMT_BAG',
      fb_bags_dffl: 'FB_BAGS_DFFL',
      fb_bags_dipr: 'FB_BAGS_DIPR',
      fb_bags_fnny: 'FB_BAGS_FNNY',
      fb_bags_grmt: 'FB_BAGS_GRMT',
      fb_bags_lugg: 'FB_BAGS_LUGG',
      fb_bags_lug_acc: 'FB_BAGS_LUG_ACC',
      fb_bags_msgr: 'FB_BAGS_MSGR',
      fb_bags_tote: 'FB_BAGS_TOTE',
      fb_bags_trn_cas: 'FB_BAGS_TRN_CAS',
      fb_bldg: 'FB_BLDG',
      fb_bldg_acc: 'FB_BLDG_ACC',
      fb_bldg_cnsmb: 'FB_BLDG_CNSMB',
      fb_bldg_fence: 'FB_BLDG_FENCE',
      fb_bldg_fuel_tnk: 'FB_BLDG_FUEL_TNK',
      fb_bldg_ht_vnt: 'FB_BLDG_HT_VNT',
      fb_bldg_lock: 'FB_BLDG_LOCK',
      fb_bldg_matrl: 'FB_BLDG_MATRL',
      fb_bldg_plmb: 'FB_BLDG_PLMB',
      fb_bldg_pump: 'FB_BLDG_PUMP',
      fb_bldg_pwrs: 'FB_BLDG_PWRS',
      fb_bldg_str_tank: 'FB_BLDG_STR_TANK',
      fb_bldg_s_eng: 'FB_BLDG_S_ENG',
      fb_bldg_tl_acc: 'FB_BLDG_TL_ACC',
      fb_bldg_tool: 'FB_BLDG_TOOL',
      fb_busind: 'FB_BUSIND',
      fb_busind_advertising: 'FB_BUSIND_ADVERTISING',
      fb_busind_agriculture: 'FB_BUSIND_AGRICULTURE',
      fb_busind_automation: 'FB_BUSIND_AUTOMATION',
      fb_busind_heavy_mach: 'FB_BUSIND_HEAVY_MACH',
      fb_busind_lab: 'FB_BUSIND_LAB',
      fb_busind_medical: 'FB_BUSIND_MEDICAL',
      fb_busind_retail: 'FB_BUSIND_RETAIL',
      fb_busind_sanitary_ct: 'FB_BUSIND_SANITARY_CT',
      fb_busind_sign: 'FB_BUSIND_SIGN',
      fb_busind_storage: 'FB_BUSIND_STORAGE',
      fb_busind_storage_acc: 'FB_BUSIND_STORAGE_ACC',
      fb_busind_work_gear: 'FB_BUSIND_WORK_GEAR',
      fb_camera_acc: 'FB_CAMERA_ACC',
      fb_camera_camera: 'FB_CAMERA_CAMERA',
      fb_camera_optic: 'FB_CAMERA_OPTIC',
      fb_camera_optics: 'FB_CAMERA_OPTICS',
      fb_camera_photo: 'FB_CAMERA_PHOTO',
      fb_elec: 'FB_ELEC',
      fb_elec_acc: 'FB_ELEC_ACC',
      fb_elec_arcdade: 'FB_ELEC_ARCDADE',
      fb_elec_audio: 'FB_ELEC_AUDIO',
      fb_elec_circuit: 'FB_ELEC_CIRCUIT',
      fb_elec_comm: 'FB_ELEC_COMM',
      fb_elec_computer: 'FB_ELEC_COMPUTER',
      fb_elec_gps_acc: 'FB_ELEC_GPS_ACC',
      fb_elec_gps_nav: 'FB_ELEC_GPS_NAV',
      fb_elec_gps_trk: 'FB_ELEC_GPS_TRK',
      fb_elec_marine: 'FB_ELEC_MARINE',
      fb_elec_network: 'FB_ELEC_NETWORK',
      fb_elec_part: 'FB_ELEC_PART',
      fb_elec_print: 'FB_ELEC_PRINT',
      fb_elec_radar: 'FB_ELEC_RADAR',
      fb_elec_sftwr: 'FB_ELEC_SFTWR',
      fb_elec_speed_rdr: 'FB_ELEC_SPEED_RDR',
      fb_elec_television: 'FB_ELEC_TELEVISION',
      fb_elec_toll: 'FB_ELEC_TOLL',
      fb_elec_video: 'FB_ELEC_VIDEO',
      fb_elec_vid_gm_acc: 'FB_ELEC_VID_GM_ACC',
      fb_elec_vid_gm_cnsl: 'FB_ELEC_VID_GM_CNSL',
      fb_food: 'FB_FOOD',
      fb_furn: 'FB_FURN',
      fb_furn_baby: 'FB_FURN_BABY',
      fb_furn_bench: 'FB_FURN_BENCH',
      fb_furn_cart: 'FB_FURN_CART',
      fb_furn_chair: 'FB_FURN_CHAIR',
      fb_furn_chair_acc: 'FB_FURN_CHAIR_ACC',
      fb_furn_divide: 'FB_FURN_DIVIDE',
      fb_furn_divide_acc: 'FB_FURN_DIVIDE_ACC',
      fb_furn_ent_ctr: 'FB_FURN_ENT_CTR',
      fb_furn_futn: 'FB_FURN_FUTN',
      fb_furn_futn_pad: 'FB_FURN_FUTN_PAD',
      fb_furn_office: 'FB_FURN_OFFICE',
      fb_furn_office_acc: 'FB_FURN_OFFICE_ACC',
      fb_furn_otto: 'FB_FURN_OTTO',
      fb_furn_outdoor: 'FB_FURN_OUTDOOR',
      fb_furn_outdoor_acc: 'FB_FURN_OUTDOOR_ACC',
      fb_furn_sets: 'FB_FURN_SETS',
      fb_furn_shelve_acc: 'FB_FURN_SHELVE_ACC',
      fb_furn_shlf: 'FB_FURN_SHLF',
      fb_furn_sofa: 'FB_FURN_SOFA',
      fb_furn_sofa_acc: 'FB_FURN_SOFA_ACC',
      fb_furn_storage: 'FB_FURN_STORAGE',
      fb_furn_tabl: 'FB_FURN_TABL',
      fb_furn_tabl_acc: 'FB_FURN_TABL_ACC',
      fb_generic_taxable: 'FB_GENERIC_TAXABLE',
      fb_hlth: 'FB_HLTH',
      fb_hlth_hlth: 'FB_HLTH_HLTH',
      fb_hlth_jwl_cr: 'FB_HLTH_JWL_CR',
      fb_hlth_lilp_blm: 'FB_HLTH_LILP_BLM',
      fb_hlth_ltn_spf: 'FB_HLTH_LTN_SPF',
      fb_hlth_prsl_cr: 'FB_HLTH_PRSL_CR',
      fb_hlth_skn_cr: 'FB_HLTH_SKN_CR',
      fb_hmgn: 'FB_HMGN',
      fb_hmgn_bath: 'FB_HMGN_BATH',
      fb_hmgn_dcor: 'FB_HMGN_DCOR',
      fb_hmgn_emgy: 'FB_HMGN_EMGY',
      fb_hmgn_fplc: 'FB_HMGN_FPLC',
      fb_hmgn_fplc_acc: 'FB_HMGN_FPLC_ACC',
      fb_hmgn_gs_sft: 'FB_HMGN_GS_SFT',
      fb_hmgn_hs_acc: 'FB_HMGN_HS_ACC',
      fb_hmgn_hs_app: 'FB_HMGN_HS_APP',
      fb_hmgn_hs_spl: 'FB_HMGN_HS_SPL',
      fb_hmgn_ktcn: 'FB_HMGN_KTCN',
      fb_hmgn_lawn: 'FB_HMGN_LAWN',
      fb_hmgn_lght: 'FB_HMGN_LGHT',
      fb_hmgn_linn: 'FB_HMGN_LINN',
      fb_hmgn_lt_acc: 'FB_HMGN_LT_ACC',
      fb_hmgn_otdr: 'FB_HMGN_OTDR',
      fb_hmgn_pool: 'FB_HMGN_POOL',
      fb_hmgn_scty: 'FB_HMGN_SCTY',
      fb_hmgn_smk_acc: 'FB_HMGN_SMK_ACC',
      fb_hmgn_umbr: 'FB_HMGN_UMBR',
      fb_hmgn_umbr_acc: 'FB_HMGN_UMBR_ACC',
      fb_mdia: 'FB_MDIA',
      fb_mdia_book: 'FB_MDIA_BOOK',
      fb_mdia_dvds: 'FB_MDIA_DVDS',
      fb_mdia_mag: 'FB_MDIA_MAG',
      fb_mdia_manl: 'FB_MDIA_MANL',
      fb_mdia_musc: 'FB_MDIA_MUSC',
      fb_mdia_prj_pln: 'FB_MDIA_PRJ_PLN',
      fb_mdia_sht_mus: 'FB_MDIA_SHT_MUS',
      fb_offc: 'FB_OFFC',
      fb_offc_bkac: 'FB_OFFC_BKAC',
      fb_offc_crts: 'FB_OFFC_CRTS',
      fb_offc_dskp: 'FB_OFFC_DSKP',
      fb_offc_eqip: 'FB_OFFC_EQIP',
      fb_offc_flng: 'FB_OFFC_FLNG',
      fb_offc_gnrl: 'FB_OFFC_GNRL',
      fb_offc_instm: 'FB_OFFC_INSTM',
      fb_offc_lp_dsk: 'FB_OFFC_LP_DSK',
      fb_offc_mats: 'FB_OFFC_MATS',
      fb_offc_nm_plt: 'FB_OFFC_NM_PLT',
      fb_offc_ppr_hndl: 'FB_OFFC_PPR_HNDL',
      fb_offc_prsnt_spl: 'FB_OFFC_PRSNT_SPL',
      fb_offc_sealr: 'FB_OFFC_SEALR',
      fb_offc_ship_spl: 'FB_OFFC_SHIP_SPL',
      fb_rlgn: 'FB_RLGN',
      fb_rlgn_cmny: 'FB_RLGN_CMNY',
      fb_rlgn_item: 'FB_RLGN_ITEM',
      fb_rlgn_wedd: 'FB_RLGN_WEDD',
      fb_sftwr: 'FB_SFTWR',
      fb_sfwr_cmptr: 'FB_SFWR_CMPTR',
      fb_sfwr_dgtl_gd: 'FB_SFWR_DGTL_GD',
      fb_sfwr_game: 'FB_SFWR_GAME',
      fb_shipping: 'FB_SHIPPING',
      fb_spor: 'FB_SPOR',
      fb_sport_athl: 'FB_SPORT_ATHL',
      fb_sport_athl_clth: 'FB_SPORT_ATHL_CLTH',
      fb_sport_athl_shoe: 'FB_SPORT_ATHL_SHOE',
      fb_sport_athl_sprt: 'FB_SPORT_ATHL_SPRT',
      fb_sport_exrcs: 'FB_SPORT_EXRCS',
      fb_sport_indr_gm: 'FB_SPORT_INDR_GM',
      fb_sport_otdr_gm: 'FB_SPORT_OTDR_GM',
      fb_toys: 'FB_TOYS',
      fb_toys_eqip: 'FB_TOYS_EQIP',
      fb_toys_game: 'FB_TOYS_GAME',
      fb_toys_pzzl: 'FB_TOYS_PZZL',
      fb_toys_tmrs: 'FB_TOYS_TMRS',
      fb_toys_toys: 'FB_TOYS_TOYS',
      fb_vehi: 'FB_VEHI',
      fb_vehi_part: 'FB_VEHI_PART'
    });
  }
  static get ErrorPriority() {
    return Object.freeze({
      high: 'HIGH',
      low: 'LOW',
      medium: 'MEDIUM'
    });
  }
  static get ErrorType() {
    return Object.freeze({
      ar_deleted_due_to_update: 'AR_DELETED_DUE_TO_UPDATE',
      ar_policy_violated: 'AR_POLICY_VIOLATED',
      available: 'AVAILABLE',
      bad_quality_image: 'BAD_QUALITY_IMAGE',
      cannot_edit_subscription_products: 'CANNOT_EDIT_SUBSCRIPTION_PRODUCTS',
      crawled_availability_mismatch: 'CRAWLED_AVAILABILITY_MISMATCH',
      digital_goods_not_available_for_checkout: 'DIGITAL_GOODS_NOT_AVAILABLE_FOR_CHECKOUT',
      duplicate_images: 'DUPLICATE_IMAGES',
      duplicate_title_and_description: 'DUPLICATE_TITLE_AND_DESCRIPTION',
      generic_invalid_field: 'GENERIC_INVALID_FIELD',
      hidden_until_product_launch: 'HIDDEN_UNTIL_PRODUCT_LAUNCH',
      image_fetch_failed: 'IMAGE_FETCH_FAILED',
      image_fetch_failed_bad_gateway: 'IMAGE_FETCH_FAILED_BAD_GATEWAY',
      image_fetch_failed_file_size_exceeded: 'IMAGE_FETCH_FAILED_FILE_SIZE_EXCEEDED',
      image_fetch_failed_forbidden: 'IMAGE_FETCH_FAILED_FORBIDDEN',
      image_fetch_failed_link_broken: 'IMAGE_FETCH_FAILED_LINK_BROKEN',
      image_fetch_failed_timed_out: 'IMAGE_FETCH_FAILED_TIMED_OUT',
      image_resolution_low: 'IMAGE_RESOLUTION_LOW',
      inactive_shopify_product: 'INACTIVE_SHOPIFY_PRODUCT',
      invalid_commerce_tax_category: 'INVALID_COMMERCE_TAX_CATEGORY',
      invalid_images: 'INVALID_IMAGES',
      invalid_monetizer_return_policy: 'INVALID_MONETIZER_RETURN_POLICY',
      invalid_pre_order_params: 'INVALID_PRE_ORDER_PARAMS',
      invalid_shipping_profile_params: 'INVALID_SHIPPING_PROFILE_PARAMS',
      invalid_subscription_disable_params: 'INVALID_SUBSCRIPTION_DISABLE_PARAMS',
      invalid_subscription_enable_params: 'INVALID_SUBSCRIPTION_ENABLE_PARAMS',
      invalid_subscription_params: 'INVALID_SUBSCRIPTION_PARAMS',
      inventory_zero_availability_in_stock: 'INVENTORY_ZERO_AVAILABILITY_IN_STOCK',
      in_another_product_launch: 'IN_ANOTHER_PRODUCT_LAUNCH',
      item_group_not_specified: 'ITEM_GROUP_NOT_SPECIFIED',
      item_not_shippable_for_sca_shop: 'ITEM_NOT_SHIPPABLE_FOR_SCA_SHOP',
      item_override_not_visible: 'ITEM_OVERRIDE_NOT_VISIBLE',
      item_stale_out_of_stock: 'ITEM_STALE_OUT_OF_STOCK',
      mini_shops_disabled_by_user: 'MINI_SHOPS_DISABLED_BY_USER',
      missing_checkout: 'MISSING_CHECKOUT',
      missing_checkout_currency: 'MISSING_CHECKOUT_CURRENCY',
      missing_color: 'MISSING_COLOR',
      missing_country_override_in_shipping_profile: 'MISSING_COUNTRY_OVERRIDE_IN_SHIPPING_PROFILE',
      missing_india_compliance_fields: 'MISSING_INDIA_COMPLIANCE_FIELDS',
      missing_shipping_profile: 'MISSING_SHIPPING_PROFILE',
      missing_size: 'MISSING_SIZE',
      missing_tax_category: 'MISSING_TAX_CATEGORY',
      negative_community_feedback: 'NEGATIVE_COMMUNITY_FEEDBACK',
      not_enough_images: 'NOT_ENOUGH_IMAGES',
      part_of_product_launch: 'PART_OF_PRODUCT_LAUNCH',
      product_expired: 'PRODUCT_EXPIRED',
      product_item_hidden_from_all_shops: 'PRODUCT_ITEM_HIDDEN_FROM_ALL_SHOPS',
      product_item_not_included_in_any_shop: 'PRODUCT_ITEM_NOT_INCLUDED_IN_ANY_SHOP',
      product_item_not_visible: 'PRODUCT_ITEM_NOT_VISIBLE',
      product_not_approved: 'PRODUCT_NOT_APPROVED',
      product_not_dominant_currency: 'PRODUCT_NOT_DOMINANT_CURRENCY',
      product_out_of_stock: 'PRODUCT_OUT_OF_STOCK',
      product_url_equals_domain: 'PRODUCT_URL_EQUALS_DOMAIN',
      property_price_currency_not_supported: 'PROPERTY_PRICE_CURRENCY_NOT_SUPPORTED',
      property_price_too_high: 'PROPERTY_PRICE_TOO_HIGH',
      property_price_too_low: 'PROPERTY_PRICE_TOO_LOW',
      property_value_contains_html_tags: 'PROPERTY_VALUE_CONTAINS_HTML_TAGS',
      property_value_description_contains_off_platform_link: 'PROPERTY_VALUE_DESCRIPTION_CONTAINS_OFF_PLATFORM_LINK',
      property_value_format: 'PROPERTY_VALUE_FORMAT',
      property_value_missing: 'PROPERTY_VALUE_MISSING',
      property_value_missing_warning: 'PROPERTY_VALUE_MISSING_WARNING',
      property_value_non_positive: 'PROPERTY_VALUE_NON_POSITIVE',
      property_value_string_exceeds_length: 'PROPERTY_VALUE_STRING_EXCEEDS_LENGTH',
      property_value_string_too_short: 'PROPERTY_VALUE_STRING_TOO_SHORT',
      property_value_uppercase_warning: 'PROPERTY_VALUE_UPPERCASE_WARNING',
      quality_duplicated_description: 'QUALITY_DUPLICATED_DESCRIPTION',
      quality_item_link_broken: 'QUALITY_ITEM_LINK_BROKEN',
      quality_item_link_redirecting: 'QUALITY_ITEM_LINK_REDIRECTING',
      retailer_id_not_provided: 'RETAILER_ID_NOT_PROVIDED',
      shopify_item_missing_shipping_profile: 'SHOPIFY_ITEM_MISSING_SHIPPING_PROFILE',
      subscription_info_not_enabled_for_feed: 'SUBSCRIPTION_INFO_NOT_ENABLED_FOR_FEED',
      tax_category_not_supported_in_uk: 'TAX_CATEGORY_NOT_SUPPORTED_IN_UK',
      unsupported_product_category: 'UNSUPPORTED_PRODUCT_CATEGORY',
      variant_attribute_issue: 'VARIANT_ATTRIBUTE_ISSUE'
    });
  }
  static get MarkedForProductLaunch() {
    return Object.freeze({
      default: 'default',
      marked: 'marked',
      not_marked: 'not_marked'
    });
  }
  static get OriginCountry() {
    return Object.freeze({
      ad: 'AD',
      ae: 'AE',
      af: 'AF',
      ag: 'AG',
      ai: 'AI',
      al: 'AL',
      am: 'AM',
      an: 'AN',
      ao: 'AO',
      aq: 'AQ',
      ar: 'AR',
      as: 'AS',
      at: 'AT',
      au: 'AU',
      aw: 'AW',
      ax: 'AX',
      az: 'AZ',
      ba: 'BA',
      bb: 'BB',
      bd: 'BD',
      be: 'BE',
      bf: 'BF',
      bg: 'BG',
      bh: 'BH',
      bi: 'BI',
      bj: 'BJ',
      bl: 'BL',
      bm: 'BM',
      bn: 'BN',
      bo: 'BO',
      bq: 'BQ',
      br: 'BR',
      bs: 'BS',
      bt: 'BT',
      bv: 'BV',
      bw: 'BW',
      by: 'BY',
      bz: 'BZ',
      ca: 'CA',
      cc: 'CC',
      cd: 'CD',
      cf: 'CF',
      cg: 'CG',
      ch: 'CH',
      ci: 'CI',
      ck: 'CK',
      cl: 'CL',
      cm: 'CM',
      cn: 'CN',
      co: 'CO',
      cr: 'CR',
      cu: 'CU',
      cv: 'CV',
      cw: 'CW',
      cx: 'CX',
      cy: 'CY',
      cz: 'CZ',
      de: 'DE',
      dj: 'DJ',
      dk: 'DK',
      dm: 'DM',
      do: 'DO',
      dz: 'DZ',
      ec: 'EC',
      ee: 'EE',
      eg: 'EG',
      eh: 'EH',
      er: 'ER',
      es: 'ES',
      et: 'ET',
      fi: 'FI',
      fj: 'FJ',
      fk: 'FK',
      fm: 'FM',
      fo: 'FO',
      fr: 'FR',
      ga: 'GA',
      gb: 'GB',
      gd: 'GD',
      ge: 'GE',
      gf: 'GF',
      gg: 'GG',
      gh: 'GH',
      gi: 'GI',
      gl: 'GL',
      gm: 'GM',
      gn: 'GN',
      gp: 'GP',
      gq: 'GQ',
      gr: 'GR',
      gs: 'GS',
      gt: 'GT',
      gu: 'GU',
      gw: 'GW',
      gy: 'GY',
      hk: 'HK',
      hm: 'HM',
      hn: 'HN',
      hr: 'HR',
      ht: 'HT',
      hu: 'HU',
      id: 'ID',
      ie: 'IE',
      il: 'IL',
      im: 'IM',
      in: 'IN',
      io: 'IO',
      iq: 'IQ',
      ir: 'IR',
      is: 'IS',
      it: 'IT',
      je: 'JE',
      jm: 'JM',
      jo: 'JO',
      jp: 'JP',
      ke: 'KE',
      kg: 'KG',
      kh: 'KH',
      ki: 'KI',
      km: 'KM',
      kn: 'KN',
      kp: 'KP',
      kr: 'KR',
      kw: 'KW',
      ky: 'KY',
      kz: 'KZ',
      la: 'LA',
      lb: 'LB',
      lc: 'LC',
      li: 'LI',
      lk: 'LK',
      lr: 'LR',
      ls: 'LS',
      lt: 'LT',
      lu: 'LU',
      lv: 'LV',
      ly: 'LY',
      ma: 'MA',
      mc: 'MC',
      md: 'MD',
      me: 'ME',
      mf: 'MF',
      mg: 'MG',
      mh: 'MH',
      mk: 'MK',
      ml: 'ML',
      mm: 'MM',
      mn: 'MN',
      mo: 'MO',
      mp: 'MP',
      mq: 'MQ',
      mr: 'MR',
      ms: 'MS',
      mt: 'MT',
      mu: 'MU',
      mv: 'MV',
      mw: 'MW',
      mx: 'MX',
      my: 'MY',
      mz: 'MZ',
      na: 'NA',
      nc: 'NC',
      ne: 'NE',
      nf: 'NF',
      ng: 'NG',
      ni: 'NI',
      nl: 'NL',
      no: 'NO',
      np: 'NP',
      nr: 'NR',
      nu: 'NU',
      nz: 'NZ',
      om: 'OM',
      pa: 'PA',
      pe: 'PE',
      pf: 'PF',
      pg: 'PG',
      ph: 'PH',
      pk: 'PK',
      pl: 'PL',
      pm: 'PM',
      pn: 'PN',
      pr: 'PR',
      ps: 'PS',
      pt: 'PT',
      pw: 'PW',
      py: 'PY',
      qa: 'QA',
      re: 'RE',
      ro: 'RO',
      rs: 'RS',
      ru: 'RU',
      rw: 'RW',
      sa: 'SA',
      sb: 'SB',
      sc: 'SC',
      sd: 'SD',
      se: 'SE',
      sg: 'SG',
      sh: 'SH',
      si: 'SI',
      sj: 'SJ',
      sk: 'SK',
      sl: 'SL',
      sm: 'SM',
      sn: 'SN',
      so: 'SO',
      sr: 'SR',
      ss: 'SS',
      st: 'ST',
      sv: 'SV',
      sx: 'SX',
      sy: 'SY',
      sz: 'SZ',
      tc: 'TC',
      td: 'TD',
      tf: 'TF',
      tg: 'TG',
      th: 'TH',
      tj: 'TJ',
      tk: 'TK',
      tl: 'TL',
      tm: 'TM',
      tn: 'TN',
      to: 'TO',
      tr: 'TR',
      tt: 'TT',
      tv: 'TV',
      tw: 'TW',
      tz: 'TZ',
      ua: 'UA',
      ug: 'UG',
      um: 'UM',
      us: 'US',
      uy: 'UY',
      uz: 'UZ',
      va: 'VA',
      vc: 'VC',
      ve: 'VE',
      vg: 'VG',
      vi: 'VI',
      vn: 'VN',
      vu: 'VU',
      wf: 'WF',
      ws: 'WS',
      xk: 'XK',
      ye: 'YE',
      yt: 'YT',
      za: 'ZA',
      zm: 'ZM',
      zw: 'ZW'
    });
  }
  static get WaComplianceCategory() {
    return Object.freeze({
      country_origin_exempt: 'COUNTRY_ORIGIN_EXEMPT',
      default: 'DEFAULT'
    });
  }
  getChannelsToIntegrityStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogItemChannelsToIntegrityStatus, fields, params, fetchFirstPage, '/channels_to_integrity_status');
  }
  getProductSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductSet, fields, params, fetchFirstPage, '/product_sets');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedRule
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedRule extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      attribute: 'attribute',
      id: 'id',
      params: 'params',
      rule_type: 'rule_type'
    });
  }
  static get RuleType() {
    return Object.freeze({
      fallback_rule: 'fallback_rule',
      letter_case_rule: 'letter_case_rule',
      mapping_rule: 'mapping_rule',
      regex_replace_rule: 'regex_replace_rule',
      value_mapping_rule: 'value_mapping_rule'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedSchedule
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedSchedule extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      day_of_month: 'day_of_month',
      day_of_week: 'day_of_week',
      hour: 'hour',
      id: 'id',
      interval: 'interval',
      interval_count: 'interval_count',
      minute: 'minute',
      timezone: 'timezone',
      url: 'url',
      username: 'username'
    });
  }
  static get DayOfWeek() {
    return Object.freeze({
      friday: 'FRIDAY',
      monday: 'MONDAY',
      saturday: 'SATURDAY',
      sunday: 'SUNDAY',
      thursday: 'THURSDAY',
      tuesday: 'TUESDAY',
      wednesday: 'WEDNESDAY'
    });
  }
  static get Interval() {
    return Object.freeze({
      daily: 'DAILY',
      hourly: 'HOURLY',
      monthly: 'MONTHLY',
      weekly: 'WEEKLY'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedUploadErrorSample
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedUploadErrorSample extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      retailer_id: 'retailer_id',
      row_number: 'row_number'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedRuleSuggestion
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedRuleSuggestion extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      attribute: 'attribute',
      params: 'params',
      type: 'type'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedUploadError
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedUploadError extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      affected_surfaces: 'affected_surfaces',
      description: 'description',
      error_type: 'error_type',
      id: 'id',
      severity: 'severity',
      summary: 'summary',
      total_count: 'total_count'
    });
  }
  static get AffectedSurfaces() {
    return Object.freeze({
      dynamic_ads: 'Dynamic Ads',
      marketplace: 'Marketplace',
      us_marketplace: 'US Marketplace'
    });
  }
  static get Severity() {
    return Object.freeze({
      fatal: 'fatal',
      warning: 'warning'
    });
  }
  static get ErrorPriority() {
    return Object.freeze({
      high: 'HIGH',
      low: 'LOW',
      medium: 'MEDIUM'
    });
  }
  getSamples(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedUploadErrorSample, fields, params, fetchFirstPage, '/samples');
  }
  getSuggestedRules(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedRuleSuggestion, fields, params, fetchFirstPage, '/suggested_rules');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeedUpload
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeedUpload extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      end_time: 'end_time',
      error_count: 'error_count',
      error_report: 'error_report',
      filename: 'filename',
      id: 'id',
      input_method: 'input_method',
      num_deleted_items: 'num_deleted_items',
      num_detected_items: 'num_detected_items',
      num_invalid_items: 'num_invalid_items',
      num_persisted_items: 'num_persisted_items',
      start_time: 'start_time',
      url: 'url',
      warning_count: 'warning_count'
    });
  }
  static get InputMethod() {
    return Object.freeze({
      google_sheets_fetch: 'Google Sheets Fetch',
      manual_upload: 'Manual Upload',
      reupload_last_file: 'Reupload Last File',
      server_fetch: 'Server Fetch',
      user_initiated_server_fetch: 'User initiated server fetch'
    });
  }
  createErrorReport(fields, params = {}, pathOverride = null) {
    return this.createEdge('/error_report', fields, params, ProductFeedUpload, pathOverride);
  }
  getErrors(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedUploadError, fields, params, fetchFirstPage, '/errors');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductFeed
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductFeed extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      country: 'country',
      created_time: 'created_time',
      default_currency: 'default_currency',
      deletion_enabled: 'deletion_enabled',
      delimiter: 'delimiter',
      encoding: 'encoding',
      file_name: 'file_name',
      id: 'id',
      ingestion_source_type: 'ingestion_source_type',
      item_sub_type: 'item_sub_type',
      latest_upload: 'latest_upload',
      migrated_from_feed_id: 'migrated_from_feed_id',
      name: 'name',
      override_type: 'override_type',
      primary_feeds: 'primary_feeds',
      product_count: 'product_count',
      quoted_fields_mode: 'quoted_fields_mode',
      schedule: 'schedule',
      supplementary_feeds: 'supplementary_feeds',
      update_schedule: 'update_schedule'
    });
  }
  static get Delimiter() {
    return Object.freeze({
      autodetect: 'AUTODETECT',
      bar: 'BAR',
      comma: 'COMMA',
      semicolon: 'SEMICOLON',
      tab: 'TAB',
      tilde: 'TILDE'
    });
  }
  static get IngestionSourceType() {
    return Object.freeze({
      primary_feed: 'primary_feed',
      supplementary_feed: 'supplementary_feed'
    });
  }
  static get QuotedFieldsMode() {
    return Object.freeze({
      autodetect: 'AUTODETECT',
      off: 'OFF',
      on: 'ON'
    });
  }
  static get Encoding() {
    return Object.freeze({
      autodetect: 'AUTODETECT',
      latin1: 'LATIN1',
      utf16be: 'UTF16BE',
      utf16le: 'UTF16LE',
      utf32be: 'UTF32BE',
      utf32le: 'UTF32LE',
      utf8: 'UTF8'
    });
  }
  static get FeedType() {
    return Object.freeze({
      automotive_model: 'AUTOMOTIVE_MODEL',
      destination: 'DESTINATION',
      flight: 'FLIGHT',
      home_listing: 'HOME_LISTING',
      hotel: 'HOTEL',
      hotel_room: 'HOTEL_ROOM',
      local_inventory: 'LOCAL_INVENTORY',
      media_title: 'MEDIA_TITLE',
      offer: 'OFFER',
      products: 'PRODUCTS',
      transactable_items: 'TRANSACTABLE_ITEMS',
      vehicles: 'VEHICLES',
      vehicle_offer: 'VEHICLE_OFFER'
    });
  }
  static get ItemSubType() {
    return Object.freeze({
      appliances: 'APPLIANCES',
      baby_feeding: 'BABY_FEEDING',
      baby_transport: 'BABY_TRANSPORT',
      beauty: 'BEAUTY',
      bedding: 'BEDDING',
      cameras: 'CAMERAS',
      cell_phones_and_smart_watches: 'CELL_PHONES_AND_SMART_WATCHES',
      cleaning_supplies: 'CLEANING_SUPPLIES',
      clothing: 'CLOTHING',
      clothing_accessories: 'CLOTHING_ACCESSORIES',
      computers_and_tablets: 'COMPUTERS_AND_TABLETS',
      diapering_and_potty_training: 'DIAPERING_AND_POTTY_TRAINING',
      electronics_accessories: 'ELECTRONICS_ACCESSORIES',
      furniture: 'FURNITURE',
      health: 'HEALTH',
      home_goods: 'HOME_GOODS',
      jewelry: 'JEWELRY',
      nursery: 'NURSERY',
      printers_and_scanners: 'PRINTERS_AND_SCANNERS',
      projectors: 'PROJECTORS',
      shoes_and_footwear: 'SHOES_AND_FOOTWEAR',
      software: 'SOFTWARE',
      toys: 'TOYS',
      tvs_and_monitors: 'TVS_AND_MONITORS',
      video_game_consoles_and_video_games: 'VIDEO_GAME_CONSOLES_AND_VIDEO_GAMES',
      watches: 'WATCHES'
    });
  }
  static get OverrideType() {
    return Object.freeze({
      batch_api_language_or_country: 'BATCH_API_LANGUAGE_OR_COUNTRY',
      catalog_segment_customize_default: 'CATALOG_SEGMENT_CUSTOMIZE_DEFAULT',
      country: 'COUNTRY',
      language: 'LANGUAGE',
      language_and_country: 'LANGUAGE_AND_COUNTRY',
      local: 'LOCAL'
    });
  }
  getAutomotiveModels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AutomotiveModel, fields, params, fetchFirstPage, '/automotive_models');
  }
  getDestinations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Destination, fields, params, fetchFirstPage, '/destinations');
  }
  getFlights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Flight, fields, params, fetchFirstPage, '/flights');
  }
  getHomeListings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(HomeListing, fields, params, fetchFirstPage, '/home_listings');
  }
  getHotels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Hotel, fields, params, fetchFirstPage, '/hotels');
  }
  getMediaTitles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MediaTitle, fields, params, fetchFirstPage, '/media_titles');
  }
  getProducts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductItem, fields, params, fetchFirstPage, '/products');
  }
  getRules(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedRule, fields, params, fetchFirstPage, '/rules');
  }
  createRule(fields, params = {}, pathOverride = null) {
    return this.createEdge('/rules', fields, params, ProductFeedRule, pathOverride);
  }
  createSupplementaryFeedAssoc(fields, params = {}, pathOverride = null) {
    return this.createEdge('/supplementary_feed_assocs', fields, params, null, pathOverride);
  }
  getUploadSchedules(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedSchedule, fields, params, fetchFirstPage, '/upload_schedules');
  }
  createUploadSchedule(fields, params = {}, pathOverride = null) {
    return this.createEdge('/upload_schedules', fields, params, ProductFeed, pathOverride);
  }
  getUploads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeedUpload, fields, params, fetchFirstPage, '/uploads');
  }
  createUpload(fields, params = {}, pathOverride = null) {
    return this.createEdge('/uploads', fields, params, ProductFeedUpload, pathOverride);
  }
  getVehicleOffers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VehicleOffer, fields, params, fetchFirstPage, '/vehicle_offers');
  }
  getVehicles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Vehicle, fields, params, fetchFirstPage, '/vehicles');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductGroup
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductGroup extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      product_catalog: 'product_catalog',
      retailer_id: 'retailer_id',
      variants: 'variants'
    });
  }
  getProducts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductItem, fields, params, fetchFirstPage, '/products');
  }
  createProduct(fields, params = {}, pathOverride = null) {
    return this.createEdge('/products', fields, params, ProductItem, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalogProductSetsBatch
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalogProductSetsBatch extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      errors: 'errors',
      errors_total_count: 'errors_total_count',
      handle: 'handle',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ProductCatalog
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ProductCatalog extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_account_to_collaborative_ads_share_settings: 'ad_account_to_collaborative_ads_share_settings',
      agency_collaborative_ads_share_settings: 'agency_collaborative_ads_share_settings',
      business: 'business',
      catalog_store: 'catalog_store',
      commerce_merchant_settings: 'commerce_merchant_settings',
      creator_user: 'creator_user',
      da_display_settings: 'da_display_settings',
      default_image_url: 'default_image_url',
      fallback_image_url: 'fallback_image_url',
      feed_count: 'feed_count',
      id: 'id',
      is_catalog_segment: 'is_catalog_segment',
      name: 'name',
      owner_business: 'owner_business',
      product_count: 'product_count',
      store_catalog_settings: 'store_catalog_settings',
      vertical: 'vertical'
    });
  }
  static get Vertical() {
    return Object.freeze({
      adoptable_pets: 'adoptable_pets',
      bookable: 'bookable',
      commerce: 'commerce',
      destinations: 'destinations',
      flights: 'flights',
      home_listings: 'home_listings',
      hotels: 'hotels',
      jobs: 'jobs',
      local_delivery_shipping_profiles: 'local_delivery_shipping_profiles',
      local_service_businesses: 'local_service_businesses',
      offer_items: 'offer_items',
      offline_commerce: 'offline_commerce',
      ticketed_experiences: 'ticketed_experiences',
      transactable_items: 'transactable_items',
      vehicles: 'vehicles'
    });
  }
  static get PermittedRoles() {
    return Object.freeze({
      admin: 'ADMIN',
      advertiser: 'ADVERTISER'
    });
  }
  static get PermittedTasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      manage: 'MANAGE',
      manage_ar: 'MANAGE_AR'
    });
  }
  static get Tasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      manage: 'MANAGE',
      manage_ar: 'MANAGE_AR'
    });
  }
  static get Standard() {
    return Object.freeze({
      google: 'google'
    });
  }
  static get ItemSubType() {
    return Object.freeze({
      appliances: 'APPLIANCES',
      baby_feeding: 'BABY_FEEDING',
      baby_transport: 'BABY_TRANSPORT',
      beauty: 'BEAUTY',
      bedding: 'BEDDING',
      cameras: 'CAMERAS',
      cell_phones_and_smart_watches: 'CELL_PHONES_AND_SMART_WATCHES',
      cleaning_supplies: 'CLEANING_SUPPLIES',
      clothing: 'CLOTHING',
      clothing_accessories: 'CLOTHING_ACCESSORIES',
      computers_and_tablets: 'COMPUTERS_AND_TABLETS',
      diapering_and_potty_training: 'DIAPERING_AND_POTTY_TRAINING',
      electronics_accessories: 'ELECTRONICS_ACCESSORIES',
      furniture: 'FURNITURE',
      health: 'HEALTH',
      home_goods: 'HOME_GOODS',
      jewelry: 'JEWELRY',
      nursery: 'NURSERY',
      printers_and_scanners: 'PRINTERS_AND_SCANNERS',
      projectors: 'PROJECTORS',
      shoes_and_footwear: 'SHOES_AND_FOOTWEAR',
      software: 'SOFTWARE',
      toys: 'TOYS',
      tvs_and_monitors: 'TVS_AND_MONITORS',
      video_game_consoles_and_video_games: 'VIDEO_GAME_CONSOLES_AND_VIDEO_GAMES',
      watches: 'WATCHES'
    });
  }
  deleteAgencies(params = {}) {
    return super.deleteEdge('/agencies', params);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  createAgency(fields, params = {}, pathOverride = null) {
    return this.createEdge('/agencies', fields, params, ProductCatalog, pathOverride);
  }
  getArEffectsBatchStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AREffectsBatchStatus, fields, params, fetchFirstPage, '/ar_effects_batch_status');
  }
  deleteAssignedUsers(params = {}) {
    return super.deleteEdge('/assigned_users', params);
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, ProductCatalog, pathOverride);
  }
  getAutomotiveModels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AutomotiveModel, fields, params, fetchFirstPage, '/automotive_models');
  }
  createBatch(fields, params = {}, pathOverride = null) {
    return this.createEdge('/batch', fields, params, ProductCatalog, pathOverride);
  }
  createCatalogStore(fields, params = {}, pathOverride = null) {
    return this.createEdge('/catalog_store', fields, params, StoreCatalogSettings, pathOverride);
  }
  getCategories(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogCategory, fields, params, fetchFirstPage, '/categories');
  }
  createCategory(fields, params = {}, pathOverride = null) {
    return this.createEdge('/categories', fields, params, ProductCatalogCategory, pathOverride);
  }
  getCheckBatchRequestStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CheckBatchRequestStatus, fields, params, fetchFirstPage, '/check_batch_request_status');
  }
  getCollaborativeAdsEventStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CatalogSegmentAllMatchCountLaser, fields, params, fetchFirstPage, '/collaborative_ads_event_stats');
  }
  getCollaborativeAdsLsbImageBank(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/collaborative_ads_lsb_image_bank');
  }
  getCollaborativeAdsShareSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CollaborativeAdsShareSettings, fields, params, fetchFirstPage, '/collaborative_ads_share_settings');
  }
  createCpasLsbImageBank(fields, params = {}, pathOverride = null) {
    return this.createEdge('/cpas_lsb_image_bank', fields, params, null, pathOverride);
  }
  getDataSources(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogDataSource, fields, params, fetchFirstPage, '/data_sources');
  }
  getDestinations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Destination, fields, params, fetchFirstPage, '/destinations');
  }
  getDiagnostics(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogDiagnosticGroup, fields, params, fetchFirstPage, '/diagnostics');
  }
  getEventStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductEventStat, fields, params, fetchFirstPage, '/event_stats');
  }
  deleteExternalEventSources(params = {}) {
    return super.deleteEdge('/external_event_sources', params);
  }
  getExternalEventSources(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ExternalEventSource, fields, params, fetchFirstPage, '/external_event_sources');
  }
  createExternalEventSource(fields, params = {}, pathOverride = null) {
    return this.createEdge('/external_event_sources', fields, params, ProductCatalog, pathOverride);
  }
  getFlights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Flight, fields, params, fetchFirstPage, '/flights');
  }
  getHomeListings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(HomeListing, fields, params, fetchFirstPage, '/home_listings');
  }
  createHomeListing(fields, params = {}, pathOverride = null) {
    return this.createEdge('/home_listings', fields, params, HomeListing, pathOverride);
  }
  getHotelRoomsBatch(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogHotelRoomsBatch, fields, params, fetchFirstPage, '/hotel_rooms_batch');
  }
  createHotelRoomsBatch(fields, params = {}, pathOverride = null) {
    return this.createEdge('/hotel_rooms_batch', fields, params, ProductCatalog, pathOverride);
  }
  getHotels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Hotel, fields, params, fetchFirstPage, '/hotels');
  }
  createHotel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/hotels', fields, params, Hotel, pathOverride);
  }
  createItemsBatch(fields, params = {}, pathOverride = null) {
    return this.createEdge('/items_batch', fields, params, ProductCatalog, pathOverride);
  }
  createLocalizedItemsBatch(fields, params = {}, pathOverride = null) {
    return this.createEdge('/localized_items_batch', fields, params, ProductCatalog, pathOverride);
  }
  getMediaTitles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MediaTitle, fields, params, fetchFirstPage, '/media_titles');
  }
  createMediaTitle(fields, params = {}, pathOverride = null) {
    return this.createEdge('/media_titles', fields, params, MediaTitle, pathOverride);
  }
  getPricingVariablesBatch(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogPricingVariablesBatch, fields, params, fetchFirstPage, '/pricing_variables_batch');
  }
  createPricingVariablesBatch(fields, params = {}, pathOverride = null) {
    return this.createEdge('/pricing_variables_batch', fields, params, ProductCatalog, pathOverride);
  }
  getProductFeeds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductFeed, fields, params, fetchFirstPage, '/product_feeds');
  }
  createProductFeed(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_feeds', fields, params, ProductFeed, pathOverride);
  }
  getProductGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductGroup, fields, params, fetchFirstPage, '/product_groups');
  }
  createProductGroup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_groups', fields, params, ProductGroup, pathOverride);
  }
  getProductSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductSet, fields, params, fetchFirstPage, '/product_sets');
  }
  createProductSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_sets', fields, params, ProductSet, pathOverride);
  }
  getProductSetsBatch(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalogProductSetsBatch, fields, params, fetchFirstPage, '/product_sets_batch');
  }
  getProducts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductItem, fields, params, fetchFirstPage, '/products');
  }
  createProduct(fields, params = {}, pathOverride = null) {
    return this.createEdge('/products', fields, params, ProductItem, pathOverride);
  }
  getVehicleOffers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VehicleOffer, fields, params, fetchFirstPage, '/vehicle_offers');
  }
  getVehicles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Vehicle, fields, params, fetchFirstPage, '/vehicles');
  }
  createVehicle(fields, params = {}, pathOverride = null) {
    return this.createEdge('/vehicles', fields, params, Vehicle, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CommerceMerchantSettingsSetupStatus
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CommerceMerchantSettingsSetupStatus extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      deals_setup: 'deals_setup',
      marketplace_approval_status: 'marketplace_approval_status',
      marketplace_approval_status_details: 'marketplace_approval_status_details',
      payment_setup: 'payment_setup',
      review_status: 'review_status',
      shop_setup: 'shop_setup'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Shop
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Shop extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      fb_sales_channel: 'fb_sales_channel',
      id: 'id',
      ig_sales_channel: 'ig_sales_channel',
      workspace: 'workspace'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CommerceMerchantSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CommerceMerchantSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      braintree_merchant_id: 'braintree_merchant_id',
      checkout_message: 'checkout_message',
      commerce_store: 'commerce_store',
      contact_email: 'contact_email',
      cta: 'cta',
      disable_checkout_urls: 'disable_checkout_urls',
      display_name: 'display_name',
      external_merchant_id: 'external_merchant_id',
      facebook_channel: 'facebook_channel',
      feature_eligibility: 'feature_eligibility',
      has_discount_code: 'has_discount_code',
      has_onsite_intent: 'has_onsite_intent',
      id: 'id',
      instagram_channel: 'instagram_channel',
      merchant_alert_email: 'merchant_alert_email',
      merchant_page: 'merchant_page',
      merchant_status: 'merchant_status',
      onsite_commerce_merchant: 'onsite_commerce_merchant',
      payment_provider: 'payment_provider',
      privacy_url_by_locale: 'privacy_url_by_locale',
      review_rejection_messages: 'review_rejection_messages',
      review_rejection_reasons: 'review_rejection_reasons',
      supported_card_types: 'supported_card_types',
      terms: 'terms',
      terms_url_by_locale: 'terms_url_by_locale',
      whatsapp_channel: 'whatsapp_channel'
    });
  }
  createAcknowledgeOrder(fields, params = {}, pathOverride = null) {
    return this.createEdge('/acknowledge_orders', fields, params, CommerceMerchantSettings, pathOverride);
  }
  getCommerceOrders(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceOrder, fields, params, fetchFirstPage, '/commerce_orders');
  }
  getCommercePayouts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommercePayout, fields, params, fetchFirstPage, '/commerce_payouts');
  }
  getCommerceTransactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceOrderTransactionDetail, fields, params, fetchFirstPage, '/commerce_transactions');
  }
  getOnsiteConversionEvents(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/onsite_conversion_events');
  }
  getOrderManagementApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/order_management_apps');
  }
  createOrderManagementApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/order_management_apps', fields, params, CommerceMerchantSettings, pathOverride);
  }
  getProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/product_catalogs');
  }
  getReturns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/returns');
  }
  getSellerIssues(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/seller_issues');
  }
  getSetupStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceMerchantSettingsSetupStatus, fields, params, fetchFirstPage, '/setup_status');
  }
  getShippingProfiles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/shipping_profiles');
  }
  createShippingProfile(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shipping_profiles', fields, params, null, pathOverride);
  }
  getShops(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Shop, fields, params, fetchFirstPage, '/shops');
  }
  getTaxSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/tax_settings');
  }
  createWhatsappChannel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/whatsapp_channel', fields, params, null, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * UnifiedThread
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class UnifiedThread extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      can_reply: 'can_reply',
      folder: 'folder',
      former_participants: 'former_participants',
      id: 'id',
      is_subscribed: 'is_subscribed',
      link: 'link',
      message_count: 'message_count',
      name: 'name',
      participants: 'participants',
      scoped_thread_key: 'scoped_thread_key',
      senders: 'senders',
      snippet: 'snippet',
      subject: 'subject',
      unread_count: 'unread_count',
      updated_time: 'updated_time',
      wallpaper: 'wallpaper'
    });
  }
  static get Platform() {
    return Object.freeze({
      instagram: 'INSTAGRAM',
      messenger: 'MESSENGER'
    });
  }
  getMessages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/messages');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PageUserMessageThreadLabel
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PageUserMessageThreadLabel extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      page_label_name: 'page_label_name'
    });
  }
  deleteLabel(params = {}) {
    return super.deleteEdge('/label', params);
  }
  createLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/label', fields, params, PageUserMessageThreadLabel, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomUserSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomUserSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      page_level_persistent_menu: 'page_level_persistent_menu',
      user_level_persistent_menu: 'user_level_persistent_menu'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * NullNode
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class NullNode extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({});
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AppRequestFormerRecipient
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AppRequestFormerRecipient extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      recipient_id: 'recipient_id'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AppRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AppRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      action_type: 'action_type',
      application: 'application',
      created_time: 'created_time',
      data: 'data',
      from: 'from',
      id: 'id',
      message: 'message',
      object: 'object',
      to: 'to'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomConversionStatsResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomConversionStatsResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      aggregation: 'aggregation',
      data: 'data',
      timestamp: 'timestamp'
    });
  }
  static get Aggregation() {
    return Object.freeze({
      count: 'count',
      device_type: 'device_type',
      host: 'host',
      pixel_fire: 'pixel_fire',
      unmatched_count: 'unmatched_count',
      unmatched_usd_amount: 'unmatched_usd_amount',
      url: 'url',
      usd_amount: 'usd_amount'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomConversion
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomConversion extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      aggregation_rule: 'aggregation_rule',
      business: 'business',
      creation_time: 'creation_time',
      custom_event_type: 'custom_event_type',
      data_sources: 'data_sources',
      default_conversion_value: 'default_conversion_value',
      description: 'description',
      event_source_type: 'event_source_type',
      first_fired_time: 'first_fired_time',
      id: 'id',
      is_archived: 'is_archived',
      is_unavailable: 'is_unavailable',
      last_fired_time: 'last_fired_time',
      name: 'name',
      offline_conversion_data_set: 'offline_conversion_data_set',
      pixel: 'pixel',
      retention_days: 'retention_days',
      rule: 'rule'
    });
  }
  static get CustomEventType() {
    return Object.freeze({
      add_payment_info: 'ADD_PAYMENT_INFO',
      add_to_cart: 'ADD_TO_CART',
      add_to_wishlist: 'ADD_TO_WISHLIST',
      complete_registration: 'COMPLETE_REGISTRATION',
      contact: 'CONTACT',
      content_view: 'CONTENT_VIEW',
      customize_product: 'CUSTOMIZE_PRODUCT',
      donate: 'DONATE',
      facebook_selected: 'FACEBOOK_SELECTED',
      find_location: 'FIND_LOCATION',
      initiated_checkout: 'INITIATED_CHECKOUT',
      lead: 'LEAD',
      listing_interaction: 'LISTING_INTERACTION',
      other: 'OTHER',
      purchase: 'PURCHASE',
      schedule: 'SCHEDULE',
      search: 'SEARCH',
      start_trial: 'START_TRIAL',
      submit_application: 'SUBMIT_APPLICATION',
      subscribe: 'SUBSCRIBE'
    });
  }
  getStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomConversionStatsResult, fields, params, fetchFirstPage, '/stats');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InstagramUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InstagramUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      follow_count: 'follow_count',
      followed_by_count: 'followed_by_count',
      has_profile_picture: 'has_profile_picture',
      id: 'id',
      is_private: 'is_private',
      is_published: 'is_published',
      media_count: 'media_count',
      mini_shop_storefront: 'mini_shop_storefront',
      owner_business: 'owner_business',
      profile_pic: 'profile_pic',
      username: 'username'
    });
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  getAuthorizedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/authorized_adaccounts');
  }
  createAuthorizedAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/authorized_adaccounts', fields, params, InstagramUser, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomAudienceSession
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomAudienceSession extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      end_time: 'end_time',
      num_invalid_entries: 'num_invalid_entries',
      num_matched: 'num_matched',
      num_received: 'num_received',
      progress: 'progress',
      session_id: 'session_id',
      stage: 'stage',
      start_time: 'start_time'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomAudiencesharedAccountInfo
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomAudiencesharedAccountInfo extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      account_name: 'account_name',
      business_id: 'business_id',
      business_name: 'business_name',
      sharing_status: 'sharing_status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomAudience
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomAudience extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      approximate_count_lower_bound: 'approximate_count_lower_bound',
      approximate_count_upper_bound: 'approximate_count_upper_bound',
      customer_file_source: 'customer_file_source',
      data_source: 'data_source',
      data_source_types: 'data_source_types',
      datafile_custom_audience_uploading_status: 'datafile_custom_audience_uploading_status',
      delete_time: 'delete_time',
      delivery_status: 'delivery_status',
      description: 'description',
      excluded_custom_audiences: 'excluded_custom_audiences',
      external_event_source: 'external_event_source',
      household_audience: 'household_audience',
      id: 'id',
      included_custom_audiences: 'included_custom_audiences',
      is_household: 'is_household',
      is_snapshot: 'is_snapshot',
      is_value_based: 'is_value_based',
      lookalike_audience_ids: 'lookalike_audience_ids',
      lookalike_spec: 'lookalike_spec',
      name: 'name',
      operation_status: 'operation_status',
      opt_out_link: 'opt_out_link',
      owner_business: 'owner_business',
      page_deletion_marked_delete_time: 'page_deletion_marked_delete_time',
      permission_for_actions: 'permission_for_actions',
      pixel_id: 'pixel_id',
      regulated_audience_spec: 'regulated_audience_spec',
      retention_days: 'retention_days',
      rev_share_policy_id: 'rev_share_policy_id',
      rule: 'rule',
      rule_aggregation: 'rule_aggregation',
      rule_v2: 'rule_v2',
      seed_audience: 'seed_audience',
      sharing_status: 'sharing_status',
      subtype: 'subtype',
      time_content_updated: 'time_content_updated',
      time_created: 'time_created',
      time_updated: 'time_updated'
    });
  }
  static get ClaimObjective() {
    return Object.freeze({
      automotive_model: 'AUTOMOTIVE_MODEL',
      collaborative_ads: 'COLLABORATIVE_ADS',
      home_listing: 'HOME_LISTING',
      media_title: 'MEDIA_TITLE',
      product: 'PRODUCT',
      travel: 'TRAVEL',
      vehicle: 'VEHICLE',
      vehicle_offer: 'VEHICLE_OFFER'
    });
  }
  static get ContentType() {
    return Object.freeze({
      automotive_model: 'AUTOMOTIVE_MODEL',
      destination: 'DESTINATION',
      flight: 'FLIGHT',
      home_listing: 'HOME_LISTING',
      hotel: 'HOTEL',
      job: 'JOB',
      local_service_business: 'LOCAL_SERVICE_BUSINESS',
      location_based_item: 'LOCATION_BASED_ITEM',
      media_title: 'MEDIA_TITLE',
      offline_product: 'OFFLINE_PRODUCT',
      product: 'PRODUCT',
      vehicle: 'VEHICLE',
      vehicle_offer: 'VEHICLE_OFFER'
    });
  }
  static get CustomerFileSource() {
    return Object.freeze({
      both_user_and_partner_provided: 'BOTH_USER_AND_PARTNER_PROVIDED',
      partner_provided_only: 'PARTNER_PROVIDED_ONLY',
      user_provided_only: 'USER_PROVIDED_ONLY'
    });
  }
  static get Subtype() {
    return Object.freeze({
      app: 'APP',
      bag_of_accounts: 'BAG_OF_ACCOUNTS',
      claim: 'CLAIM',
      custom: 'CUSTOM',
      engagement: 'ENGAGEMENT',
      fox: 'FOX',
      lookalike: 'LOOKALIKE',
      managed: 'MANAGED',
      measurement: 'MEASUREMENT',
      offline_conversion: 'OFFLINE_CONVERSION',
      partner: 'PARTNER',
      regulated_categories_audience: 'REGULATED_CATEGORIES_AUDIENCE',
      study_rule_audience: 'STUDY_RULE_AUDIENCE',
      video: 'VIDEO',
      website: 'WEBSITE'
    });
  }
  static get ActionSource() {
    return Object.freeze({
      physical_store: 'PHYSICAL_STORE',
      website: 'WEBSITE'
    });
  }
  deleteAdAccounts(params = {}) {
    return super.deleteEdge('/adaccounts', params);
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/adaccounts');
  }
  createAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adaccounts', fields, params, CustomAudience, pathOverride);
  }
  getAds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/ads');
  }
  getSessions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomAudienceSession, fields, params, fetchFirstPage, '/sessions');
  }
  getSharedAccountInfo(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomAudiencesharedAccountInfo, fields, params, fetchFirstPage, '/shared_account_info');
  }
  deleteUsers(params = {}) {
    return super.deleteEdge('/users', params);
  }
  createUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/users', fields, params, CustomAudience, pathOverride);
  }
  createUsersReplace(fields, params = {}, pathOverride = null) {
    return this.createEdge('/usersreplace', fields, params, CustomAudience, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * OfflineConversionDataSetUpload
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class OfflineConversionDataSetUpload extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      api_calls: 'api_calls',
      creation_time: 'creation_time',
      duplicate_entries: 'duplicate_entries',
      event_stats: 'event_stats',
      event_time_max: 'event_time_max',
      event_time_min: 'event_time_min',
      first_upload_time: 'first_upload_time',
      id: 'id',
      is_excluded_for_lift: 'is_excluded_for_lift',
      last_upload_time: 'last_upload_time',
      match_rate_approx: 'match_rate_approx',
      matched_entries: 'matched_entries',
      upload_tag: 'upload_tag',
      valid_entries: 'valid_entries'
    });
  }
  static get Order() {
    return Object.freeze({
      ascending: 'ASCENDING',
      descending: 'DESCENDING'
    });
  }
  static get SortBy() {
    return Object.freeze({
      api_calls: 'API_CALLS',
      creation_time: 'CREATION_TIME',
      event_time_max: 'EVENT_TIME_MAX',
      event_time_min: 'EVENT_TIME_MIN',
      first_upload_time: 'FIRST_UPLOAD_TIME',
      is_excluded_for_lift: 'IS_EXCLUDED_FOR_LIFT',
      last_upload_time: 'LAST_UPLOAD_TIME'
    });
  }
  getProgress(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/progress');
  }
  getPullSessions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/pull_sessions');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * OfflineConversionDataSet
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class OfflineConversionDataSet extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business: 'business',
      config: 'config',
      creation_time: 'creation_time',
      creator: 'creator',
      description: 'description',
      duplicate_entries: 'duplicate_entries',
      enable_auto_assign_to_accounts: 'enable_auto_assign_to_accounts',
      event_stats: 'event_stats',
      event_time_max: 'event_time_max',
      event_time_min: 'event_time_min',
      id: 'id',
      is_mta_use: 'is_mta_use',
      is_restricted_use: 'is_restricted_use',
      is_unavailable: 'is_unavailable',
      last_upload_app: 'last_upload_app',
      last_upload_app_changed_time: 'last_upload_app_changed_time',
      match_rate_approx: 'match_rate_approx',
      matched_entries: 'matched_entries',
      name: 'name',
      owner_business: 'owner_business',
      usage: 'usage',
      valid_entries: 'valid_entries'
    });
  }
  static get PermittedRoles() {
    return Object.freeze({
      admin: 'ADMIN',
      advertiser: 'ADVERTISER',
      uploader: 'UPLOADER'
    });
  }
  static get RelationshipType() {
    return Object.freeze({
      ad_manager: 'AD_MANAGER',
      agency: 'AGENCY',
      aggregator: 'AGGREGATOR',
      audience_manager: 'AUDIENCE_MANAGER',
      other: 'OTHER'
    });
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/adaccounts');
  }
  createAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adaccounts', fields, params, OfflineConversionDataSet, pathOverride);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  createAgency(fields, params = {}, pathOverride = null) {
    return this.createEdge('/agencies', fields, params, OfflineConversionDataSet, pathOverride);
  }
  getAudiences(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomAudience, fields, params, fetchFirstPage, '/audiences');
  }
  getCustomConversions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomConversion, fields, params, fetchFirstPage, '/customconversions');
  }
  createEvent(fields, params = {}, pathOverride = null) {
    return this.createEdge('/events', fields, params, null, pathOverride);
  }
  getStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/stats');
  }
  getUploads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OfflineConversionDataSetUpload, fields, params, fetchFirstPage, '/uploads');
  }
  createUpload(fields, params = {}, pathOverride = null) {
    return this.createEdge('/uploads', fields, params, OfflineConversionDataSetUpload, pathOverride);
  }
  createValidate(fields, params = {}, pathOverride = null) {
    return this.createEdge('/validate', fields, params, OfflineConversionDataSet, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessAssetGroup
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessAssetGroup extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      owner_business: 'owner_business'
    });
  }
  static get AdaccountTasks() {
    return Object.freeze({
      aa_analyze: 'AA_ANALYZE',
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      draft: 'DRAFT',
      manage: 'MANAGE'
    });
  }
  static get OfflineConversionDataSetTasks() {
    return Object.freeze({
      aa_analyze: 'AA_ANALYZE',
      advertise: 'ADVERTISE',
      manage: 'MANAGE',
      upload: 'UPLOAD',
      view: 'VIEW'
    });
  }
  static get PageTasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      cashier_role: 'CASHIER_ROLE',
      create_content: 'CREATE_CONTENT',
      manage: 'MANAGE',
      manage_jobs: 'MANAGE_JOBS',
      manage_leads: 'MANAGE_LEADS',
      messaging: 'MESSAGING',
      moderate: 'MODERATE',
      moderate_community: 'MODERATE_COMMUNITY',
      pages_messaging: 'PAGES_MESSAGING',
      pages_messaging_subscriptions: 'PAGES_MESSAGING_SUBSCRIPTIONS',
      profile_plus_advertise: 'PROFILE_PLUS_ADVERTISE',
      profile_plus_analyze: 'PROFILE_PLUS_ANALYZE',
      profile_plus_create_content: 'PROFILE_PLUS_CREATE_CONTENT',
      profile_plus_facebook_access: 'PROFILE_PLUS_FACEBOOK_ACCESS',
      profile_plus_full_control: 'PROFILE_PLUS_FULL_CONTROL',
      profile_plus_manage: 'PROFILE_PLUS_MANAGE',
      profile_plus_manage_leads: 'PROFILE_PLUS_MANAGE_LEADS',
      profile_plus_messaging: 'PROFILE_PLUS_MESSAGING',
      profile_plus_moderate: 'PROFILE_PLUS_MODERATE',
      profile_plus_moderate_delegate_community: 'PROFILE_PLUS_MODERATE_DELEGATE_COMMUNITY',
      profile_plus_revenue: 'PROFILE_PLUS_REVENUE',
      read_page_mailboxes: 'READ_PAGE_MAILBOXES',
      view_monetization_insights: 'VIEW_MONETIZATION_INSIGHTS'
    });
  }
  static get PixelTasks() {
    return Object.freeze({
      aa_analyze: 'AA_ANALYZE',
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      edit: 'EDIT',
      upload: 'UPLOAD'
    });
  }
  deleteAssignedUsers(params = {}) {
    return super.deleteEdge('/assigned_users', params);
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedAdAccounts(params = {}) {
    return super.deleteEdge('/contained_adaccounts', params);
  }
  getContainedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/contained_adaccounts');
  }
  createContainedAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_adaccounts', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedApplications(params = {}) {
    return super.deleteEdge('/contained_applications', params);
  }
  getContainedApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/contained_applications');
  }
  createContainedApplication(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_applications', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedCustomConversions(params = {}) {
    return super.deleteEdge('/contained_custom_conversions', params);
  }
  getContainedCustomConversions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomConversion, fields, params, fetchFirstPage, '/contained_custom_conversions');
  }
  createContainedCustomConversion(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_custom_conversions', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedInstagramAccounts(params = {}) {
    return super.deleteEdge('/contained_instagram_accounts', params);
  }
  getContainedInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/contained_instagram_accounts');
  }
  createContainedInstagramAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_instagram_accounts', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedOfflineConversionDataSets(params = {}) {
    return super.deleteEdge('/contained_offline_conversion_data_sets', params);
  }
  getContainedOfflineConversionDataSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OfflineConversionDataSet, fields, params, fetchFirstPage, '/contained_offline_conversion_data_sets');
  }
  createContainedOfflineConversionDataSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_offline_conversion_data_sets', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedPages(params = {}) {
    return super.deleteEdge('/contained_pages', params);
  }
  getContainedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/contained_pages');
  }
  createContainedPage(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_pages', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedPixels(params = {}) {
    return super.deleteEdge('/contained_pixels', params);
  }
  getContainedPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/contained_pixels');
  }
  createContainedPixel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_pixels', fields, params, BusinessAssetGroup, pathOverride);
  }
  deleteContainedProductCatalogs(params = {}) {
    return super.deleteEdge('/contained_product_catalogs', params);
  }
  getContainedProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/contained_product_catalogs');
  }
  createContainedProductCatalog(fields, params = {}, pathOverride = null) {
    return this.createEdge('/contained_product_catalogs', fields, params, BusinessAssetGroup, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business: 'business',
      business_role_request: 'business_role_request',
      email: 'email',
      finance_permission: 'finance_permission',
      first_name: 'first_name',
      id: 'id',
      ip_permission: 'ip_permission',
      last_name: 'last_name',
      marked_for_removal: 'marked_for_removal',
      name: 'name',
      pending_email: 'pending_email',
      role: 'role',
      title: 'title',
      two_fac_status: 'two_fac_status'
    });
  }
  static get Role() {
    return Object.freeze({
      admin: 'ADMIN',
      ads_rights_reviewer: 'ADS_RIGHTS_REVIEWER',
      default: 'DEFAULT',
      developer: 'DEVELOPER',
      employee: 'EMPLOYEE',
      finance_analyst: 'FINANCE_ANALYST',
      finance_edit: 'FINANCE_EDIT',
      finance_editor: 'FINANCE_EDITOR',
      finance_view: 'FINANCE_VIEW',
      manage: 'MANAGE',
      partner_center_admin: 'PARTNER_CENTER_ADMIN',
      partner_center_analyst: 'PARTNER_CENTER_ANALYST',
      partner_center_education: 'PARTNER_CENTER_EDUCATION',
      partner_center_marketing: 'PARTNER_CENTER_MARKETING',
      partner_center_operations: 'PARTNER_CENTER_OPERATIONS'
    });
  }
  getAssignedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/assigned_ad_accounts');
  }
  getAssignedBusinessAssetGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetGroup, fields, params, fetchFirstPage, '/assigned_business_asset_groups');
  }
  getAssignedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/assigned_pages');
  }
  getAssignedProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/assigned_product_catalogs');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * FundraiserPersonToCharity
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class FundraiserPersonToCharity extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      amount_raised: 'amount_raised',
      charity_id: 'charity_id',
      currency: 'currency',
      description: 'description',
      donations_count: 'donations_count',
      donors_count: 'donors_count',
      end_time: 'end_time',
      external_amount_raised: 'external_amount_raised',
      external_donations_count: 'external_donations_count',
      external_donors_count: 'external_donors_count',
      external_event_name: 'external_event_name',
      external_event_start_time: 'external_event_start_time',
      external_event_uri: 'external_event_uri',
      external_fundraiser_uri: 'external_fundraiser_uri',
      external_id: 'external_id',
      goal_amount: 'goal_amount',
      id: 'id',
      internal_amount_raised: 'internal_amount_raised',
      internal_donations_count: 'internal_donations_count',
      internal_donors_count: 'internal_donors_count',
      name: 'name',
      uri: 'uri'
    });
  }
  static get FundraiserType() {
    return Object.freeze({
      person_for_charity: 'person_for_charity'
    });
  }
  getDonations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/donations');
  }
  createEndFundraiser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/end_fundraiser', fields, params, null, pathOverride);
  }
  getExternalDonations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/external_donations');
  }
  createExternalDonation(fields, params = {}, pathOverride = null) {
    return this.createEdge('/external_donations', fields, params, null, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * GameItem
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class GameItem extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      count: 'count',
      created: 'created',
      ext_id: 'ext_id',
      id: 'id',
      item_def: 'item_def',
      owner: 'owner',
      status: 'status',
      updated: 'updated'
    });
  }
  static get Action() {
    return Object.freeze({
      consume: 'CONSUME',
      drop: 'DROP',
      mark: 'MARK'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * UserIDForApp
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class UserIDForApp extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      app: 'app',
      id: 'id'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * UserIDForPage
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class UserIDForPage extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      page: 'page'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PaymentEnginePayment
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PaymentEnginePayment extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      actions: 'actions',
      application: 'application',
      country: 'country',
      created_time: 'created_time',
      disputes: 'disputes',
      fraud_status: 'fraud_status',
      fulfillment_status: 'fulfillment_status',
      id: 'id',
      is_from_ad: 'is_from_ad',
      is_from_page_post: 'is_from_page_post',
      items: 'items',
      payout_foreign_exchange_rate: 'payout_foreign_exchange_rate',
      phone_support_eligible: 'phone_support_eligible',
      platform: 'platform',
      refundable_amount: 'refundable_amount',
      request_id: 'request_id',
      tax: 'tax',
      tax_country: 'tax_country',
      test: 'test',
      user: 'user'
    });
  }
  static get Reason() {
    return Object.freeze({
      banned_user: 'BANNED_USER',
      denied_refund: 'DENIED_REFUND',
      granted_replacement_item: 'GRANTED_REPLACEMENT_ITEM'
    });
  }
  createDispute(fields, params = {}, pathOverride = null) {
    return this.createEdge('/dispute', fields, params, PaymentEnginePayment, pathOverride);
  }
  createRefund(fields, params = {}, pathOverride = null) {
    return this.createEdge('/refunds', fields, params, PaymentEnginePayment, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Permission
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Permission extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      permission: 'permission',
      status: 'status'
    });
  }
  static get Status() {
    return Object.freeze({
      declined: 'declined',
      expired: 'expired',
      granted: 'granted'
    });
  }
}

var fs = {};

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VideoThumbnail
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VideoThumbnail extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      height: 'height',
      id: 'id',
      is_preferred: 'is_preferred',
      name: 'name',
      scale: 'scale',
      uri: 'uri',
      width: 'width'
    });
  }
}

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
function resolve() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : '/';

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
}
// path.normalize(path)
// posix version
function normalize(path) {
  var isPathAbsolute = isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isPathAbsolute).join('/');

  if (!path && !isPathAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isPathAbsolute ? '/' : '') + path;
}
// posix version
function isAbsolute(path) {
  return path.charAt(0) === '/';
}

// posix version
function join() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
}


// path.relative(from, to)
// posix version
function relative(from, to) {
  from = resolve(from).substr(1);
  to = resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
}

var sep = '/';
var delimiter = ':';

function dirname(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
}

function basename(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
}


function extname(path) {
  return splitPath(path)[3];
}
var path = {
  extname: extname,
  basename: basename,
  dirname: dirname,
  sep: sep,
  delimiter: delimiter,
  relative: relative,
  join: join,
  isAbsolute: isAbsolute,
  normalize: normalize,
  resolve: resolve
};
function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b' ?
    function (str, start, len) { return str.substr(start, len) } :
    function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * @format
 * 
 */
/**
 * Video uploader that can upload videos to adaccount
 **/
class VideoUploader {
  constructor() {
    this._session = null;
  }

  /**
   * Upload the given video file.
   * @param {AdVideo} video The AdVideo object that will be uploaded
   * @param {Boolean} [waitForEncoding] Whether to wait until encoding
   *   is finished
   **/
  upload(video, waitForEncoding) {
    // Check there is no existing session
    if (this._session) {
      throw Error('There is already an upload session for this video uploader');
    }

    // Initate an upload session
    this._session = new VideoUploadSession(video, waitForEncoding);
    const result = this._session.start();
    this._session = null;
    return result;
  }
}
class VideoUploadSession {
  constructor(video, waitForEncoding = false) {
    this._video = video;
    this._api = video.getApi();
    if (video.filepath) {
      this._filePath = video.filepath;
      this._slideshowSpec = null;
    } else if (video.slideshow_spec) {
      this._slideshowSpec = video.slideshow_spec;
      this._filePath = null;
    }
    this._accountId = video.getParentId();
    this._waitForEncoding = waitForEncoding;
    // Setup start request manager
    this._startRequestManager = new VideoUploadStartRequestManager(this._api);
    // Setup transfer request manager
    this._transferRequestManager = new VideoUploadTransferRequestManager(this._api);
    // Setup finish request manager
    this._finishRequestManager = new VideoUploadFinishRequestManager(this._api);
  }
  async start() {
    let videoId;

    // Run start request manager
    const startResponse = await this._startRequestManager.sendRequest(this.getStartRequestContext());
    this._startOffset = parseInt(startResponse['start_offset']);
    this._endOffset = parseInt(startResponse['end_offset']);
    this._sessionId = startResponse['upload_session_id'];
    videoId = startResponse['video_id'];
    // Run transfer request manager
    await this._transferRequestManager.sendRequest(this.getTransferRequestContext());
    // Run finish request manager
    const finishResponse = await this._finishRequestManager.sendRequest(this.getFinishRequestContext());
    // Populate the video info
    const body = finishResponse;
    body.id = videoId;
    delete body.success;
    return body;
  }
  getStartRequestContext() {
    const context = new VideoUploadRequestContext();
    if (this._filePath) {
      // Read file size
      context.fileSize = fs.statSync(this._filePath).size;
    }
    context.accountId = this._accountId;
    return context;
  }
  getTransferRequestContext() {
    const context = new VideoUploadRequestContext();
    context.sessionId = this._sessionId;
    context.startOffset = this._startOffset;
    context.endOffset = this._endOffset;
    if (this._filePath) {
      context.filePath = this._filePath;
    }
    if (this._slideshowSpec) {
      context.slideshowSpec = this._slideshowSpec;
    }
    context.accountId = this._accountId;
    return context;
  }
  getFinishRequestContext() {
    const context = new VideoUploadRequestContext();
    context.sessionId = this._sessionId;
    context.accountId = this._accountId;
    if (this._filePath) {
      context.fileName = path.basename(this._filePath);
    }
    return context;
  }
}

/**
 * Abstract class for request managers
 **/
class VideoUploadRequestManager {
  constructor(api) {
    this._api = api;
  }
  sendRequest(context) {
    throw new TypeError('Class extending VideoUploadRequestManager must implement ' + 'sendRequest method');
  }
  getParamsFromContext(context) {
    throw new TypeError('Class extending VideoUploadRequestManager must implement ' + 'getParamsFromContext method');
  }
}
class VideoUploadStartRequestManager extends VideoUploadRequestManager {
  /**
   * Send start request with the given context
   **/
  async sendRequest(context) {
    // Init a VideoUploadRequest and send the request
    const request = new VideoUploadRequest(this._api);
    request.setParams(this.getParamsFromContext(context));
    const response = await request.send([context.accountId, 'advideos']);
    return response;
  }
  getParamsFromContext(context) {
    return {
      file_size: context.fileSize,
      upload_phase: 'start'
    };
  }
}
class VideoUploadTransferRequestManager extends VideoUploadRequestManager {
  /**
   * Send transfer request with the given context
   **/
  async sendRequest(context) {
    // Init a VideoUploadRequest
    const request = new VideoUploadRequest(this._api);
    var start_offset = context.startOffset;
    var end_offset = context.endOffset;
    const filePath = context.filePath;
    const fileSize = fs.statSync(filePath).size;

    // Give a chance to retry every 10M, or at least twice
    let numRetry = Math.max(fileSize / (1024 * 1024 * 10), 2);
    let response = null;
    // While there are still more chunks to send
    const videoFileDescriptor = fs.openSync(filePath, 'r');
    while (start_offset !== end_offset) {
      context.startOffset = start_offset;
      context.endOffset = end_offset;
      let params = {
        upload_phase: 'transfer',
        start_offset: context.startOffset,
        upload_session_id: context.sessionId,
        video_file_chunk: context.videoFileChunk
      };
      request.setParams(params, {
        video_file_chunk: fs.createReadStream(context.filePath, {
          start: context.startOffset,
          end: context.endOffset - 1
        })
      });
      // Send the request
      try {
        response = await request.send([context.accountId, 'advideos']);
        start_offset = parseInt(response['start_offset']);
        end_offset = parseInt(response['end_offset']);
      } catch (error) {
        if (numRetry > 0) {
          numRetry = Math.max(numRetry - 1, 0);
          continue;
        }
        fs.close(videoFileDescriptor, err => {});
        throw error;
      }
    }
    this._startOffset = start_offset;
    this._endOffset = end_offset;
    fs.close(videoFileDescriptor, err => {});
    return response;
  }
}
class VideoUploadFinishRequestManager extends VideoUploadRequestManager {
  /**
   * Send transfer request with the given context
   **/
  async sendRequest(context) {
    // Init a VideoUploadRequest
    const request = new VideoUploadRequest(this._api);

    // Parse the context
    request.setParams(this.getParamsFromContext(context));

    // Sent the request
    const response = await request.send([context.accountId, 'advideos']);
    return response;
  }
  getParamsFromContext(context) {
    return {
      upload_phase: 'finish',
      upload_session_id: context.sessionId,
      title: context.fileName
    };
  }
}

/**
 * Upload request context that contains the param data
 **/
class VideoUploadRequestContext {
  get accountId() {
    return this._accountId;
  }
  set accountId(accountId) {
    this._accountId = accountId;
  }
  get fileName() {
    return this._fileName;
  }
  set fileName(fileName) {
    this._fileName = fileName;
  }
  get filePath() {
    return this._filePath;
  }
  set filePath(filePath) {
    this._filePath = filePath;
  }
  get fileSize() {
    return this._fileSize;
  }
  set fileSize(fileSize) {
    this._fileSize = fileSize;
  }
  get name() {
    return this._name;
  }
  set name(name) {
    this._name = name;
  }
  get sessionId() {
    return this._sessionId;
  }
  set sessionId(sessionId) {
    this._sessionId = sessionId;
  }
  get startOffset() {
    return this._startOffset;
  }
  set startOffset(startOffset) {
    this._startOffset = startOffset;
  }
  get endOffset() {
    return this._endOffset;
  }
  set endOffset(endOffset) {
    this._endOffset = endOffset;
  }
  get slideshowSpec() {
    return this._slideshowSpec;
  }
  set slideshowSpec(slideshowSpec) {
    this._slideshowSpec = slideshowSpec;
  }
  get videoFileChunk() {
    return this._videoFileChunk;
  }
  set videoFileChunk(videoFileChunk) {
    this._videoFileChunk = videoFileChunk;
  }
}
class VideoUploadRequest {
  constructor(api) {
    this._params = null;
    this._files = null;
    this._api = api;
  }

  /**
   * Send the current request
   **/
  send(path) {
    return new Promise((resolve, reject) => {
      this._api.call('POST', path, this._params, this._files, true,
      // use multipart/form-data
      FacebookAdsApi.GRAPH_VIDEO // override graph.facebook.com
      ).then(response => resolve(JSON.parse(response))).catch(error => reject(error));
    });
  }
  setParams(params, files = null) {
    this._params = params;
    this._files = files;
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
class VideoEncodingStatusChecker {
  static async waitUntilReady(api, videoId, interval, timeout) {
    const startTime = new Date().getTime();
    let status = null;
    while (true) {
      status = VideoEncodingStatusChecker.getStatus(api, videoId);
      status = status['video_status'];
      if (status !== 'processing') {
        break;
      }
      if (startTime + timeout <= new Date().getTime()) {
        throw Error(`Video encoding timeout: ${timeout}`);
      }
      await sleep(interval);
    }
    if (status !== 'ready') {
      status = status == null ? '' : status;
      throw Error(`Video encoding status ${status}`);
    }
  }
  static getStatus(api, videoId) {
    const result = api.call('GET', [videoId.toString()], {
      fields: 'status'
    });
    // $FlowFixMe
    return result['status'];
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * 
 */
/**
 * AdVideo
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdVideo extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      filepath: 'filepath',
      id: 'id',
      slideshow_spec: 'slideshow_spec'
    });
  }
  get filepath() {
    return this.filepath;
  }
  get slideshow_spec() {
    return this.slideshow_spec;
  }

  /**
   * Uploads filepath and creates the AdVideo object from it.
   * It requires 'filepath' property to be defined.
   **/
  create(batch, failureHandler, successHandler) {
    let response = null;
    var spec = this.slideshow_spec;
    if (spec) {
      const request = new VideoUploadRequest(this.getApi());
      request.setParams({
        'slideshow_spec[images_urls]': JSON.stringify(spec['images_urls']),
        'slideshow_spec[duration_ms]': spec['duration_ms'],
        'slideshow_spec[transition_ms]': spec['transition_ms']
      });
      response = request.send([this.getParentId(), 'advideos']);
    } else if (this.filepath) {
      const videoUploader = new VideoUploader();
      response = videoUploader.upload(this, true);
    } else {
      throw Error('AdVideo requires a filepath or slideshow_spec to be defined.');
    }
    this.setData(response);
    return response;
  }
  waitUntilEncodingReady(interval = 30, timeout = 600) {
    if (!this.id) {
      throw Error('Invalid Video ID');
    }
    VideoEncodingStatusChecker.waitUntilReady(this.getApi(), parseInt(this.id), interval, timeout);
  }

  /**
   *  Returns all the thumbnails associated with the ad video
   */
  getThumbnails(fields, params) {
    return this.getEdge(VideoThumbnail, fields, params, true, 'thumbnails');
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * User
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class User extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      about: 'about',
      age_range: 'age_range',
      birthday: 'birthday',
      cover: 'cover',
      currency: 'currency',
      education: 'education',
      email: 'email',
      favorite_athletes: 'favorite_athletes',
      favorite_teams: 'favorite_teams',
      first_name: 'first_name',
      gender: 'gender',
      hometown: 'hometown',
      id: 'id',
      id_for_avatars: 'id_for_avatars',
      inspirational_people: 'inspirational_people',
      install_type: 'install_type',
      installed: 'installed',
      is_guest_user: 'is_guest_user',
      languages: 'languages',
      last_name: 'last_name',
      link: 'link',
      local_news_megaphone_dismiss_status: 'local_news_megaphone_dismiss_status',
      local_news_subscription_status: 'local_news_subscription_status',
      locale: 'locale',
      location: 'location',
      meeting_for: 'meeting_for',
      middle_name: 'middle_name',
      name: 'name',
      name_format: 'name_format',
      payment_pricepoints: 'payment_pricepoints',
      political: 'political',
      profile_pic: 'profile_pic',
      quotes: 'quotes',
      relationship_status: 'relationship_status',
      shared_login_upgrade_required_by: 'shared_login_upgrade_required_by',
      short_name: 'short_name',
      significant_other: 'significant_other',
      sports: 'sports',
      supports_donate_button_in_live_video: 'supports_donate_button_in_live_video',
      third_party_id: 'third_party_id',
      timezone: 'timezone',
      token_for_business: 'token_for_business',
      updated_time: 'updated_time',
      verified: 'verified',
      video_upload_limits: 'video_upload_limits',
      website: 'website'
    });
  }
  static get LocalNewsMegaphoneDismissStatus() {
    return Object.freeze({
      no: 'NO',
      yes: 'YES'
    });
  }
  static get LocalNewsSubscriptionStatus() {
    return Object.freeze({
      status_off: 'STATUS_OFF',
      status_on: 'STATUS_ON'
    });
  }
  static get Filtering() {
    return Object.freeze({
      ema: 'ema',
      groups: 'groups',
      groups_social: 'groups_social'
    });
  }
  static get Type() {
    return Object.freeze({
      content_update: 'content_update',
      generic: 'generic'
    });
  }
  deleteAccessTokens(params = {}) {
    return super.deleteEdge('/access_tokens', params);
  }
  createAccessToken(fields, params = {}, pathOverride = null) {
    return this.createEdge('/access_tokens', fields, params, User, pathOverride);
  }
  getAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/accounts');
  }
  createAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/accounts', fields, params, Page, pathOverride);
  }
  getAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/ad_studies');
  }
  createAdStudy(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ad_studies', fields, params, AdStudy, pathOverride);
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/adaccounts');
  }
  getAlbums(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Album, fields, params, fetchFirstPage, '/albums');
  }
  createApplication(fields, params = {}, pathOverride = null) {
    return this.createEdge('/applications', fields, params, User, pathOverride);
  }
  getAppRequestFormerRecipients(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AppRequestFormerRecipient, fields, params, fetchFirstPage, '/apprequestformerrecipients');
  }
  getAppRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AppRequest, fields, params, fetchFirstPage, '/apprequests');
  }
  getAssignedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/assigned_ad_accounts');
  }
  getAssignedBusinessAssetGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetGroup, fields, params, fetchFirstPage, '/assigned_business_asset_groups');
  }
  getAssignedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/assigned_pages');
  }
  getAssignedProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/assigned_product_catalogs');
  }
  getAvatars(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/avatars');
  }
  getBusinessUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessUser, fields, params, fetchFirstPage, '/business_users');
  }
  deleteBusinesses(params = {}) {
    return super.deleteEdge('/businesses', params);
  }
  getBusinesses(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/businesses');
  }
  createBusiness(fields, params = {}, pathOverride = null) {
    return this.createEdge('/businesses', fields, params, Business, pathOverride);
  }
  getConversations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UnifiedThread, fields, params, fetchFirstPage, '/conversations');
  }
  getCustomLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageUserMessageThreadLabel, fields, params, fetchFirstPage, '/custom_labels');
  }
  getEvents(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Event, fields, params, fetchFirstPage, '/events');
  }
  getFeed(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Post, fields, params, fetchFirstPage, '/feed');
  }
  createFeed(fields, params = {}, pathOverride = null) {
    return this.createEdge('/feed', fields, params, Post, pathOverride);
  }
  getFriends(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(User, fields, params, fetchFirstPage, '/friends');
  }
  getFundraisers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(FundraiserPersonToCharity, fields, params, fetchFirstPage, '/fundraisers');
  }
  createFundraiser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/fundraisers', fields, params, FundraiserPersonToCharity, pathOverride);
  }
  createGameItem(fields, params = {}, pathOverride = null) {
    return this.createEdge('/game_items', fields, params, GameItem, pathOverride);
  }
  createGameTime(fields, params = {}, pathOverride = null) {
    return this.createEdge('/game_times', fields, params, null, pathOverride);
  }
  getGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Group, fields, params, fetchFirstPage, '/groups');
  }
  getIdsForApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UserIDForApp, fields, params, fetchFirstPage, '/ids_for_apps');
  }
  getIdsForBusiness(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UserIDForApp, fields, params, fetchFirstPage, '/ids_for_business');
  }
  getIdsForPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UserIDForPage, fields, params, fetchFirstPage, '/ids_for_pages');
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/likes');
  }
  getLiveVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LiveVideo, fields, params, fetchFirstPage, '/live_videos');
  }
  createLiveVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/live_videos', fields, params, LiveVideo, pathOverride);
  }
  createMessengerDesktopPerformanceTrace(fields, params = {}, pathOverride = null) {
    return this.createEdge('/messenger_desktop_performance_traces', fields, params, User, pathOverride);
  }
  getMusic(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/music');
  }
  createNotification(fields, params = {}, pathOverride = null) {
    return this.createEdge('/notifications', fields, params, User, pathOverride);
  }
  getPaymentTransactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PaymentEnginePayment, fields, params, fetchFirstPage, '/payment_transactions');
  }
  deletePermissions(params = {}) {
    return super.deleteEdge('/permissions', params);
  }
  getPermissions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Permission, fields, params, fetchFirstPage, '/permissions');
  }
  getPersonalAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/personal_ad_accounts');
  }
  getPhotos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Photo, fields, params, fetchFirstPage, '/photos');
  }
  createPhoto(fields, params = {}, pathOverride = null) {
    return this.createEdge('/photos', fields, params, Photo, pathOverride);
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  getPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Post, fields, params, fetchFirstPage, '/posts');
  }
  getRichMediaDocuments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Canvas, fields, params, fetchFirstPage, '/rich_media_documents');
  }
  createStagingResource(fields, params = {}, pathOverride = null) {
    return this.createEdge('/staging_resources', fields, params, User, pathOverride);
  }
  getVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/videos');
  }
  createVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/videos', fields, params, AdVideo, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * LiveVideoError
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class LiveVideoError extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      creation_time: 'creation_time',
      error_code: 'error_code',
      error_message: 'error_message',
      error_type: 'error_type',
      id: 'id'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * LiveVideoInputStream
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class LiveVideoInputStream extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      dash_ingest_url: 'dash_ingest_url',
      dash_preview_url: 'dash_preview_url',
      id: 'id',
      is_master: 'is_master',
      secure_stream_url: 'secure_stream_url',
      stream_health: 'stream_health',
      stream_id: 'stream_id',
      stream_url: 'stream_url'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VideoPoll
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VideoPoll extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      close_after_voting: 'close_after_voting',
      default_open: 'default_open',
      id: 'id',
      question: 'question',
      show_gradient: 'show_gradient',
      show_results: 'show_results',
      status: 'status'
    });
  }
  static get Status() {
    return Object.freeze({
      closed: 'closed',
      results_open: 'results_open',
      voting_open: 'voting_open'
    });
  }
  static get Action() {
    return Object.freeze({
      attach_to_video: 'ATTACH_TO_VIDEO',
      close: 'CLOSE',
      delete_poll: 'DELETE_POLL',
      show_results: 'SHOW_RESULTS',
      show_voting: 'SHOW_VOTING'
    });
  }
  getPollOptions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/poll_options');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * LiveVideo
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class LiveVideo extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_break_config: 'ad_break_config',
      ad_break_failure_reason: 'ad_break_failure_reason',
      broadcast_start_time: 'broadcast_start_time',
      copyright: 'copyright',
      creation_time: 'creation_time',
      dash_ingest_url: 'dash_ingest_url',
      dash_preview_url: 'dash_preview_url',
      description: 'description',
      embed_html: 'embed_html',
      from: 'from',
      id: 'id',
      ingest_streams: 'ingest_streams',
      is_manual_mode: 'is_manual_mode',
      is_reference_only: 'is_reference_only',
      live_views: 'live_views',
      overlay_url: 'overlay_url',
      permalink_url: 'permalink_url',
      planned_start_time: 'planned_start_time',
      recommended_encoder_settings: 'recommended_encoder_settings',
      seconds_left: 'seconds_left',
      secure_stream_url: 'secure_stream_url',
      status: 'status',
      stream_url: 'stream_url',
      targeting: 'targeting',
      title: 'title',
      total_views: 'total_views',
      video: 'video'
    });
  }
  static get Projection() {
    return Object.freeze({
      cubemap: 'CUBEMAP',
      equirectangular: 'EQUIRECTANGULAR',
      half_equirectangular: 'HALF_EQUIRECTANGULAR'
    });
  }
  static get SpatialAudioFormat() {
    return Object.freeze({
      ambix_4: 'ambiX_4'
    });
  }
  static get Status() {
    return Object.freeze({
      live_now: 'LIVE_NOW',
      scheduled_canceled: 'SCHEDULED_CANCELED',
      scheduled_live: 'SCHEDULED_LIVE',
      scheduled_unpublished: 'SCHEDULED_UNPUBLISHED',
      unpublished: 'UNPUBLISHED'
    });
  }
  static get StereoscopicMode() {
    return Object.freeze({
      left_right: 'LEFT_RIGHT',
      mono: 'MONO',
      top_bottom: 'TOP_BOTTOM'
    });
  }
  static get StreamType() {
    return Object.freeze({
      ambient: 'AMBIENT',
      regular: 'REGULAR'
    });
  }
  static get BroadcastStatus() {
    return Object.freeze({
      live: 'LIVE',
      live_stopped: 'LIVE_STOPPED',
      processing: 'PROCESSING',
      scheduled_canceled: 'SCHEDULED_CANCELED',
      scheduled_expired: 'SCHEDULED_EXPIRED',
      scheduled_live: 'SCHEDULED_LIVE',
      scheduled_unpublished: 'SCHEDULED_UNPUBLISHED',
      unpublished: 'UNPUBLISHED',
      vod: 'VOD'
    });
  }
  static get Source() {
    return Object.freeze({
      owner: 'owner',
      target: 'target'
    });
  }
  static get LiveCommentModerationSetting() {
    return Object.freeze({
      default: 'DEFAULT',
      discussion: 'DISCUSSION',
      followed: 'FOLLOWED',
      follower: 'FOLLOWER',
      no_hyperlink: 'NO_HYPERLINK',
      protected_mode: 'PROTECTED_MODE',
      restricted: 'RESTRICTED',
      slow: 'SLOW',
      supporter: 'SUPPORTER',
      tagged: 'TAGGED'
    });
  }
  static get PersistentStreamKeyStatus() {
    return Object.freeze({
      disable: 'DISABLE',
      enable: 'ENABLE',
      regenerate: 'REGENERATE'
    });
  }
  getBlockedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(User, fields, params, fetchFirstPage, '/blocked_users');
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  getCrosspostSharedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/crosspost_shared_pages');
  }
  getCrosspostedBroadcasts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LiveVideo, fields, params, fetchFirstPage, '/crossposted_broadcasts');
  }
  getErrors(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LiveVideoError, fields, params, fetchFirstPage, '/errors');
  }
  createInputStream(fields, params = {}, pathOverride = null) {
    return this.createEdge('/input_streams', fields, params, LiveVideoInputStream, pathOverride);
  }
  getPolls(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VideoPoll, fields, params, fetchFirstPage, '/polls');
  }
  createPoll(fields, params = {}, pathOverride = null) {
    return this.createEdge('/polls', fields, params, VideoPoll, pathOverride);
  }
  getReactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/reactions');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Event
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Event extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      attending_count: 'attending_count',
      can_guests_invite: 'can_guests_invite',
      category: 'category',
      cover: 'cover',
      created_time: 'created_time',
      declined_count: 'declined_count',
      description: 'description',
      discount_code_enabled: 'discount_code_enabled',
      end_time: 'end_time',
      event_times: 'event_times',
      guest_list_enabled: 'guest_list_enabled',
      id: 'id',
      interested_count: 'interested_count',
      is_canceled: 'is_canceled',
      is_draft: 'is_draft',
      is_online: 'is_online',
      is_page_owned: 'is_page_owned',
      maybe_count: 'maybe_count',
      name: 'name',
      noreply_count: 'noreply_count',
      online_event_format: 'online_event_format',
      online_event_third_party_url: 'online_event_third_party_url',
      owner: 'owner',
      parent_group: 'parent_group',
      place: 'place',
      scheduled_publish_time: 'scheduled_publish_time',
      start_time: 'start_time',
      ticket_setting: 'ticket_setting',
      ticket_uri: 'ticket_uri',
      ticket_uri_start_sales_time: 'ticket_uri_start_sales_time',
      ticketing_privacy_uri: 'ticketing_privacy_uri',
      ticketing_terms_uri: 'ticketing_terms_uri',
      timezone: 'timezone',
      type: 'type',
      updated_time: 'updated_time'
    });
  }
  static get Category() {
    return Object.freeze({
      classic_literature: 'CLASSIC_LITERATURE',
      comedy: 'COMEDY',
      crafts: 'CRAFTS',
      dance: 'DANCE',
      drinks: 'DRINKS',
      fitness_and_workouts: 'FITNESS_AND_WORKOUTS',
      foods: 'FOODS',
      games: 'GAMES',
      gardening: 'GARDENING',
      healthy_living_and_self_care: 'HEALTHY_LIVING_AND_SELF_CARE',
      health_and_medical: 'HEALTH_AND_MEDICAL',
      home_and_garden: 'HOME_AND_GARDEN',
      music_and_audio: 'MUSIC_AND_AUDIO',
      parties: 'PARTIES',
      professional_networking: 'PROFESSIONAL_NETWORKING',
      religions: 'RELIGIONS',
      shopping_event: 'SHOPPING_EVENT',
      social_issues: 'SOCIAL_ISSUES',
      sports: 'SPORTS',
      theater: 'THEATER',
      tv_and_movies: 'TV_AND_MOVIES',
      visual_arts: 'VISUAL_ARTS'
    });
  }
  static get OnlineEventFormat() {
    return Object.freeze({
      fb_live: 'fb_live',
      messenger_room: 'messenger_room',
      none: 'none',
      other: 'other',
      third_party: 'third_party'
    });
  }
  static get Type() {
    return Object.freeze({
      community: 'community',
      friends: 'friends',
      group: 'group',
      private: 'private',
      public: 'public',
      work_company: 'work_company'
    });
  }
  static get EventStateFilter() {
    return Object.freeze({
      canceled: 'canceled',
      draft: 'draft',
      published: 'published',
      scheduled_draft_for_publication: 'scheduled_draft_for_publication'
    });
  }
  static get TimeFilter() {
    return Object.freeze({
      past: 'past',
      upcoming: 'upcoming'
    });
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/comments');
  }
  getFeed(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/feed');
  }
  getLiveVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/live_videos');
  }
  createLiveVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/live_videos', fields, params, LiveVideo, pathOverride);
  }
  getPhotos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/photos');
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/picture');
  }
  getPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/posts');
  }
  getRoles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/roles');
  }
  getTicketTiers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ticket_tiers');
  }
  getVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/videos');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ImageCopyright
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ImageCopyright extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      artist: 'artist',
      copyright_monitoring_status: 'copyright_monitoring_status',
      creation_time: 'creation_time',
      creator: 'creator',
      custom_id: 'custom_id',
      description: 'description',
      filename: 'filename',
      id: 'id',
      image: 'image',
      matches_count: 'matches_count',
      original_content_creation_date: 'original_content_creation_date',
      ownership_countries: 'ownership_countries',
      tags: 'tags',
      title: 'title',
      update_time: 'update_time'
    });
  }
  static get GeoOwnership() {
    return Object.freeze({
      ad: 'AD',
      ae: 'AE',
      af: 'AF',
      ag: 'AG',
      ai: 'AI',
      al: 'AL',
      am: 'AM',
      an: 'AN',
      ao: 'AO',
      aq: 'AQ',
      ar: 'AR',
      as: 'AS',
      at: 'AT',
      au: 'AU',
      aw: 'AW',
      ax: 'AX',
      az: 'AZ',
      ba: 'BA',
      bb: 'BB',
      bd: 'BD',
      be: 'BE',
      bf: 'BF',
      bg: 'BG',
      bh: 'BH',
      bi: 'BI',
      bj: 'BJ',
      bl: 'BL',
      bm: 'BM',
      bn: 'BN',
      bo: 'BO',
      bq: 'BQ',
      br: 'BR',
      bs: 'BS',
      bt: 'BT',
      bv: 'BV',
      bw: 'BW',
      by: 'BY',
      bz: 'BZ',
      ca: 'CA',
      cc: 'CC',
      cd: 'CD',
      cf: 'CF',
      cg: 'CG',
      ch: 'CH',
      ci: 'CI',
      ck: 'CK',
      cl: 'CL',
      cm: 'CM',
      cn: 'CN',
      co: 'CO',
      cr: 'CR',
      cu: 'CU',
      cv: 'CV',
      cw: 'CW',
      cx: 'CX',
      cy: 'CY',
      cz: 'CZ',
      de: 'DE',
      dj: 'DJ',
      dk: 'DK',
      dm: 'DM',
      do: 'DO',
      dz: 'DZ',
      ec: 'EC',
      ee: 'EE',
      eg: 'EG',
      eh: 'EH',
      er: 'ER',
      es: 'ES',
      et: 'ET',
      fi: 'FI',
      fj: 'FJ',
      fk: 'FK',
      fm: 'FM',
      fo: 'FO',
      fr: 'FR',
      ga: 'GA',
      gb: 'GB',
      gd: 'GD',
      ge: 'GE',
      gf: 'GF',
      gg: 'GG',
      gh: 'GH',
      gi: 'GI',
      gl: 'GL',
      gm: 'GM',
      gn: 'GN',
      gp: 'GP',
      gq: 'GQ',
      gr: 'GR',
      gs: 'GS',
      gt: 'GT',
      gu: 'GU',
      gw: 'GW',
      gy: 'GY',
      hk: 'HK',
      hm: 'HM',
      hn: 'HN',
      hr: 'HR',
      ht: 'HT',
      hu: 'HU',
      id: 'ID',
      ie: 'IE',
      il: 'IL',
      im: 'IM',
      in: 'IN',
      io: 'IO',
      iq: 'IQ',
      ir: 'IR',
      is: 'IS',
      it: 'IT',
      je: 'JE',
      jm: 'JM',
      jo: 'JO',
      jp: 'JP',
      ke: 'KE',
      kg: 'KG',
      kh: 'KH',
      ki: 'KI',
      km: 'KM',
      kn: 'KN',
      kp: 'KP',
      kr: 'KR',
      kw: 'KW',
      ky: 'KY',
      kz: 'KZ',
      la: 'LA',
      lb: 'LB',
      lc: 'LC',
      li: 'LI',
      lk: 'LK',
      lr: 'LR',
      ls: 'LS',
      lt: 'LT',
      lu: 'LU',
      lv: 'LV',
      ly: 'LY',
      ma: 'MA',
      mc: 'MC',
      md: 'MD',
      me: 'ME',
      mf: 'MF',
      mg: 'MG',
      mh: 'MH',
      mk: 'MK',
      ml: 'ML',
      mm: 'MM',
      mn: 'MN',
      mo: 'MO',
      mp: 'MP',
      mq: 'MQ',
      mr: 'MR',
      ms: 'MS',
      mt: 'MT',
      mu: 'MU',
      mv: 'MV',
      mw: 'MW',
      mx: 'MX',
      my: 'MY',
      mz: 'MZ',
      na: 'NA',
      nc: 'NC',
      ne: 'NE',
      nf: 'NF',
      ng: 'NG',
      ni: 'NI',
      nl: 'NL',
      no: 'NO',
      np: 'NP',
      nr: 'NR',
      nu: 'NU',
      nz: 'NZ',
      om: 'OM',
      pa: 'PA',
      pe: 'PE',
      pf: 'PF',
      pg: 'PG',
      ph: 'PH',
      pk: 'PK',
      pl: 'PL',
      pm: 'PM',
      pn: 'PN',
      pr: 'PR',
      ps: 'PS',
      pt: 'PT',
      pw: 'PW',
      py: 'PY',
      qa: 'QA',
      re: 'RE',
      ro: 'RO',
      rs: 'RS',
      ru: 'RU',
      rw: 'RW',
      sa: 'SA',
      sb: 'SB',
      sc: 'SC',
      sd: 'SD',
      se: 'SE',
      sg: 'SG',
      sh: 'SH',
      si: 'SI',
      sj: 'SJ',
      sk: 'SK',
      sl: 'SL',
      sm: 'SM',
      sn: 'SN',
      so: 'SO',
      sr: 'SR',
      ss: 'SS',
      st: 'ST',
      sv: 'SV',
      sx: 'SX',
      sy: 'SY',
      sz: 'SZ',
      tc: 'TC',
      td: 'TD',
      tf: 'TF',
      tg: 'TG',
      th: 'TH',
      tj: 'TJ',
      tk: 'TK',
      tl: 'TL',
      tm: 'TM',
      tn: 'TN',
      to: 'TO',
      tp: 'TP',
      tr: 'TR',
      tt: 'TT',
      tv: 'TV',
      tw: 'TW',
      tz: 'TZ',
      ua: 'UA',
      ug: 'UG',
      um: 'UM',
      us: 'US',
      uy: 'UY',
      uz: 'UZ',
      va: 'VA',
      vc: 'VC',
      ve: 'VE',
      vg: 'VG',
      vi: 'VI',
      vn: 'VN',
      vu: 'VU',
      wf: 'WF',
      ws: 'WS',
      xk: 'XK',
      ye: 'YE',
      yt: 'YT',
      za: 'ZA',
      zm: 'ZM',
      zw: 'ZW'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InstantArticleInsightsQueryResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InstantArticleInsightsQueryResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      breakdowns: 'breakdowns',
      name: 'name',
      time: 'time',
      value: 'value'
    });
  }
  static get Breakdown() {
    return Object.freeze({
      age: 'age',
      country: 'country',
      gender: 'gender',
      gender_and_age: 'gender_and_age',
      is_organic: 'is_organic',
      is_shared_by_ia_owner: 'is_shared_by_ia_owner',
      no_breakdown: 'no_breakdown',
      platform: 'platform',
      region: 'region'
    });
  }
  static get Period() {
    return Object.freeze({
      day: 'day',
      days_28: 'days_28',
      lifetime: 'lifetime',
      month: 'month',
      total_over_range: 'total_over_range',
      week: 'week'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InstantArticle
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InstantArticle extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      canonical_url: 'canonical_url',
      development_mode: 'development_mode',
      html_source: 'html_source',
      id: 'id',
      most_recent_import_status: 'most_recent_import_status',
      photos: 'photos',
      publish_status: 'publish_status',
      published: 'published',
      videos: 'videos'
    });
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstantArticleInsightsQueryResult, fields, params, fetchFirstPage, '/insights');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InstantArticlesStats
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InstantArticlesStats extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      error: 'error',
      metadata: 'metadata',
      metric: 'metric',
      totals: 'totals',
      x_axis_breakdown: 'x_axis_breakdown'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * LeadgenForm
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class LeadgenForm extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      allow_organic_lead: 'allow_organic_lead',
      block_display_for_non_targeted_viewer: 'block_display_for_non_targeted_viewer',
      context_card: 'context_card',
      created_time: 'created_time',
      creator: 'creator',
      expired_leads_count: 'expired_leads_count',
      follow_up_action_text: 'follow_up_action_text',
      follow_up_action_url: 'follow_up_action_url',
      id: 'id',
      is_optimized_for_quality: 'is_optimized_for_quality',
      leads_count: 'leads_count',
      legal_content: 'legal_content',
      locale: 'locale',
      name: 'name',
      organic_leads_count: 'organic_leads_count',
      page: 'page',
      page_id: 'page_id',
      privacy_policy_url: 'privacy_policy_url',
      question_page_custom_headline: 'question_page_custom_headline',
      questions: 'questions',
      status: 'status',
      thank_you_page: 'thank_you_page',
      tracking_parameters: 'tracking_parameters'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      archived: 'ARCHIVED',
      deleted: 'DELETED',
      draft: 'DRAFT'
    });
  }
  static get Locale() {
    return Object.freeze({
      ar_ar: 'AR_AR',
      cs_cz: 'CS_CZ',
      da_dk: 'DA_DK',
      de_de: 'DE_DE',
      el_gr: 'EL_GR',
      en_gb: 'EN_GB',
      en_us: 'EN_US',
      es_es: 'ES_ES',
      es_la: 'ES_LA',
      fi_fi: 'FI_FI',
      fr_fr: 'FR_FR',
      he_il: 'HE_IL',
      hi_in: 'HI_IN',
      hu_hu: 'HU_HU',
      id_id: 'ID_ID',
      it_it: 'IT_IT',
      ja_jp: 'JA_JP',
      ko_kr: 'KO_KR',
      nb_no: 'NB_NO',
      nl_nl: 'NL_NL',
      pl_pl: 'PL_PL',
      pt_br: 'PT_BR',
      pt_pt: 'PT_PT',
      ro_ro: 'RO_RO',
      ru_ru: 'RU_RU',
      sv_se: 'SV_SE',
      th_th: 'TH_TH',
      tr_tr: 'TR_TR',
      vi_vn: 'VI_VN',
      zh_cn: 'ZH_CN',
      zh_hk: 'ZH_HK',
      zh_tw: 'ZH_TW'
    });
  }
  getLeads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Lead, fields, params, fetchFirstPage, '/leads');
  }
  getTestLeads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Lead, fields, params, fetchFirstPage, '/test_leads');
  }
  createTestLead(fields, params = {}, pathOverride = null) {
    return this.createEdge('/test_leads', fields, params, Lead, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * MediaFingerprint
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class MediaFingerprint extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      duration_in_sec: 'duration_in_sec',
      fingerprint_content_type: 'fingerprint_content_type',
      fingerprint_type: 'fingerprint_type',
      id: 'id',
      metadata: 'metadata',
      title: 'title',
      universal_content_id: 'universal_content_id'
    });
  }
  static get FingerprintContentType() {
    return Object.freeze({
      am_songtrack: 'AM_SONGTRACK',
      episode: 'EPISODE',
      movie: 'MOVIE',
      other: 'OTHER',
      songtrack: 'SONGTRACK'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * MessagingFeatureReview
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class MessagingFeatureReview extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      feature: 'feature',
      status: 'status'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * MessengerProfile
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class MessengerProfile extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_linking_url: 'account_linking_url',
      get_started: 'get_started',
      greeting: 'greeting',
      ice_breakers: 'ice_breakers',
      payment_settings: 'payment_settings',
      persistent_menu: 'persistent_menu',
      subject_to_new_eu_privacy_rules: 'subject_to_new_eu_privacy_rules',
      target_audience: 'target_audience',
      whitelisted_domains: 'whitelisted_domains'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * UserPageOneTimeOptInTokenSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class UserPageOneTimeOptInTokenSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      creation_timestamp: 'creation_timestamp',
      notification_messages_frequency: 'notification_messages_frequency',
      notification_messages_reoptin: 'notification_messages_reoptin',
      notification_messages_timezone: 'notification_messages_timezone',
      notification_messages_token: 'notification_messages_token',
      recipient_id: 'recipient_id',
      token_expiry_timestamp: 'token_expiry_timestamp',
      topic_title: 'topic_title',
      user_token_status: 'user_token_status',
      id: 'id'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Persona
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Persona extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      profile_picture_url: 'profile_picture_url'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Recommendation
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Recommendation extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      created_time: 'created_time',
      has_rating: 'has_rating',
      has_review: 'has_review',
      open_graph_story: 'open_graph_story',
      rating: 'rating',
      recommendation_type: 'recommendation_type',
      review_text: 'review_text',
      reviewer: 'reviewer'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PageSettings
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PageSettings extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      setting: 'setting',
      value: 'value'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Tab
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Tab extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      application: 'application',
      custom_image_url: 'custom_image_url',
      custom_name: 'custom_name',
      id: 'id',
      image_url: 'image_url',
      is_non_connection_landing_tab: 'is_non_connection_landing_tab',
      is_permanent: 'is_permanent',
      link: 'link',
      name: 'name',
      position: 'position'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PageThreadOwner
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PageThreadOwner extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      thread_owner: 'thread_owner'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VideoCopyrightRule
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VideoCopyrightRule extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      condition_groups: 'condition_groups',
      copyrights: 'copyrights',
      created_date: 'created_date',
      creator: 'creator',
      id: 'id',
      is_in_migration: 'is_in_migration',
      name: 'name'
    });
  }
  static get Source() {
    return Object.freeze({
      match_settings_dialog: 'MATCH_SETTINGS_DIALOG',
      rules_selector: 'RULES_SELECTOR',
      rules_tab: 'RULES_TAB'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VideoCopyright
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VideoCopyright extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      content_category: 'content_category',
      copyright_content_id: 'copyright_content_id',
      creator: 'creator',
      excluded_ownership_segments: 'excluded_ownership_segments',
      id: 'id',
      in_conflict: 'in_conflict',
      monitoring_status: 'monitoring_status',
      monitoring_type: 'monitoring_type',
      ownership_countries: 'ownership_countries',
      reference_file: 'reference_file',
      reference_file_disabled: 'reference_file_disabled',
      reference_file_disabled_by_ops: 'reference_file_disabled_by_ops',
      reference_owner_id: 'reference_owner_id',
      rule_ids: 'rule_ids',
      tags: 'tags',
      whitelisted_ids: 'whitelisted_ids'
    });
  }
  static get ContentCategory() {
    return Object.freeze({
      episode: 'episode',
      movie: 'movie',
      web: 'web'
    });
  }
  static get MonitoringType() {
    return Object.freeze({
      audio_only: 'AUDIO_ONLY',
      video_and_audio: 'VIDEO_AND_AUDIO',
      video_only: 'VIDEO_ONLY'
    });
  }
  getUpdateRecords(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/update_records');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * VideoList
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class VideoList extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      creation_time: 'creation_time',
      description: 'description',
      id: 'id',
      last_modified: 'last_modified',
      owner: 'owner',
      season_number: 'season_number',
      thumbnail: 'thumbnail',
      title: 'title',
      videos_count: 'videos_count'
    });
  }
  getVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/videos');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Page
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Page extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      about: 'about',
      access_token: 'access_token',
      ad_campaign: 'ad_campaign',
      affiliation: 'affiliation',
      app_id: 'app_id',
      artists_we_like: 'artists_we_like',
      attire: 'attire',
      awards: 'awards',
      band_interests: 'band_interests',
      band_members: 'band_members',
      best_page: 'best_page',
      bio: 'bio',
      birthday: 'birthday',
      booking_agent: 'booking_agent',
      built: 'built',
      business: 'business',
      can_checkin: 'can_checkin',
      can_post: 'can_post',
      category: 'category',
      category_list: 'category_list',
      checkins: 'checkins',
      company_overview: 'company_overview',
      connected_instagram_account: 'connected_instagram_account',
      connected_page_backed_instagram_account: 'connected_page_backed_instagram_account',
      contact_address: 'contact_address',
      copyright_whitelisted_ig_partners: 'copyright_whitelisted_ig_partners',
      country_page_likes: 'country_page_likes',
      cover: 'cover',
      culinary_team: 'culinary_team',
      current_location: 'current_location',
      delivery_and_pickup_option_info: 'delivery_and_pickup_option_info',
      description: 'description',
      description_html: 'description_html',
      differently_open_offerings: 'differently_open_offerings',
      directed_by: 'directed_by',
      display_subtext: 'display_subtext',
      displayed_message_response_time: 'displayed_message_response_time',
      emails: 'emails',
      engagement: 'engagement',
      fan_count: 'fan_count',
      featured_video: 'featured_video',
      features: 'features',
      followers_count: 'followers_count',
      food_styles: 'food_styles',
      founded: 'founded',
      general_info: 'general_info',
      general_manager: 'general_manager',
      genre: 'genre',
      global_brand_page_name: 'global_brand_page_name',
      global_brand_root_id: 'global_brand_root_id',
      has_added_app: 'has_added_app',
      has_transitioned_to_new_page_experience: 'has_transitioned_to_new_page_experience',
      has_whatsapp_business_number: 'has_whatsapp_business_number',
      has_whatsapp_number: 'has_whatsapp_number',
      hometown: 'hometown',
      hours: 'hours',
      id: 'id',
      impressum: 'impressum',
      influences: 'influences',
      instagram_business_account: 'instagram_business_account',
      instant_articles_review_status: 'instant_articles_review_status',
      is_always_open: 'is_always_open',
      is_chain: 'is_chain',
      is_community_page: 'is_community_page',
      is_eligible_for_branded_content: 'is_eligible_for_branded_content',
      is_messenger_bot_get_started_enabled: 'is_messenger_bot_get_started_enabled',
      is_messenger_platform_bot: 'is_messenger_platform_bot',
      is_owned: 'is_owned',
      is_permanently_closed: 'is_permanently_closed',
      is_published: 'is_published',
      is_unclaimed: 'is_unclaimed',
      is_verified: 'is_verified',
      is_webhooks_subscribed: 'is_webhooks_subscribed',
      keywords: 'keywords',
      leadgen_tos_acceptance_time: 'leadgen_tos_acceptance_time',
      leadgen_tos_accepted: 'leadgen_tos_accepted',
      leadgen_tos_accepting_user: 'leadgen_tos_accepting_user',
      link: 'link',
      location: 'location',
      members: 'members',
      merchant_id: 'merchant_id',
      merchant_review_status: 'merchant_review_status',
      messaging_feature_status: 'messaging_feature_status',
      messenger_ads_default_icebreakers: 'messenger_ads_default_icebreakers',
      messenger_ads_default_page_welcome_message: 'messenger_ads_default_page_welcome_message',
      messenger_ads_default_quick_replies: 'messenger_ads_default_quick_replies',
      messenger_ads_quick_replies_type: 'messenger_ads_quick_replies_type',
      mini_shop_storefront: 'mini_shop_storefront',
      mission: 'mission',
      mpg: 'mpg',
      name: 'name',
      name_with_location_descriptor: 'name_with_location_descriptor',
      network: 'network',
      new_like_count: 'new_like_count',
      offer_eligible: 'offer_eligible',
      overall_star_rating: 'overall_star_rating',
      owner_business: 'owner_business',
      page_token: 'page_token',
      parent_page: 'parent_page',
      parking: 'parking',
      payment_options: 'payment_options',
      personal_info: 'personal_info',
      personal_interests: 'personal_interests',
      pharma_safety_info: 'pharma_safety_info',
      phone: 'phone',
      pickup_options: 'pickup_options',
      place_type: 'place_type',
      plot_outline: 'plot_outline',
      preferred_audience: 'preferred_audience',
      press_contact: 'press_contact',
      price_range: 'price_range',
      privacy_info_url: 'privacy_info_url',
      produced_by: 'produced_by',
      products: 'products',
      promotion_eligible: 'promotion_eligible',
      promotion_ineligible_reason: 'promotion_ineligible_reason',
      public_transit: 'public_transit',
      rating_count: 'rating_count',
      recipient: 'recipient',
      record_label: 'record_label',
      release_date: 'release_date',
      restaurant_services: 'restaurant_services',
      restaurant_specialties: 'restaurant_specialties',
      schedule: 'schedule',
      screenplay_by: 'screenplay_by',
      season: 'season',
      single_line_address: 'single_line_address',
      starring: 'starring',
      start_info: 'start_info',
      store_code: 'store_code',
      store_location_descriptor: 'store_location_descriptor',
      store_number: 'store_number',
      studio: 'studio',
      supports_donate_button_in_live_video: 'supports_donate_button_in_live_video',
      supports_instant_articles: 'supports_instant_articles',
      talking_about_count: 'talking_about_count',
      temporary_status: 'temporary_status',
      unread_message_count: 'unread_message_count',
      unread_notif_count: 'unread_notif_count',
      unseen_message_count: 'unseen_message_count',
      username: 'username',
      verification_status: 'verification_status',
      voip_info: 'voip_info',
      website: 'website',
      were_here_count: 'were_here_count',
      whatsapp_number: 'whatsapp_number',
      written_by: 'written_by'
    });
  }
  static get Attire() {
    return Object.freeze({
      casual: 'Casual',
      dressy: 'Dressy',
      unspecified: 'Unspecified'
    });
  }
  static get FoodStyles() {
    return Object.freeze({
      afghani: 'Afghani',
      american_new_: 'American (New)',
      american_traditional_: 'American (Traditional)',
      asian_fusion: 'Asian Fusion',
      barbeque: 'Barbeque',
      brazilian: 'Brazilian',
      breakfast: 'Breakfast',
      british: 'British',
      brunch: 'Brunch',
      buffets: 'Buffets',
      burgers: 'Burgers',
      burmese: 'Burmese',
      cajun_creole: 'Cajun/Creole',
      caribbean: 'Caribbean',
      chinese: 'Chinese',
      creperies: 'Creperies',
      cuban: 'Cuban',
      delis: 'Delis',
      diners: 'Diners',
      ethiopian: 'Ethiopian',
      fast_food: 'Fast Food',
      filipino: 'Filipino',
      fondue: 'Fondue',
      food_stands: 'Food Stands',
      french: 'French',
      german: 'German',
      greek_and_mediterranean: 'Greek and Mediterranean',
      hawaiian: 'Hawaiian',
      himalayan_nepalese: 'Himalayan/Nepalese',
      hot_dogs: 'Hot Dogs',
      indian_pakistani: 'Indian/Pakistani',
      irish: 'Irish',
      italian: 'Italian',
      japanese: 'Japanese',
      korean: 'Korean',
      latin_american: 'Latin American',
      mexican: 'Mexican',
      middle_eastern: 'Middle Eastern',
      moroccan: 'Moroccan',
      pizza: 'Pizza',
      russian: 'Russian',
      sandwiches: 'Sandwiches',
      seafood: 'Seafood',
      singaporean: 'Singaporean',
      soul_food: 'Soul Food',
      southern: 'Southern',
      spanish_basque: 'Spanish/Basque',
      steakhouses: 'Steakhouses',
      sushi_bars: 'Sushi Bars',
      taiwanese: 'Taiwanese',
      tapas_bars: 'Tapas Bars',
      tex_mex: 'Tex-Mex',
      thai: 'Thai',
      turkish: 'Turkish',
      vegan: 'Vegan',
      vegetarian: 'Vegetarian',
      vietnamese: 'Vietnamese'
    });
  }
  static get PickupOptions() {
    return Object.freeze({
      curbside: 'CURBSIDE',
      in_store: 'IN_STORE',
      other: 'OTHER'
    });
  }
  static get TemporaryStatus() {
    return Object.freeze({
      differently_open: 'DIFFERENTLY_OPEN',
      no_data: 'NO_DATA',
      operating_as_usual: 'OPERATING_AS_USUAL',
      temporarily_closed: 'TEMPORARILY_CLOSED'
    });
  }
  static get PermittedTasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      cashier_role: 'CASHIER_ROLE',
      create_content: 'CREATE_CONTENT',
      manage: 'MANAGE',
      manage_jobs: 'MANAGE_JOBS',
      manage_leads: 'MANAGE_LEADS',
      messaging: 'MESSAGING',
      moderate: 'MODERATE',
      moderate_community: 'MODERATE_COMMUNITY',
      pages_messaging: 'PAGES_MESSAGING',
      pages_messaging_subscriptions: 'PAGES_MESSAGING_SUBSCRIPTIONS',
      profile_plus_advertise: 'PROFILE_PLUS_ADVERTISE',
      profile_plus_analyze: 'PROFILE_PLUS_ANALYZE',
      profile_plus_create_content: 'PROFILE_PLUS_CREATE_CONTENT',
      profile_plus_facebook_access: 'PROFILE_PLUS_FACEBOOK_ACCESS',
      profile_plus_full_control: 'PROFILE_PLUS_FULL_CONTROL',
      profile_plus_manage: 'PROFILE_PLUS_MANAGE',
      profile_plus_manage_leads: 'PROFILE_PLUS_MANAGE_LEADS',
      profile_plus_messaging: 'PROFILE_PLUS_MESSAGING',
      profile_plus_moderate: 'PROFILE_PLUS_MODERATE',
      profile_plus_moderate_delegate_community: 'PROFILE_PLUS_MODERATE_DELEGATE_COMMUNITY',
      profile_plus_revenue: 'PROFILE_PLUS_REVENUE',
      read_page_mailboxes: 'READ_PAGE_MAILBOXES',
      view_monetization_insights: 'VIEW_MONETIZATION_INSIGHTS'
    });
  }
  static get Tasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      cashier_role: 'CASHIER_ROLE',
      create_content: 'CREATE_CONTENT',
      manage: 'MANAGE',
      manage_jobs: 'MANAGE_JOBS',
      manage_leads: 'MANAGE_LEADS',
      messaging: 'MESSAGING',
      moderate: 'MODERATE',
      moderate_community: 'MODERATE_COMMUNITY',
      pages_messaging: 'PAGES_MESSAGING',
      pages_messaging_subscriptions: 'PAGES_MESSAGING_SUBSCRIPTIONS',
      profile_plus_advertise: 'PROFILE_PLUS_ADVERTISE',
      profile_plus_analyze: 'PROFILE_PLUS_ANALYZE',
      profile_plus_create_content: 'PROFILE_PLUS_CREATE_CONTENT',
      profile_plus_facebook_access: 'PROFILE_PLUS_FACEBOOK_ACCESS',
      profile_plus_full_control: 'PROFILE_PLUS_FULL_CONTROL',
      profile_plus_manage: 'PROFILE_PLUS_MANAGE',
      profile_plus_manage_leads: 'PROFILE_PLUS_MANAGE_LEADS',
      profile_plus_messaging: 'PROFILE_PLUS_MESSAGING',
      profile_plus_moderate: 'PROFILE_PLUS_MODERATE',
      profile_plus_moderate_delegate_community: 'PROFILE_PLUS_MODERATE_DELEGATE_COMMUNITY',
      profile_plus_revenue: 'PROFILE_PLUS_REVENUE',
      read_page_mailboxes: 'READ_PAGE_MAILBOXES',
      view_monetization_insights: 'VIEW_MONETIZATION_INSIGHTS'
    });
  }
  static get Alignment() {
    return Object.freeze({
      left: 'LEFT',
      right: 'RIGHT'
    });
  }
  static get EntryPointIcon() {
    return Object.freeze({
      chat_angular_icon: 'CHAT_ANGULAR_ICON',
      chat_round_icon: 'CHAT_ROUND_ICON',
      messenger_icon: 'MESSENGER_ICON',
      none: 'NONE'
    });
  }
  static get EntryPointLabel() {
    return Object.freeze({
      ask_us: 'ASK_US',
      chat: 'CHAT',
      help: 'HELP',
      none: 'NONE'
    });
  }
  static get GreetingDialogDisplay() {
    return Object.freeze({
      hide: 'HIDE',
      show: 'SHOW',
      welcome_message: 'WELCOME_MESSAGE'
    });
  }
  static get GuestChatMode() {
    return Object.freeze({
      disabled: 'DISABLED',
      enabled: 'ENABLED'
    });
  }
  static get MobileChatDisplay() {
    return Object.freeze({
      app_switch: 'APP_SWITCH',
      chat_tab: 'CHAT_TAB'
    });
  }
  static get BackdatedTimeGranularity() {
    return Object.freeze({
      day: 'day',
      hour: 'hour',
      min: 'min',
      month: 'month',
      none: 'none',
      year: 'year'
    });
  }
  static get CheckinEntryPoint() {
    return Object.freeze({
      branding_checkin: 'BRANDING_CHECKIN',
      branding_other: 'BRANDING_OTHER',
      branding_photo: 'BRANDING_PHOTO',
      branding_status: 'BRANDING_STATUS'
    });
  }
  static get Formatting() {
    return Object.freeze({
      markdown: 'MARKDOWN',
      plaintext: 'PLAINTEXT'
    });
  }
  static get PlaceAttachmentSetting() {
    return Object.freeze({
      value_1: '1',
      value_2: '2'
    });
  }
  static get PostSurfacesBlacklist() {
    return Object.freeze({
      value_1: '1',
      value_2: '2',
      value_3: '3',
      value_4: '4',
      value_5: '5'
    });
  }
  static get PostingToRedspace() {
    return Object.freeze({
      disabled: 'disabled',
      enabled: 'enabled'
    });
  }
  static get TargetSurface() {
    return Object.freeze({
      story: 'STORY',
      timeline: 'TIMELINE'
    });
  }
  static get UnpublishedContentType() {
    return Object.freeze({
      ads_post: 'ADS_POST',
      draft: 'DRAFT',
      inline_created: 'INLINE_CREATED',
      published: 'PUBLISHED',
      reviewable_branded_content: 'REVIEWABLE_BRANDED_CONTENT',
      scheduled: 'SCHEDULED',
      scheduled_recurring: 'SCHEDULED_RECURRING'
    });
  }
  static get PublishStatus() {
    return Object.freeze({
      draft: 'DRAFT',
      live: 'LIVE'
    });
  }
  static get MessagingType() {
    return Object.freeze({
      message_tag: 'MESSAGE_TAG',
      response: 'RESPONSE',
      update: 'UPDATE'
    });
  }
  static get NotificationType() {
    return Object.freeze({
      no_push: 'NO_PUSH',
      regular: 'REGULAR',
      silent_push: 'SILENT_PUSH'
    });
  }
  static get SenderAction() {
    return Object.freeze({
      mark_seen: 'MARK_SEEN',
      react: 'REACT',
      typing_off: 'TYPING_OFF',
      typing_on: 'TYPING_ON',
      unreact: 'UNREACT'
    });
  }
  static get Platform() {
    return Object.freeze({
      instagram: 'INSTAGRAM',
      messenger: 'MESSENGER'
    });
  }
  static get Model() {
    return Object.freeze({
      arabic: 'ARABIC',
      chinese: 'CHINESE',
      croatian: 'CROATIAN',
      custom: 'CUSTOM',
      danish: 'DANISH',
      dutch: 'DUTCH',
      english: 'ENGLISH',
      french_standard: 'FRENCH_STANDARD',
      georgian: 'GEORGIAN',
      german_standard: 'GERMAN_STANDARD',
      greek: 'GREEK',
      hebrew: 'HEBREW',
      hungarian: 'HUNGARIAN',
      irish: 'IRISH',
      italian_standard: 'ITALIAN_STANDARD',
      korean: 'KOREAN',
      norwegian_bokmal: 'NORWEGIAN_BOKMAL',
      polish: 'POLISH',
      portuguese: 'PORTUGUESE',
      romanian: 'ROMANIAN',
      spanish: 'SPANISH',
      swedish: 'SWEDISH',
      vietnamese: 'VIETNAMESE'
    });
  }
  static get DeveloperAction() {
    return Object.freeze({
      enable_followup_message: 'ENABLE_FOLLOWUP_MESSAGE',
      send_re_optin: 'SEND_RE_OPTIN'
    });
  }
  static get SubscribedFields() {
    return Object.freeze({
      affiliation: 'affiliation',
      attire: 'attire',
      awards: 'awards',
      bio: 'bio',
      birthday: 'birthday',
      category: 'category',
      checkins: 'checkins',
      company_overview: 'company_overview',
      conversations: 'conversations',
      culinary_team: 'culinary_team',
      current_location: 'current_location',
      description: 'description',
      email: 'email',
      feature_access_list: 'feature_access_list',
      feed: 'feed',
      founded: 'founded',
      general_info: 'general_info',
      general_manager: 'general_manager',
      hometown: 'hometown',
      hours: 'hours',
      inbox_labels: 'inbox_labels',
      invoice_access_invoice_change: 'invoice_access_invoice_change',
      invoice_access_invoice_draft_change: 'invoice_access_invoice_draft_change',
      invoice_access_onboarding_status_active: 'invoice_access_onboarding_status_active',
      leadgen: 'leadgen',
      leadgen_fat: 'leadgen_fat',
      live_videos: 'live_videos',
      local_delivery: 'local_delivery',
      location: 'location',
      mcom_invoice_change: 'mcom_invoice_change',
      members: 'members',
      mention: 'mention',
      merchant_review: 'merchant_review',
      message_deliveries: 'message_deliveries',
      message_echoes: 'message_echoes',
      message_mention: 'message_mention',
      message_reactions: 'message_reactions',
      message_reads: 'message_reads',
      messages: 'messages',
      messaging_account_linking: 'messaging_account_linking',
      messaging_appointments: 'messaging_appointments',
      messaging_checkout_updates: 'messaging_checkout_updates',
      messaging_customer_information: 'messaging_customer_information',
      messaging_direct_sends: 'messaging_direct_sends',
      messaging_fblogin_account_linking: 'messaging_fblogin_account_linking',
      messaging_feedback: 'messaging_feedback',
      messaging_game_plays: 'messaging_game_plays',
      messaging_handovers: 'messaging_handovers',
      messaging_optins: 'messaging_optins',
      messaging_optouts: 'messaging_optouts',
      messaging_payments: 'messaging_payments',
      messaging_policy_enforcement: 'messaging_policy_enforcement',
      messaging_postbacks: 'messaging_postbacks',
      messaging_pre_checkouts: 'messaging_pre_checkouts',
      messaging_referrals: 'messaging_referrals',
      mission: 'mission',
      name: 'name',
      page_about_story: 'page_about_story',
      page_change_proposal: 'page_change_proposal',
      page_upcoming_change: 'page_upcoming_change',
      parking: 'parking',
      payment_options: 'payment_options',
      personal_info: 'personal_info',
      personal_interests: 'personal_interests',
      phone: 'phone',
      picture: 'picture',
      price_range: 'price_range',
      product_review: 'product_review',
      products: 'products',
      public_transit: 'public_transit',
      publisher_subscriptions: 'publisher_subscriptions',
      ratings: 'ratings',
      registration: 'registration',
      standby: 'standby',
      user_action: 'user_action',
      video_text_question_responses: 'video_text_question_responses',
      videos: 'videos',
      website: 'website'
    });
  }
  createAcknowledgeOrder(fields, params = {}, pathOverride = null) {
    return this.createEdge('/acknowledge_orders', fields, params, Page, pathOverride);
  }
  getAdsPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/ads_posts');
  }
  deleteAgencies(params = {}) {
    return super.deleteEdge('/agencies', params);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  createAgency(fields, params = {}, pathOverride = null) {
    return this.createEdge('/agencies', fields, params, Page, pathOverride);
  }
  getAlbums(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Album, fields, params, fetchFirstPage, '/albums');
  }
  getArExperience(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ar_experience');
  }
  deleteAssignedUsers(params = {}) {
    return super.deleteEdge('/assigned_users', params);
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, Page, pathOverride);
  }
  deleteBlocked(params = {}) {
    return super.deleteEdge('/blocked', params);
  }
  getBlocked(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/blocked');
  }
  createBlocked(fields, params = {}, pathOverride = null) {
    return this.createEdge('/blocked', fields, params, null, pathOverride);
  }
  createBusinessDatum(fields, params = {}, pathOverride = null) {
    return this.createEdge('/business_data', fields, params, null, pathOverride);
  }
  getCallToActions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageCallToAction, fields, params, fetchFirstPage, '/call_to_actions');
  }
  getCanvasElements(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CanvasBodyElement, fields, params, fetchFirstPage, '/canvas_elements');
  }
  createCanvasElement(fields, params = {}, pathOverride = null) {
    return this.createEdge('/canvas_elements', fields, params, CanvasBodyElement, pathOverride);
  }
  getCanvases(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Canvas, fields, params, fetchFirstPage, '/canvases');
  }
  createCanvase(fields, params = {}, pathOverride = null) {
    return this.createEdge('/canvases', fields, params, Canvas, pathOverride);
  }
  getChatPlugin(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ChatPlugin, fields, params, fetchFirstPage, '/chat_plugin');
  }
  createChatPlugin(fields, params = {}, pathOverride = null) {
    return this.createEdge('/chat_plugin', fields, params, Page, pathOverride);
  }
  getClaimedUrls(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(URL, fields, params, fetchFirstPage, '/claimed_urls');
  }
  getCommerceEligibility(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageCommerceEligibility, fields, params, fetchFirstPage, '/commerce_eligibility');
  }
  getCommerceMerchantSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceMerchantSettings, fields, params, fetchFirstPage, '/commerce_merchant_settings');
  }
  getCommerceOrders(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceOrder, fields, params, fetchFirstPage, '/commerce_orders');
  }
  getCommercePayouts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommercePayout, fields, params, fetchFirstPage, '/commerce_payouts');
  }
  getCommerceTransactions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceOrderTransactionDetail, fields, params, fetchFirstPage, '/commerce_transactions');
  }
  getConversations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UnifiedThread, fields, params, fetchFirstPage, '/conversations');
  }
  createCopyrightManualClaim(fields, params = {}, pathOverride = null) {
    return this.createEdge('/copyright_manual_claims', fields, params, null, pathOverride);
  }
  getCrosspostWhitelistedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/crosspost_whitelisted_pages');
  }
  getCustomLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageUserMessageThreadLabel, fields, params, fetchFirstPage, '/custom_labels');
  }
  createCustomLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/custom_labels', fields, params, PageUserMessageThreadLabel, pathOverride);
  }
  deleteCustomUserSettings(params = {}) {
    return super.deleteEdge('/custom_user_settings', params);
  }
  getCustomUserSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomUserSettings, fields, params, fetchFirstPage, '/custom_user_settings');
  }
  createCustomUserSetting(fields, params = {}, pathOverride = null) {
    return this.createEdge('/custom_user_settings', fields, params, Page, pathOverride);
  }
  getEvents(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Event, fields, params, fetchFirstPage, '/events');
  }
  createExtendThreadControl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/extend_thread_control', fields, params, Page, pathOverride);
  }
  getFantasyGames(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/fantasy_games');
  }
  getFeed(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/feed');
  }
  createFeed(fields, params = {}, pathOverride = null) {
    return this.createEdge('/feed', fields, params, Page, pathOverride);
  }
  getGlobalBrandChildren(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/global_brand_children');
  }
  getGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Group, fields, params, fetchFirstPage, '/groups');
  }
  getImageCopyrights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ImageCopyright, fields, params, fetchFirstPage, '/image_copyrights');
  }
  createImageCopyright(fields, params = {}, pathOverride = null) {
    return this.createEdge('/image_copyrights', fields, params, ImageCopyright, pathOverride);
  }
  getIndexedVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/indexed_videos');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  getInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/instagram_accounts');
  }
  getInstantArticles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstantArticle, fields, params, fetchFirstPage, '/instant_articles');
  }
  createInstantArticle(fields, params = {}, pathOverride = null) {
    return this.createEdge('/instant_articles', fields, params, InstantArticle, pathOverride);
  }
  getInstantArticlesInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstantArticleInsightsQueryResult, fields, params, fetchFirstPage, '/instant_articles_insights');
  }
  createInstantArticlesPublish(fields, params = {}, pathOverride = null) {
    return this.createEdge('/instant_articles_publish', fields, params, Page, pathOverride);
  }
  getInstantArticlesStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstantArticlesStats, fields, params, fetchFirstPage, '/instant_articles_stats');
  }
  getInvoiceAccessBankAccount(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/invoice_access_bank_account');
  }
  getLeadGenForms(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LeadgenForm, fields, params, fetchFirstPage, '/leadgen_forms');
  }
  createLeadGenForm(fields, params = {}, pathOverride = null) {
    return this.createEdge('/leadgen_forms', fields, params, LeadgenForm, pathOverride);
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/likes');
  }
  getLiveVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LiveVideo, fields, params, fetchFirstPage, '/live_videos');
  }
  createLiveVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/live_videos', fields, params, LiveVideo, pathOverride);
  }
  deleteLocations(params = {}) {
    return super.deleteEdge('/locations', params);
  }
  getLocations(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/locations');
  }
  createLocation(fields, params = {}, pathOverride = null) {
    return this.createEdge('/locations', fields, params, Page, pathOverride);
  }
  getMediaFingerprints(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MediaFingerprint, fields, params, fetchFirstPage, '/media_fingerprints');
  }
  createMediaFingerprint(fields, params = {}, pathOverride = null) {
    return this.createEdge('/media_fingerprints', fields, params, MediaFingerprint, pathOverride);
  }
  createMessageAttachment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/message_attachments', fields, params, null, pathOverride);
  }
  createMessage(fields, params = {}, pathOverride = null) {
    return this.createEdge('/messages', fields, params, Page, pathOverride);
  }
  getMessagingFeatureReview(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MessagingFeatureReview, fields, params, fetchFirstPage, '/messaging_feature_review');
  }
  deleteMessengerProfile(params = {}) {
    return super.deleteEdge('/messenger_profile', params);
  }
  getMessengerProfile(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MessengerProfile, fields, params, fetchFirstPage, '/messenger_profile');
  }
  createMessengerProfile(fields, params = {}, pathOverride = null) {
    return this.createEdge('/messenger_profile', fields, params, Page, pathOverride);
  }
  createNlpConfig(fields, params = {}, pathOverride = null) {
    return this.createEdge('/nlp_configs', fields, params, Page, pathOverride);
  }
  getNotificationMessageTokens(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UserPageOneTimeOptInTokenSettings, fields, params, fetchFirstPage, '/notification_message_tokens');
  }
  createNotificationMessagesDevSupport(fields, params = {}, pathOverride = null) {
    return this.createEdge('/notification_messages_dev_support', fields, params, Page, pathOverride);
  }
  getPageBackedInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/page_backed_instagram_accounts');
  }
  createPageBackedInstagramAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/page_backed_instagram_accounts', fields, params, InstagramUser, pathOverride);
  }
  createPageWhatsappNumberVerification(fields, params = {}, pathOverride = null) {
    return this.createEdge('/page_whatsapp_number_verification', fields, params, Page, pathOverride);
  }
  createPassThreadControl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/pass_thread_control', fields, params, Page, pathOverride);
  }
  createPassThreadMetadatum(fields, params = {}, pathOverride = null) {
    return this.createEdge('/pass_thread_metadata', fields, params, Page, pathOverride);
  }
  getPersonas(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Persona, fields, params, fetchFirstPage, '/personas');
  }
  createPersona(fields, params = {}, pathOverride = null) {
    return this.createEdge('/personas', fields, params, Persona, pathOverride);
  }
  getPhotos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Photo, fields, params, fetchFirstPage, '/photos');
  }
  createPhoto(fields, params = {}, pathOverride = null) {
    return this.createEdge('/photos', fields, params, Photo, pathOverride);
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  createPicture(fields, params = {}, pathOverride = null) {
    return this.createEdge('/picture', fields, params, ProfilePictureSource, pathOverride);
  }
  getPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/posts');
  }
  getProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/product_catalogs');
  }
  getPublishedPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/published_posts');
  }
  getRatings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Recommendation, fields, params, fetchFirstPage, '/ratings');
  }
  createReleaseThreadControl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/release_thread_control', fields, params, Page, pathOverride);
  }
  createRequestThreadControl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/request_thread_control', fields, params, Page, pathOverride);
  }
  getRoles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(User, fields, params, fetchFirstPage, '/roles');
  }
  getRtbDynamicPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(RTBDynamicPost, fields, params, fetchFirstPage, '/rtb_dynamic_posts');
  }
  getScheduledPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/scheduled_posts');
  }
  getSecondaryReceivers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/secondary_receivers');
  }
  getSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageSettings, fields, params, fetchFirstPage, '/settings');
  }
  createSetting(fields, params = {}, pathOverride = null) {
    return this.createEdge('/settings', fields, params, Page, pathOverride);
  }
  getShopSetupStatus(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceMerchantSettingsSetupStatus, fields, params, fetchFirstPage, '/shop_setup_status');
  }
  deleteSubscribedApps(params = {}) {
    return super.deleteEdge('/subscribed_apps', params);
  }
  getSubscribedApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/subscribed_apps');
  }
  createSubscribedApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscribed_apps', fields, params, Page, pathOverride);
  }
  getTabs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Tab, fields, params, fetchFirstPage, '/tabs');
  }
  getTagged(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/tagged');
  }
  createTakeThreadControl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/take_thread_control', fields, params, Page, pathOverride);
  }
  getThreadOwner(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PageThreadOwner, fields, params, fetchFirstPage, '/thread_owner');
  }
  getThreads(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(UnifiedThread, fields, params, fetchFirstPage, '/threads');
  }
  createUnlinkAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/unlink_accounts', fields, params, Page, pathOverride);
  }
  getVideoCopyrightRules(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VideoCopyrightRule, fields, params, fetchFirstPage, '/video_copyright_rules');
  }
  createVideoCopyrightRule(fields, params = {}, pathOverride = null) {
    return this.createEdge('/video_copyright_rules', fields, params, VideoCopyrightRule, pathOverride);
  }
  createVideoCopyright(fields, params = {}, pathOverride = null) {
    return this.createEdge('/video_copyrights', fields, params, VideoCopyright, pathOverride);
  }
  getVideoLists(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(VideoList, fields, params, fetchFirstPage, '/video_lists');
  }
  getVideoReels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/video_reels');
  }
  createVideoReel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/video_reels', fields, params, AdVideo, pathOverride);
  }
  getVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/videos');
  }
  createVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/videos', fields, params, AdVideo, pathOverride);
  }
  getVisitorPosts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PagePost, fields, params, fetchFirstPage, '/visitor_posts');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Photo
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Photo extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      album: 'album',
      alt_text: 'alt_text',
      alt_text_custom: 'alt_text_custom',
      backdated_time: 'backdated_time',
      backdated_time_granularity: 'backdated_time_granularity',
      can_backdate: 'can_backdate',
      can_delete: 'can_delete',
      can_tag: 'can_tag',
      created_time: 'created_time',
      event: 'event',
      from: 'from',
      height: 'height',
      icon: 'icon',
      id: 'id',
      images: 'images',
      link: 'link',
      name: 'name',
      name_tags: 'name_tags',
      page_story_id: 'page_story_id',
      picture: 'picture',
      place: 'place',
      position: 'position',
      source: 'source',
      target: 'target',
      updated_time: 'updated_time',
      webp_images: 'webp_images',
      width: 'width'
    });
  }
  static get BackdatedTimeGranularity() {
    return Object.freeze({
      day: 'day',
      hour: 'hour',
      min: 'min',
      month: 'month',
      none: 'none',
      year: 'year'
    });
  }
  static get UnpublishedContentType() {
    return Object.freeze({
      ads_post: 'ADS_POST',
      draft: 'DRAFT',
      inline_created: 'INLINE_CREATED',
      published: 'PUBLISHED',
      reviewable_branded_content: 'REVIEWABLE_BRANDED_CONTENT',
      scheduled: 'SCHEDULED',
      scheduled_recurring: 'SCHEDULED_RECURRING'
    });
  }
  static get Type() {
    return Object.freeze({
      profile: 'profile',
      tagged: 'tagged',
      uploaded: 'uploaded'
    });
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, Comment, pathOverride);
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/likes');
  }
  createLike(fields, params = {}, pathOverride = null) {
    return this.createEdge('/likes', fields, params, Photo, pathOverride);
  }
  getSponsorTags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/sponsor_tags');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Album
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Album extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      backdated_time: 'backdated_time',
      backdated_time_granularity: 'backdated_time_granularity',
      can_backdate: 'can_backdate',
      can_upload: 'can_upload',
      count: 'count',
      cover_photo: 'cover_photo',
      created_time: 'created_time',
      description: 'description',
      edit_link: 'edit_link',
      event: 'event',
      from: 'from',
      id: 'id',
      is_user_facing: 'is_user_facing',
      link: 'link',
      location: 'location',
      modified_major: 'modified_major',
      name: 'name',
      photo_count: 'photo_count',
      place: 'place',
      privacy: 'privacy',
      type: 'type',
      updated_time: 'updated_time',
      video_count: 'video_count'
    });
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Comment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, Comment, pathOverride);
  }
  getLikes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Profile, fields, params, fetchFirstPage, '/likes');
  }
  createLike(fields, params = {}, pathOverride = null) {
    return this.createEdge('/likes', fields, params, Album, pathOverride);
  }
  getPhotos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Photo, fields, params, fetchFirstPage, '/photos');
  }
  createPhoto(fields, params = {}, pathOverride = null) {
    return this.createEdge('/photos', fields, params, Photo, pathOverride);
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Group
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Group extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      archived: 'archived',
      cover: 'cover',
      created_time: 'created_time',
      description: 'description',
      email: 'email',
      icon: 'icon',
      id: 'id',
      install: 'install',
      link: 'link',
      member_count: 'member_count',
      member_request_count: 'member_request_count',
      name: 'name',
      parent: 'parent',
      permissions: 'permissions',
      privacy: 'privacy',
      purpose: 'purpose',
      subdomain: 'subdomain',
      updated_time: 'updated_time',
      venue: 'venue'
    });
  }
  static get JoinSetting() {
    return Object.freeze({
      admin_only: 'ADMIN_ONLY',
      anyone: 'ANYONE',
      none: 'NONE'
    });
  }
  static get PostPermissions() {
    return Object.freeze({
      value_0: '0',
      value_1: '1',
      value_2: '2'
    });
  }
  static get Purpose() {
    return Object.freeze({
      casual: 'CASUAL',
      coworkers: 'COWORKERS',
      custom: 'CUSTOM',
      for_sale: 'FOR_SALE',
      for_work: 'FOR_WORK',
      game: 'GAME',
      health_support: 'HEALTH_SUPPORT',
      jobs: 'JOBS',
      learning: 'LEARNING',
      none: 'NONE',
      parenting: 'PARENTING',
      streamer: 'STREAMER',
      work_announcement: 'WORK_ANNOUNCEMENT',
      work_demo_group: 'WORK_DEMO_GROUP',
      work_discussion: 'WORK_DISCUSSION',
      work_ephemeral: 'WORK_EPHEMERAL',
      work_feedback: 'WORK_FEEDBACK',
      work_for_sale: 'WORK_FOR_SALE',
      work_garden: 'WORK_GARDEN',
      work_integrity: 'WORK_INTEGRITY',
      work_learning: 'WORK_LEARNING',
      work_mentorship: 'WORK_MENTORSHIP',
      work_multi_company: 'WORK_MULTI_COMPANY',
      work_recruiting: 'WORK_RECRUITING',
      work_social: 'WORK_SOCIAL',
      work_stages: 'WORK_STAGES',
      work_team: 'WORK_TEAM',
      work_teamwork: 'WORK_TEAMWORK'
    });
  }
  static get GroupType() {
    return Object.freeze({
      casual: 'CASUAL',
      coworkers: 'COWORKERS',
      custom: 'CUSTOM',
      for_sale: 'FOR_SALE',
      for_work: 'FOR_WORK',
      game: 'GAME',
      health_support: 'HEALTH_SUPPORT',
      jobs: 'JOBS',
      learning: 'LEARNING',
      none: 'NONE',
      parenting: 'PARENTING',
      streamer: 'STREAMER',
      work_announcement: 'WORK_ANNOUNCEMENT',
      work_demo_group: 'WORK_DEMO_GROUP',
      work_discussion: 'WORK_DISCUSSION',
      work_ephemeral: 'WORK_EPHEMERAL',
      work_feedback: 'WORK_FEEDBACK',
      work_for_sale: 'WORK_FOR_SALE',
      work_garden: 'WORK_GARDEN',
      work_integrity: 'WORK_INTEGRITY',
      work_learning: 'WORK_LEARNING',
      work_mentorship: 'WORK_MENTORSHIP',
      work_multi_company: 'WORK_MULTI_COMPANY',
      work_recruiting: 'WORK_RECRUITING',
      work_social: 'WORK_SOCIAL',
      work_stages: 'WORK_STAGES',
      work_team: 'WORK_TEAM',
      work_teamwork: 'WORK_TEAMWORK'
    });
  }
  deleteAdmins(params = {}) {
    return super.deleteEdge('/admins', params);
  }
  createAdmin(fields, params = {}, pathOverride = null) {
    return this.createEdge('/admins', fields, params, Group, pathOverride);
  }
  getAlbums(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Album, fields, params, fetchFirstPage, '/albums');
  }
  createAlbum(fields, params = {}, pathOverride = null) {
    return this.createEdge('/albums', fields, params, Album, pathOverride);
  }
  getAttachmentSurfaces(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/attachment_surfaces');
  }
  createAttachmentSurface(fields, params = {}, pathOverride = null) {
    return this.createEdge('/attachment_surfaces', fields, params, null, pathOverride);
  }
  getDocs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/docs');
  }
  getEvents(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Event, fields, params, fetchFirstPage, '/events');
  }
  getFeaturedCards(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/featured_cards');
  }
  createFeaturedCard(fields, params = {}, pathOverride = null) {
    return this.createEdge('/featured_cards', fields, params, null, pathOverride);
  }
  getFeed(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Post, fields, params, fetchFirstPage, '/feed');
  }
  createFeed(fields, params = {}, pathOverride = null) {
    return this.createEdge('/feed', fields, params, Post, pathOverride);
  }
  getFiles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/files');
  }
  getGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Group, fields, params, fetchFirstPage, '/groups');
  }
  createGroup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/groups', fields, params, Group, pathOverride);
  }
  getLiveVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(LiveVideo, fields, params, fetchFirstPage, '/live_videos');
  }
  createLiveVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/live_videos', fields, params, LiveVideo, pathOverride);
  }
  deleteMembers(params = {}) {
    return super.deleteEdge('/members', params);
  }
  createMember(fields, params = {}, pathOverride = null) {
    return this.createEdge('/members', fields, params, Group, pathOverride);
  }
  getOptedInMembers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(User, fields, params, fetchFirstPage, '/opted_in_members');
  }
  createPhoto(fields, params = {}, pathOverride = null) {
    return this.createEdge('/photos', fields, params, Photo, pathOverride);
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  createShiftSetting(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shift_settings', fields, params, null, pathOverride);
  }
  getVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/videos');
  }
  createVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/videos', fields, params, AdVideo, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Application
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Application extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      aam_rules: 'aam_rules',
      an_ad_space_limit: 'an_ad_space_limit',
      an_platforms: 'an_platforms',
      android_key_hash: 'android_key_hash',
      android_sdk_error_categories: 'android_sdk_error_categories',
      app_domains: 'app_domains',
      app_events_config: 'app_events_config',
      app_events_feature_bitmask: 'app_events_feature_bitmask',
      app_events_session_timeout: 'app_events_session_timeout',
      app_install_tracked: 'app_install_tracked',
      app_name: 'app_name',
      app_signals_binding_ios: 'app_signals_binding_ios',
      app_type: 'app_type',
      auth_dialog_data_help_url: 'auth_dialog_data_help_url',
      auth_dialog_headline: 'auth_dialog_headline',
      auth_dialog_perms_explanation: 'auth_dialog_perms_explanation',
      auth_referral_default_activity_privacy: 'auth_referral_default_activity_privacy',
      auth_referral_enabled: 'auth_referral_enabled',
      auth_referral_extended_perms: 'auth_referral_extended_perms',
      auth_referral_friend_perms: 'auth_referral_friend_perms',
      auth_referral_response_type: 'auth_referral_response_type',
      auth_referral_user_perms: 'auth_referral_user_perms',
      auto_event_mapping_android: 'auto_event_mapping_android',
      auto_event_mapping_ios: 'auto_event_mapping_ios',
      auto_event_setup_enabled: 'auto_event_setup_enabled',
      business: 'business',
      canvas_fluid_height: 'canvas_fluid_height',
      canvas_fluid_width: 'canvas_fluid_width',
      canvas_url: 'canvas_url',
      category: 'category',
      client_config: 'client_config',
      company: 'company',
      configured_ios_sso: 'configured_ios_sso',
      contact_email: 'contact_email',
      created_time: 'created_time',
      creator_uid: 'creator_uid',
      daily_active_users: 'daily_active_users',
      daily_active_users_rank: 'daily_active_users_rank',
      deauth_callback_url: 'deauth_callback_url',
      default_share_mode: 'default_share_mode',
      description: 'description',
      financial_id: 'financial_id',
      gdpv4_chrome_custom_tabs_enabled: 'gdpv4_chrome_custom_tabs_enabled',
      gdpv4_enabled: 'gdpv4_enabled',
      gdpv4_nux_content: 'gdpv4_nux_content',
      gdpv4_nux_enabled: 'gdpv4_nux_enabled',
      has_messenger_product: 'has_messenger_product',
      hosting_url: 'hosting_url',
      icon_url: 'icon_url',
      id: 'id',
      ios_bundle_id: 'ios_bundle_id',
      ios_sdk_dialog_flows: 'ios_sdk_dialog_flows',
      ios_sdk_error_categories: 'ios_sdk_error_categories',
      ios_sfvc_attr: 'ios_sfvc_attr',
      ios_supports_native_proxy_auth_flow: 'ios_supports_native_proxy_auth_flow',
      ios_supports_system_auth: 'ios_supports_system_auth',
      ipad_app_store_id: 'ipad_app_store_id',
      iphone_app_store_id: 'iphone_app_store_id',
      latest_sdk_version: 'latest_sdk_version',
      link: 'link',
      logging_token: 'logging_token',
      logo_url: 'logo_url',
      migrations: 'migrations',
      mobile_profile_section_url: 'mobile_profile_section_url',
      mobile_web_url: 'mobile_web_url',
      monthly_active_users: 'monthly_active_users',
      monthly_active_users_rank: 'monthly_active_users_rank',
      name: 'name',
      namespace: 'namespace',
      object_store_urls: 'object_store_urls',
      owner_business: 'owner_business',
      page_tab_default_name: 'page_tab_default_name',
      page_tab_url: 'page_tab_url',
      photo_url: 'photo_url',
      privacy_policy_url: 'privacy_policy_url',
      profile_section_url: 'profile_section_url',
      property_id: 'property_id',
      real_time_mode_devices: 'real_time_mode_devices',
      restrictions: 'restrictions',
      restrictive_data_filter_params: 'restrictive_data_filter_params',
      restrictive_data_filter_rules: 'restrictive_data_filter_rules',
      sdk_update_message: 'sdk_update_message',
      seamless_login: 'seamless_login',
      secure_canvas_url: 'secure_canvas_url',
      secure_page_tab_url: 'secure_page_tab_url',
      server_ip_whitelist: 'server_ip_whitelist',
      smart_login_bookmark_icon_url: 'smart_login_bookmark_icon_url',
      smart_login_menu_icon_url: 'smart_login_menu_icon_url',
      social_discovery: 'social_discovery',
      subcategory: 'subcategory',
      suggested_events_setting: 'suggested_events_setting',
      supported_platforms: 'supported_platforms',
      supports_apprequests_fast_app_switch: 'supports_apprequests_fast_app_switch',
      supports_attribution: 'supports_attribution',
      supports_implicit_sdk_logging: 'supports_implicit_sdk_logging',
      suppress_native_ios_gdp: 'suppress_native_ios_gdp',
      terms_of_service_url: 'terms_of_service_url',
      url_scheme_suffix: 'url_scheme_suffix',
      user_support_email: 'user_support_email',
      user_support_url: 'user_support_url',
      website_url: 'website_url',
      weekly_active_users: 'weekly_active_users'
    });
  }
  static get SupportedPlatforms() {
    return Object.freeze({
      amazon: 'AMAZON',
      android: 'ANDROID',
      canvas: 'CANVAS',
      gameroom: 'GAMEROOM',
      instant_game: 'INSTANT_GAME',
      ipad: 'IPAD',
      iphone: 'IPHONE',
      mobile_web: 'MOBILE_WEB',
      oculus: 'OCULUS',
      samsung: 'SAMSUNG',
      supplementary_images: 'SUPPLEMENTARY_IMAGES',
      web: 'WEB',
      windows: 'WINDOWS',
      xiaomi: 'XIAOMI'
    });
  }
  static get AnPlatforms() {
    return Object.freeze({
      android: 'ANDROID',
      desktop: 'DESKTOP',
      galaxy: 'GALAXY',
      instant_articles: 'INSTANT_ARTICLES',
      ios: 'IOS',
      mobile_web: 'MOBILE_WEB',
      oculus: 'OCULUS',
      unknown: 'UNKNOWN',
      xiaomi: 'XIAOMI'
    });
  }
  static get Platform() {
    return Object.freeze({
      android: 'ANDROID',
      ios: 'IOS'
    });
  }
  static get RequestType() {
    return Object.freeze({
      app_indexing: 'APP_INDEXING',
      button_sampling: 'BUTTON_SAMPLING',
      plugin: 'PLUGIN'
    });
  }
  static get MutationMethod() {
    return Object.freeze({
      add: 'ADD',
      delete: 'DELETE',
      replace: 'REPLACE'
    });
  }
  static get PostMethod() {
    return Object.freeze({
      codeless: 'CODELESS',
      eymt: 'EYMT'
    });
  }
  static get LoggingSource() {
    return Object.freeze({
      messenger_bot: 'MESSENGER_BOT'
    });
  }
  static get LoggingTarget() {
    return Object.freeze({
      app: 'APP',
      app_and_page: 'APP_AND_PAGE',
      page: 'PAGE'
    });
  }
  deleteAccounts(params = {}) {
    return super.deleteEdge('/accounts', params);
  }
  getAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/accounts');
  }
  createAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/accounts', fields, params, null, pathOverride);
  }
  createActivity(fields, params = {}, pathOverride = null) {
    return this.createEdge('/activities', fields, params, null, pathOverride);
  }
  getAdPlacementGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ad_placement_groups');
  }
  getAdNetworkPlacements(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPlacement, fields, params, fetchFirstPage, '/adnetwork_placements');
  }
  getAdNetworkAnalytics(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdNetworkAnalyticsSyncQueryResult, fields, params, fetchFirstPage, '/adnetworkanalytics');
  }
  createAdNetworkAnalytic(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adnetworkanalytics', fields, params, Application, pathOverride);
  }
  getAdNetworkAnalyticsResults(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdNetworkAnalyticsAsyncQueryResult, fields, params, fetchFirstPage, '/adnetworkanalytics_results');
  }
  getAemAttribution(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/aem_attribution');
  }
  getAemConversionConfigs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/aem_conversion_configs');
  }
  getAemConversionFilter(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/aem_conversion_filter');
  }
  createAemConversion(fields, params = {}, pathOverride = null) {
    return this.createEdge('/aem_conversions', fields, params, null, pathOverride);
  }
  createAemSkanReadiness(fields, params = {}, pathOverride = null) {
    return this.createEdge('/aem_skan_readiness', fields, params, null, pathOverride);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  createAggregateRevenue(fields, params = {}, pathOverride = null) {
    return this.createEdge('/aggregate_revenue', fields, params, null, pathOverride);
  }
  getAndroidDialogConfigs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/android_dialog_configs');
  }
  getAppCapiSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/app_capi_settings');
  }
  getAppEventTypes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/app_event_types');
  }
  createAppIndexing(fields, params = {}, pathOverride = null) {
    return this.createEdge('/app_indexing', fields, params, Application, pathOverride);
  }
  createAppIndexingSession(fields, params = {}, pathOverride = null) {
    return this.createEdge('/app_indexing_session', fields, params, Application, pathOverride);
  }
  getAppInstalledGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Group, fields, params, fetchFirstPage, '/app_installed_groups');
  }
  createAppPushDeviceToken(fields, params = {}, pathOverride = null) {
    return this.createEdge('/app_push_device_token', fields, params, Application, pathOverride);
  }
  getAppAssets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/appassets');
  }
  createAsset(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assets', fields, params, Application, pathOverride);
  }
  getAuthorizedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/authorized_adaccounts');
  }
  getButtonAutoDetectionDeviceSelection(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/button_auto_detection_device_selection');
  }
  getCloudbridgeSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/cloudbridge_settings');
  }
  createCodelessEventMapping(fields, params = {}, pathOverride = null) {
    return this.createEdge('/codeless_event_mappings', fields, params, Application, pathOverride);
  }
  getDaChecks(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(DACheck, fields, params, fetchFirstPage, '/da_checks');
  }
  getEvents(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Event, fields, params, fetchFirstPage, '/events');
  }
  getInsightsPushSchedule(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/insights_push_schedule');
  }
  getIosDialogConfigs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ios_dialog_configs');
  }
  createMmpAuditing(fields, params = {}, pathOverride = null) {
    return this.createEdge('/mmp_auditing', fields, params, null, pathOverride);
  }
  getMobileSdkGk(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/mobile_sdk_gk');
  }
  getMonetizedDigitalStoreObjects(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/monetized_digital_store_objects');
  }
  createMonetizedDigitalStoreObject(fields, params = {}, pathOverride = null) {
    return this.createEdge('/monetized_digital_store_objects', fields, params, null, pathOverride);
  }
  getObjectTypes(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(NullNode, fields, params, fetchFirstPage, '/object_types');
  }
  createOccludesPopup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/occludespopups', fields, params, null, pathOverride);
  }
  createPageActivity(fields, params = {}, pathOverride = null) {
    return this.createEdge('/page_activities', fields, params, Application, pathOverride);
  }
  createPaymentCurrency(fields, params = {}, pathOverride = null) {
    return this.createEdge('/payment_currencies', fields, params, Application, pathOverride);
  }
  getPermissions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/permissions');
  }
  getProducts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/products');
  }
  getPurchases(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/purchases');
  }
  getRoles(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/roles');
  }
  getSubscribedDomains(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/subscribed_domains');
  }
  createSubscribedDomain(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscribed_domains', fields, params, Application, pathOverride);
  }
  getSubscribedDomainsPhishing(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/subscribed_domains_phishing');
  }
  createSubscribedDomainsPhishing(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscribed_domains_phishing', fields, params, Application, pathOverride);
  }
  deleteSubscriptions(params = {}) {
    return super.deleteEdge('/subscriptions', params);
  }
  createSubscription(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscriptions', fields, params, null, pathOverride);
  }
  createUpload(fields, params = {}, pathOverride = null) {
    return this.createEdge('/uploads', fields, params, null, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * OmegaCustomerTrx
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class OmegaCustomerTrx extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_account_ids: 'ad_account_ids',
      advertiser_name: 'advertiser_name',
      amount: 'amount',
      amount_due: 'amount_due',
      billed_amount_details: 'billed_amount_details',
      billing_period: 'billing_period',
      cdn_download_uri: 'cdn_download_uri',
      currency: 'currency',
      download_uri: 'download_uri',
      due_date: 'due_date',
      entity: 'entity',
      id: 'id',
      invoice_date: 'invoice_date',
      invoice_id: 'invoice_id',
      invoice_type: 'invoice_type',
      liability_type: 'liability_type',
      payment_status: 'payment_status',
      payment_term: 'payment_term',
      type: 'type'
    });
  }
  static get Type() {
    return Object.freeze({
      cm: 'CM',
      dm: 'DM',
      inv: 'INV',
      pro_forma: 'PRO_FORMA'
    });
  }
  getCampaigns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/campaigns');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * WhatsAppBusinessAccount
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class WhatsAppBusinessAccount extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_review_status: 'account_review_status',
      analytics: 'analytics',
      business_verification_status: 'business_verification_status',
      country: 'country',
      creation_time: 'creation_time',
      currency: 'currency',
      id: 'id',
      message_template_namespace: 'message_template_namespace',
      name: 'name',
      on_behalf_of_business_info: 'on_behalf_of_business_info',
      owner_business: 'owner_business',
      owner_business_info: 'owner_business_info',
      ownership_type: 'ownership_type',
      primary_funding_id: 'primary_funding_id',
      purchase_order_number: 'purchase_order_number',
      status: 'status',
      timezone_id: 'timezone_id'
    });
  }
  static get Tasks() {
    return Object.freeze({
      develop: 'DEVELOP',
      full_control: 'FULL_CONTROL',
      manage: 'MANAGE',
      manage_phone: 'MANAGE_PHONE',
      manage_templates: 'MANAGE_TEMPLATES',
      manage_templates_and_phone: 'MANAGE_TEMPLATES_AND_PHONE',
      messaging: 'MESSAGING',
      view_cost: 'VIEW_COST'
    });
  }
  static get Category() {
    return Object.freeze({
      marketing: 'MARKETING',
      otp: 'OTP',
      transactional: 'TRANSACTIONAL'
    });
  }
  deleteAssignedUsers(params = {}) {
    return super.deleteEdge('/assigned_users', params);
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, WhatsAppBusinessAccount, pathOverride);
  }
  getAudiences(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/audiences');
  }
  getConversationAnalytics(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/conversation_analytics');
  }
  getExtensions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/extensions');
  }
  deleteMessageTemplates(params = {}) {
    return super.deleteEdge('/message_templates', params);
  }
  getMessageTemplates(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/message_templates');
  }
  createMessageTemplate(fields, params = {}, pathOverride = null) {
    return this.createEdge('/message_templates', fields, params, WhatsAppBusinessAccount, pathOverride);
  }
  getPhoneNumbers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/phone_numbers');
  }
  createPhoneNumber(fields, params = {}, pathOverride = null) {
    return this.createEdge('/phone_numbers', fields, params, null, pathOverride);
  }
  deleteProductCatalogs(params = {}) {
    return super.deleteEdge('/product_catalogs', params);
  }
  getProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/product_catalogs');
  }
  createProductCatalog(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_catalogs', fields, params, ProductCatalog, pathOverride);
  }
  getSchedules(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/schedules');
  }
  deleteSubscribedApps(params = {}) {
    return super.deleteEdge('/subscribed_apps', params);
  }
  getSubscribedApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/subscribed_apps');
  }
  createSubscribedApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscribed_apps', fields, params, WhatsAppBusinessAccount, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CPASCollaborationRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CPASCollaborationRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      brands: 'brands',
      contact_email: 'contact_email',
      contact_first_name: 'contact_first_name',
      contact_last_name: 'contact_last_name',
      id: 'id',
      phone_number: 'phone_number',
      receiver_business: 'receiver_business',
      requester_agency_or_brand: 'requester_agency_or_brand',
      sender_client_business: 'sender_client_business',
      status: 'status'
    });
  }
  static get RequesterAgencyOrBrand() {
    return Object.freeze({
      agency: 'AGENCY',
      brand: 'BRAND',
      merchant: 'MERCHANT'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CPASAdvertiserPartnershipRecommendation
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CPASAdvertiserPartnershipRecommendation extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      advertiser_business_id: 'advertiser_business_id',
      brand_business_id: 'brand_business_id',
      brands: 'brands',
      countries: 'countries',
      id: 'id',
      merchant_business_id: 'merchant_business_id',
      merchant_categories: 'merchant_categories',
      status: 'status',
      status_reason: 'status_reason'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CPASBusinessSetupConfig
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CPASBusinessSetupConfig extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      accepted_collab_ads_tos: 'accepted_collab_ads_tos',
      business: 'business',
      business_capabilities_status: 'business_capabilities_status',
      capabilities_compliance_status: 'capabilities_compliance_status',
      id: 'id'
    });
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/ad_accounts');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CPASMerchantConfig
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CPASMerchantConfig extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      accepted_tos: 'accepted_tos',
      beta_features: 'beta_features',
      business_outcomes_status: 'business_outcomes_status',
      id: 'id',
      is_test_merchant: 'is_test_merchant',
      outcomes_compliance_status: 'outcomes_compliance_status',
      qualified_to_onboard: 'qualified_to_onboard'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CreditCard
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CreditCard extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      billing_address: 'billing_address',
      card_cobadging: 'card_cobadging',
      card_holder_name: 'card_holder_name',
      card_type: 'card_type',
      credential_id: 'credential_id',
      default_receiving_method_products: 'default_receiving_method_products',
      expiry_month: 'expiry_month',
      expiry_year: 'expiry_year',
      id: 'id',
      is_cvv_tricky_bin: 'is_cvv_tricky_bin',
      is_enabled: 'is_enabled',
      is_last_used: 'is_last_used',
      is_network_tokenized_in_india: 'is_network_tokenized_in_india',
      is_soft_disabled: 'is_soft_disabled',
      is_user_verified: 'is_user_verified',
      is_zip_verified: 'is_zip_verified',
      last4: 'last4',
      readable_card_type: 'readable_card_type',
      time_created: 'time_created',
      time_created_ts: 'time_created_ts',
      type: 'type'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * EventSourceGroup
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class EventSourceGroup extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business: 'business',
      event_sources: 'event_sources',
      id: 'id',
      name: 'name',
      owner_business: 'owner_business'
    });
  }
  getSharedAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/shared_accounts');
  }
  createSharedAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shared_accounts', fields, params, EventSourceGroup, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ExtendedCreditInvoiceGroup
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ExtendedCreditInvoiceGroup extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      auto_enroll: 'auto_enroll',
      bill_to_address: 'bill_to_address',
      customer_po_number: 'customer_po_number',
      email: 'email',
      emails: 'emails',
      id: 'id',
      liable_address: 'liable_address',
      name: 'name',
      sold_to_address: 'sold_to_address'
    });
  }
  deleteAdAccounts(params = {}) {
    return super.deleteEdge('/ad_accounts', params);
  }
  getAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/ad_accounts');
  }
  createAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ad_accounts', fields, params, AdAccount, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ExtendedCreditAllocationConfig
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ExtendedCreditAllocationConfig extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      currency_amount: 'currency_amount',
      id: 'id',
      liability_type: 'liability_type',
      owning_business: 'owning_business',
      owning_credential: 'owning_credential',
      partition_type: 'partition_type',
      receiving_business: 'receiving_business',
      receiving_credential: 'receiving_credential',
      request_status: 'request_status',
      send_bill_to: 'send_bill_to'
    });
  }
  static get LiabilityType() {
    return Object.freeze({
      msa: 'MSA',
      normal: 'Normal',
      sequential: 'Sequential'
    });
  }
  static get PartitionType() {
    return Object.freeze({
      auth: 'AUTH',
      fixed: 'FIXED'
    });
  }
  static get SendBillTo() {
    return Object.freeze({
      advertiser: 'Advertiser',
      agency: 'Agency'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ExtendedCredit
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ExtendedCredit extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      allocated_amount: 'allocated_amount',
      balance: 'balance',
      credit_available: 'credit_available',
      credit_type: 'credit_type',
      id: 'id',
      is_access_revoked: 'is_access_revoked',
      is_automated_experience: 'is_automated_experience',
      legal_entity_name: 'legal_entity_name',
      liable_address: 'liable_address',
      liable_biz_name: 'liable_biz_name',
      max_balance: 'max_balance',
      online_max_balance: 'online_max_balance',
      owner_business: 'owner_business',
      owner_business_name: 'owner_business_name',
      partition_from: 'partition_from',
      receiving_credit_allocation_config: 'receiving_credit_allocation_config',
      send_bill_to_address: 'send_bill_to_address',
      send_bill_to_biz_name: 'send_bill_to_biz_name',
      sold_to_address: 'sold_to_address'
    });
  }
  getExtendedCreditInvoiceGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ExtendedCreditInvoiceGroup, fields, params, fetchFirstPage, '/extended_credit_invoice_groups');
  }
  createExtendedCreditInvoiceGroup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/extended_credit_invoice_groups', fields, params, ExtendedCreditInvoiceGroup, pathOverride);
  }
  getOwningCreditAllocationConfigs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ExtendedCreditAllocationConfig, fields, params, fetchFirstPage, '/owning_credit_allocation_configs');
  }
  createOwningCreditAllocationConfig(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owning_credit_allocation_configs', fields, params, ExtendedCreditAllocationConfig, pathOverride);
  }
  createWhatsappCreditSharingAndAttach(fields, params = {}, pathOverride = null) {
    return this.createEdge('/whatsapp_credit_sharing_and_attach', fields, params, null, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessAssetSharingAgreement
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessAssetSharingAgreement extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      initiator: 'initiator',
      recipient: 'recipient',
      relationship_type: 'relationship_type',
      request_status: 'request_status',
      request_type: 'request_type'
    });
  }
  static get RequestStatus() {
    return Object.freeze({
      approve: 'APPROVE',
      decline: 'DECLINE',
      expired: 'EXPIRED',
      in_progress: 'IN_PROGRESS',
      pending: 'PENDING',
      pending_email_verification: 'PENDING_EMAIL_VERIFICATION',
      pending_integrity_review: 'PENDING_INTEGRITY_REVIEW'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * InstagramInsightsResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class InstagramInsightsResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      description: 'description',
      id: 'id',
      name: 'name',
      period: 'period',
      title: 'title',
      total_value: 'total_value',
      values: 'values'
    });
  }
  static get Breakdown() {
    return Object.freeze({
      action_type: 'action_type',
      follow_type: 'follow_type',
      story_navigation_action_type: 'story_navigation_action_type',
      surface_type: 'surface_type'
    });
  }
  static get Metric() {
    return Object.freeze({
      carousel_album_engagement: 'carousel_album_engagement',
      carousel_album_impressions: 'carousel_album_impressions',
      carousel_album_reach: 'carousel_album_reach',
      carousel_album_saved: 'carousel_album_saved',
      carousel_album_video_views: 'carousel_album_video_views',
      comments: 'comments',
      engagement: 'engagement',
      exits: 'exits',
      follows: 'follows',
      impressions: 'impressions',
      likes: 'likes',
      navigation: 'navigation',
      plays: 'plays',
      profile_activity: 'profile_activity',
      profile_visits: 'profile_visits',
      reach: 'reach',
      replies: 'replies',
      saved: 'saved',
      shares: 'shares',
      taps_back: 'taps_back',
      taps_forward: 'taps_forward',
      total_interactions: 'total_interactions',
      video_views: 'video_views'
    });
  }
  static get Period() {
    return Object.freeze({
      day: 'day',
      days_28: 'days_28',
      lifetime: 'lifetime',
      month: 'month',
      total_over_range: 'total_over_range',
      week: 'week'
    });
  }
  static get MetricType() {
    return Object.freeze({
      default: 'default',
      time_series: 'time_series',
      total_value: 'total_value'
    });
  }
  static get Timeframe() {
    return Object.freeze({
      last_14_days: 'last_14_days',
      last_30_days: 'last_30_days',
      last_90_days: 'last_90_days',
      prev_month: 'prev_month',
      this_month: 'this_month',
      this_week: 'this_week'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * IGComment
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class IGComment extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      from: 'from',
      hidden: 'hidden',
      id: 'id',
      like_count: 'like_count',
      media: 'media',
      parent_id: 'parent_id',
      text: 'text',
      timestamp: 'timestamp',
      user: 'user',
      username: 'username'
    });
  }
  getReplies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGComment, fields, params, fetchFirstPage, '/replies');
  }
  createReply(fields, params = {}, pathOverride = null) {
    return this.createEdge('/replies', fields, params, IGComment, pathOverride);
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ShadowIGMediaProductTags
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ShadowIGMediaProductTags extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      image_url: 'image_url',
      is_checkout: 'is_checkout',
      merchant_id: 'merchant_id',
      name: 'name',
      price_string: 'price_string',
      product_id: 'product_id',
      review_status: 'review_status',
      stripped_price_string: 'stripped_price_string',
      stripped_sale_price_string: 'stripped_sale_price_string',
      x: 'x',
      y: 'y'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * IGMedia
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class IGMedia extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      caption: 'caption',
      comments_count: 'comments_count',
      id: 'id',
      ig_id: 'ig_id',
      is_comment_enabled: 'is_comment_enabled',
      is_shared_to_feed: 'is_shared_to_feed',
      like_count: 'like_count',
      media_product_type: 'media_product_type',
      media_type: 'media_type',
      media_url: 'media_url',
      owner: 'owner',
      permalink: 'permalink',
      shortcode: 'shortcode',
      thumbnail_url: 'thumbnail_url',
      timestamp: 'timestamp',
      username: 'username'
    });
  }
  getChildren(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGMedia, fields, params, fetchFirstPage, '/children');
  }
  getComments(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGComment, fields, params, fetchFirstPage, '/comments');
  }
  createComment(fields, params = {}, pathOverride = null) {
    return this.createEdge('/comments', fields, params, IGComment, pathOverride);
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramInsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  deleteProductTags(params = {}) {
    return super.deleteEdge('/product_tags', params);
  }
  getProductTags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ShadowIGMediaProductTags, fields, params, fetchFirstPage, '/product_tags');
  }
  createProductTag(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_tags', fields, params, ShadowIGMediaProductTags, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * IGUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class IGUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      biography: 'biography',
      business_discovery: 'business_discovery',
      followers_count: 'followers_count',
      follows_count: 'follows_count',
      id: 'id',
      ig_id: 'ig_id',
      media_count: 'media_count',
      mentioned_comment: 'mentioned_comment',
      mentioned_media: 'mentioned_media',
      name: 'name',
      owner_business: 'owner_business',
      profile_picture_url: 'profile_picture_url',
      shopping_product_tag_eligibility: 'shopping_product_tag_eligibility',
      shopping_review_status: 'shopping_review_status',
      username: 'username',
      website: 'website'
    });
  }
  getAvailableCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/available_catalogs');
  }
  getCatalogProductSearch(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/catalog_product_search');
  }
  getContentPublishingLimit(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/content_publishing_limit');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramInsightsResult, fields, params, fetchFirstPage, '/insights');
  }
  getLiveMedia(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGMedia, fields, params, fetchFirstPage, '/live_media');
  }
  getMedia(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGMedia, fields, params, fetchFirstPage, '/media');
  }
  createMedia(fields, params = {}, pathOverride = null) {
    return this.createEdge('/media', fields, params, IGMedia, pathOverride);
  }
  createMediaPublish(fields, params = {}, pathOverride = null) {
    return this.createEdge('/media_publish', fields, params, IGMedia, pathOverride);
  }
  createMention(fields, params = {}, pathOverride = null) {
    return this.createEdge('/mentions', fields, params, null, pathOverride);
  }
  getProductAppeal(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/product_appeal');
  }
  createProductAppeal(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_appeal', fields, params, null, pathOverride);
  }
  getRecentlySearchedHashtags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/recently_searched_hashtags');
  }
  getStories(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGMedia, fields, params, fetchFirstPage, '/stories');
  }
  getTags(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGMedia, fields, params, fetchFirstPage, '/tags');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessAdAccountRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessAdAccountRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      ad_account: 'ad_account',
      id: 'id'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessApplicationRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessApplicationRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      application: 'application',
      id: 'id'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessPageRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessPageRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      page: 'page'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessRoleRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessRoleRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      created_by: 'created_by',
      created_time: 'created_time',
      email: 'email',
      expiration_time: 'expiration_time',
      expiry_time: 'expiry_time',
      finance_role: 'finance_role',
      id: 'id',
      invite_link: 'invite_link',
      ip_role: 'ip_role',
      owner: 'owner',
      role: 'role',
      status: 'status',
      updated_by: 'updated_by',
      updated_time: 'updated_time'
    });
  }
  static get Role() {
    return Object.freeze({
      admin: 'ADMIN',
      ads_rights_reviewer: 'ADS_RIGHTS_REVIEWER',
      default: 'DEFAULT',
      developer: 'DEVELOPER',
      employee: 'EMPLOYEE',
      finance_analyst: 'FINANCE_ANALYST',
      finance_edit: 'FINANCE_EDIT',
      finance_editor: 'FINANCE_EDITOR',
      finance_view: 'FINANCE_VIEW',
      manage: 'MANAGE',
      partner_center_admin: 'PARTNER_CENTER_ADMIN',
      partner_center_analyst: 'PARTNER_CENTER_ANALYST',
      partner_center_education: 'PARTNER_CENTER_EDUCATION',
      partner_center_marketing: 'PARTNER_CENTER_MARKETING',
      partner_center_operations: 'PARTNER_CENTER_OPERATIONS'
    });
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * SystemUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class SystemUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      created_by: 'created_by',
      created_time: 'created_time',
      finance_permission: 'finance_permission',
      id: 'id',
      ip_permission: 'ip_permission',
      name: 'name'
    });
  }
  static get Role() {
    return Object.freeze({
      admin: 'ADMIN',
      ads_rights_reviewer: 'ADS_RIGHTS_REVIEWER',
      default: 'DEFAULT',
      developer: 'DEVELOPER',
      employee: 'EMPLOYEE',
      finance_analyst: 'FINANCE_ANALYST',
      finance_edit: 'FINANCE_EDIT',
      finance_editor: 'FINANCE_EDITOR',
      finance_view: 'FINANCE_VIEW',
      manage: 'MANAGE',
      partner_center_admin: 'PARTNER_CENTER_ADMIN',
      partner_center_analyst: 'PARTNER_CENTER_ANALYST',
      partner_center_education: 'PARTNER_CENTER_EDUCATION',
      partner_center_marketing: 'PARTNER_CENTER_MARKETING',
      partner_center_operations: 'PARTNER_CENTER_OPERATIONS'
    });
  }
  getAssignedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/assigned_ad_accounts');
  }
  getAssignedBusinessAssetGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetGroup, fields, params, fetchFirstPage, '/assigned_business_asset_groups');
  }
  getAssignedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/assigned_pages');
  }
  getAssignedProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/assigned_product_catalogs');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * Business
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class Business extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      block_offline_analytics: 'block_offline_analytics',
      collaborative_ads_managed_partner_business_info: 'collaborative_ads_managed_partner_business_info',
      collaborative_ads_managed_partner_eligibility: 'collaborative_ads_managed_partner_eligibility',
      collaborative_ads_partner_premium_options: 'collaborative_ads_partner_premium_options',
      created_by: 'created_by',
      created_time: 'created_time',
      extended_updated_time: 'extended_updated_time',
      id: 'id',
      is_hidden: 'is_hidden',
      link: 'link',
      name: 'name',
      payment_account_id: 'payment_account_id',
      primary_page: 'primary_page',
      profile_picture_uri: 'profile_picture_uri',
      timezone_id: 'timezone_id',
      two_factor_type: 'two_factor_type',
      updated_by: 'updated_by',
      updated_time: 'updated_time',
      verification_status: 'verification_status',
      vertical: 'vertical',
      vertical_id: 'vertical_id'
    });
  }
  static get TwoFactorType() {
    return Object.freeze({
      admin_required: 'admin_required',
      all_required: 'all_required',
      none: 'none'
    });
  }
  static get Vertical() {
    return Object.freeze({
      advertising: 'ADVERTISING',
      automotive: 'AUTOMOTIVE',
      consumer_packaged_goods: 'CONSUMER_PACKAGED_GOODS',
      ecommerce: 'ECOMMERCE',
      education: 'EDUCATION',
      energy_and_utilities: 'ENERGY_AND_UTILITIES',
      entertainment_and_media: 'ENTERTAINMENT_AND_MEDIA',
      financial_services: 'FINANCIAL_SERVICES',
      gaming: 'GAMING',
      government_and_politics: 'GOVERNMENT_AND_POLITICS',
      health: 'HEALTH',
      luxury: 'LUXURY',
      marketing: 'MARKETING',
      non_profit: 'NON_PROFIT',
      organizations_and_associations: 'ORGANIZATIONS_AND_ASSOCIATIONS',
      other: 'OTHER',
      professional_services: 'PROFESSIONAL_SERVICES',
      restaurant: 'RESTAURANT',
      retail: 'RETAIL',
      technology: 'TECHNOLOGY',
      telecom: 'TELECOM',
      travel: 'TRAVEL'
    });
  }
  static get PermittedTasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      cashier_role: 'CASHIER_ROLE',
      create_content: 'CREATE_CONTENT',
      manage: 'MANAGE',
      manage_jobs: 'MANAGE_JOBS',
      manage_leads: 'MANAGE_LEADS',
      messaging: 'MESSAGING',
      moderate: 'MODERATE',
      moderate_community: 'MODERATE_COMMUNITY',
      pages_messaging: 'PAGES_MESSAGING',
      pages_messaging_subscriptions: 'PAGES_MESSAGING_SUBSCRIPTIONS',
      profile_plus_advertise: 'PROFILE_PLUS_ADVERTISE',
      profile_plus_analyze: 'PROFILE_PLUS_ANALYZE',
      profile_plus_create_content: 'PROFILE_PLUS_CREATE_CONTENT',
      profile_plus_facebook_access: 'PROFILE_PLUS_FACEBOOK_ACCESS',
      profile_plus_full_control: 'PROFILE_PLUS_FULL_CONTROL',
      profile_plus_manage: 'PROFILE_PLUS_MANAGE',
      profile_plus_manage_leads: 'PROFILE_PLUS_MANAGE_LEADS',
      profile_plus_messaging: 'PROFILE_PLUS_MESSAGING',
      profile_plus_moderate: 'PROFILE_PLUS_MODERATE',
      profile_plus_moderate_delegate_community: 'PROFILE_PLUS_MODERATE_DELEGATE_COMMUNITY',
      profile_plus_revenue: 'PROFILE_PLUS_REVENUE',
      read_page_mailboxes: 'READ_PAGE_MAILBOXES',
      view_monetization_insights: 'VIEW_MONETIZATION_INSIGHTS'
    });
  }
  static get SurveyBusinessType() {
    return Object.freeze({
      advertiser: 'ADVERTISER',
      agency: 'AGENCY',
      app_developer: 'APP_DEVELOPER',
      publisher: 'PUBLISHER'
    });
  }
  static get PagePermittedTasks() {
    return Object.freeze({
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      cashier_role: 'CASHIER_ROLE',
      create_content: 'CREATE_CONTENT',
      manage: 'MANAGE',
      manage_jobs: 'MANAGE_JOBS',
      manage_leads: 'MANAGE_LEADS',
      messaging: 'MESSAGING',
      moderate: 'MODERATE',
      moderate_community: 'MODERATE_COMMUNITY',
      pages_messaging: 'PAGES_MESSAGING',
      pages_messaging_subscriptions: 'PAGES_MESSAGING_SUBSCRIPTIONS',
      profile_plus_advertise: 'PROFILE_PLUS_ADVERTISE',
      profile_plus_analyze: 'PROFILE_PLUS_ANALYZE',
      profile_plus_create_content: 'PROFILE_PLUS_CREATE_CONTENT',
      profile_plus_facebook_access: 'PROFILE_PLUS_FACEBOOK_ACCESS',
      profile_plus_full_control: 'PROFILE_PLUS_FULL_CONTROL',
      profile_plus_manage: 'PROFILE_PLUS_MANAGE',
      profile_plus_manage_leads: 'PROFILE_PLUS_MANAGE_LEADS',
      profile_plus_messaging: 'PROFILE_PLUS_MESSAGING',
      profile_plus_moderate: 'PROFILE_PLUS_MODERATE',
      profile_plus_moderate_delegate_community: 'PROFILE_PLUS_MODERATE_DELEGATE_COMMUNITY',
      profile_plus_revenue: 'PROFILE_PLUS_REVENUE',
      read_page_mailboxes: 'READ_PAGE_MAILBOXES',
      view_monetization_insights: 'VIEW_MONETIZATION_INSIGHTS'
    });
  }
  createAccessToken(fields, params = {}, pathOverride = null) {
    return this.createEdge('/access_token', fields, params, Business, pathOverride);
  }
  deleteAdAccounts(params = {}) {
    return super.deleteEdge('/ad_accounts', params);
  }
  getAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/ad_studies');
  }
  createAdStudy(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ad_studies', fields, params, AdStudy, pathOverride);
  }
  createAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adaccount', fields, params, AdAccount, pathOverride);
  }
  createAdNetworkApplication(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adnetwork_applications', fields, params, Application, pathOverride);
  }
  getAdNetworkAnalytics(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdNetworkAnalyticsSyncQueryResult, fields, params, fetchFirstPage, '/adnetworkanalytics');
  }
  createAdNetworkAnalytic(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adnetworkanalytics', fields, params, Business, pathOverride);
  }
  getAdNetworkAnalyticsResults(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdNetworkAnalyticsAsyncQueryResult, fields, params, fetchFirstPage, '/adnetworkanalytics_results');
  }
  getAdsReportingMmmReports(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ads_reporting_mmm_reports');
  }
  getAdsReportingMmmSchedulers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ads_reporting_mmm_schedulers');
  }
  getAdsPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/adspixels');
  }
  createAdsPixel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adspixels', fields, params, AdsPixel, pathOverride);
  }
  deleteAgencies(params = {}) {
    return super.deleteEdge('/agencies', params);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  getAnPlacements(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPlacement, fields, params, fetchFirstPage, '/an_placements');
  }
  createBlockListDraft(fields, params = {}, pathOverride = null) {
    return this.createEdge('/block_list_drafts', fields, params, Business, pathOverride);
  }
  getBusinessAssetGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetGroup, fields, params, fetchFirstPage, '/business_asset_groups');
  }
  getBusinessInvoices(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OmegaCustomerTrx, fields, params, fetchFirstPage, '/business_invoices');
  }
  getBusinessUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessUser, fields, params, fetchFirstPage, '/business_users');
  }
  createBusinessUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/business_users', fields, params, BusinessUser, pathOverride);
  }
  createClaimCustomConversion(fields, params = {}, pathOverride = null) {
    return this.createEdge('/claim_custom_conversions', fields, params, CustomConversion, pathOverride);
  }
  getClientAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/client_ad_accounts');
  }
  getClientApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/client_apps');
  }
  createClientApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/client_apps', fields, params, Business, pathOverride);
  }
  getClientOffsiteSignalContainerBusinessObjects(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/client_offsite_signal_container_business_objects');
  }
  getClientPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/client_pages');
  }
  createClientPage(fields, params = {}, pathOverride = null) {
    return this.createEdge('/client_pages', fields, params, Business, pathOverride);
  }
  getClientPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/client_pixels');
  }
  getClientProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/client_product_catalogs');
  }
  getClientWhatsAppBusinessAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(WhatsAppBusinessAccount, fields, params, fetchFirstPage, '/client_whatsapp_business_accounts');
  }
  deleteClients(params = {}) {
    return super.deleteEdge('/clients', params);
  }
  getClients(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/clients');
  }
  getCollaborativeAdsCollaborationRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CPASCollaborationRequest, fields, params, fetchFirstPage, '/collaborative_ads_collaboration_requests');
  }
  createCollaborativeAdsCollaborationRequest(fields, params = {}, pathOverride = null) {
    return this.createEdge('/collaborative_ads_collaboration_requests', fields, params, CPASCollaborationRequest, pathOverride);
  }
  getCollaborativeAdsSuggestedPartners(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CPASAdvertiserPartnershipRecommendation, fields, params, fetchFirstPage, '/collaborative_ads_suggested_partners');
  }
  getCommerceMerchantSettings(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CommerceMerchantSettings, fields, params, fetchFirstPage, '/commerce_merchant_settings');
  }
  getCpasBusinessSetupConfig(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CPASBusinessSetupConfig, fields, params, fetchFirstPage, '/cpas_business_setup_config');
  }
  createCpasBusinessSetupConfig(fields, params = {}, pathOverride = null) {
    return this.createEdge('/cpas_business_setup_config', fields, params, CPASBusinessSetupConfig, pathOverride);
  }
  getCpasMerchantConfig(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CPASMerchantConfig, fields, params, fetchFirstPage, '/cpas_merchant_config');
  }
  getCreditCards(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CreditCard, fields, params, fetchFirstPage, '/creditcards');
  }
  createCustomConversion(fields, params = {}, pathOverride = null) {
    return this.createEdge('/customconversions', fields, params, CustomConversion, pathOverride);
  }
  createDraftNegativeKeywordList(fields, params = {}, pathOverride = null) {
    return this.createEdge('/draft_negative_keyword_lists', fields, params, null, pathOverride);
  }
  getEventSourceGroups(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(EventSourceGroup, fields, params, fetchFirstPage, '/event_source_groups');
  }
  createEventSourceGroup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/event_source_groups', fields, params, EventSourceGroup, pathOverride);
  }
  getExtendedCreditApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/extendedcreditapplications');
  }
  getExtendedCredits(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ExtendedCredit, fields, params, fetchFirstPage, '/extendedcredits');
  }
  getInitiatedAudienceSharingRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetSharingAgreement, fields, params, fetchFirstPage, '/initiated_audience_sharing_requests');
  }
  deleteInstagramAccounts(params = {}) {
    return super.deleteEdge('/instagram_accounts', params);
  }
  getInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/instagram_accounts');
  }
  getInstagramBusinessAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGUser, fields, params, fetchFirstPage, '/instagram_business_accounts');
  }
  deleteManagedBusinesses(params = {}) {
    return super.deleteEdge('/managed_businesses', params);
  }
  createManagedBusiness(fields, params = {}, pathOverride = null) {
    return this.createEdge('/managed_businesses', fields, params, Business, pathOverride);
  }
  createManagedPartnerBusinessSetup(fields, params = {}, pathOverride = null) {
    return this.createEdge('/managed_partner_business_setup', fields, params, Business, pathOverride);
  }
  deleteManagedPartnerBusinesses(params = {}) {
    return super.deleteEdge('/managed_partner_businesses', params);
  }
  createManagedPartnerBusiness(fields, params = {}, pathOverride = null) {
    return this.createEdge('/managed_partner_businesses', fields, params, null, pathOverride);
  }
  getNegativeKeywordLists(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/negative_keyword_lists');
  }
  getOfflineConversionDataSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OfflineConversionDataSet, fields, params, fetchFirstPage, '/offline_conversion_data_sets');
  }
  createOfflineConversionDataSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/offline_conversion_data_sets', fields, params, OfflineConversionDataSet, pathOverride);
  }
  getOwnedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/owned_ad_accounts');
  }
  createOwnedAdAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owned_ad_accounts', fields, params, Business, pathOverride);
  }
  getOwnedApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/owned_apps');
  }
  createOwnedApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owned_apps', fields, params, Business, pathOverride);
  }
  deleteOwnedBusinesses(params = {}) {
    return super.deleteEdge('/owned_businesses', params);
  }
  getOwnedBusinesses(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/owned_businesses');
  }
  createOwnedBusiness(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owned_businesses', fields, params, Business, pathOverride);
  }
  getOwnedInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/owned_instagram_accounts');
  }
  getOwnedOffsiteSignalContainerBusinessObjects(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/owned_offsite_signal_container_business_objects');
  }
  getOwnedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/owned_pages');
  }
  createOwnedPage(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owned_pages', fields, params, Business, pathOverride);
  }
  getOwnedPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/owned_pixels');
  }
  getOwnedProductCatalogs(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProductCatalog, fields, params, fetchFirstPage, '/owned_product_catalogs');
  }
  createOwnedProductCatalog(fields, params = {}, pathOverride = null) {
    return this.createEdge('/owned_product_catalogs', fields, params, ProductCatalog, pathOverride);
  }
  getOwnedWhatsAppBusinessAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(WhatsAppBusinessAccount, fields, params, fetchFirstPage, '/owned_whatsapp_business_accounts');
  }
  deletePages(params = {}) {
    return super.deleteEdge('/pages', params);
  }
  createPartnerPremiumOption(fields, params = {}, pathOverride = null) {
    return this.createEdge('/partner_premium_options', fields, params, null, pathOverride);
  }
  getPendingClientAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAdAccountRequest, fields, params, fetchFirstPage, '/pending_client_ad_accounts');
  }
  getPendingClientApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessApplicationRequest, fields, params, fetchFirstPage, '/pending_client_apps');
  }
  getPendingClientPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessPageRequest, fields, params, fetchFirstPage, '/pending_client_pages');
  }
  getPendingOwnedAdAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAdAccountRequest, fields, params, fetchFirstPage, '/pending_owned_ad_accounts');
  }
  getPendingOwnedPages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessPageRequest, fields, params, fetchFirstPage, '/pending_owned_pages');
  }
  getPendingSharedOffsiteSignalContainerBusinessObjects(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/pending_shared_offsite_signal_container_business_objects');
  }
  getPendingUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessRoleRequest, fields, params, fetchFirstPage, '/pending_users');
  }
  getPicture(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ProfilePictureSource, fields, params, fetchFirstPage, '/picture');
  }
  createPixelTo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/pixel_tos', fields, params, null, pathOverride);
  }
  getReceivedAudienceSharingRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessAssetSharingAgreement, fields, params, fetchFirstPage, '/received_audience_sharing_requests');
  }
  getSystemUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(SystemUser, fields, params, fetchFirstPage, '/system_users');
  }
  createSystemUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/system_users', fields, params, SystemUser, pathOverride);
  }
  getThirdPartyMeasurementReportDataset(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/third_party_measurement_report_dataset');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdsPixelStatsResult
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdsPixelStatsResult extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      aggregation: 'aggregation',
      data: 'data',
      start_time: 'start_time'
    });
  }
  static get Aggregation() {
    return Object.freeze({
      browser_type: 'browser_type',
      custom_data_field: 'custom_data_field',
      device_os: 'device_os',
      device_type: 'device_type',
      event: 'event',
      event_detection_method: 'event_detection_method',
      event_processing_results: 'event_processing_results',
      event_source: 'event_source',
      event_total_counts: 'event_total_counts',
      event_value_count: 'event_value_count',
      had_pii: 'had_pii',
      host: 'host',
      match_keys: 'match_keys',
      pixel_fire: 'pixel_fire',
      url: 'url',
      url_by_rule: 'url_by_rule'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdsPixel
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdsPixel extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      automatic_matching_fields: 'automatic_matching_fields',
      can_proxy: 'can_proxy',
      code: 'code',
      creation_time: 'creation_time',
      creator: 'creator',
      data_use_setting: 'data_use_setting',
      enable_automatic_matching: 'enable_automatic_matching',
      first_party_cookie_status: 'first_party_cookie_status',
      id: 'id',
      is_created_by_business: 'is_created_by_business',
      is_crm: 'is_crm',
      is_unavailable: 'is_unavailable',
      last_fired_time: 'last_fired_time',
      name: 'name',
      owner_ad_account: 'owner_ad_account',
      owner_business: 'owner_business'
    });
  }
  static get SortBy() {
    return Object.freeze({
      last_fired_time: 'LAST_FIRED_TIME',
      name: 'NAME'
    });
  }
  static get AutomaticMatchingFields() {
    return Object.freeze({
      country: 'country',
      ct: 'ct',
      db: 'db',
      em: 'em',
      external_id: 'external_id',
      fn: 'fn',
      ge: 'ge',
      ln: 'ln',
      ph: 'ph',
      st: 'st',
      zp: 'zp'
    });
  }
  static get DataUseSetting() {
    return Object.freeze({
      advertising_and_analytics: 'ADVERTISING_AND_ANALYTICS',
      analytics_only: 'ANALYTICS_ONLY',
      empty: 'EMPTY'
    });
  }
  static get FirstPartyCookieStatus() {
    return Object.freeze({
      empty: 'EMPTY',
      first_party_cookie_disabled: 'FIRST_PARTY_COOKIE_DISABLED',
      first_party_cookie_enabled: 'FIRST_PARTY_COOKIE_ENABLED'
    });
  }
  static get Tasks() {
    return Object.freeze({
      aa_analyze: 'AA_ANALYZE',
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      edit: 'EDIT',
      upload: 'UPLOAD'
    });
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, AdsPixel, pathOverride);
  }
  getDaChecks(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(DACheck, fields, params, fetchFirstPage, '/da_checks');
  }
  createEvent(fields, params = {}, pathOverride = null) {
    return this.createEdge('/events', fields, params, null, pathOverride);
  }
  createMeapitocapiconsolidationhelper(fields, params = {}, pathOverride = null) {
    return this.createEdge('/meapitocapiconsolidationhelper', fields, params, null, pathOverride);
  }
  createShadowTrafficHelper(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shadowtraffichelper', fields, params, null, pathOverride);
  }
  deleteSharedAccounts(params = {}) {
    return super.deleteEdge('/shared_accounts', params);
  }
  getSharedAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccount, fields, params, fetchFirstPage, '/shared_accounts');
  }
  createSharedAccount(fields, params = {}, pathOverride = null) {
    return this.createEdge('/shared_accounts', fields, params, AdsPixel, pathOverride);
  }
  getSharedAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/shared_agencies');
  }
  getStats(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixelStatsResult, fields, params, fetchFirstPage, '/stats');
  }
  createTelemetry(fields, params = {}, pathOverride = null) {
    return this.createEdge('/telemetry', fields, params, null, pathOverride);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PartnerStudy
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PartnerStudy extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      additional_info: 'additional_info',
      brand: 'brand',
      client_name: 'client_name',
      emails: 'emails',
      id: 'id',
      input_ids: 'input_ids',
      is_export: 'is_export',
      lift_study: 'lift_study',
      location: 'location',
      match_file_ds: 'match_file_ds',
      name: 'name',
      partner_defined_id: 'partner_defined_id',
      partner_household_graph_dataset_id: 'partner_household_graph_dataset_id',
      status: 'status',
      study_end_date: 'study_end_date',
      study_start_date: 'study_start_date',
      study_type: 'study_type',
      submit_date: 'submit_date'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdStudyObjective
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdStudyObjective extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      is_primary: 'is_primary',
      last_updated_results: 'last_updated_results',
      name: 'name',
      results: 'results',
      type: 'type'
    });
  }
  static get Type() {
    return Object.freeze({
      brand: 'BRAND',
      brandlift: 'BRANDLIFT',
      conversions: 'CONVERSIONS',
      ftl: 'FTL',
      mae: 'MAE',
      mai: 'MAI',
      mpc_conversion: 'MPC_CONVERSION',
      nonsales: 'NONSALES',
      partner: 'PARTNER',
      sales: 'SALES',
      telco: 'TELCO'
    });
  }
  getAdsPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/adspixels');
  }
  getApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/applications');
  }
  getCustomConversions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomConversion, fields, params, fetchFirstPage, '/customconversions');
  }
  getOfflineConversionDataSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OfflineConversionDataSet, fields, params, fetchFirstPage, '/offline_conversion_data_sets');
  }
  getPartnerStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PartnerStudy, fields, params, fetchFirstPage, '/partnerstudies');
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdStudy
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdStudy extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business: 'business',
      canceled_time: 'canceled_time',
      client_business: 'client_business',
      cooldown_start_time: 'cooldown_start_time',
      created_by: 'created_by',
      created_time: 'created_time',
      description: 'description',
      end_time: 'end_time',
      id: 'id',
      measurement_contact: 'measurement_contact',
      name: 'name',
      observation_end_time: 'observation_end_time',
      results_first_available_date: 'results_first_available_date',
      sales_contact: 'sales_contact',
      start_time: 'start_time',
      type: 'type',
      updated_by: 'updated_by',
      updated_time: 'updated_time'
    });
  }
  static get Type() {
    return Object.freeze({
      continuous_lift_config: 'CONTINUOUS_LIFT_CONFIG',
      geo_lift: 'GEO_LIFT',
      lift: 'LIFT',
      split_test: 'SPLIT_TEST'
    });
  }
  getCells(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudyCell, fields, params, fetchFirstPage, '/cells');
  }
  createCheckPoint(fields, params = {}, pathOverride = null) {
    return this.createEdge('/checkpoint', fields, params, AdStudy, pathOverride);
  }
  getInstances(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PrivateLiftStudyInstance, fields, params, fetchFirstPage, '/instances');
  }
  createInstance(fields, params = {}, pathOverride = null) {
    return this.createEdge('/instances', fields, params, PrivateLiftStudyInstance, pathOverride);
  }
  getObjectives(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudyObjective, fields, params, fetchFirstPage, '/objectives');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CloudGame
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CloudGame extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      owner: 'owner',
      playable_ad_file_size: 'playable_ad_file_size',
      playable_ad_orientation: 'playable_ad_orientation',
      playable_ad_package_name: 'playable_ad_package_name',
      playable_ad_reject_reason: 'playable_ad_reject_reason',
      playable_ad_status: 'playable_ad_status',
      playable_ad_upload_time: 'playable_ad_upload_time'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdImage
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdImage extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      created_time: 'created_time',
      creatives: 'creatives',
      hash: 'hash',
      height: 'height',
      id: 'id',
      is_associated_creatives_in_adgroups: 'is_associated_creatives_in_adgroups',
      name: 'name',
      original_height: 'original_height',
      original_width: 'original_width',
      owner_business: 'owner_business',
      permalink_url: 'permalink_url',
      status: 'status',
      updated_time: 'updated_time',
      url: 'url',
      url_128: 'url_128',
      width: 'width'
    });
  }
  static get Status() {
    return Object.freeze({
      active: 'ACTIVE',
      deleted: 'DELETED',
      internal: 'INTERNAL'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdLabel
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdLabel extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account: 'account',
      created_time: 'created_time',
      id: 'id',
      name: 'name',
      updated_time: 'updated_time'
    });
  }
  getAdCreatives(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreative, fields, params, fetchFirstPage, '/adcreatives');
  }
  getAds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/ads');
  }
  getAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/adsets');
  }
  getCampaigns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Campaign, fields, params, fetchFirstPage, '/campaigns');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PlayableContent
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PlayableContent extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      owner: 'owner'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountAdRulesHistory
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountAdRulesHistory extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      evaluation_spec: 'evaluation_spec',
      exception_code: 'exception_code',
      exception_message: 'exception_message',
      execution_spec: 'execution_spec',
      is_manual: 'is_manual',
      results: 'results',
      rule_id: 'rule_id',
      schedule_spec: 'schedule_spec',
      timestamp: 'timestamp'
    });
  }
  static get Action() {
    return Object.freeze({
      budget_not_redistributed: 'BUDGET_NOT_REDISTRIBUTED',
      changed_bid: 'CHANGED_BID',
      changed_budget: 'CHANGED_BUDGET',
      email: 'EMAIL',
      enable_autoflow: 'ENABLE_AUTOFLOW',
      endpoint_pinged: 'ENDPOINT_PINGED',
      error: 'ERROR',
      facebook_notification_sent: 'FACEBOOK_NOTIFICATION_SENT',
      message_sent: 'MESSAGE_SENT',
      not_changed: 'NOT_CHANGED',
      paused: 'PAUSED',
      unpaused: 'UNPAUSED'
    });
  }
  static get EvaluationType() {
    return Object.freeze({
      schedule: 'SCHEDULE',
      trigger: 'TRIGGER'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountAdVolume
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountAdVolume extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      actor_id: 'actor_id',
      actor_name: 'actor_name',
      ad_limit_scope_business: 'ad_limit_scope_business',
      ad_limit_scope_business_manager_id: 'ad_limit_scope_business_manager_id',
      ad_limit_set_by_page_admin: 'ad_limit_set_by_page_admin',
      ads_running_or_in_review_count: 'ads_running_or_in_review_count',
      ads_running_or_in_review_count_subject_to_limit_set_by_page: 'ads_running_or_in_review_count_subject_to_limit_set_by_page',
      current_account_ads_running_or_in_review_count: 'current_account_ads_running_or_in_review_count',
      future_limit_activation_date: 'future_limit_activation_date',
      future_limit_on_ads_running_or_in_review: 'future_limit_on_ads_running_or_in_review',
      limit_on_ads_running_or_in_review: 'limit_on_ads_running_or_in_review',
      recommendations: 'recommendations'
    });
  }
  static get RecommendationType() {
    return Object.freeze({
      aco_toggle: 'ACO_TOGGLE',
      aggregated_bid_limited: 'AGGREGATED_BID_LIMITED',
      aggregated_budget_limited: 'AGGREGATED_BUDGET_LIMITED',
      aggregated_cost_limited: 'AGGREGATED_COST_LIMITED',
      auction_overlap: 'AUCTION_OVERLAP',
      auction_overlap_consolidation: 'AUCTION_OVERLAP_CONSOLIDATION',
      audience_expansion: 'AUDIENCE_EXPANSION',
      autoflow_opt_in: 'AUTOFLOW_OPT_IN',
      automatic_placements: 'AUTOMATIC_PLACEMENTS',
      capi: 'CAPI',
      cost_goal: 'COST_GOAL',
      cost_goal_budget_limited: 'COST_GOAL_BUDGET_LIMITED',
      cost_goal_cpa_limited: 'COST_GOAL_CPA_LIMITED',
      creative_badge: 'CREATIVE_BADGE',
      creative_fatigue: 'CREATIVE_FATIGUE',
      creative_limited: 'CREATIVE_LIMITED',
      dead_link: 'DEAD_LINK',
      ecosystem_bid_reduce_l1_cardinality: 'ECOSYSTEM_BID_REDUCE_L1_CARDINALITY',
      fragmentation: 'FRAGMENTATION',
      learning_limited: 'LEARNING_LIMITED',
      low_outcome: 'LOW_OUTCOME',
      multi_text: 'MULTI_TEXT',
      music: 'MUSIC',
      predictive_creative_limited: 'PREDICTIVE_CREATIVE_LIMITED',
      revert: 'REVERT',
      signals_growth_capi: 'SIGNALS_GROWTH_CAPI',
      syd_test_mode: 'SYD_TEST_MODE',
      top_adsets_with_ads_under_cap: 'TOP_ADSETS_WITH_ADS_UNDER_CAP',
      top_campaigns_with_ads_under_cap: 'TOP_CAMPAIGNS_WITH_ADS_UNDER_CAP',
      uneconomical_ads_throttling: 'UNECONOMICAL_ADS_THROTTLING',
      unused_budget: 'UNUSED_BUDGET',
      zero_impression: 'ZERO_IMPRESSION'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AsyncRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AsyncRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      result: 'result',
      status: 'status',
      type: 'type'
    });
  }
  static get Status() {
    return Object.freeze({
      error: 'ERROR',
      executing: 'EXECUTING',
      finished: 'FINISHED',
      initialized: 'INITIALIZED'
    });
  }
  static get Type() {
    return Object.freeze({
      async_adgroup_creation: 'ASYNC_ADGROUP_CREATION',
      batch_api: 'BATCH_API',
      drafts: 'DRAFTS'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAsyncRequestSet
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAsyncRequestSet extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      canceled_count: 'canceled_count',
      created_time: 'created_time',
      error_count: 'error_count',
      id: 'id',
      in_progress_count: 'in_progress_count',
      initial_count: 'initial_count',
      is_completed: 'is_completed',
      name: 'name',
      notification_mode: 'notification_mode',
      notification_result: 'notification_result',
      notification_status: 'notification_status',
      notification_uri: 'notification_uri',
      owner_id: 'owner_id',
      success_count: 'success_count',
      total_count: 'total_count',
      updated_time: 'updated_time'
    });
  }
  static get NotificationMode() {
    return Object.freeze({
      off: 'OFF',
      on_complete: 'ON_COMPLETE'
    });
  }
  getRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAsyncRequest, fields, params, fetchFirstPage, '/requests');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BroadTargetingCategories
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BroadTargetingCategories extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      category_description: 'category_description',
      id: 'id',
      name: 'name',
      parent_category: 'parent_category',
      path: 'path',
      size_lower_bound: 'size_lower_bound',
      size_upper_bound: 'size_upper_bound',
      source: 'source',
      type: 'type',
      type_name: 'type_name',
      untranslated_name: 'untranslated_name',
      untranslated_parent_name: 'untranslated_parent_name'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * CustomAudiencesTOS
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class CustomAudiencesTOS extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      content: 'content',
      id: 'id',
      type: 'type'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountDeliveryEstimate
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountDeliveryEstimate extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      daily_outcomes_curve: 'daily_outcomes_curve',
      estimate_dau: 'estimate_dau',
      estimate_mau_lower_bound: 'estimate_mau_lower_bound',
      estimate_mau_upper_bound: 'estimate_mau_upper_bound',
      estimate_ready: 'estimate_ready',
      targeting_optimization_types: 'targeting_optimization_types'
    });
  }
  static get OptimizationGoal() {
    return Object.freeze({
      ad_recall_lift: 'AD_RECALL_LIFT',
      app_installs: 'APP_INSTALLS',
      app_installs_and_offsite_conversions: 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS',
      conversations: 'CONVERSATIONS',
      derived_events: 'DERIVED_EVENTS',
      engaged_users: 'ENGAGED_USERS',
      event_responses: 'EVENT_RESPONSES',
      impressions: 'IMPRESSIONS',
      in_app_value: 'IN_APP_VALUE',
      landing_page_views: 'LANDING_PAGE_VIEWS',
      lead_generation: 'LEAD_GENERATION',
      link_clicks: 'LINK_CLICKS',
      messaging_appointment_conversion: 'MESSAGING_APPOINTMENT_CONVERSION',
      messaging_purchase_conversion: 'MESSAGING_PURCHASE_CONVERSION',
      none: 'NONE',
      offsite_conversions: 'OFFSITE_CONVERSIONS',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      quality_call: 'QUALITY_CALL',
      quality_lead: 'QUALITY_LEAD',
      reach: 'REACH',
      thruplay: 'THRUPLAY',
      value: 'VALUE',
      visit_instagram_profile: 'VISIT_INSTAGRAM_PROFILE'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountIosFourteenCampaignLimits
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountIosFourteenCampaignLimits extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      campaign_group_limit: 'campaign_group_limit',
      campaign_group_limits_details: 'campaign_group_limits_details',
      campaign_limit: 'campaign_limit'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountMatchedSearchApplicationsEdgeData
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountMatchedSearchApplicationsEdgeData extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      app_id: 'app_id',
      are_app_events_unavailable: 'are_app_events_unavailable',
      icon_url: 'icon_url',
      name: 'name',
      search_source_store: 'search_source_store',
      store: 'store',
      unique_id: 'unique_id',
      url: 'url'
    });
  }
  static get AppStore() {
    return Object.freeze({
      amazon_app_store: 'AMAZON_APP_STORE',
      apk_mirror: 'APK_MIRROR',
      apk_monk: 'APK_MONK',
      apk_pure: 'APK_PURE',
      aptoide_a1_store: 'APTOIDE_A1_STORE',
      bemobi_mobile_store: 'BEMOBI_MOBILE_STORE',
      does_not_exist: 'DOES_NOT_EXIST',
      fb_android_store: 'FB_ANDROID_STORE',
      fb_canvas: 'FB_CANVAS',
      fb_gameroom: 'FB_GAMEROOM',
      galaxy_store: 'GALAXY_STORE',
      google_play: 'GOOGLE_PLAY',
      instant_game: 'INSTANT_GAME',
      itunes: 'ITUNES',
      itunes_ipad: 'ITUNES_IPAD',
      oculus_app_store: 'OCULUS_APP_STORE',
      oppo: 'OPPO',
      roku_store: 'ROKU_STORE',
      uptodown: 'UPTODOWN',
      vivo: 'VIVO',
      windows_10_store: 'WINDOWS_10_STORE',
      windows_store: 'WINDOWS_STORE',
      xiaomi: 'XIAOMI'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountMaxBid
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountMaxBid extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      max_bid: 'max_bid'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * MinimumBudget
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class MinimumBudget extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      currency: 'currency',
      min_daily_budget_high_freq: 'min_daily_budget_high_freq',
      min_daily_budget_imp: 'min_daily_budget_imp',
      min_daily_budget_low_freq: 'min_daily_budget_low_freq',
      min_daily_budget_video_views: 'min_daily_budget_video_views'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * BusinessOwnedObjectOnBehalfOfRequest
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class BusinessOwnedObjectOnBehalfOfRequest extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      business_owned_object: 'business_owned_object',
      id: 'id',
      receiving_business: 'receiving_business',
      requesting_business: 'requesting_business',
      status: 'status'
    });
  }
  static get Status() {
    return Object.freeze({
      approve: 'APPROVE',
      decline: 'DECLINE',
      expired: 'EXPIRED',
      in_progress: 'IN_PROGRESS',
      pending: 'PENDING',
      pending_email_verification: 'PENDING_EMAIL_VERIFICATION',
      pending_integrity_review: 'PENDING_INTEGRITY_REVIEW'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * PublisherBlockList
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class PublisherBlockList extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      app_publishers: 'app_publishers',
      business_owner_id: 'business_owner_id',
      id: 'id',
      is_auto_blocking_on: 'is_auto_blocking_on',
      is_eligible_at_campaign_level: 'is_eligible_at_campaign_level',
      last_update_time: 'last_update_time',
      last_update_user: 'last_update_user',
      name: 'name',
      owner_ad_account_id: 'owner_ad_account_id',
      web_publishers: 'web_publishers'
    });
  }
  createAppEndPublisherUrl(fields, params = {}, pathOverride = null) {
    return this.createEdge('/append_publisher_urls', fields, params, null, pathOverride);
  }
  getPagedWebPublishers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/paged_web_publishers');
  }

  // $FlowFixMe : Support Generic Types
  delete(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.delete(params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountReachEstimate
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountReachEstimate extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      estimate_ready: 'estimate_ready',
      users_lower_bound: 'users_lower_bound',
      users_upper_bound: 'users_upper_bound'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * ReachFrequencyPrediction
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class ReachFrequencyPrediction extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      activity_status: 'activity_status',
      ad_formats: 'ad_formats',
      auction_entry_option_index: 'auction_entry_option_index',
      audience_size_lower_bound: 'audience_size_lower_bound',
      audience_size_upper_bound: 'audience_size_upper_bound',
      business_id: 'business_id',
      buying_type: 'buying_type',
      campaign_group_id: 'campaign_group_id',
      campaign_id: 'campaign_id',
      campaign_time_start: 'campaign_time_start',
      campaign_time_stop: 'campaign_time_stop',
      currency: 'currency',
      curve_budget_reach: 'curve_budget_reach',
      curve_reach: 'curve_reach',
      daily_grp_curve: 'daily_grp_curve',
      daily_impression_curve: 'daily_impression_curve',
      daily_impression_curve_map: 'daily_impression_curve_map',
      day_parting_schedule: 'day_parting_schedule',
      destination_id: 'destination_id',
      end_time: 'end_time',
      expiration_time: 'expiration_time',
      external_budget: 'external_budget',
      external_impression: 'external_impression',
      external_maximum_budget: 'external_maximum_budget',
      external_maximum_impression: 'external_maximum_impression',
      external_maximum_reach: 'external_maximum_reach',
      external_minimum_budget: 'external_minimum_budget',
      external_minimum_impression: 'external_minimum_impression',
      external_minimum_reach: 'external_minimum_reach',
      external_reach: 'external_reach',
      feed_ratio_0000: 'feed_ratio_0000',
      frequency_cap: 'frequency_cap',
      frequency_distribution_map: 'frequency_distribution_map',
      frequency_distribution_map_agg: 'frequency_distribution_map_agg',
      grp_audience_size: 'grp_audience_size',
      grp_avg_probability_map: 'grp_avg_probability_map',
      grp_country_audience_size: 'grp_country_audience_size',
      grp_curve: 'grp_curve',
      grp_dmas_audience_size: 'grp_dmas_audience_size',
      grp_filtering_threshold_00: 'grp_filtering_threshold_00',
      grp_points: 'grp_points',
      grp_ratio: 'grp_ratio',
      grp_reach_ratio: 'grp_reach_ratio',
      grp_status: 'grp_status',
      holdout_percentage: 'holdout_percentage',
      id: 'id',
      impression_curve: 'impression_curve',
      instagram_destination_id: 'instagram_destination_id',
      instream_packages: 'instream_packages',
      interval_frequency_cap: 'interval_frequency_cap',
      interval_frequency_cap_reset_period: 'interval_frequency_cap_reset_period',
      is_bonus_media: 'is_bonus_media',
      is_conversion_goal: 'is_conversion_goal',
      is_higher_average_frequency: 'is_higher_average_frequency',
      is_io: 'is_io',
      is_reserved_buying: 'is_reserved_buying',
      is_trp: 'is_trp',
      name: 'name',
      objective: 'objective',
      objective_name: 'objective_name',
      odax_objective: 'odax_objective',
      odax_objective_name: 'odax_objective_name',
      optimization_goal: 'optimization_goal',
      optimization_goal_name: 'optimization_goal_name',
      pause_periods: 'pause_periods',
      placement_breakdown: 'placement_breakdown',
      placement_breakdown_map: 'placement_breakdown_map',
      plan_name: 'plan_name',
      plan_type: 'plan_type',
      prediction_mode: 'prediction_mode',
      prediction_progress: 'prediction_progress',
      reference_id: 'reference_id',
      reservation_status: 'reservation_status',
      start_time: 'start_time',
      status: 'status',
      story_event_type: 'story_event_type',
      target_cpm: 'target_cpm',
      target_spec: 'target_spec',
      time_created: 'time_created',
      time_updated: 'time_updated',
      timezone_id: 'timezone_id',
      timezone_name: 'timezone_name',
      topline_id: 'topline_id',
      video_view_length_constraint: 'video_view_length_constraint',
      viewtag: 'viewtag'
    });
  }
  static get Action() {
    return Object.freeze({
      cancel: 'cancel',
      quote: 'quote',
      reserve: 'reserve'
    });
  }
  static get BuyingType() {
    return Object.freeze({
      auction: 'AUCTION',
      deprecated_reach_block: 'DEPRECATED_REACH_BLOCK',
      fixed_cpm: 'FIXED_CPM',
      mixed: 'MIXED',
      reachblock: 'REACHBLOCK',
      research_poll: 'RESEARCH_POLL',
      reserved: 'RESERVED'
    });
  }
  static get InstreamPackages() {
    return Object.freeze({
      beauty: 'BEAUTY',
      entertainment: 'ENTERTAINMENT',
      food: 'FOOD',
      normal: 'NORMAL',
      premium: 'PREMIUM',
      regular_animals_pets: 'REGULAR_ANIMALS_PETS',
      regular_food: 'REGULAR_FOOD',
      regular_games: 'REGULAR_GAMES',
      regular_politics: 'REGULAR_POLITICS',
      regular_sports: 'REGULAR_SPORTS',
      regular_style: 'REGULAR_STYLE',
      regular_tv_movies: 'REGULAR_TV_MOVIES',
      spanish: 'SPANISH',
      sports: 'SPORTS'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * SavedAudience
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class SavedAudience extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account: 'account',
      approximate_count_lower_bound: 'approximate_count_lower_bound',
      approximate_count_upper_bound: 'approximate_count_upper_bound',
      delete_time: 'delete_time',
      description: 'description',
      extra_info: 'extra_info',
      id: 'id',
      name: 'name',
      operation_status: 'operation_status',
      owner_business: 'owner_business',
      page_deletion_marked_delete_time: 'page_deletion_marked_delete_time',
      permission_for_actions: 'permission_for_actions',
      run_status: 'run_status',
      sentence_lines: 'sentence_lines',
      targeting: 'targeting',
      time_created: 'time_created',
      time_updated: 'time_updated'
    });
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountSubscribedApps
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountSubscribedApps extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      app_id: 'app_id',
      app_name: 'app_name'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountTargetingUnified
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountTargetingUnified extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      audience_size_lower_bound: 'audience_size_lower_bound',
      audience_size_upper_bound: 'audience_size_upper_bound',
      conversion_lift: 'conversion_lift',
      description: 'description',
      id: 'id',
      img: 'img',
      info: 'info',
      info_title: 'info_title',
      is_recommendation: 'is_recommendation',
      key: 'key',
      link: 'link',
      name: 'name',
      parent: 'parent',
      partner: 'partner',
      path: 'path',
      performance_rating: 'performance_rating',
      raw_name: 'raw_name',
      recommendation_model: 'recommendation_model',
      search_interest_id: 'search_interest_id',
      source: 'source',
      spend: 'spend',
      type: 'type',
      valid: 'valid'
    });
  }
  static get LimitType() {
    return Object.freeze({
      behaviors: 'behaviors',
      college_years: 'college_years',
      education_majors: 'education_majors',
      education_schools: 'education_schools',
      education_statuses: 'education_statuses',
      ethnic_affinity: 'ethnic_affinity',
      family_statuses: 'family_statuses',
      generation: 'generation',
      home_ownership: 'home_ownership',
      home_type: 'home_type',
      home_value: 'home_value',
      household_composition: 'household_composition',
      income: 'income',
      industries: 'industries',
      interested_in: 'interested_in',
      interests: 'interests',
      life_events: 'life_events',
      location_categories: 'location_categories',
      moms: 'moms',
      net_worth: 'net_worth',
      office_type: 'office_type',
      politics: 'politics',
      relationship_statuses: 'relationship_statuses',
      user_adclusters: 'user_adclusters',
      work_employers: 'work_employers',
      work_positions: 'work_positions'
    });
  }
  static get RegulatedCategories() {
    return Object.freeze({
      credit: 'CREDIT',
      employment: 'EMPLOYMENT',
      housing: 'HOUSING',
      issues_elections_politics: 'ISSUES_ELECTIONS_POLITICS',
      none: 'NONE',
      online_gambling_and_gaming: 'ONLINE_GAMBLING_AND_GAMING'
    });
  }
  static get WhitelistedTypes() {
    return Object.freeze({
      adgroup_id: 'adgroup_id',
      age_max: 'age_max',
      age_min: 'age_min',
      alternate_auto_targeting_option: 'alternate_auto_targeting_option',
      app_install_state: 'app_install_state',
      audience_network_positions: 'audience_network_positions',
      behaviors: 'behaviors',
      brand_safety_content_filter_levels: 'brand_safety_content_filter_levels',
      brand_safety_content_severity_levels: 'brand_safety_content_severity_levels',
      catalog_based_targeting: 'catalog_based_targeting',
      cities: 'cities',
      city_keys: 'city_keys',
      college_years: 'college_years',
      conjunctive_user_adclusters: 'conjunctive_user_adclusters',
      connections: 'connections',
      contextual_targeting_categories: 'contextual_targeting_categories',
      countries: 'countries',
      country: 'country',
      country_groups: 'country_groups',
      custom_audiences: 'custom_audiences',
      device_platforms: 'device_platforms',
      direct_install_devices: 'direct_install_devices',
      dynamic_audience_ids: 'dynamic_audience_ids',
      education_majors: 'education_majors',
      education_schools: 'education_schools',
      education_statuses: 'education_statuses',
      effective_audience_network_positions: 'effective_audience_network_positions',
      effective_device_platforms: 'effective_device_platforms',
      effective_facebook_positions: 'effective_facebook_positions',
      effective_instagram_positions: 'effective_instagram_positions',
      effective_messenger_positions: 'effective_messenger_positions',
      effective_oculus_positions: 'effective_oculus_positions',
      effective_publisher_platforms: 'effective_publisher_platforms',
      effective_whatsapp_positions: 'effective_whatsapp_positions',
      engagement_specs: 'engagement_specs',
      ethnic_affinity: 'ethnic_affinity',
      exclude_previous_days: 'exclude_previous_days',
      exclude_reached_since: 'exclude_reached_since',
      excluded_brand_safety_content_types: 'excluded_brand_safety_content_types',
      excluded_connections: 'excluded_connections',
      excluded_custom_audiences: 'excluded_custom_audiences',
      excluded_dynamic_audience_ids: 'excluded_dynamic_audience_ids',
      excluded_engagement_specs: 'excluded_engagement_specs',
      excluded_geo_locations: 'excluded_geo_locations',
      excluded_mobile_device_model: 'excluded_mobile_device_model',
      excluded_product_audience_specs: 'excluded_product_audience_specs',
      excluded_publisher_categories: 'excluded_publisher_categories',
      excluded_publisher_list_ids: 'excluded_publisher_list_ids',
      excluded_user_adclusters: 'excluded_user_adclusters',
      excluded_user_device: 'excluded_user_device',
      exclusions: 'exclusions',
      facebook_positions: 'facebook_positions',
      family_statuses: 'family_statuses',
      fb_deal_id: 'fb_deal_id',
      flexible_spec: 'flexible_spec',
      follow_profiles: 'follow_profiles',
      follow_profiles_negative: 'follow_profiles_negative',
      format: 'format',
      friends_of_connections: 'friends_of_connections',
      gatekeepers: 'gatekeepers',
      genders: 'genders',
      generation: 'generation',
      geo_locations: 'geo_locations',
      home_ownership: 'home_ownership',
      home_type: 'home_type',
      home_value: 'home_value',
      household_composition: 'household_composition',
      id: 'id',
      income: 'income',
      industries: 'industries',
      instagram_hashtags: 'instagram_hashtags',
      instagram_positions: 'instagram_positions',
      instream_video_skippable_excluded: 'instream_video_skippable_excluded',
      instream_video_sponsorship_placements: 'instream_video_sponsorship_placements',
      interest_defaults_source: 'interest_defaults_source',
      interested_in: 'interested_in',
      interests: 'interests',
      is_instagram_destination_ad: 'is_instagram_destination_ad',
      is_whatsapp_destination_ad: 'is_whatsapp_destination_ad',
      keywords: 'keywords',
      life_events: 'life_events',
      locales: 'locales',
      location_categories: 'location_categories',
      location_cluster_ids: 'location_cluster_ids',
      location_expansion: 'location_expansion',
      marketplace_product_categories: 'marketplace_product_categories',
      messenger_positions: 'messenger_positions',
      mobile_device_model: 'mobile_device_model',
      moms: 'moms',
      net_worth: 'net_worth',
      oculus_positions: 'oculus_positions',
      office_type: 'office_type',
      page_types: 'page_types',
      place_page_set_ids: 'place_page_set_ids',
      political_views: 'political_views',
      politics: 'politics',
      product_audience_specs: 'product_audience_specs',
      prospecting_audience: 'prospecting_audience',
      publisher_platforms: 'publisher_platforms',
      radius: 'radius',
      region_keys: 'region_keys',
      regions: 'regions',
      relationship_statuses: 'relationship_statuses',
      rtb_flag: 'rtb_flag',
      site_category: 'site_category',
      targeting_automation: 'targeting_automation',
      targeting_optimization: 'targeting_optimization',
      targeting_relaxation_types: 'targeting_relaxation_types',
      timezones: 'timezones',
      topic: 'topic',
      trending: 'trending',
      user_adclusters: 'user_adclusters',
      user_device: 'user_device',
      user_event: 'user_event',
      user_os: 'user_os',
      user_page_threads: 'user_page_threads',
      user_page_threads_excluded: 'user_page_threads_excluded',
      whatsapp_positions: 'whatsapp_positions',
      wireless_carrier: 'wireless_carrier',
      work_employers: 'work_employers',
      work_positions: 'work_positions',
      zips: 'zips'
    });
  }
  static get AppStore() {
    return Object.freeze({
      amazon_app_store: 'amazon_app_store',
      apk_mirror: 'apk_mirror',
      apk_monk: 'apk_monk',
      apk_pure: 'apk_pure',
      aptoide_a1_store: 'aptoide_a1_store',
      bemobi_mobile_store: 'bemobi_mobile_store',
      does_not_exist: 'does_not_exist',
      fb_android_store: 'fb_android_store',
      fb_canvas: 'fb_canvas',
      fb_gameroom: 'fb_gameroom',
      galaxy_store: 'galaxy_store',
      google_play: 'google_play',
      instant_game: 'instant_game',
      itunes: 'itunes',
      itunes_ipad: 'itunes_ipad',
      oculus_app_store: 'oculus_app_store',
      oppo: 'oppo',
      roku_channel_store: 'roku_channel_store',
      uptodown: 'uptodown',
      vivo: 'vivo',
      windows_10_store: 'windows_10_store',
      windows_store: 'windows_store',
      xiaomi: 'xiaomi'
    });
  }
  static get Objective() {
    return Object.freeze({
      app_installs: 'APP_INSTALLS',
      brand_awareness: 'BRAND_AWARENESS',
      conversions: 'CONVERSIONS',
      event_responses: 'EVENT_RESPONSES',
      lead_generation: 'LEAD_GENERATION',
      link_clicks: 'LINK_CLICKS',
      local_awareness: 'LOCAL_AWARENESS',
      messages: 'MESSAGES',
      offer_claims: 'OFFER_CLAIMS',
      outcome_app_promotion: 'OUTCOME_APP_PROMOTION',
      outcome_awareness: 'OUTCOME_AWARENESS',
      outcome_engagement: 'OUTCOME_ENGAGEMENT',
      outcome_leads: 'OUTCOME_LEADS',
      outcome_sales: 'OUTCOME_SALES',
      outcome_traffic: 'OUTCOME_TRAFFIC',
      page_likes: 'PAGE_LIKES',
      post_engagement: 'POST_ENGAGEMENT',
      product_catalog_sales: 'PRODUCT_CATALOG_SALES',
      reach: 'REACH',
      store_visits: 'STORE_VISITS',
      video_views: 'VIDEO_VIEWS'
    });
  }
  static get Mode() {
    return Object.freeze({
      best_performing: 'best_performing',
      recently_used: 'recently_used',
      related: 'related',
      suggestions: 'suggestions'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountTrackingData
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountTrackingData extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      tracking_specs: 'tracking_specs'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccountUser
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccountUser extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      id: 'id',
      name: 'name',
      tasks: 'tasks'
    });
  }
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * 
 */

/**
 * AdAccount
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
class AdAccount extends AbstractCrudObject {
  static get Fields() {
    return Object.freeze({
      account_id: 'account_id',
      account_status: 'account_status',
      ad_account_promotable_objects: 'ad_account_promotable_objects',
      age: 'age',
      agency_client_declaration: 'agency_client_declaration',
      amount_spent: 'amount_spent',
      attribution_spec: 'attribution_spec',
      balance: 'balance',
      business: 'business',
      business_city: 'business_city',
      business_country_code: 'business_country_code',
      business_name: 'business_name',
      business_state: 'business_state',
      business_street: 'business_street',
      business_street2: 'business_street2',
      business_zip: 'business_zip',
      can_create_brand_lift_study: 'can_create_brand_lift_study',
      capabilities: 'capabilities',
      created_time: 'created_time',
      currency: 'currency',
      custom_audience_info: 'custom_audience_info',
      disable_reason: 'disable_reason',
      end_advertiser: 'end_advertiser',
      end_advertiser_name: 'end_advertiser_name',
      existing_customers: 'existing_customers',
      extended_credit_invoice_group: 'extended_credit_invoice_group',
      failed_delivery_checks: 'failed_delivery_checks',
      fb_entity: 'fb_entity',
      funding_source: 'funding_source',
      funding_source_details: 'funding_source_details',
      has_advertiser_opted_in_odax: 'has_advertiser_opted_in_odax',
      has_migrated_permissions: 'has_migrated_permissions',
      has_page_authorized_adaccount: 'has_page_authorized_adaccount',
      id: 'id',
      io_number: 'io_number',
      is_attribution_spec_system_default: 'is_attribution_spec_system_default',
      is_direct_deals_enabled: 'is_direct_deals_enabled',
      is_in_3ds_authorization_enabled_market: 'is_in_3ds_authorization_enabled_market',
      is_notifications_enabled: 'is_notifications_enabled',
      is_personal: 'is_personal',
      is_prepay_account: 'is_prepay_account',
      is_tax_id_required: 'is_tax_id_required',
      liable_address: 'liable_address',
      line_numbers: 'line_numbers',
      media_agency: 'media_agency',
      min_campaign_group_spend_cap: 'min_campaign_group_spend_cap',
      min_daily_budget: 'min_daily_budget',
      name: 'name',
      offsite_pixels_tos_accepted: 'offsite_pixels_tos_accepted',
      owner: 'owner',
      owner_business: 'owner_business',
      partner: 'partner',
      rf_spec: 'rf_spec',
      send_bill_to_address: 'send_bill_to_address',
      show_checkout_experience: 'show_checkout_experience',
      sold_to_address: 'sold_to_address',
      spend_cap: 'spend_cap',
      tax_id: 'tax_id',
      tax_id_status: 'tax_id_status',
      tax_id_type: 'tax_id_type',
      timezone_id: 'timezone_id',
      timezone_name: 'timezone_name',
      timezone_offset_hours_utc: 'timezone_offset_hours_utc',
      tos_accepted: 'tos_accepted',
      user_tasks: 'user_tasks',
      user_tos_accepted: 'user_tos_accepted',
      viewable_business: 'viewable_business'
    });
  }
  static get Currency() {
    return Object.freeze({
      aed: 'AED',
      ars: 'ARS',
      aud: 'AUD',
      bdt: 'BDT',
      bob: 'BOB',
      brl: 'BRL',
      cad: 'CAD',
      chf: 'CHF',
      clp: 'CLP',
      cny: 'CNY',
      cop: 'COP',
      crc: 'CRC',
      czk: 'CZK',
      dkk: 'DKK',
      dzd: 'DZD',
      egp: 'EGP',
      eur: 'EUR',
      gbp: 'GBP',
      gtq: 'GTQ',
      hkd: 'HKD',
      hnl: 'HNL',
      huf: 'HUF',
      idr: 'IDR',
      ils: 'ILS',
      inr: 'INR',
      isk: 'ISK',
      jpy: 'JPY',
      kes: 'KES',
      krw: 'KRW',
      lkr: 'LKR',
      mop: 'MOP',
      mxn: 'MXN',
      myr: 'MYR',
      ngn: 'NGN',
      nio: 'NIO',
      nok: 'NOK',
      nzd: 'NZD',
      pen: 'PEN',
      php: 'PHP',
      pkr: 'PKR',
      pln: 'PLN',
      pyg: 'PYG',
      qar: 'QAR',
      ron: 'RON',
      sar: 'SAR',
      sek: 'SEK',
      sgd: 'SGD',
      thb: 'THB',
      try: 'TRY',
      twd: 'TWD',
      uah: 'UAH',
      usd: 'USD',
      uyu: 'UYU',
      vnd: 'VND',
      zar: 'ZAR'
    });
  }
  static get Tasks() {
    return Object.freeze({
      aa_analyze: 'AA_ANALYZE',
      advertise: 'ADVERTISE',
      analyze: 'ANALYZE',
      draft: 'DRAFT',
      manage: 'MANAGE'
    });
  }
  static get ClaimObjective() {
    return Object.freeze({
      automotive_model: 'AUTOMOTIVE_MODEL',
      collaborative_ads: 'COLLABORATIVE_ADS',
      home_listing: 'HOME_LISTING',
      media_title: 'MEDIA_TITLE',
      product: 'PRODUCT',
      travel: 'TRAVEL',
      vehicle: 'VEHICLE',
      vehicle_offer: 'VEHICLE_OFFER'
    });
  }
  static get ContentType() {
    return Object.freeze({
      automotive_model: 'AUTOMOTIVE_MODEL',
      destination: 'DESTINATION',
      flight: 'FLIGHT',
      home_listing: 'HOME_LISTING',
      hotel: 'HOTEL',
      job: 'JOB',
      local_service_business: 'LOCAL_SERVICE_BUSINESS',
      location_based_item: 'LOCATION_BASED_ITEM',
      media_title: 'MEDIA_TITLE',
      offline_product: 'OFFLINE_PRODUCT',
      product: 'PRODUCT',
      vehicle: 'VEHICLE',
      vehicle_offer: 'VEHICLE_OFFER'
    });
  }
  static get Subtype() {
    return Object.freeze({
      app: 'APP',
      bag_of_accounts: 'BAG_OF_ACCOUNTS',
      claim: 'CLAIM',
      custom: 'CUSTOM',
      engagement: 'ENGAGEMENT',
      fox: 'FOX',
      lookalike: 'LOOKALIKE',
      managed: 'MANAGED',
      measurement: 'MEASUREMENT',
      offline_conversion: 'OFFLINE_CONVERSION',
      partner: 'PARTNER',
      regulated_categories_audience: 'REGULATED_CATEGORIES_AUDIENCE',
      study_rule_audience: 'STUDY_RULE_AUDIENCE',
      video: 'VIDEO',
      website: 'WEBSITE'
    });
  }
  getActivities(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdActivity, fields, params, fetchFirstPage, '/activities');
  }
  getAdPlacePageSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPlacePageSet, fields, params, fetchFirstPage, '/ad_place_page_sets');
  }
  createAdPlacePageSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ad_place_page_sets', fields, params, AdPlacePageSet, pathOverride);
  }
  createAdPlacePageSetsAsync(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ad_place_page_sets_async', fields, params, AdPlacePageSet, pathOverride);
  }
  getAdSavedKeywords(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ad_saved_keywords');
  }
  getAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/ad_studies');
  }
  getAdCloudPlayables(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CloudGame, fields, params, fetchFirstPage, '/adcloudplayables');
  }
  getAdCreatives(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreative, fields, params, fetchFirstPage, '/adcreatives');
  }
  createAdCreative(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adcreatives', fields, params, AdCreative, pathOverride);
  }
  getAdCreativesByLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdCreative, fields, params, fetchFirstPage, '/adcreativesbylabels');
  }
  deleteAdImages(params = {}) {
    return super.deleteEdge('/adimages', params);
  }
  getAdImages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdImage, fields, params, fetchFirstPage, '/adimages');
  }
  createAdImage(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adimages', fields, params, AdImage, pathOverride);
  }
  getAdLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdLabel, fields, params, fetchFirstPage, '/adlabels');
  }
  createAdLabel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adlabels', fields, params, AdLabel, pathOverride);
  }
  getAdPlayables(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PlayableContent, fields, params, fetchFirstPage, '/adplayables');
  }
  createAdPlayable(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adplayables', fields, params, PlayableContent, pathOverride);
  }
  getAdRulesHistory(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountAdRulesHistory, fields, params, fetchFirstPage, '/adrules_history');
  }
  getAdRulesLibrary(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdRule, fields, params, fetchFirstPage, '/adrules_library');
  }
  createAdRulesLibrary(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adrules_library', fields, params, AdRule, pathOverride);
  }
  getAds(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/ads');
  }
  createAd(fields, params = {}, pathOverride = null) {
    return this.createEdge('/ads', fields, params, Ad, pathOverride);
  }
  getAdsReportingMmmReports(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ads_reporting_mmm_reports');
  }
  getAdsReportingMmmSchedulers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AbstractObject, fields, params, fetchFirstPage, '/ads_reporting_mmm_schedulers');
  }
  getAdsVolume(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountAdVolume, fields, params, fetchFirstPage, '/ads_volume');
  }
  getAdsByLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Ad, fields, params, fetchFirstPage, '/adsbylabels');
  }
  getAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/adsets');
  }
  createAdSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adsets', fields, params, AdSet, pathOverride);
  }
  getAdSetsByLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/adsetsbylabels');
  }
  getAdsPixels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsPixel, fields, params, fetchFirstPage, '/adspixels');
  }
  createAdsPixel(fields, params = {}, pathOverride = null) {
    return this.createEdge('/adspixels', fields, params, AdsPixel, pathOverride);
  }
  getAdvertisableApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/advertisable_applications');
  }
  deleteAdVideos(params = {}) {
    return super.deleteEdge('/advideos', params);
  }
  getAdVideos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdVideo, fields, params, fetchFirstPage, '/advideos');
  }
  createAdVideo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/advideos', fields, params, AdVideo, pathOverride);
  }
  getAffectedAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/affectedadsets');
  }
  deleteAgencies(params = {}) {
    return super.deleteEdge('/agencies', params);
  }
  getAgencies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Business, fields, params, fetchFirstPage, '/agencies');
  }
  getApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Application, fields, params, fetchFirstPage, '/applications');
  }
  deleteAssignedUsers(params = {}) {
    return super.deleteEdge('/assigned_users', params);
  }
  getAssignedUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AssignedUser, fields, params, fetchFirstPage, '/assigned_users');
  }
  createAssignedUser(fields, params = {}, pathOverride = null) {
    return this.createEdge('/assigned_users', fields, params, AdAccount, pathOverride);
  }
  createAsyncBatchRequest(fields, params = {}, pathOverride = null) {
    return this.createEdge('/async_batch_requests', fields, params, Campaign, pathOverride);
  }
  getAsyncRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AsyncRequest, fields, params, fetchFirstPage, '/async_requests');
  }
  getAsyncAdRequestSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAsyncRequestSet, fields, params, fetchFirstPage, '/asyncadrequestsets');
  }
  createAsyncAdRequestSet(fields, params = {}, pathOverride = null) {
    return this.createEdge('/asyncadrequestsets', fields, params, AdAsyncRequestSet, pathOverride);
  }
  createBlockListDraft(fields, params = {}, pathOverride = null) {
    return this.createEdge('/block_list_drafts', fields, params, AdAccount, pathOverride);
  }
  getBroadTargetingCategories(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BroadTargetingCategories, fields, params, fetchFirstPage, '/broadtargetingcategories');
  }
  deleteCampaigns(params = {}) {
    return super.deleteEdge('/campaigns', params);
  }
  getCampaigns(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Campaign, fields, params, fetchFirstPage, '/campaigns');
  }
  createCampaign(fields, params = {}, pathOverride = null) {
    return this.createEdge('/campaigns', fields, params, Campaign, pathOverride);
  }
  getCampaignsByLabels(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Campaign, fields, params, fetchFirstPage, '/campaignsbylabels');
  }
  getConnectedInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(IGUser, fields, params, fetchFirstPage, '/connected_instagram_accounts');
  }
  getCustomAudiences(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomAudience, fields, params, fetchFirstPage, '/customaudiences');
  }
  createCustomAudience(fields, params = {}, pathOverride = null) {
    return this.createEdge('/customaudiences', fields, params, CustomAudience, pathOverride);
  }
  getCustomAudiencesTos(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomAudiencesTOS, fields, params, fetchFirstPage, '/customaudiencestos');
  }
  createCustomAudiencesTo(fields, params = {}, pathOverride = null) {
    return this.createEdge('/customaudiencestos', fields, params, AdAccount, pathOverride);
  }
  getCustomConversions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(CustomConversion, fields, params, fetchFirstPage, '/customconversions');
  }
  createCustomConversion(fields, params = {}, pathOverride = null) {
    return this.createEdge('/customconversions', fields, params, CustomConversion, pathOverride);
  }
  getDeliveryEstimate(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountDeliveryEstimate, fields, params, fetchFirstPage, '/delivery_estimate');
  }
  getDeprecatedTargetingAdSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdSet, fields, params, fetchFirstPage, '/deprecatedtargetingadsets');
  }
  getGeneratePreviews(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdPreview, fields, params, fetchFirstPage, '/generatepreviews');
  }
  getImpactingAdStudies(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdStudy, fields, params, fetchFirstPage, '/impacting_ad_studies');
  }
  getInsights(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdsInsights, fields, params, fetchFirstPage, '/insights');
  }
  getInsightsAsync(fields, params = {}, pathOverride = null) {
    return this.createEdge('/insights', fields, params, AdReportRun, pathOverride);
  }
  getInstagramAccounts(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(InstagramUser, fields, params, fetchFirstPage, '/instagram_accounts');
  }
  getIosFourteenCampaignLimits(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountIosFourteenCampaignLimits, fields, params, fetchFirstPage, '/ios_fourteen_campaign_limits');
  }
  createManagedPartnerAd(fields, params = {}, pathOverride = null) {
    return this.createEdge('/managed_partner_ads', fields, params, null, pathOverride);
  }
  getMatchedSearchApplications(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountMatchedSearchApplicationsEdgeData, fields, params, fetchFirstPage, '/matched_search_applications');
  }
  getMaxBid(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountMaxBid, fields, params, fetchFirstPage, '/max_bid');
  }
  getMinimumBudgets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(MinimumBudget, fields, params, fetchFirstPage, '/minimum_budgets');
  }
  getOfflineConversionDataSets(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(OfflineConversionDataSet, fields, params, fetchFirstPage, '/offline_conversion_data_sets');
  }
  getOnBehalfRequests(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(BusinessOwnedObjectOnBehalfOfRequest, fields, params, fetchFirstPage, '/onbehalf_requests');
  }
  createProductAudience(fields, params = {}, pathOverride = null) {
    return this.createEdge('/product_audiences', fields, params, CustomAudience, pathOverride);
  }
  getPromotePages(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(Page, fields, params, fetchFirstPage, '/promote_pages');
  }
  getPublisherBlockLists(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(PublisherBlockList, fields, params, fetchFirstPage, '/publisher_block_lists');
  }
  createPublisherBlockList(fields, params = {}, pathOverride = null) {
    return this.createEdge('/publisher_block_lists', fields, params, PublisherBlockList, pathOverride);
  }
  getReachEstimate(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountReachEstimate, fields, params, fetchFirstPage, '/reachestimate');
  }
  getReachFrequencyPredictions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(ReachFrequencyPrediction, fields, params, fetchFirstPage, '/reachfrequencypredictions');
  }
  createReachFrequencyPrediction(fields, params = {}, pathOverride = null) {
    return this.createEdge('/reachfrequencypredictions', fields, params, ReachFrequencyPrediction, pathOverride);
  }
  getSavedAudiences(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(SavedAudience, fields, params, fetchFirstPage, '/saved_audiences');
  }
  deleteSubscribedApps(params = {}) {
    return super.deleteEdge('/subscribed_apps', params);
  }
  getSubscribedApps(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountSubscribedApps, fields, params, fetchFirstPage, '/subscribed_apps');
  }
  createSubscribedApp(fields, params = {}, pathOverride = null) {
    return this.createEdge('/subscribed_apps', fields, params, AdAccountSubscribedApps, pathOverride);
  }
  getTargetingBrowse(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountTargetingUnified, fields, params, fetchFirstPage, '/targetingbrowse');
  }
  getTargetingSearch(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountTargetingUnified, fields, params, fetchFirstPage, '/targetingsearch');
  }
  getTargetingSentenceLines(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(TargetingSentenceLine, fields, params, fetchFirstPage, '/targetingsentencelines');
  }
  getTargetingSuggestions(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountTargetingUnified, fields, params, fetchFirstPage, '/targetingsuggestions');
  }
  getTargetingValidation(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountTargetingUnified, fields, params, fetchFirstPage, '/targetingvalidation');
  }
  getTracking(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountTrackingData, fields, params, fetchFirstPage, '/tracking');
  }
  createTracking(fields, params = {}, pathOverride = null) {
    return this.createEdge('/tracking', fields, params, AdAccount, pathOverride);
  }
  getUsers(fields, params = {}, fetchFirstPage = true) {
    return this.getEdge(AdAccountUser, fields, params, fetchFirstPage, '/users');
  }
  deleteUsersOfAnyAudience(params = {}) {
    return super.deleteEdge('/usersofanyaudience', params);
  }
  get(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return this.read(fields, params);
  }

  // $FlowFixMe : Support Generic Types
  update(fields, params = {}) {
    // $FlowFixMe : Support Generic Types
    return super.update(params);
  }
}

export { AdAccount, FacebookAdsApi, User };
