/* eslint-disable no-console */
import {parseResumptionToken, generateResumptionToken} from './common.js';

run();

function run() {
  const {SECRET_ENCRYPTION_KEY: secretEncryptionKey, RESUMPTION_TOKEN_TIMEOUT: resumptionTokenTimeout} = process.env; // eslint-disable-line no-process-env
  const [op, ...args] = process.argv.slice(2);
  console.log(process.argv);
  console.log(op);
  console.log(JSON.stringify(args));

  if (op === undefined) {
    console.error('Missing params!');
    return process.exit(1);
  }

  if (op === '-e') {
    const params = getParams();

    const {token, tokenExpirationTime} = generateResumptionToken({
      secretEncryptionKey, resumptionTokenTimeout,
      ...params
    });

    console.log(tokenExpirationTime);
    console.log(token);
    return process.exit();
  }

  if (op === '-d') {
    const token = decodeURIComponent(args[0]);
    const params = parseResumptionToken({secretEncryptionKey, token, ignoreError: true});

    console.log(params);
    return process.exit();
  }

  console.error('Invalid op!');
  process.exit(1);

  function getParams() {
    return args
      .map(str => str.split(/[=]/u))
      .reduce((acc, [key, value]) => ({...acc, [key]: value}), {});
  }
}
