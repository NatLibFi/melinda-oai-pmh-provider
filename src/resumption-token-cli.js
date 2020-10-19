/**
* Copyright 2019-2020 University Of Helsinki (The National Library Of Finland)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.a
*/

import {parseResumptionToken, generateResumptionToken} from './common';

run();

function run() {
  const {SECRET_ENCRYPTION_KEY: secretEncryptionKey, RESUMPTION_TOKEN_TIMEOUT: resumptionTokenTimeout} = process.env; // eslint-disable-line no-process-env
  const [op, ...args] = process.argv.slice(2);

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
