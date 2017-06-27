import { Bunq } from '../index';
import fs = require('fs');
import path = require('path');
import NodeRsa = require('node-rsa');
import dotenv = require('dotenv');
import async = require('async');
import randomstring = require('randomstring');

const cwd = process.cwd();

// Load environment variables
dotenv.config();

// Interface definition for key pair
interface IKeyPair {
    privateKey: NodeRsa.Key;
    publicKey: NodeRsa.Key;
}

// Util methods for file handling
const fileExists = (path: string) => fs.existsSync(path) ? true : false;
const saveData = (path: string, data: string) => fs.writeFileSync(path, data, 'utf8');
const getData = (path: string) => {
    if (fileExists(path)) {
        return fs.readFileSync(path).toString();
    } else {
        throw new Error(`File doesn't exist at ${path}`);
    }
}

// Util method for writing provided private and public keys to respective files
const saveKeys = ({ privateKey, publicKey }: IKeyPair) => {
    saveData(path.resolve(cwd, 'private'), <string>privateKey);
    saveData(path.resolve(cwd, 'public'), <string>publicKey);
    return {
        privateKey,
        publicKey
    };
};

// Uncomment the below method to create a private public key pair and store it in respective files
// saveKeys(Bunq.createKeyPair());

// Util method for retrieving key pair from respective files
const getKeys = () => {
    if (fileExists(path.resolve(cwd, 'private')) && fileExists(path.resolve(cwd, 'public'))) {
        const privateKey: NodeRsa.Key = <NodeRsa.Key>getData(path.resolve(cwd, 'private'));
        const publicKey: NodeRsa.Key = <NodeRsa.Key>getData(path.resolve(cwd, 'public'));
        const keyPair: IKeyPair = {
            privateKey,
            publicKey
        };
        return keyPair;
    } else {
        throw new Error('Key pair not found');
    }
}

const keyPair = getKeys();

// Instantiate bunq client
const bunq = new Bunq(process.env.BUNQ_API_KEY);
// Set public and private keys to bunq client instance
bunq.publicKey = keyPair.publicKey;
bunq.privateKey = keyPair.privateKey;

// Uncomment below lines if you want to the installation
// Do bunq installation and store installation token and server public key in respective file
// bunq.installation({ method: Bunq.method.POST })
//     .then((response) => {
//         let body = bunq.parseResponseBody(bunq.parseResponse(response).body);
//         let installationToken = body[1]['Token']['token'];
//         let serverPublicKey = body[2]['ServerPublicKey']['server_public_key'];
//         console.log('Installation token ', installationToken);
//         saveData(path.resolve(cwd, 'installation_token'), installationToken);
//         saveData(path.resolve(cwd, 'server_public_key'), serverPublicKey);
//     })
//     .catch((error) => {
//         console.log(error);
//     });

const installationToken = getData(path.resolve(cwd, 'installation_token'));
const serverPublicKey = getData(path.resolve(cwd, 'server_public_key'));

// Do bunq device server and initialize session
// bunq.deviceServer({ 
//     method: Bunq.method.POST,
//     installationToken: installationToken,
//     body: {
//         description: randomstring.generate(10),
//         secret: process.env.BUNQ_API_KEY
//     }
// })
//     .then((response) => {
//         if (bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
//             console.log('Device server registration successful', response.body);
//         } else {
//             throw new Error('Response verification failed');
//         }
//     })
//     .catch((error) => console.log(error));

// Do bunq session establishment
bunq.sessionServer({
    method: Bunq.method.POST,
    installationToken: installationToken,
    body: {
        secret: process.env.BUNQ_API_KEY
    }
})
    .then((response) => {
        if (bunq.verifyResponse(bunq.parseResponse(response), serverPublicKey)) {
            console.log('Device server registration successful', response.body);
        } else {
            throw new Error('Response verification failed');
        }
    })
    .catch((error) => console.log(error));
