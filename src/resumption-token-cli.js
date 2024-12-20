/* eslint-disable no-console */
import {parseResumptionToken, generateResumptionToken} from './common';

run();

function run() {
  const {SECRET_ENCRYPTION_KEY: secretEncryptionKey, RESUMPTION_TOKEN_TIMEOUT: resumptionTokenTimeout} = process.env; // eslint-disable-line no-process-env
  const [op, ...args] = process.argv.slice(2);
  // eslint-disable-next-line no-console
  console.log(process.argv);
  console.log(op);
  console.log(JSON.stringify(args));

  if (op === undefined) {
    console.error('Missing params!'); // eslint-disable-line no-console
    return process.exit(1); // eslint-disable-line no-process-exit
  }

  if (op === '-e') {
    const params = getParams();

    const {token, tokenExpirationTime} = generateResumptionToken({
      secretEncryptionKey, resumptionTokenTimeout,
      ...params
    });

    console.log(tokenExpirationTime); // eslint-disable-line no-console
    console.log(token); // eslint-disable-line no-console
    return process.exit(); // eslint-disable-line no-process-exit
  }

  if (op === '-d') {
    const token = decodeURIComponent(args[0]);
    const params = parseResumptionToken({secretEncryptionKey, token, ignoreError: true});

    console.log(params); // eslint-disable-line no-console
    return process.exit(); // eslint-disable-line no-process-exit
  }

  console.error('Invalid op!'); // eslint-disable-line no-console
  process.exit(1); // eslint-disable-line no-process-exit

  function getParams() {
    return args
      .map(str => str.split(/[=]/u))
      .reduce((acc, [key, value]) => ({...acc, [key]: value}), {});
  }
}
