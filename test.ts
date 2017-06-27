import { Bunq } from './index';
import fs = require('fs');
import path = require('path');
import NodeRsa = require('node-rsa');
const cwd = process.cwd();

interface IKeyPair {
    privateKey: NodeRsa.Key;
    publicKey: NodeRsa.Key;
}

let API_TOKEN;
try {
    API_TOKEN = fs.readFileSync(path.resolve(cwd, 'api_key')).toString();
} catch (e) {
    throw new Error('No API Key file named `api_key` is available in working directory');
}
/* To use production instead of sandbox for API calls
*   let bunq = new Bunq(API_TOKEN, 'https://api.bunq.com')
*/
let bunq = new Bunq(API_TOKEN);

const fileExists = (path: string) => fs.existsSync(path) ? true : false;

const saveData = (path: string, data: string) => fs.writeFileSync(path, data, 'utf8');

const getData = (path: string) => fs.readFileSync(path).toString();

/* Public and private keypair generation (Keypair should be in pkcs8 forrmat)
* The below code will generate an sha256(2048 bits) key pairs if one doesnt already exists
*
**/


const saveKeys = ({ privateKey, publicKey }: IKeyPair) => {
    saveData(path.resolve(cwd, 'private'), <string> privateKey);
    saveData(path.resolve(cwd, 'public'), <string> publicKey);
    return {
        privateKey,
        publicKey
    };
};

// saveKeys(Bunq.createKeyPair());

const getKeys = () => {
    if (fileExists(path.resolve(cwd, 'private')) && fileExists(path.resolve(cwd, 'public'))) {
        const privateKey: NodeRsa.Key = <NodeRsa.Key> getData(path.resolve(cwd, 'private'));
        const publicKey: NodeRsa.Key = <NodeRsa.Key> getData(path.resolve(cwd, 'public'));
        const keyPair: IKeyPair = {
            privateKey,
            publicKey
        };
        return keyPair;
    } else {
        throw new Error('Key pair not found');
    }
}
// create or retrieve keyPairs ;
// const createOrRetriveKeys = (callback: any) => {
//   getKeys() ? callback(null, getKeys()) : callback(null, saveKeys(Bunq.createKeyPair()));
// };

bunq.publicKey = getKeys().publicKey;
bunq.privateKey = getKeys().privateKey;
bunq.sessionToken = getData(path.resolve(cwd, 'session_token'));

const serverPublicKey = getData(path.resolve(cwd, 'server_public_key'));

bunq.user({
    method: Bunq.method.GET
}).then(
    (response) => console.log(response),
    (error) => console.log(error)
)

// bunq.installation({ method: 'GET' })
//     .then(
//         (response) => console.log('Response ', response), 
//         (error) => console.log(error)
//     );
