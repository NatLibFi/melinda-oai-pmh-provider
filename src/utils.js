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

import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import {ERRORS, RESUMPTION_TOKEN_TIME_FORMAT} from './app/constants';
import ApiError from './api-error';

export function generateResumptionToken({
	secretEncryptionKey, resumptionTokenTimeout,
	cursor, metadataPrefix, from, until, set
}) {
	const {encryptString} = Utils;
	const tokenExpirationTime = generateResumptionExpirationTime();
	const value = generateValue();
	const token = encryptString({key: secretEncryptionKey, value, algorithm: 'aes-256-cbc'});

	return {token, tokenExpirationTime};

	function generateResumptionExpirationTime() {
		return moment().add(resumptionTokenTimeout, 'milliseconds');
	}

	function generateValue() {
		const expirationTime = tokenExpirationTime.format(RESUMPTION_TOKEN_TIME_FORMAT);

		return `${expirationTime};${cursor};${metadataPrefix};${from ? from.format(RESUMPTION_TOKEN_TIME_FORMAT) : ''};${until ? until.format(RESUMPTION_TOKEN_TIME_FORMAT) : ''};${set || ''}`;
	}
}

export function parseResumptionToken({secretEncryptionKey, verb, token, ignoreError = false}) {
	const {decryptString} = Utils;
	const str = decryptToken();
	const [expirationTime, cursor, metadataPrefix, from, until, set] = str.split(/;/g);
	const expires = moment(expirationTime, RESUMPTION_TOKEN_TIME_FORMAT, true);

	if (expires.isValid() && moment().isBefore(expires)) {
		return {cursor, metadataPrefix, set, from, until};
	}

	if (ignoreError) {
		return {cursor, metadataPrefix, set, from, until};
	}

	throw new ApiError({verb, code: ERRORS.BAD_RESUMPTION_TOKEN});

	function decryptToken() {
		try {
			const decoded = decodeURIComponent(token);
			return decryptString({key: secretEncryptionKey, value: decoded, algorithm: 'aes-256-cbc'});
		} catch (_) {
			throw new ApiError({verb, code: ERRORS.BAD_RESUMPTION_TOKEN});
		}
	}
}
