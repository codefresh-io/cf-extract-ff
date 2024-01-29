import { writeFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { Parser } from '@json2csv/plainjs';

const fields = new Set(['name']);

console.log('Connecting to db...');
const apiClient = await MongoClient.connect(process.env.MONGO_URI);

const accounts = apiClient.db().collection('accounts');
console.log('Connected to db.');


async function getFFconfigForAccounts() {
    const featuresPerAccount = [];
    const errors = [];
    const accountsCursor = accounts
        .find()
        .project({ _id: 1, name: 1, features: 1 });
    let curAccount;
    let counter = 0;

    while ((curAccount = await accountsCursor.next())) {
        try {
            const accountFeatures = {
                name: curAccount.name,
            };
            curAccount.features &&
                Object.entries(curAccount.features).forEach(([key, value]) => {
                    accountFeatures[key] = value;
                    fields.add(key);
                });
            featuresPerAccount.push(accountFeatures);
            counter += 1;
        } catch (err) {
            console.error(
                `failed to get account "${curAccount.name}": ${JSON.stringify(err)}`
            );
            errors.push({
                account: { id: curAccount._id.toString(), name: curAccount.name },
                cause: err,
            });
        }
    }

    console.log(`finished! ${counter} accounts`);
    console.log(`had ${errors.length} errors!`);

    const opts = { fields: [...fields.values()] };

    if (featuresPerAccount.length) {
        const filename = './report.csv';
        const parser = new Parser(opts);
        const csv = parser.parse(featuresPerAccount);
        await writeFile(filename, csv);
    }

    if (errors.length) {
        const filename = './errors.json';
        await writeFile(filename, JSON.stringify(errors));
        console.log(`written errors to file "${filename}"!`);
    }
}

try {
    await getFFconfigForAccounts();
} catch (error) {
    console.error(err);
    process.exit(1);
} finally {
    console.log('Closing db connection...');
    await apiClient.close();
}
