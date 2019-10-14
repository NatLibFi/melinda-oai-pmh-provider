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
import {ERRORS, RESUMPTION_TOKEN_TIME_FORMAT} from './constants';
import ApiError from './api-error';

export function createLowFilter(value) {
	return createSubfieldValueFilter([{tag: 'LOW', code: /^a$/, value}]);
}

export function createLow020Filter(value) {
	return createSubfieldValueFilter([{tag: 'LOW', code: /^a$/, value}]);
}

export function createSidFilter(value) {
	return createSubfieldValueFilter([{tag: 'SID', code: /^a$/, value}]);
}

export function create960Filter(value) {
	return createSubfieldValueFilter([{tag: '960', code: /^a$/, value}]);
}

export function createLeaderFilter({start, end, value}) {
	return record => compareSubstring({
		start, end, value,
		context: record.leader
	});
}

export function createControlFieldFilter({tag, start, end, value}) {
	return record => {
		return record.get(tag).every(({value: context}) => compareSubstring({
			context, start, end, value
		}));
	};
}

export function createSubfieldValueFilter(conditions) {
	const pattern = getPattern();

	return record => {
		const fields = record.get(pattern);

		return conditions.every(({tag, code, value}) => {
			return fields.some(f => {
				return f.tag === tag && f.subfields.some(sf => {
					return sf.code === code && sf.value === value;
				});
			});
		});
	};

	function getPattern() {
		const str = conditions.map(({tag}) => tag).join('|');
		return new RegExp(`^(${str})$`);
	}
}

export function createHasFieldFilter(tag) {
	return record => record.get(tag).length > 0;
}

function compareSubstring({context, start, end, value}) {
	const chunk = context.substring(start, end + 1);
	return chunk === value;
}

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
	const [expirationTime, cursorString, metadataPrefix, from, until, set] = str.split(/;/g);
	const expires = moment(expirationTime, RESUMPTION_TOKEN_TIME_FORMAT, true);
	const cursor = Number(cursorString);

	if (expires.isValid() && moment().isBefore(expires) && Number.isNaN(cursor) === false) {
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
		} catch (err) {
			throw new ApiError({verb, code: ERRORS.BAD_RESUMPTION_TOKEN});
		}
	}
}
