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
* limitations under the License.
*/

import startApp from './app';
import {
	HTTP_PORT as httpPort,
	ENABLE_PROXY as enableProxy,
	INSTANCE_URL as instanceUrl,
	SUPPORT_EMAIL as supportEmail,
	SECRET_ENCRYPTION_KEY as secretEncryptionKey,
	RESUMPTION_TOKEN_TIMEOUT as resumptionTokenTimeout,
	OAI_IDENTIFIER_PREFIX as identifierPrefix,
	MAX_RESULTS as maxResults,
	ORACLE_USERNAME as oracleUsername,
	ORACLE_PASSWORD as oraclePassword,
	ORACLE_CONNECT_STRING as oracleConnectString,
	ALEPH_LIBRARY as alephLibrary
} from './config';

run();

async function run() {
	process.on('SIGTERM', handleSignal);
	process.on('SIGINT', handleSignal);

	process.on('uncaughtException', async err => {
		handleTermination({code: 1, message: err.stack});
	});

	process.on('unhandledRejection', async err => {
		handleTermination({code: 1, message: err.stack});
	});

	const server = await startApp({
		enableProxy, supportEmail,
		httpPort, secretEncryptionKey, instanceUrl,
		identifierPrefix, resumptionTokenTimeout, maxResults,
		oracleUsername, oraclePassword, oracleConnectString,
		alephLibrary
	});

	function handleTermination({code = 0, message}) {
		if (server) {
			server.close();
		}

		if (message) {
			console.error(message);
		}

		process.exit(code);
	}

	function handleSignal(signal) {
		handleTermination({code: 1, message: `Received ${signal}`});
	}
}
