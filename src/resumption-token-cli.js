/**
* Copyright 2019 University Of Helsinki (The National Library Of Finland)
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

import {
	SECRET_ENCRYPTION_KEY as secretEncryptionKey,
	RESUMPTION_TOKEN_TIMEOUT as resumptionTokenTimeout
} from './config';

import {parseResumptionToken, generateResumptionToken} from './utils';

const [op, ...args] = process.argv.slice(2);

if (op === undefined) {
	console.error('Missing params!');
	process.exit(1);
}

if (op === '-e') {
	const params = getParams();

	const {token, tokenExpirationTime} = generateResumptionToken({
		secretEncryptionKey, resumptionTokenTimeout,
		...params
	});

	console.log(tokenExpirationTime);
	console.log(token);
	process.exit();
}

if (op === '-d') {
	const token = decodeURIComponent(args[0]);
	const params = parseResumptionToken({secretEncryptionKey, token, ignoreError: true});

	console.log(params);
	process.exit();
}

console.error('Invalid op!');
process.exit(1);

function getParams() {
	return args
		.map(str => {
			return str.split(/[=]/);
		})
		.reduce((acc, [key, value]) => {
			return {...acc, [key]: value};
		}, {});
}
