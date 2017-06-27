// Credits to https://github.com/c0dr/bunq

const rp = require('request-promise');
const randomstring = require('randomstring');
const crypto = require('crypto');


const BUNQ_API_SERVICE_URL = 'https://sandbox.public.api.bunq.com';
const BUNQ_API_VERSION = 'v1';

class Bunq {
  
  constructor(apiKey, bunqUrl, privateKey, publicKey) {
    this.apiKey = apiKey;
    this.bunqUrl = bunqUrl ? bunqUrl : BUNQ_API_SERVICE_URL;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  getDefaultOptions() {
    return {
      uri: this.bunqUrl,
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': 'bunq-TestSerdver/1.00 sandbox/0.17b',
        'X-Bunq-Language': 'en_US',
        'X-Bunq-Region': 'en_US',
        'X-Bunq-Geolocation': '0 0 0 00 NL',
        'X-Bunq-Client-Request-Id': randomstring.generate(7),
        'X-Bunq-Client-Authentication': this.sessionToken,
      },
      resolveWithFullResponse: true
    };
  }
  generateRequest(method, url, body) {
    let options = this.getDefaultOptions();
    options.uri = '/' + BUNQ_API_VERSION + url;

    if (body && method != 'GET') {
      options.body = JSON.stringify(body);
    }
    options.method = method;
    options.headers['X-Bunq-Client-Signature'] = this.signApiCall(options);
    options.uri = this.bunqUrl + options.uri;
    return rp(options);
  }

  setPublicKey(key) {
    this.publicKey = key;
  }
  
  setPrivateKey(key) {
    this.privateKey = key;
  }

  postInstallation() {
    return new Promise((resolve, reject) => {
      this.generateRequest('POST', '/installation', {
        client_public_key: this.publicKey
      })
      .then((response) => {
        let body = this.parseResponseBody(this.parseResponse(response).body);
        let token = body[1]['Token']['token'];
        let serverPublicKey = body[2]['ServerPublicKey']['server_public_key'];
        resolve({
          token,
          serverPublicKey
        });
      })
      .catch((error) => reject(error));
    });
  }

  postDeviceServer(installationToken, description) {
    this.sessionToken = installationToken;
    return this.generateRequest('POST', '/device-server', {
      secret: this.apiKey,
      description: description
    });
  }

  getDeviceServers() {
    return this.generateRequest('GET', '/device-server');
  }

  postPermittedIp(userId, ipId, newIp) {
    // this.sessionToken = sessionToken;
    return this.generateRequest('POST', `/user/${userId}/credential-password-ip/${ipId}/ip`, {
      ip: newIp,
      status: 'ACTIVE'
    });
  }

  getPermittedIp(userId) {
    return this.generateRequest('GET', `/user/${userId}/credential-password-ip`);
  }


  postSessionServer(installationToken) {
    this.sessionToken = installationToken;
    return this.generateRequest('POST', '/session-server', {
      secret: this.apiKey
    });
  }

  getUser(userId) {
    const urlWithParameter = userId ? `/user/${userId}` : '/user';
    return this.generateRequest('GET', urlWithParameter);
  }

  getMonetaryAccount(userId, accountId) {
    const urlWithParameter = accountId ? `/user/${userId}/monetary-account/${accountId}` : `/user/${userId}/monetary-account`;
    return this.generateRequest('GET', urlWithParameter);
  }

//   initSession() {
//     return new Promise((resolve, reject) => {
//       this.postSessionServer().then((response) => {
//         this.sessionToken = JSON.parse(response).Response[1]['Token']['token']
//         resolve();
//       }).catch((error) => {
//         reject(error);
//       })
//     })
//   }
  /* 
  *  To get session token we have to do the following steps in sequence 
  *  (All the below request headers and body has to be signed and sent in `X-Bunq-Client-Signature` header)
  *  1. Do a `POST` request to `/installation` endpoint with the public key in body
  *    a. Store the installation token and server public key from the response
  *  2. Do a `POST` request to `/device-server` endpoint by setting `X-Bunq-Client-Authentication` 
  *  header with the installation token value we recieved from step 1 and api key(secret) and description in body
  *  3. Do a `POST` request to `/session-server`endpoint by setting `X-Bunq-Client-Authentication` 
  *  header with the installation token value we recieved from step 1 and api key(secret) in body
  *    a. Store session token from response. This token has to be used in `X-Bunq-Client-Authentication` header for further requests
  *  
  **/
  initSession() {
    let installationToken, serverPublicKey;
    return new Promise((resolve, reject) => {
        this.postInstallation().then((response) => {
            response = this.parseResponse(response);
            this.sessionToken = response[1]['Token']['token'];
            serverPublicKey = response[2]['ServerPublicKey']['server_public_key'];
            return this.postDeviceServer('this is a test');
        }).then(() => {
          this.postSessionServer().then((response) => {
            this.sessionToken = JSON.parse(response).Response[1]['Token']['token']
            resolve();
          }).catch((error) => {
            reject(error);
          })
        });
    });
  }

  setSessionToken(sessionToken) {
      this.sessionToken = sessionToken;
  }

  signApiCall(options) {
    let stringToSign = options.method + ' ';
    stringToSign += options.uri;
    stringToSign += '\n';

    // We need to order the headers
    const orderedHeaders = this.orderKeys(options.headers);
    Object.keys(orderedHeaders).forEach(function(key) {
      if (key.startsWith('X-Bunq-') || key == 'Cache-Control' || key == 'User-Agent')
        stringToSign += key + ': ' + orderedHeaders[key] + '\n';
    });
    stringToSign += '\n';
    if (options.body) {
      stringToSign += options.body.toString();
    }

    const sign = crypto.createSign('sha256');
    sign.update(stringToSign);
    return sign.sign({
      key: this.privateKey,
      passphrase: 'rabobank'
    }, 'base64');
  }

  verifyResponse(response, serverPublicKey) {
    let stringToVerify = response.statusCode + '\n';
    const signature = response.headers['x-bunq-server-signature'];
    // const orderedHeaders = this.orderKeys(response.headers);
    // Object.keys(orderedHeaders).forEach(function(key) {
    //   if (key.startsWith('x-bunq-') && key !== 'x-bunq-server-signature')
    //     stringToVerify += key + ': ' + orderedHeaders[key] + '\n';
    // });
    stringToVerify += 'X-Bunq-Client-Request-Id: ' + response.headers['x-bunq-client-request-id'] + '\n';
    stringToVerify += 'X-Bunq-Client-Response-Id: ' + response.headers['x-bunq-client-response-id'] + '\n';
    stringToVerify += '\n';
    stringToVerify += response.body.toString();
    // console.log(stringToVerify);
    const verify = crypto.createVerify('sha256');
    verify.update(stringToVerify);
    return verify.verify(serverPublicKey, signature, 'base64');
  }

  // credit to http://stackoverflow.com/questions/9658690/is-there-a-way-to-sort-order-keys-in-javascript-objects
  orderKeys(obj, expected) {

    var keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
      if (k1 < k2) return -1;
      else if (k1 > k2) return +1;
      else return 0;
    });

    var i, after = {};
    for (i = 0; i < keys.length; i++) {
      after[keys[i]] = obj[keys[i]];
      delete obj[keys[i]];
    }

    for (i = 0; i < keys.length; i++) {
      obj[keys[i]] = after[keys[i]];
    }
    return obj;
  }

  parseResponse(response) {
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body
    };
  }
  parseResponseBody(body) {
    return JSON.parse(body)['Response'];
  }

}
module.exports = Bunq;