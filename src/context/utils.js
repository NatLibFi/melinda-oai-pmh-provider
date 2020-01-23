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

import {MarcRecord} from '@natlibfi/marc-record';
import {readFileSync} from 'fs';

export function readSetsFile(setsFile) {
	const str = readFileSync(setsFile, 'utf8');
	return JSON.parse(str);
}

export function stripPrivateFields(record) {
	const newRecord = MarcRecord.clone(record);
	newRecord.get(/^CAT$/).forEach(f => newRecord.removeField(f));
	return newRecord;
}

export function formatBib(params) {
	const prefixReplaceCodes = ['w'];
	const nonStandardSubfields = [
		{tagPattern: /.*/, codes: ['9']}
	];

	return formatRecord({
		...params,
		prefixReplaceCodes,
		nonStandardSubfields
	});
}

export function formatAut(params) {
	const prefixReplaceCodes = ['0', '1'];
	const nonStandardSubfields = [
		{tagPattern: /.*/, codes: ['9']},
		{tagPattern: /^1../, codes: ['0', '2']},
		{tagPattern: /^4../, codes: ['0', '2', '7']},
		{tagPattern: /^5../, codes: ['2']}
	];

	return formatRecord({
		...params,
		prefixReplaceCodes,
		nonStandardSubfields
	});
}

export function formatRecord({
	record, id, metadataPrefix,
	oldPrefix, newPrefix,
	prefixReplaceCodes,
	nonStandardSubfields
}) {
	const newRecord = MarcRecord.clone(record);

	formatAleph();
	replacePrefixes();

	return metadataPrefix === 'melinda_marc' ? newRecord : formatStandard();

	function formatAleph() {
		handle003();
		handle035();

		function handle003() {
			newRecord.insertField({
				tag: '003',
				value: newPrefix
			});
		}

		function handle035() {
			removeExisting();

			newRecord.insertField({
				tag: '035',
				ind1: ' ',
				ind2: ' ',
				subfields: [{
					code: 'a',
					value: `(${newPrefix})${id}`
				}]
			});

			function removeExisting() {
				newRecord.get(/^035$/)
					.filter(prefixFilter)
					.forEach(f => newRecord.removeField(f));

				function prefixFilter(field) {
					return field.subfields.some(({code, value}) => {
						return code === 'a' && new RegExp(`^\(${newPrefix}\)`).test(value); // eslint-disable-line no-useless-escape
					});
				}
			}
		}
	}

	function formatStandard() {
		removeFields();
		removeSubfields();

		return newRecord;

		function removeFields() {
			// Remove all fields with non-numeric tags
			newRecord.get(/[^0-9]+/).forEach(f => newRecord.removeField(f));
		}

		function removeSubfields() {
			nonStandardSubfields.forEach(({tagPattern, codes}) => {
				return newRecord.getDatafields()
					.filter(({tag}) => tagPattern.test(tag))
					.forEach(field => {
						field.subfields
							.filter(({code}) => codes.includes(code))
							.forEach(sf => newRecord.removeSubfield(sf, field));
					});
			});
		}
	}

	// Replace prefix in all specified subfields
	function replacePrefixes() {
		newRecord.getDatafields()
			.forEach(field => {
				field.subfields
					.filter(({code}) => prefixReplaceCodes.includes(code))
					.forEach(subfield => {
						const pattern = `(${oldPrefix})`;
						const replacement = `(${newPrefix})`;
						subfield.value = subfield.value.replace(pattern, replacement);
					});
			});
	}
}
