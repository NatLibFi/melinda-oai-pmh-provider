const moment = require('moment');
const TOKEN_EXPIRATION_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
const key = 'yuKf7ly1xml33H5+fThvzhdY4XlFMJwQ';
const {Utils: {encryptString}} = require('@natlibfi/melinda-commons');
const resumptionTokenTimeout = 31536000000000;

const [metadataPrefix, cursor, from, until, set] = process.argv.slice(2);

const tokenExpirationTime = generateResumptionExpirationTime();
const value = generateValue();
const token = encryptString({key, value, algorithm: 'aes-256-cbc'});

console.log(encodeURIComponent(token));
console.log(token);
console.log(tokenExpirationTime.format('YYYY-MM-DDTHH:mm:ss[Z]'));

function generateResumptionExpirationTime() {
    return moment().add(1000, 'milliseconds');
}

function generateValue() {
    const time = tokenExpirationTime.format(TOKEN_EXPIRATION_FORMAT);
    return `${time};${cursor};${metadataPrefix};${from || ''};${until || ''};${set || ''}`;
}