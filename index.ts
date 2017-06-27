import * as rp from 'request-promise';
import * as randomstring from 'randomstring';
import * as crypto from 'crypto';
import NodeRsa = require('node-rsa');

import { IInstallationOptions } from './models/installation-options';
import { IMethod } from './models/method';
import { IDeviceServerOptions } from './models/device-server';
import { IMonetaryAccountOptions } from './models/monetary-account';
import { IUserOptions } from './models/user-options';

const BUNQ_API_SERVICE_URL:string = 'https://sandbox.public.api.bunq.com';
const BUNQ_API_VERSION:string = 'v1';

export class Bunq {
    public static get method(): IMethod {
        const methods: IMethod = {
            GET: 'GET',
            POST: 'POST',
            DELETE: 'DELETE'
        }
        return methods;
    }

    private _privateKey: NodeRsa.Key;

	public get privateKey(): NodeRsa.Key {
		return this._privateKey;
	}

	public set privateKey(value: NodeRsa.Key) {
		this._privateKey = value;
	}

    private _publicKey: NodeRsa.Key;

	public get publicKey(): NodeRsa.Key {
		return this._publicKey;
	}

	public set publicKey(value: NodeRsa.Key) {
		this._publicKey = value;
	}

    private _sessionToken: string;

	public get sessionToken(): string {
		return this._sessionToken;
	}

	public set sessionToken(value: string) {
		this._sessionToken = value;
	}

    constructor(private apiKey: string, private bunqUrl: string = BUNQ_API_SERVICE_URL) {

    }

    /* 
    * Public and private keypair generation (Keypair should be in pkcs8 forrmat)
    * The below code will generate an sha256(2048 bits) key pair
    *
    **/
    public static createKeyPair() {
        let key = new NodeRsa();
        key.generateKeyPair(2048);
        const privateKey: NodeRsa.Key = key.exportKey('pkcs8-private-pem');
        const publicKey: NodeRsa.Key = key.exportKey('pkcs8-public-pem');
        return { 
            privateKey, 
            publicKey 
        }
    }

    private getDefaultOptions(): rp.OptionsWithUri {
        const defaultOptions: rp.OptionsWithUri = {
            uri: this.bunqUrl,
            headers: {
                'Cache-Control': 'no-cache',
                'User-Agent': 'bunq-TestSerdver/1.00 sandbox/0.17b',
                'X-Bunq-Language': 'en_US',
                'X-Bunq-Region': 'en_US',
                'X-Bunq-Geolocation': '0 0 0 00 NL',
                'X-Bunq-Client-Request-Id': randomstring.generate(7),
                'X-Bunq-Client-Authentication': this._sessionToken,
            },
            resolveWithFullResponse: true
        };
        return defaultOptions;
    }

    generateRequest(method: string, url: string, body?: any): rp.RequestPromise {
        let options: rp.OptionsWithUri = this.getDefaultOptions();
        options.uri = '/' + BUNQ_API_VERSION + url;

        if (body && method != 'GET') {
            options.body = JSON.stringify(body);
        }
        options.method = method;
        if(!!options.headers) {
            options.headers['X-Bunq-Client-Signature'] = this.signApiCall(options);
        }
        options.uri = this.bunqUrl + options.uri;
        return rp(options);
    }

    private signApiCall(options: rp.OptionsWithUri): string {
        let stringToSign: string = options.method + ' ';
        stringToSign += options.uri;
        stringToSign += '\n';

        // We need to order the headers
        const orderedHeaders: any = this.orderKeys(options.headers);
        Object.keys(orderedHeaders).forEach(function(key) {
        if ((key.indexOf('X-Bunq-') === 0) || key == 'Cache-Control' || key == 'User-Agent')
            stringToSign += key + ': ' + orderedHeaders[key] + '\n';
        });
        stringToSign += '\n';
        if (options.body) {
            stringToSign += options.body.toString();
        }

        const sign: crypto.Signer = crypto.createSign('sha256');
        sign.update(stringToSign);
        return sign.sign({
            key: <string> this.privateKey,
            passphrase: 'rabobank'
        }, 
        'base64');
    }

