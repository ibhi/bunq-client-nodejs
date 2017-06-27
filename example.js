const Bunq = require("./bunq");
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const randomstring = require('randomstring');
const NodeRsa = require('node-rsa');
const async = require('async');
// Get API Token from Bunq App or contact Bunq customer support to get one
let API_TOKEN;
try {
 API_TOKEN = fs.readFileSync(path.resolve(cwd, 'api_key')).toString();
} catch(e) {
  throw new Error('No API Key file named `api_key` is available in working directory');
}
/* To use production instead of sandbox for API calls
*   let bunq = new Bunq(API_TOKEN, 'https://api.bunq.com')
*/
let bunq = new Bunq(API_TOKEN);

const fileExists = (path) => fs.existsSync(path) ? true : false;

const saveData = (path, data) => fs.writeFileSync(path, data, 'utf8');

const getData = (path) => fs.readFileSync(path).toString();

/* Public and private keypair generation (Keypair should be in pkcs8 forrmat)
* The below code will generate an sha256(2048 bits) key pairs if one doesnt already exists
*
**/
const createKeyPairs = () => {
  let key = new NodeRsa();
  key.generateKeyPair(2048);
  const privateKey = key.exportKey('pkcs8-private-pem');
  const publicKey = key.exportKey('pkcs8-public-pem');
  return saveKeys(privateKey, publicKey);
};

const saveKeys = (privateKey, publicKey) => {
  saveData(path.resolve(cwd, 'private'), privateKey);
  saveData(path.resolve(cwd, 'public'), publicKey);
  return {
    privateKey,
    publicKey
  };
};

const getKeys = () => {
  if(fileExists(path.resolve(cwd, 'private')) && fileExists(path.resolve(cwd, 'public'))) {
    const privateKey = getData(path.resolve(cwd, 'private'));
    const publicKey = getData(path.resolve(cwd, 'public'));
    return {
      privateKey,
      publicKey
    };
  }
  return null;
}

const createOrRetriveKeys = (callback) => {
  getKeys() ? callback(null, getKeys()) : callback(null, createKeyPairs());
};

const retrieveInstallationToken = (privateKey, publicKey, callback) => {
  const installationToken = getData(path.resolve(cwd, 'installation_token'));
  const serverPublicKey = getData(path.resolve(cwd, 'server_public_key'));
  bunq.setPrivateKey(privateKey);
  bunq.setPublicKey(publicKey);
  callback(null, {
    installationToken,
    serverPublicKey
  });
};

const postInstallation = (callback) => {
  bunq.postInstallation().then(response => {
    const installationToken = response.token;
    const serverPublicKey = response.serverPublicKey;
    console.log('Inside post installation ', installationToken);
    saveData(path.resolve(cwd, 'installation_token'), installationToken);
    saveData(path.resolve(cwd, 'server_public_key'), serverPublicKey);
    callback(null, {
      installationToken,
      serverPublicKey
    });
  }, err => callback(err));
};

const postDeviceServer = ({ installationToken, serverPublicKey }, callback) => {
  bunq.postDeviceServer(installationToken, randomstring.generate(10))
    .then((response) => {
      if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
        console.log('Inside device server');
        callback(null, {
          installationToken,
          serverPublicKey
        });
      } else {
        callback(new Error('Response verification failed'));
      }
    }, (err) => callback(err));
};

const postInstallationAndDeviceServer = (privateKey, publicKey, callback) => {
  bunq.setPrivateKey(privateKey);
  bunq.setPublicKey(publicKey);
  async.waterfall([
    (cb) => {
      postInstallation(cb);
    },
    ({ installationToken, serverPublicKey }, cb) => {
      postDeviceServer({ installationToken, serverPublicKey }, cb);
    }
  ], (err, result) => {
    if(err) {
      callback(err);
    } else {
      callback(null, result);
    }
  });
};

