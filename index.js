const Promise = require('bluebird');
const { writeFileSync } = require('fs');
const { MongoClient } = require('mongodb');

let accounts = null;
let featuresPerAccount = [];

async function initMongoClients() {
    console.log('Connecting to db...');
    const [apiClient] = await Promise.all([
        MongoClient.connect(process.env.MONGO_URI, { promiseLibrary: Promise, useNewUrlParser: true, useUnifiedTopology: true  }),
    ]);

    accounts = apiClient.db().collection('accounts');
    console.log('Connected to db.');
}

async function getFFconfigForAccounts() {
    const errors = [];
    const accountsCursor = accounts.find().project({ _id: 1, name: 1, features: 1 });
    let curAccount;
    let counter = 0;

    while ((curAccount = await accountsCursor.next())) {
        try {
           const accountFeatures = {
               name: curAccount.name,
               features: curAccount.features
           }
            featuresPerAccount.push(accountFeatures)
            counter+=1;
        } catch (err) {
            console.error(`failed to get account "${curAccount.name}": ${JSON.stringify(err)}`);
            errors.push({
                account: { id: curAccount._id.toString(), name: curAccount.name },
                cause: err
            });
        }
    }

    console.log(`finished! ${counter} accounts`);
    console.log(`had ${errors.length} errors!`)

    if (featuresPerAccount) {
        const filename = './report.json';
        writeFileSync(filename, JSON.stringify(featuresPerAccount));
    }

    if (errors.length) {
        const filename = './report.json';
        writeFileSync(filename, JSON.stringify(errors));
        console.log(`written errors to file "${filename}"!`);
    }
}

async function run() {
    await initMongoClients();
    await getFFconfigForAccounts();
    process.exit(0);
}

run()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