    private orderKeys(obj: any) {

        const keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
            if (k1 < k2) return -1;
            else if (k1 > k2) return +1;
            else return 0;
        });

        let i: number, after: any = {};
        for (i = 0; i < keys.length; i++) {
            after[keys[i]] = obj[keys[i]];
            delete obj[keys[i]];
        }

        for (i = 0; i < keys.length; i++) {
            obj[keys[i]] = after[keys[i]];
        }
        return obj;
    }

    public verifyResponse(response: any, serverPublicKey: string): boolean {
        let stringToVerify: string = response.statusCode + '\n';
        const signature: string = response.headers['x-bunq-server-signature'];
        // const orderedHeaders = this.orderKeys(response.headers);
        // Object.keys(orderedHeaders).forEach(function(key) {
        //   if (key.startsWith('x-bunq-') && key !== 'x-bunq-server-signature')
        //     stringToVerify += key + ': ' + orderedHeaders[key] + '\n';
        // });
        stringToVerify += 'X-Bunq-Client-Request-Id: ' + response.headers['x-bunq-client-request-id'] + '\n';
        stringToVerify += 'X-Bunq-Client-Response-Id: ' + response.headers['x-bunq-client-response-id'] + '\n';
        stringToVerify += '\n';
        stringToVerify += response.body.toString();
        const verify: crypto.Verify = crypto.createVerify('sha256');
        verify.update(stringToVerify);
        return verify.verify(serverPublicKey, signature, 'base64');
    }

    public parseResponse({ statusCode, headers, body } : any) {
        return {
            statusCode,
            headers,
            body
        };
    }

    public parseResponseBody(body: string) {
        return JSON.parse(body)['Response'];
    }

    public installation(options: IInstallationOptions): rp.RequestPromise {
        if(options.method === Bunq.method.POST) {
            return this.generateRequest(options.method, '/installation', {
                client_public_key: this.publicKey
            });
        } else if(options.method === Bunq.method.GET) {
            if(options.id) {
                return this.generateRequest(options.method, `/installation/${options.id}`);
            }
            return this.generateRequest(options.method, `/installation`);
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public installationServerPublicKey(options: IInstallationOptions): rp.RequestPromise {
        if(options.method === Bunq.method.GET) {
            return this.generateRequest(options.method, `/installation/${options.id}/server-public-key`);
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public device(options: IInstallationOptions): rp.RequestPromise {
        if(options.method === Bunq.method.GET) {
            if(options.id) {
                return this.generateRequest(options.method, `/device/${options.id}`);
            } 
            return this.generateRequest(options.method, `/device`);
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public deviceServer(options: IDeviceServerOptions): rp.RequestPromise {
        if(options.method === Bunq.method.POST) {
            // POST
            return this.generateRequest(options.method, `/device-server`, options.body || {});
        } else if(options.method === Bunq.method.GET) {
            if(options.id) {
                // GET
                return this.generateRequest(options.method, `/device-server/${options.id}`);
            }
            // LIST
            return this.generateRequest(options.method, `/device-server`);
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public sessionServer(options: IDeviceServerOptions): rp.RequestPromise {
        if(options.method === Bunq.method.POST) {
            // POST
            return this.generateRequest(options.method, `/session-server`, options.body || {});
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public user(options: IUserOptions): rp.RequestPromise {
        if(options.method === Bunq.method.GET) {
            if(options.id) {
                // GET
                return this.generateRequest(options.method, `/user/${options.id}`);
            }
            // LIST
            return this.generateRequest(options.method, `/user`);
        } else {
            throw new Error('Method not supported ' + options.method);
        }
    }

    public monetaryAccount(options: IMonetaryAccountOptions): rp.RequestPromise {
        if(options.method === Bunq.method.GET) {
            if(options.userId) {
                if(options.id) {
                        // GET
                        return this.generateRequest(options.method, `/user/${options.userId}/monetary-account/${options.id}`);
                }
                // LIST
                return this.generateRequest(options.method, `/user/${options.userId}/monetary-account`);
            } else {
                throw new Error('User Id is missing');
            }   
        } else {
            throw new Error('Method not supported ' + options.method);
        }           
    }
 }