const postOrRetriveInstallation = ({ privateKey, publicKey }, callback) => {
  if(fileExists(path.resolve(cwd, 'installation_token')) && fileExists(path.resolve(cwd, 'server_public_key'))) {
    retrieveInstallationToken(privateKey, publicKey, callback);
  } else {
    postInstallationAndDeviceServer(privateKey, publicKey, callback);
  }
};

const saveSessionToken = (sessionToken) => saveData(path.resolve(cwd, 'session_token'), sessionToken);

const createSession = ({ installationToken, serverPublicKey }, callback) => {
  bunq.postSessionServer(installationToken)
    .then((response) => {
      if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
        const sessionToken = bunq.parseResponseBody(bunq.parseResponse(response).body)[1]['Token']['token'];
        saveSessionToken(sessionToken);
        callback(null, { sessionToken, serverPublicKey });
      } else {
        callback(new Error('Response verification failed'));
      }
    }, (err) => callback(err));
}

const retrieveSessionToken = (serverPublicKey, callback) => {
  const sessionToken = getData(path.resolve(cwd, 'session_token'));
  sessionToken ? callback(null, { sessionToken, serverPublicKey }) : callback(new Error('No session token available'));
};

const createOrRetrieveSession = ({ installationToken, serverPublicKey }, callback) => {
  console.log('Inside create or retrieve session', installationToken);
  if(fileExists(path.resolve(cwd, 'session_token'))) {
    retrieveSessionToken(serverPublicKey, callback);
  } else {
    createSession({ installationToken, serverPublicKey }, callback);
  }
}

const getUser = ({ sessionToken, serverPublicKey }, callback) => {
  bunq.setSessionToken(sessionToken);
  bunq.getUser().then((response) => {
    if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
      console.log('User response verification successful');
      userId = bunq.parseResponseBody(bunq.parseResponse(response).body)[0]["UserCompany"]["id"];
      callback(null, { sessionToken, serverPublicKey, userId });
    } else {
        callback(new Error('Response verification failed'));
    }
  }, (err) => callback(err));
};

const getMonetaryAccount = ({ sessionToken, serverPublicKey, userId }, callback) => {
  bunq.setSessionToken(sessionToken);
  bunq.getMonetaryAccount(userId)
    .then((response) => {
      if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
        console.log('Monetary account verification successful');
        let firstAccount = bunq.parseResponseBody(bunq.parseResponse(response).body)[0]["MonetaryAccountBank"];
        console.log(firstAccount.balance.value + firstAccount.balance.currency);
        callback(null, { sessionToken, serverPublicKey, userId });
      } else {
        callback(new Error('Response verification failed'));
      }
    }, (err) => callback(err));
};

const getPermittedIp = ({ sessionToken, serverPublicKey, userId }, callback) => {
  bunq.setSessionToken(sessionToken);
  bunq.getPermittedIp(userId)
    .then((response) => {
      if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
        console.log('IP response verification successful');
        console.log(bunq.parseResponseBody(bunq.parseResponse(response).body));
        const ipId = bunq.parseResponseBody(bunq.parseResponse(response).body)[1]['CredentialPasswordIp']['id'];
        callback(null, { sessionToken, serverPublicKey, userId, ipId });
      } else {
        callback(new Error('Response verification failed'));
      }
    }, (err) => callback(err));
};

const postPermittedIp = (newIp) => (({ sessionToken, serverPublicKey, userId, ipId }, callback) => {
  console.log('Inside post permitted ip');
  bunq.setSessionToken(sessionToken);
  bunq.postPermittedIp(userId, ipId, newIp)
    .then((response) => {
      if(bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
        console.log('IP response verification successful');
        console.log(bunq.parseResponseBody(bunq.parseResponse(response).body));
        callback(null, { sessionToken, serverPublicKey, userId, ipId });
      } else {
        callback(new Error('Response verification failed'));
      }
    }, (err) => callback(err));
});

async.waterfall([
  createOrRetriveKeys,
  postOrRetriveInstallation,
  createOrRetrieveSession,
  getUser,
  getMonetaryAccount,
  getPermittedIp,
  // postPermittedIp('62.41.23.0')
], (err, result) => {
  console.log('Result ', result, err);
});
